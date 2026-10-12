import { prisma } from "@/lib/prisma";
import { NFL_TEAMS } from "@/lib/nflTeams";

// Powers the NFL Usage Explorer on /data. WeeklyPlayerStat (see
// prisma/schema.prisma) is rebuilt by the daily Sleeper sync
// (lib/sleeper.ts's syncSeasonPoints); this module just reads it back out,
// grouped by NFL team and player, with season totals and derived rate stats
// (YPC, YPT, aDOT, combined TD) computed on top of the stored raw counts.
//
// Route% isn't here — Sleeper's stats payload has no route-participation
// field, and no free public feed publishes it either (it's normally PFF/
// FantasyData-exclusive). Everything else requested (snap%, carries,
// targets, receptions, target share, aDOT, YPC/YPT) comes straight from
// Sleeper's own weekly stats; separation/cushion/air-yards-share/YAC+- are
// layered in from NFL Next Gen Stats (lib/nextgenStats.ts) and are WR/TE
// only — NGS's public receiving leaderboard doesn't cover RB or QB.

export type UsageStatLine = {
  week: number | "season";
  snapPct: number | null;
  carries: number | null;
  rushYards: number | null;
  rushTd: number | null;
  rushYardsAfterContact: number | null; // raw total — yaco below is the per-carry rate actually shown
  yaco: number | null; // rushYardsAfterContact / carries
  ypc: number | null;
  targets: number | null;
  receptions: number | null;
  recYards: number | null;
  recTd: number | null;
  ypt: number | null;
  targetSharePct: number | null;
  aDOT: number | null;
  td: number | null; // rushTd + recTd (not pass_td — that's its own column for QBs)
  passAttempts: number | null;
  passCompletions: number | null;
  passYards: number | null;
  passTd: number | null;
  interceptions: number | null;
  fantasyPoints: number | null;
  avgCushion: number | null;
  avgSeparation: number | null;
  airYardsSharePct: number | null;
  yacAboveExpectation: number | null;
  opponent: string | null; // null on the season line — a season spans many opponents
  isHome: boolean | null;
  teamScore: number | null;
  opponentScore: number | null;
  teamQuarterScores: number[];
  opponentQuarterScores: number[];
};

export type UsagePlayer = {
  sleeperPlayerId: string;
  name: string;
  position: "QB" | "RB" | "WR" | "TE";
  weeks: UsageStatLine[]; // ascending by week, only weeks the player has a row for
  season: UsageStatLine;
};

// Team-level season box score — wins/losses and points by quarter, summed
// across every game the team's played. Computed once per team from the raw
// rows directly (not from any one player's `season` line), since a player
// who missed games would otherwise make the team look like it played fewer
// games than it did.
export type TeamSeasonBox = {
  wins: number;
  losses: number;
  ties: number;
  gamesPlayed: number;
  pointsFor: number;
  pointsAgainst: number;
  quartersFor: number[]; // summed across games; index 4+ is overtime
  quartersAgainst: number[];
};

export type TeamUsage = {
  abbr: string;
  name: string;
  color: string;
  hasData: boolean;
  players: UsagePlayer[];
  seasonBox: TeamSeasonBox | null;
};

export type PulseEntry = {
  sleeperPlayerId: string;
  name: string;
  position: string;
  nflTeam: string;
  snapPct: number;
  deltaSnapPct: number;
};

export type UsageExplorerData = {
  season: string | null;
  statsThroughWeek: number;
  teams: TeamUsage[];
  pulse: PulseEntry[];
};

