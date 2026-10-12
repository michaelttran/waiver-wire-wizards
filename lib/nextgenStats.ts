import { gunzipSync } from "node:zlib";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import type { SleeperPlayersMap } from "@/lib/sleeper";
import { normalizePlayerName } from "@/lib/playerGrades";

// Adds NFL Next Gen Stats receiving metrics (separation, cushion, air yards
// share, YAC above expectation) on top of the WeeklyPlayerStat rows the
// Sleeper-based sync already created — see lib/sleeper.ts. These are WR/TE
// only; NGS's public receiving leaderboard doesn't cover RB or QB.
//
// nflverse republishes NFL's own Next Gen Stats as a public CSV, refreshed
// during the season (unlike nflverse's play-by-play *participation* data,
// which only finalizes after a season ends — that's why this site doesn't
// attempt route participation: see the note on /data).
const NGS_RECEIVING_URL =
  "https://github.com/nflverse/nflverse-data/releases/download/nextgen_stats/ngs_receiving.csv.gz";

type NgsUpdate = {
  sleeperPlayerId: string;
  week: number;
  avgCushion: number | null;
  avgSeparation: number | null;
  airYardsSharePct: number | null;
  yacAboveExpectation: number | null;
};

function num(v: string | undefined): number | null {
  if (!v || v === "NA") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function round1(v: number | null): number | null {
  return v === null ? null : Math.round(v * 10) / 10;
}

// Minimal CSV parser — safe here only because nflverse's ngs_receiving export
// has no quoted or comma-containing fields (verified against the live file;
// every column is a plain number, position code, or name with no commas).
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split("\n").filter((l) => l.length > 0);
  const header = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
}

// Returns the number of player-weeks updated. Throws on a genuine fetch/parse
// failure; the caller treats this sync as best-effort, same as ADP.
export async function syncNextGenReceiving(
  season: string,
  players: SleeperPlayersMap
): Promise<number> {
  const res = await fetch(NGS_RECEIVING_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`nflverse NGS receiving request failed (${res.status})`);
  const gzipped = Buffer.from(await res.arrayBuffer());
  const csvText = gunzipSync(gzipped).toString("utf8");
  const rows = parseCsv(csvText);

  // GSIS id is the reliable join key when it's there, but Sleeper's player
  // list has real gaps in it (e.g. Jaylen Waddle's own Sleeper record has a
  // null gsis_id) — so this falls back to normalized name+position, and
  // name+position+team when that's ambiguous, rather than silently losing
  // those players' NGS columns.
  const sleeperIdByGsisId = new Map<string, string>();
  const sleeperIdByNamePos = new Map<string, string>();
  const sleeperIdByNamePosTeam = new Map<string, string>();
  for (const [sleeperId, player] of Object.entries(players)) {
    if (player.gsis_id) sleeperIdByGsisId.set(player.gsis_id, sleeperId);

    const fullName = player.full_name || `${player.first_name ?? ""} ${player.last_name ?? ""}`.trim();
    if (!fullName || !player.position) continue;
    const nameKey = `${normalizePlayerName(fullName)}|${player.position}`;
    sleeperIdByNamePos.set(nameKey, sleeperId);
    if (player.team) sleeperIdByNamePosTeam.set(`${nameKey}|${player.team}`, sleeperId);
  }

  function resolveSleeperId(row: Record<string, string>): string | undefined {
    const byGsis = sleeperIdByGsisId.get(row.player_gsis_id);
    if (byGsis) return byGsis;
    const nameKey = `${normalizePlayerName(row.player_display_name)}|${row.player_position}`;
    return sleeperIdByNamePosTeam.get(`${nameKey}|${row.team_abbr}`) ?? sleeperIdByNamePos.get(nameKey);
  }

  const updates: NgsUpdate[] = [];
  for (const row of rows) {
    if (row.season !== season || row.season_type !== "REG") continue;
    // NGS includes a week-0 row per player that's a running season-to-date
    // aggregate, not a game week — no WeeklyPlayerStat row ever has week 0,
    // so this would no-op anyway, but skip it explicitly rather than rely
    // on that.
    if (row.week === "0") continue;
    const sleeperPlayerId = resolveSleeperId(row);
    if (!sleeperPlayerId) continue; // no Sleeper match at all — e.g. a practice-squad call-up Sleeper hasn't indexed yet

    updates.push({
      sleeperPlayerId,
      week: Number(row.week),
      avgCushion: round1(num(row.avg_cushion)),
      avgSeparation: round1(num(row.avg_separation)),
      airYardsSharePct: round1(num(row.percent_share_of_intended_air_yards)),
      yacAboveExpectation: round1(num(row.avg_yac_above_expectation)),
    });
  }

  if (updates.length === 0) return 0;

  // Bulk UPDATE...FROM (VALUES ...) against rows the Sleeper sync already
  // created — this never inserts rows on its own, so a player NGS doesn't
  // recognize (or a week WeeklyPlayerStat doesn't have yet) just no-ops.
  const values = updates.map(
    (u) => Prisma.sql`(
      ${u.sleeperPlayerId}::text, ${season}::text, ${u.week}::int,
      ${u.avgCushion}::float8, ${u.avgSeparation}::float8,
      ${u.airYardsSharePct}::float8, ${u.yacAboveExpectation}::float8
    )`
  );

  await prisma.$executeRaw`
    UPDATE "WeeklyPlayerStat" AS w
    SET
      "avgCushion" = v.avg_cushion,
      "avgSeparation" = v.avg_separation,
      "airYardsSharePct" = v.air_yards_share_pct,
      "yacAboveExpectation" = v.yac_above_expectation
    FROM (VALUES ${Prisma.join(values)}) AS v(
      sleeper_player_id, season, week,
      avg_cushion, avg_separation, air_yards_share_pct, yac_above_expectation
    )
    WHERE w."sleeperPlayerId" = v.sleeper_player_id
      AND w."season" = v.season
      AND w."week" = v.week
  `;

  return updates.length;
}
