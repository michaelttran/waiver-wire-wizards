import { randomUUID } from "node:crypto";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { VALUE_POSITIONS } from "@/lib/fpor";
import { snapshotMarketAdp } from "@/lib/marketAdp";
import { syncNextGenReceiving } from "@/lib/nextgenStats";
import { getScheduleMap, type GameInfo } from "@/lib/schedule";

const SLEEPER_API = "https://api.sleeper.app/v1";

type SleeperLeague = {
  season: string;
  total_rosters: number;
  scoring_settings: Record<string, number>;
};

type SleeperNflState = {
  season: string;
  season_type: string; // "pre" | "regular" | "post" | "off"
  week: number;
};

type SleeperWeekStats = Record<string, Record<string, number>>;

type SleeperUser = {
  user_id: string;
  display_name: string;
  metadata: { team_name?: string } | null;
};

type SleeperDraft = {
  draft_id: string;
  status: string;
  settings: { teams: number; rounds: number };
  draft_order: Record<string, number> | null;
};

type SleeperPickMetadata = {
  first_name: string;
  last_name: string;
  position: string;
  team: string;
};

type SleeperPick = {
  player_id: string;
  round: number;
  pick_no: number;
  draft_slot: number;
  picked_by: string;
  metadata: SleeperPickMetadata;
};

type SleeperRoster = {
  owner_id: string | null;
  players: string[] | null;
  starters: string[] | null;
  reserve: string[] | null;
  taxi: string[] | null;
};

type SleeperPlayer = {
  first_name?: string;
  last_name?: string;
  full_name?: string;
  position?: string;
  team?: string | null;
  gsis_id?: string | null; // NFL's own player id — the join key nflverse's NGS data uses
};

export type SleeperPlayersMap = Record<string, SleeperPlayer>;