type RawRow = {
  sleeperPlayerId: string;
  playerName: string;
  playerPosition: string;
  nflTeam: string;
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
  avgCushion: number | null;
  avgSeparation: number | null;
  airYardsSharePct: number | null;
  yacAboveExpectation: number | null;
  opponent: string | null;
  isHome: boolean | null;
  teamScore: number | null;
  opponentScore: number | null;
  teamQuarterScores: number[];
  opponentQuarterScores: number[];
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function sum(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  return present.length ? present.reduce((a, b) => a + b, 0) : null;
}

// For the season line of a rate-ish NGS stat (separation, cushion, YAC+-):
// a plain mean across the weeks it's present, rather than a weighted sum —
// there's no raw per-week denominator stored to weight it by.
function mean(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  return present.length ? round1(present.reduce((a, b) => a + b, 0) / present.length) : null;
}

function addQuarterArrays(a: number[], b: number[]): number[] {
  const out = new Array(Math.max(a.length, b.length)).fill(0);
  for (let i = 0; i < out.length; i++) out[i] = (a[i] ?? 0) + (b[i] ?? 0);
  return out;
}

// One row per (team, week) is enough — every player on a team shares the
// same game that week, so the raw rows passed in (which include every
// player who recorded a stat that week) massively over-count games without
// this dedupe.
function computeSeasonBox(teamRows: RawRow[]): TeamSeasonBox | null {
  const byWeek = new Map<number, RawRow>();
  for (const r of teamRows) {
    if (r.teamScore === null || r.opponentScore === null) continue;
    if (!byWeek.has(r.week)) byWeek.set(r.week, r);
  }
  if (byWeek.size === 0) return null;

  let wins = 0,
    losses = 0,
    ties = 0,
    pointsFor = 0,
    pointsAgainst = 0;
  let quartersFor: number[] = [];
  let quartersAgainst: number[] = [];
  for (const r of byWeek.values()) {
    const tf = r.teamScore!;
    const ta = r.opponentScore!;
    pointsFor += tf;
    pointsAgainst += ta;
    if (tf > ta) wins++;
    else if (tf < ta) losses++;
    else ties++;
    quartersFor = addQuarterArrays(quartersFor, r.teamQuarterScores);
    quartersAgainst = addQuarterArrays(quartersAgainst, r.opponentQuarterScores);
  }

  return { wins, losses, ties, gamesPlayed: byWeek.size, pointsFor, pointsAgainst, quartersFor, quartersAgainst };
}

function weekLine(r: RawRow): UsageStatLine {
  return {
    week: r.week,
    snapPct: r.snapPct,
    carries: r.carries,
    rushYards: r.rushYards,
    rushTd: r.rushTd,
    rushYardsAfterContact: r.rushYardsAfterContact,
    // null (not 0) when Sleeper didn't report YACO that week — see the note
    // on /data, it's genuinely missing some weeks, not actually zero.
    yaco: r.carries && r.rushYardsAfterContact !== null ? round1(r.rushYardsAfterContact / r.carries) : null,
    ypc: r.carries ? round1((r.rushYards ?? 0) / r.carries) : null,
    targets: r.targets,
    receptions: r.receptions,
    recYards: r.recYards,
    recTd: r.recTd,
    ypt: r.targets ? round1((r.recYards ?? 0) / r.targets) : null,
    targetSharePct: r.targetSharePct,
    aDOT: r.targets ? round1((r.recAirYards ?? 0) / r.targets) : null,
    td: r.rushTd === null && r.recTd === null ? null : (r.rushTd ?? 0) + (r.recTd ?? 0),
    passAttempts: r.passAttempts,
    passCompletions: r.passCompletions,
    passYards: r.passYards,
    passTd: r.passTd,
    interceptions: r.interceptions,
    fantasyPoints: r.fantasyPoints,
    avgCushion: r.avgCushion,
    avgSeparation: r.avgSeparation,
    airYardsSharePct: r.airYardsSharePct,
    yacAboveExpectation: r.yacAboveExpectation,
    opponent: r.opponent,
    isHome: r.isHome,
    teamScore: r.teamScore,
    opponentScore: r.opponentScore,
    teamQuarterScores: r.teamQuarterScores,
    opponentQuarterScores: r.opponentQuarterScores,
  };
}

// Season totals re-derived from the raw weekly rows rather than averaging
// weekly percentages — e.g. snap share is sum(offSnaps) / sum(teamOffSnaps),
// not an average of weekly snap%, so a bye week or a cameo snap count
// doesn't skew it.
function seasonLine(rows: RawRow[]): UsageStatLine {
  const offSnaps = sum(rows.map((r) => r.offSnaps));
  const teamOffSnaps = sum(rows.map((r) => r.teamOffSnaps));
  const carries = sum(rows.map((r) => r.carries));
  const rushYards = sum(rows.map((r) => r.rushYards));
  const rushTd = sum(rows.map((r) => r.rushTd));
  const rushYardsAfterContact = sum(rows.map((r) => r.rushYardsAfterContact));
  const targets = sum(rows.map((r) => r.targets));
  const receptions = sum(rows.map((r) => r.receptions));
  const recYards = sum(rows.map((r) => r.recYards));
  const recTd = sum(rows.map((r) => r.recTd));
  const recAirYards = sum(rows.map((r) => r.recAirYards));
  const teamPassAttempts = sum(rows.map((r) => r.teamPassAttempts));
  const fantasyPoints = sum(rows.map((r) => r.fantasyPoints));

  return {
    week: "season",
    snapPct: offSnaps !== null && teamOffSnaps ? round1((offSnaps / teamOffSnaps) * 100) : null,
    carries,
    rushYards,
    rushTd,
    rushYardsAfterContact,
    // Denominator is every carry on record, numerator only the weeks Sleeper
    // reported YACO for — a slight under-count when coverage is partial, but
    // simpler than tracking a separate "carries in a YACO week" sum for a
    // stat that's already an approximation (see the note on /data).
    yaco: carries && rushYardsAfterContact !== null ? round1(rushYardsAfterContact / carries) : null,
    ypc: carries ? round1((rushYards ?? 0) / carries) : null,
    targets,
    receptions,
    recYards,
    recTd,
    ypt: targets ? round1((recYards ?? 0) / targets) : null,
    targetSharePct: targets !== null && teamPassAttempts ? round1((targets / teamPassAttempts) * 100) : null,
    aDOT: targets ? round1((recAirYards ?? 0) / targets) : null,
    td: rushTd === null && recTd === null ? null : (rushTd ?? 0) + (recTd ?? 0),
    passAttempts: sum(rows.map((r) => r.passAttempts)),
    passCompletions: sum(rows.map((r) => r.passCompletions)),
    passYards: sum(rows.map((r) => r.passYards)),
    passTd: sum(rows.map((r) => r.passTd)),
    interceptions: sum(rows.map((r) => r.interceptions)),
    fantasyPoints: fantasyPoints !== null ? Math.round(fantasyPoints * 100) / 100 : null,
    avgCushion: mean(rows.map((r) => r.avgCushion)),
    avgSeparation: mean(rows.map((r) => r.avgSeparation)),
    airYardsSharePct: mean(rows.map((r) => r.airYardsSharePct)),
    yacAboveExpectation: mean(rows.map((r) => r.yacAboveExpectation)),
    opponent: null, // a season spans many opponents — no single value here
    isHome: null,
    teamScore: null,
    opponentScore: null,
    teamQuarterScores: [],
    opponentQuarterScores: [],
  };
}

const POSITIONS = ["QB", "RB", "WR", "TE"] as const;

export async function getUsageExplorerData(): Promise<UsageExplorerData> {
  const latest = await prisma.weeklyPlayerStat.findFirst({
    orderBy: [{ season: "desc" }, { week: "desc" }],
    select: { season: true, week: true },
  });

  const emptyTeams: TeamUsage[] = NFL_TEAMS.map((t) => ({ ...t, hasData: false, players: [], seasonBox: null }));
  if (!latest) {
    return { season: null, statsThroughWeek: 0, teams: emptyTeams, pulse: [] };
  }

  const season = latest.season;
  const statsThroughWeek = latest.week;

  const rows: RawRow[] = await prisma.weeklyPlayerStat.findMany({
    where: { season },
    orderBy: [{ nflTeam: "asc" }, { playerPosition: "asc" }, { playerName: "asc" }, { week: "asc" }],
  });

  const byTeam = new Map<string, RawRow[]>();
  for (const row of rows) {
    const list = byTeam.get(row.nflTeam) ?? [];
    list.push(row);
    byTeam.set(row.nflTeam, list);
  }

  const teams: TeamUsage[] = NFL_TEAMS.map((info) => {
    const teamRows = byTeam.get(info.abbr) ?? [];
    const byPlayer = new Map<string, RawRow[]>();
    for (const row of teamRows) {
      const list = byPlayer.get(row.sleeperPlayerId) ?? [];
      list.push(row);
      byPlayer.set(row.sleeperPlayerId, list);
    }

    const players: UsagePlayer[] = [...byPlayer.values()]
      .filter((playerRows) => (POSITIONS as readonly string[]).includes(playerRows[0].playerPosition))
      .map((playerRows) => {
        const latestRow = playerRows[playerRows.length - 1];
        return {
          sleeperPlayerId: latestRow.sleeperPlayerId,
          name: latestRow.playerName,
          position: latestRow.playerPosition as UsagePlayer["position"],
          weeks: playerRows.map(weekLine),
          season: seasonLine(playerRows),
        };
      })
      .sort((a, b) => (b.season.fantasyPoints ?? 0) - (a.season.fantasyPoints ?? 0));

    return { ...info, hasData: players.length > 0, players, seasonBox: computeSeasonBox(teamRows) };
  });

  // League Pulse: biggest week-over-week snap share jump, across every team,
  // using the two most recent weeks. Backups under 15% snap share are
  // excluded so a cameo-to-cameo swing doesn't crowd out real signal.
  const pulse: PulseEntry[] = [];
  if (statsThroughWeek >= 2) {
    for (const team of teams) {
      for (const player of team.players) {
        const current = player.weeks.find((w) => w.week === statsThroughWeek);
        const previous = player.weeks.find((w) => w.week === statsThroughWeek - 1);
        if (!current || current.snapPct === null || current.snapPct < 15) continue;
        if (!previous || previous.snapPct === null) continue;
        pulse.push({
          sleeperPlayerId: player.sleeperPlayerId,
          name: player.name,
          position: player.position,
          nflTeam: team.abbr,
          snapPct: current.snapPct,
          deltaSnapPct: Math.round(current.snapPct - previous.snapPct),
        });
      }
    }
    pulse.sort((a, b) => b.deltaSnapPct - a.deltaSnapPct);
  }

  return { season, statsThroughWeek, teams, pulse: pulse.slice(0, 8) };
}
