// Who each NFL team played each week — Sleeper has no schedule endpoint, so
// this comes from nflverse's public schedule feed instead, same approach as
// lib/nextgenStats.ts. Looked up during the daily sync (lib/sleeper.ts) and
// stored on WeeklyPlayerStat rather than fetched at page-render time, so
// /data doesn't depend on nflverse being reachable right when someone loads it.
const SCHEDULE_URL = "https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv";

// nflverse's team codes mostly match Sleeper's, except the Rams: nflverse
// uses "LA", Sleeper (and this app, and the rest of the Usage Explorer) uses
// "LAR". Mapped nflverse -> our convention.
const TEAM_ALIASES: Record<string, string> = { LA: "LAR" };

function normalizeTeam(code: string): string {
  return TEAM_ALIASES[code] ?? code;
}

export type OpponentInfo = { opponent: string; isHome: boolean };

// Proper RFC4180 parser (not a naive split) — unlike nflverse's NGS export,
// this schedule file has quoted fields with embedded commas (stadium names,
// etc.), confirmed against the live file.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// Returns team -> week -> opponent for one season's regular season games.
// Best-effort: the caller (lib/sleeper.ts) treats a failure here as
// non-fatal, same as the NGS and ADP steps.
export async function getScheduleMap(
  season: string
): Promise<Map<string, Map<number, OpponentInfo>>> {
  const res = await fetch(SCHEDULE_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`nflverse schedule request failed (${res.status})`);
  const csvText = await res.text();
  const table = parseCsv(csvText);
  const header = table[0];
  const col = (name: string) => header.indexOf(name);
  const iSeason = col("season");
  const iType = col("game_type");
  const iWeek = col("week");
  const iAway = col("away_team");
  const iHome = col("home_team");

  const map = new Map<string, Map<number, OpponentInfo>>();
  const setOpponent = (team: string, week: number, info: OpponentInfo) => {
    const team_ = normalizeTeam(team);
    if (!map.has(team_)) map.set(team_, new Map());
    map.get(team_)!.set(week, info);
  };

  for (const row of table.slice(1)) {
    if (row[iSeason] !== season || row[iType] !== "REG") continue;
    const week = Number(row[iWeek]);
    const away = normalizeTeam(row[iAway]);
    const home = normalizeTeam(row[iHome]);
    if (!away || !home || !Number.isFinite(week)) continue;
    setOpponent(away, week, { opponent: home, isHome: false });
    setOpponent(home, week, { opponent: away, isHome: true });
  }

  return map;
}