async function sleeperFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${SLEEPER_API}${path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Sleeper API request failed (${res.status}): ${path}`);
  }
  return res.json() as Promise<T>;
}

function pickPlayerName(metadata: SleeperPickMetadata): string {
  if (metadata.position === "DEF") return metadata.last_name;
  return `${metadata.first_name} ${metadata.last_name}`.trim();
}

function rosterPlayerName(playerId: string, player: SleeperPlayer | undefined): string {
  if (!player) return playerId;
  if (player.position === "DEF") return player.last_name || player.full_name || playerId;
  return (
    player.full_name ||
    `${player.first_name ?? ""} ${player.last_name ?? ""}`.trim() ||
    playerId
  );
}

function rosterSlot(playerId: string, roster: SleeperRoster): string {
  if (roster.starters?.includes(playerId)) return "starter";
  if (roster.reserve?.includes(playerId)) return "ir";
  if (roster.taxi?.includes(playerId)) return "taxi";
  return "bench";
}

export function sleeperTeamName(user: SleeperUser): string {
  return user.metadata?.team_name?.trim() || `Team ${user.display_name}`;
}

// Name-only refresh for the admin button: one cheap Sleeper call instead of
// the full roster/draft sync. Skips teams whose name the commissioner locked.
export async function syncTeamNames(leagueId: string): Promise<number> {
  const users = await sleeperFetch<SleeperUser[]>(`/league/${leagueId}/users`);
  let changed = 0;
  for (const user of users) {
    const team = await prisma.team.findUnique({ where: { sleeperUserId: user.user_id } });
    if (!team) continue;
    const name = team.nameLocked ? team.name : sleeperTeamName(user);
    if (name === team.name && user.display_name === team.ownerName) continue;
    await prisma.team.update({
      where: { id: team.id },
      data: { name, ownerName: user.display_name },
    });
    changed++;
  }
  return changed;
}

export async function syncSleeperLeague(leagueId: string) {
  const users = await sleeperFetch<SleeperUser[]>(`/league/${leagueId}/users`);
  const drafts = await sleeperFetch<SleeperDraft[]>(`/league/${leagueId}/drafts`);
  const draft = drafts.find((d) => d.status === "complete") ?? drafts[0];

  const teamIdBySleeperUserId = new Map<string, string>();

  for (const user of users) {
    // Match by Sleeper user id when available; otherwise fall back to
    // owner name once, to link up teams that predate this sync (e.g. from
    // the original manual seed) instead of creating duplicates.
    const existing =
      (await prisma.team.findUnique({ where: { sleeperUserId: user.user_id } })) ??
      (await prisma.team.findFirst({
        where: { ownerName: user.display_name, sleeperUserId: null },
      }));
    const draftPosition = draft?.draft_order?.[user.user_id] ?? null;
    const data = {
      name: existing?.nameLocked ? existing.name : sleeperTeamName(user),
      ownerName: user.display_name,
      draftPosition,
      sleeperUserId: user.user_id,
    };

    const team = existing
      ? await prisma.team.update({ where: { id: existing.id }, data })
      : await prisma.team.create({ data: { ...data, faabStarting: 100 } });

    teamIdBySleeperUserId.set(user.user_id, team.id);
  }

  let pickCount = 0;
  if (draft && draft.status === "complete") {
    const picks = await sleeperFetch<SleeperPick[]>(`/draft/${draft.draft_id}/picks`);
    const teamCount = draft.settings.teams;

    await prisma.draftPick.deleteMany({});
    for (const p of picks) {
      const teamId = teamIdBySleeperUserId.get(p.picked_by);
      if (!teamId) continue;

      const pickInRound =
        p.round % 2 === 1 ? p.draft_slot : teamCount + 1 - p.draft_slot;

      await prisma.draftPick.create({
        data: {
          teamId,
          round: p.round,
          pick: pickInRound,
          overall: p.pick_no,
          playerName: pickPlayerName(p.metadata),
          playerPosition: p.metadata.position,
          nflTeam: p.metadata.team,
          sleeperPlayerId: p.player_id,
        },
      });
      pickCount++;
    }
  }

  const rosters = await sleeperFetch<SleeperRoster[]>(`/league/${leagueId}/rosters`);
  // Sleeper asks that this ~5MB dump be pulled "at most once per day" per
  // league — fine here since this runs from the daily cron and the
  // occasional manual admin click, never per-request.
  const players = await sleeperFetch<SleeperPlayersMap>(`/players/nfl`);

  const rosterRows: {
    teamId: string;
    sleeperPlayerId: string;
    playerName: string;
    playerPosition: string;
    nflTeam: string | null;
    slot: string;
  }[] = [];

  for (const roster of rosters) {
    const teamId = roster.owner_id ? teamIdBySleeperUserId.get(roster.owner_id) : undefined;
    if (!teamId) continue;

    for (const playerId of roster.players ?? []) {
      const player = players[playerId];
      rosterRows.push({
        teamId,
        sleeperPlayerId: playerId,
        playerName: rosterPlayerName(playerId, player),
        playerPosition: player?.position ?? "?",
        nflTeam: player?.team ?? null,
        slot: rosterSlot(playerId, roster),
      });
    }
  }

  // createMany instead of one create() per row (as draft picks use) — a full
  // league roster sync is 150+ rows, which blew past the interactive
  // transaction's default 5s timeout when done as individual creates.
  await prisma.$transaction([
    prisma.rosterPlayer.deleteMany({}),
    prisma.rosterPlayer.createMany({ data: rosterRows }),
  ]);

  // Season points and the market ADP snapshot feed only the value grid on
  // /draft, so a failure there (e.g. a third-party API being down) is logged
  // rather than failing the whole sync.
  const league = await sleeperFetch<SleeperLeague>(`/league/${leagueId}`);
  let statsThroughWeek: number | null = null;
  try {
    statsThroughWeek = await syncSeasonPoints(league, players);
  } catch (err) {
    console.error("Season points sync failed", err);
  }

  // Layers NGS separation/cushion/air-yards-share/YAC+- onto the
  // WeeklyPlayerStat rows syncSeasonPoints just wrote — best-effort, same as
  // ADP below, since it's a third-party (nflverse) feed outside Sleeper.
  try {
    await syncNextGenReceiving(league.season, players);
  } catch (err) {
    console.error("Next Gen Stats receiving sync failed", err);
  }

  let adpEntryCount = await prisma.adpEntry.count();
  if (adpEntryCount === 0) {
    try {
      adpEntryCount = await snapshotMarketAdp(league.total_rosters, league.season, players);
    } catch (err) {
      console.error("Market ADP snapshot failed", err);
    }
  }

  await prisma.appSettings.upsert({
    where: { id: 1 },
    update: {
      sleeperLastSynced: new Date(),
      ...(statsThroughWeek !== null && { statsThroughWeek }),
    },
    create: {
      id: 1,
      sleeperLastSynced: new Date(),
      statsThroughWeek,
    },
  });

  return {
    teamCount: users.length,
    pickCount,
    rosterPlayerCount: rosterRows.length,
    statsThroughWeek,
    adpEntryCount,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

type WeeklyPlayerStatRow = {
  sleeperPlayerId: string;
  playerName: string;
  playerPosition: string;
  nflTeam: string;
  season: string;
  week: number;
  snapPct: number | null;
  offSnaps: number | null;
  teamOffSnaps: number | null;
  carries: number | null;
  rushYards: number | null;
  rushTd: number | null;
  rushYardsAfterContact: number | null;
  targets: number | null;
  receptions: number | null;
  recYards: number | null;
  recTd: number | null;
  recAirYards: number | null;
  targetSharePct: number | null;
  teamPassAttempts: number | null;
  passAttempts: number | null;
  passCompletions: number | null;
  passYards: number | null;
  passTd: number | null;
  interceptions: number | null;
  fantasyPoints: number | null;
  opponent: string | null;
  isHome: boolean | null;
  teamScore: number | null;
  opponentScore: number | null;
  teamQuarterScores: number[];
  opponentQuarterScores: number[];
};

// Bulk upsert via one multi-row `INSERT ... ON CONFLICT DO UPDATE` instead of
// Prisma's upsert() per row (one round trip per row adds up fast at ~400
// rows/week — see the call site). The id is only used on the insert branch;
// Postgres leaves it alone on conflict.
async function upsertWeeklyPlayerStats(rows: WeeklyPlayerStatRow[]): Promise<void> {
  const values = rows.map(
    (r) => Prisma.sql`(
      ${randomUUID()}, ${r.sleeperPlayerId}, ${r.playerName}, ${r.playerPosition}, ${r.nflTeam},
      ${r.season}, ${r.week}, ${r.snapPct}, ${r.offSnaps}, ${r.teamOffSnaps},
      ${r.carries}, ${r.rushYards}, ${r.rushTd}, ${r.rushYardsAfterContact}, ${r.targets}, ${r.receptions},
      ${r.recYards}, ${r.recTd}, ${r.recAirYards}, ${r.targetSharePct}, ${r.teamPassAttempts},
      ${r.passAttempts}, ${r.passCompletions}, ${r.passYards}, ${r.passTd}, ${r.interceptions},
      ${r.fantasyPoints}, ${r.opponent}, ${r.isHome},
      ${r.teamScore}, ${r.opponentScore}, ${r.teamQuarterScores}::int[], ${r.opponentQuarterScores}::int[],
      now()
    )`
  );

  await prisma.$executeRaw`
    INSERT INTO "WeeklyPlayerStat" (
      "id", "sleeperPlayerId", "playerName", "playerPosition", "nflTeam",
      "season", "week", "snapPct", "offSnaps", "teamOffSnaps",
      "carries", "rushYards", "rushTd", "rushYardsAfterContact", "targets", "receptions",
      "recYards", "recTd", "recAirYards", "targetSharePct", "teamPassAttempts",
      "passAttempts", "passCompletions", "passYards", "passTd", "interceptions",
      "fantasyPoints", "opponent", "isHome",
      "teamScore", "opponentScore", "teamQuarterScores", "opponentQuarterScores",
      "updatedAt"
    )
    VALUES ${Prisma.join(values)}
    ON CONFLICT ("sleeperPlayerId", "season", "week") DO UPDATE SET
      "playerName" = EXCLUDED."playerName",
      "playerPosition" = EXCLUDED."playerPosition",
      "nflTeam" = EXCLUDED."nflTeam",
      "snapPct" = EXCLUDED."snapPct",
      "offSnaps" = EXCLUDED."offSnaps",
      "teamOffSnaps" = EXCLUDED."teamOffSnaps",
      "carries" = EXCLUDED."carries",
      "rushYards" = EXCLUDED."rushYards",
      "rushTd" = EXCLUDED."rushTd",
      "rushYardsAfterContact" = EXCLUDED."rushYardsAfterContact",
      "targets" = EXCLUDED."targets",
      "receptions" = EXCLUDED."receptions",
      "recYards" = EXCLUDED."recYards",
      "recTd" = EXCLUDED."recTd",
      "recAirYards" = EXCLUDED."recAirYards",
      "targetSharePct" = EXCLUDED."targetSharePct",
      "teamPassAttempts" = EXCLUDED."teamPassAttempts",
      "passAttempts" = EXCLUDED."passAttempts",
      "passCompletions" = EXCLUDED."passCompletions",
      "passYards" = EXCLUDED."passYards",
      "passTd" = EXCLUDED."passTd",
      "interceptions" = EXCLUDED."interceptions",
      "fantasyPoints" = EXCLUDED."fantasyPoints",
      "opponent" = EXCLUDED."opponent",
      "isHome" = EXCLUDED."isHome",
      "teamScore" = EXCLUDED."teamScore",
      "opponentScore" = EXCLUDED."opponentScore",
      "teamQuarterScores" = EXCLUDED."teamQuarterScores",
      "opponentQuarterScores" = EXCLUDED."opponentQuarterScores",
      "updatedAt" = EXCLUDED."updatedAt"
  `;
}

// Rebuilds PlayerSeasonPoints *and* WeeklyPlayerStat from the same weekly
// stat lines, scored with the league's own scoring_settings — Sleeper keys
// stats and scoring rules by the same names (pass_td, rec, rush_yd, ...), so
// a player's points are just the sum of stat × rule. One fetch per week
// feeds both tables instead of two separate sync passes hitting Sleeper
// twice. Returns the last week included.
async function syncSeasonPoints(
  league: SleeperLeague,
  players: SleeperPlayersMap
): Promise<number> {
  const state = await sleeperFetch<SleeperNflState>(`/state/nfl`);
  let lastWeek = 0;
  if (state.season === league.season) {
    if (state.season_type === "regular") lastWeek = state.week;
    else if (state.season_type === "post" || state.season_type === "off") lastWeek = 18;
  } else if (Number(state.season) > Number(league.season)) {
    lastWeek = 18;
  }

  // Best-effort — a player's opponent that week just stays unset if
  // nflverse's schedule feed is unreachable, same tradeoff as the NGS step.
  let schedule: Map<string, Map<number, GameInfo>> = new Map();
  try {
    schedule = await getScheduleMap(league.season);
  } catch (err) {
    console.error("Schedule fetch failed", err);
  }

  const totals = new Map<string, { points: number; gamesPlayed: number }>();
  for (let week = 1; week <= lastWeek; week++) {
    const stats = await sleeperFetch<SleeperWeekStats>(
      `/stats/nfl/regular/${league.season}/${week}`
    );

    // Sleeper includes one row per NFL team in the same payload, keyed
    // "TEAM_<ABBR>" — that's the only place a team's own offensive snap
    // count and pass attempts live, which snap share and target share are
    // each a fraction of.
    const teamLines = new Map<string, Record<string, number>>();
    for (const [key, line] of Object.entries(stats)) {
      if (key.startsWith("TEAM_")) teamLines.set(key.slice("TEAM_".length), line);
    }

    const weeklyRows: WeeklyPlayerStatRow[] = [];

    for (const [playerId, line] of Object.entries(stats)) {
      if (playerId.startsWith("TEAM_")) continue;
      const player = players[playerId];
      const position = player?.position;
      if (!position || !(VALUE_POSITIONS as readonly string[]).includes(position)) continue;

      let points = 0;
      for (const [stat, value] of Object.entries(line)) {
        points += value * (league.scoring_settings[stat] ?? 0);
      }
      const total = totals.get(playerId) ?? { points: 0, gamesPlayed: 0 };
      total.points += points;
      const played = (line.gp ?? 0) > 0;
      if (played) total.gamesPlayed++;
      totals.set(playerId, total);

      if (!played) continue; // skip bye/inactive weeks in the weekly log
      if (!player?.team) continue; // free agents etc. don't belong to an NFL team to browse by

      const nflTeam = player.team;
      const team = nflTeam ? teamLines.get(nflTeam) : undefined;
      const offSnaps = line.off_snp ?? null;
      // The per-team "TEAM_<ABBR>" row has no snap count of its own — each
      // player's line already carries the team's offensive snap total as
      // tm_off_snp, so snap share comes entirely from this one line.
      const teamOffSnaps = line.tm_off_snp ?? null;
      const targets = line.rec_tgt ?? null;
      const teamPassAtt = team?.pass_att ?? null;
      const opponentInfo = schedule.get(nflTeam)?.get(week);

      weeklyRows.push({
        sleeperPlayerId: playerId,
        playerName: rosterPlayerName(playerId, player),
        playerPosition: position,
        nflTeam,
        season: league.season,
        week,
        opponent: opponentInfo?.opponent ?? null,
        isHome: opponentInfo?.isHome ?? null,
        teamScore: opponentInfo?.teamScore ?? null,
        opponentScore: opponentInfo?.opponentScore ?? null,
        teamQuarterScores: opponentInfo?.teamQuarterScores ?? [],
        opponentQuarterScores: opponentInfo?.opponentQuarterScores ?? [],
        snapPct: offSnaps !== null && teamOffSnaps ? round1((offSnaps / teamOffSnaps) * 100) : null,
        offSnaps: offSnaps !== null ? Math.round(offSnaps) : null,
        teamOffSnaps: teamOffSnaps !== null ? Math.round(teamOffSnaps) : null,
        carries: line.rush_att !== undefined ? Math.round(line.rush_att) : null,
        rushYards: line.rush_yd !== undefined ? Math.round(line.rush_yd) : null,
        rushTd: line.rush_td !== undefined ? Math.round(line.rush_td) : null,
        rushYardsAfterContact: line.rush_yac !== undefined ? Math.round(line.rush_yac) : null,
        targets: targets !== null ? Math.round(targets) : null,
        receptions: line.rec !== undefined ? Math.round(line.rec) : null,
        recYards: line.rec_yd !== undefined ? Math.round(line.rec_yd) : null,
        recTd: line.rec_td !== undefined ? Math.round(line.rec_td) : null,
        recAirYards: line.rec_air_yd !== undefined ? Math.round(line.rec_air_yd) : null,
        targetSharePct:
          targets !== null && teamPassAtt ? round1((targets / teamPassAtt) * 100) : null,
        teamPassAttempts: teamPassAtt !== null ? Math.round(teamPassAtt) : null,
        passAttempts: line.pass_att !== undefined ? Math.round(line.pass_att) : null,
        passCompletions: line.pass_cmp !== undefined ? Math.round(line.pass_cmp) : null,
        passYards: line.pass_yd !== undefined ? Math.round(line.pass_yd) : null,
        passTd: line.pass_td !== undefined ? Math.round(line.pass_td) : null,
        interceptions: line.pass_int !== undefined ? Math.round(line.pass_int) : null,
        fantasyPoints: Math.round(points * 100) / 100,
      });
    }

    // One multi-row INSERT ... ON CONFLICT per week instead of one upsert
    // call per row — Prisma's upsert() is one round trip per row, and at
    // ~400 rows/week that was ~100ms × 400 (chunked $transaction calls hit
    // the interactive transaction's 5s timeout the same way a
    // single-row-at-a-time RosterPlayer sync once did, and sequential
    // upserts just moved the same cost outside a transaction). Raw SQL gets
    // a whole week down to one query.
    if (weeklyRows.length > 0) {
      await upsertWeeklyPlayerStats(weeklyRows);
    }
  }

  const rows = [...totals.entries()]
    .filter(([, t]) => t.gamesPlayed > 0)
    .map(([playerId, t]) => ({
      sleeperPlayerId: playerId,
      playerName: rosterPlayerName(playerId, players[playerId]),
      playerPosition: players[playerId]?.position ?? "?",
      nflTeam: players[playerId]?.team ?? null,
      points: Math.round(t.points * 100) / 100,
      gamesPlayed: t.gamesPlayed,
    }));

  await prisma.$transaction([
    prisma.playerSeasonPoints.deleteMany({}),
    prisma.playerSeasonPoints.createMany({ data: rows }),
  ]);

  return lastWeek;
}

// Retakes the market ADP snapshot on demand (from /admin). The daily sync only
// takes one when none exists, so the grid stays frozen at draft-season ADP.
export async function refreshMarketAdp(leagueId: string) {
  const league = await sleeperFetch<SleeperLeague>(`/league/${leagueId}`);
  const players = await sleeperFetch<SleeperPlayersMap>(`/players/nfl`);
  return snapshotMarketAdp(league.total_rosters, league.season, players);
}

// Everyone currently on a roster in the league (including IR and taxi), pulled
// live from Sleeper for the value grid's waiver-wire replacement level rather
// than from the daily-synced RosterPlayer table, so a pickup or drop shows up
// within the hour. The rosters endpoint is small, unlike /players/nfl.
async function fetchRosteredPlayerIds(leagueId: string): Promise<string[]> {
  const rosters = await sleeperFetch<SleeperRoster[]>(`/league/${leagueId}/rosters`);
  const ids = new Set<string>();
  for (const roster of rosters) {
    for (const id of [...(roster.players ?? []), ...(roster.reserve ?? []), ...(roster.taxi ?? [])]) {
      ids.add(id);
    }
  }
  return [...ids];
}

export const getRosteredPlayerIds = unstable_cache(fetchRosteredPlayerIds, ["sleeper-rostered"], {
  revalidate: 60 * 60,
});
