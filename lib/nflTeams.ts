// Static registry of the 32 NFL teams for the Usage Explorer's team picker —
// Sleeper's player data uses these same abbreviations for `team`, so this is
// just display info (full name, brand color for the chip) layered on top.
export type NflTeamInfo = { abbr: string; name: string; color: string };

export const NFL_TEAMS: NflTeamInfo[] = [
  { abbr: "BUF", name: "Buffalo Bills", color: "#00338D" },
  { abbr: "MIA", name: "Miami Dolphins", color: "#008E97" },
  { abbr: "NE", name: "New England Patriots", color: "#002244" },
  { abbr: "NYJ", name: "New York Jets", color: "#125740" },
  { abbr: "BAL", name: "Baltimore Ravens", color: "#241773" },
  { abbr: "CIN", name: "Cincinnati Bengals", color: "#FB4F14" },
  { abbr: "CLE", name: "Cleveland Browns", color: "#311D00" },
  { abbr: "PIT", name: "Pittsburgh Steelers", color: "#FFB612" },
  { abbr: "HOU", name: "Houston Texans", color: "#03202F" },
  { abbr: "IND", name: "Indianapolis Colts", color: "#002C5F" },
  { abbr: "JAX", name: "Jacksonville Jaguars", color: "#006778" },
  { abbr: "TEN", name: "Tennessee Titans", color: "#0C2340" },
  { abbr: "DEN", name: "Denver Broncos", color: "#FB4F14" },
  { abbr: "KC", name: "Kansas City Chiefs", color: "#E31837" },
  { abbr: "LAC", name: "Los Angeles Chargers", color: "#0080C6" },
  { abbr: "LV", name: "Las Vegas Raiders", color: "#000000" },
  { abbr: "DAL", name: "Dallas Cowboys", color: "#003594" },
  { abbr: "NYG", name: "New York Giants", color: "#0B2265" },
  { abbr: "PHI", name: "Philadelphia Eagles", color: "#004C54" },
  { abbr: "WAS", name: "Washington Commanders", color: "#5A1414" },
  { abbr: "CHI", name: "Chicago Bears", color: "#0B162A" },
  { abbr: "DET", name: "Detroit Lions", color: "#0076B6" },
  { abbr: "GB", name: "Green Bay Packers", color: "#203731" },
  { abbr: "MIN", name: "Minnesota Vikings", color: "#4F2683" },
  { abbr: "ATL", name: "Atlanta Falcons", color: "#A71930" },
  { abbr: "CAR", name: "Carolina Panthers", color: "#0085CA" },
  { abbr: "NO", name: "New Orleans Saints", color: "#D3BC8D" },
  { abbr: "TB", name: "Tampa Bay Buccaneers", color: "#D50A0A" },
  { abbr: "ARI", name: "Arizona Cardinals", color: "#97233F" },
  { abbr: "LAR", name: "Los Angeles Rams", color: "#003594" },
  { abbr: "SF", name: "San Francisco 49ers", color: "#AA0000" },
  { abbr: "SEA", name: "Seattle Seahawks", color: "#002244" },
];

export function nflTeamInfo(abbr: string): NflTeamInfo | undefined {
  return NFL_TEAMS.find((t) => t.abbr === abbr);
}
