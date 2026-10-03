// Fantasy points over replacement (FPOR) for the value grid on /draft.
//
// Replacement level at a position is the best player there who wouldn't crack
// a starting lineup in this league: fill every team's QB/RB/WR/TE slots with
// the top scorers at each position, then the FLEX slots with the best
// remaining RB/WR/TE, and whoever is next in line at each position sets the
// bar. A player's FPOR is his points minus that bar, floored at zero.

export const VALUE_POSITIONS = ["QB", "RB", "WR", "TE"] as const;

// Mirrors the starting lineup in lib/rulesData.ts (ROSTER_SLOTS).
const DEDICATED_STARTERS: Record<string, number> = { QB: 1, RB: 2, WR: 2, TE: 1 };
const FLEX_STARTERS = 1;
const FLEX_POSITIONS = new Set(["RB", "WR", "TE"]);

export type SeasonPoints = { playerPosition: string; points: number };

export function replacementLevels(
  players: SeasonPoints[],
  teamCount: number
): Record<string, number> {
  const byPosition = new Map<string, number[]>();
  for (const p of players) {
    if (!(p.playerPosition in DEDICATED_STARTERS)) continue;
    const list = byPosition.get(p.playerPosition) ?? [];
    list.push(p.points);
    byPosition.set(p.playerPosition, list);
  }

  // How many players at each position are "starters" league-wide.
  const starterCount: Record<string, number> = {};
  const flexPool: { position: string; points: number }[] = [];
  for (const [position, slots] of Object.entries(DEDICATED_STARTERS)) {
    const sorted = (byPosition.get(position) ?? []).sort((a, b) => b - a);
    byPosition.set(position, sorted);
    starterCount[position] = Math.min(sorted.length, slots * teamCount);
    if (FLEX_POSITIONS.has(position)) {
      for (const points of sorted.slice(starterCount[position])) {
        flexPool.push({ position, points });
      }
    }
  }
  flexPool.sort((a, b) => b.points - a.points);
  for (const { position } of flexPool.slice(0, FLEX_STARTERS * teamCount)) {
    starterCount[position]++;
  }

  const levels: Record<string, number> = {};
  for (const position of Object.keys(DEDICATED_STARTERS)) {
    levels[position] = byPosition.get(position)?.[starterCount[position]] ?? 0;
  }
  return levels;
}

export function fpor(
  points: number | undefined,
  position: string,
  levels: Record<string, number>
): number | null {
  if (points === undefined || !(position in levels)) return null;
  return Math.max(0, points - levels[position]);
}

// What a pick "should" return: if every player were drafted in order of the
// FPOR they actually produced, the Nth pick would get the Nth-best FPOR.
// Comparing a player's FPOR with this for the pick he went at makes busts go
// negative (a 1st-rounder returning 3rd-round value) and steals go positive.
export function expectedFporByPick(fporValues: number[]): (overall: number) => number {
  const sorted = [...fporValues].sort((a, b) => b - a);
  return (overall) => sorted[overall - 1] ?? 0;
}

// Loose name key for matching the same player across sources (Sleeper,
// Fantasy Football Calculator, hand-entered picks), which disagree on
// punctuation and suffixes like "Jr." or "III".
export function playerKey(name: string, position: string): string {
  const normalized = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[.'’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return `${normalized}|${position}`;
}
