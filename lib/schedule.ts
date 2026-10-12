import { gunzipSync } from "node:zlib";
import { parseCsvRows } from "@/lib/csv";

// Who each NFL team played each week, the final score, and a quarter-by-
// quarter breakdown — Sleeper has no schedule or score endpoint, so this
// comes from nflverse instead, same approach as lib/nextgenStats.ts. Looked
// up during the daily sync (lib/sleeper.ts) and stored on WeeklyPlayerStat
// rather than fetched at page-render time, so /data doesn't depend on
// nflverse being reachable right when someone loads it.
//
// Final scores come straight from nflverse's schedule feed. Quarter-by-
// quarter doesn't exist as a published field anywhere, so it's derived from
// play-by-play: each play carries the game's running score
// (total_home_score/total_away_score) and the quarter it happened in, so the
// last play of each quarter gives that quarter's cumulative score, and the
// per-quarter points are just the difference from the previous quarter's
// cumulative score. Cross-checked against nflverse's own final scores and
// it matches exactly.
const SCHEDULE_URL = "https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv";
const pbpUrl = (season: string) =>
  `https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_${season}.csv.gz`;

// nflverse's team codes mostly match Sleeper's, except the Rams: nflverse
// uses "LA", Sleeper (and this app, and the rest of the Usage Explorer) uses
// "LAR". Mapped nflverse -> our convention. Confirmed the same alias is
// needed in both the schedule and play-by-play feeds.
const TEAM_ALIASES: Record<string, string> = { LA: "LAR" };

function normalizeTeam(code: string): string {
  return TEAM_ALIASES[code] ?? code;
}

export type GameInfo = {
  opponent: string;
  isHome: boolean;
  teamScore: number | null;
  opponentScore: number | null;
  teamQuarterScores: number[]; // empty when the play-by-play feed doesn't have this game yet
  opponentQuarterScores: number[];
};

type QuarterTotals = { home: number[]; away: number[] }; // index 0 = Q1, etc.; index 4+ = OT periods

// One pass over the season's play-by-play, keeping the last-seen cumulative
// score for each (game, quarter) — last occurrence in file order is the
// score at the end of that quarter, since plays are chronological.
async function getQuarterTotalsByGame(season: string): Promise<Map<string, QuarterTotals>> {
  const res = await fetch(pbpUrl(season), { cache: "no-store" });
  if (!res.ok) throw new Error(`nflverse play-by-play request failed (${res.status})`);
  const gzipped = Buffer.from(await res.arrayBuffer());
  const csvText = gunzipSync(gzipped).toString("utf8");
  const rows = parseCsvRows(csvText);

  // cumulative[gameId][quarterIndex] = running score at the last play seen
  // so far in that quarter.
  const cumulative = new Map<string, { home: Map<number, number>; away: Map<number, number> }>();

  for (const row of rows) {
    const gameId = row.game_id;
    const qtr = Number(row.qtr);
    const home = Number(row.total_home_score);
    const away = Number(row.total_away_score);
    if (!gameId || !Number.isFinite(qtr) || qtr < 1 || !Number.isFinite(home) || !Number.isFinite(away)) {
      continue;
    }
    if (!cumulative.has(gameId)) cumulative.set(gameId, { home: new Map(), away: new Map() });
    const entry = cumulative.get(gameId)!;
    entry.home.set(qtr, home); // overwritten each time -> ends up as the last (highest) value for that quarter
    entry.away.set(qtr, away);
  }

  const result = new Map<string, QuarterTotals>();
  for (const [gameId, entry] of cumulative) {
    const maxQtr = Math.max(...entry.home.keys(), ...entry.away.keys());
    const homeQuarters: number[] = [];
    const awayQuarters: number[] = [];
    let prevHome = 0;
    let prevAway = 0;
    for (let q = 1; q <= maxQtr; q++) {
      // Carry the previous cumulative score forward for a quarter with no
      // scoring-relevant plays recorded (rare, but a scoreless OT period
      // that ends in a tie would look like this).
      const home = entry.home.get(q) ?? prevHome;
      const away = entry.away.get(q) ?? prevAway;
      homeQuarters.push(home - prevHome);
      awayQuarters.push(away - prevAway);
      prevHome = home;
      prevAway = away;
    }
    result.set(gameId, { home: homeQuarters, away: awayQuarters });
  }
  return result;
}

// Returns team -> week -> game info for one season's regular season games.
// Best-effort: the caller (lib/sleeper.ts) treats a failure here as
// non-fatal, same as the NGS and ADP steps. The play-by-play fetch for
// quarter scores is a second, independent best-effort — if it fails, teams
// still get their opponent and final score, just with empty quarter arrays.
export async function getScheduleMap(season: string): Promise<Map<string, Map<number, GameInfo>>> {
  const res = await fetch(SCHEDULE_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`nflverse schedule request failed (${res.status})`);
  const rows = parseCsvRows(await res.text());

  let quarterTotals = new Map<string, QuarterTotals>();
  try {
    quarterTotals = await getQuarterTotalsByGame(season);
  } catch (err) {
    console.error("Play-by-play quarter scores fetch failed", err);
  }

  const map = new Map<string, Map<number, GameInfo>>();
  const setGame = (team: string, week: number, info: GameInfo) => {
    const team_ = normalizeTeam(team);
    if (!map.has(team_)) map.set(team_, new Map());
    map.get(team_)!.set(week, info);
  };

  for (const row of rows) {
    if (row.season !== season || row.game_type !== "REG") continue;
    const week = Number(row.week);
    const away = normalizeTeam(row.away_team);
    const home = normalizeTeam(row.home_team);
    if (!away || !home || !Number.isFinite(week)) continue;

    const awayScore = row.away_score === "" ? null : Number(row.away_score);
    const homeScore = row.home_score === "" ? null : Number(row.home_score);
    const quarters = quarterTotals.get(row.game_id);

    setGame(away, week, {
      opponent: home,
      isHome: false,
      teamScore: awayScore,
      opponentScore: homeScore,
      teamQuarterScores: quarters?.away ?? [],
      opponentQuarterScores: quarters?.home ?? [],
    });
    setGame(home, week, {
      opponent: away,
      isHome: true,
      teamScore: homeScore,
      opponentScore: awayScore,
      teamQuarterScores: quarters?.home ?? [],
      opponentQuarterScores: quarters?.away ?? [],
    });
  }

  return map;
}
