import { unstable_cache } from "next/cache";

const SHEET_TAB = "Player Grades";

export type PlayerGrade = {
  player: string;
  pos: string;
  team: string;
  status: string;
  age: string;
  posRank: string;
  projTgt: string;
  projCar: string;
  rzShare: string;
  pctTimeOut: string;
  dur: string;
  volumeIdx: string;
  rzIdx: string;
  availIdx: string;
  trajIdx: string;
  score: number;
  grade: string;
};

export type GradeCutoff = { cutoff: number; grade: string };

export type PlayerGradesData = {
  players: PlayerGrade[];
  gradeCutoffs: GradeCutoff[]; // ascending by cutoff
};

function extractSheetId(url: string): string | null {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

// Minimal RFC4180 CSV parser — Google's export quotes fields containing
// commas (e.g. "38.9%") and doubles up embedded quotes, which a naive
// split(",") would mangle.
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

function colIndex(header: string[], name: string): number {
  return header.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
}

function cell(row: string[], index: number): string {
  return index >= 0 ? (row[index] ?? "") : "";
}

async function fetchPlayerGradesUncached(): Promise<PlayerGradesData> {
  const sheetUrl = process.env.PLAYER_GRADES_SHEET_URL;
  const sheetId = sheetUrl ? extractSheetId(sheetUrl) : null;
  if (!sheetId) return { players: [], gradeCutoffs: [] };

  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_TAB)}`;
    const res = await fetch(csvUrl);
    if (!res.ok) return { players: [], gradeCutoffs: [] };

    const rows = parseCsv(await res.text()).filter((r) => r.some((c) => c.trim() !== ""));
    if (rows.length === 0) return { players: [], gradeCutoffs: [] };

    // Read columns by header name rather than fixed position — the sheet
    // author actively edits this workbook and has already reshuffled
    // columns once (adding "Status" and "Graded On" mid-table).
    const header = rows[0];
    const idx = {
      player: colIndex(header, "Player"),
      pos: colIndex(header, "Pos"),
      team: colIndex(header, "Team"),
      status: colIndex(header, "Status"),
      age: colIndex(header, "Age"),
      posRank: colIndex(header, "Pos Rank"),
      projTgt: colIndex(header, "Proj Tgt"),
      projCar: colIndex(header, "Proj Car"),
      rzShare: colIndex(header, "RZ Share"),
      pctTimeOut: colIndex(header, "% Time Out"),
      dur: colIndex(header, "Dur"),
      volumeIdx: colIndex(header, "Volume Idx"),
      rzIdx: colIndex(header, "RZ Idx"),
      availIdx: colIndex(header, "Avail Idx"),
      trajIdx: colIndex(header, "Traj Idx"),
      score: colIndex(header, "Score"),
      grade: colIndex(header, "Grade"), // first "Grade" column = the per-player grade
    };
    const cutoffIdx = colIndex(header, "Cutoff");
    // The "Cutoff -> Grade" legend sits to the right of the per-player
    // columns as an adjacent pair; its Grade column shares a header name
    // with the per-player one, so it's addressed positionally off Cutoff.
    const cutoffGradeIdx = cutoffIdx >= 0 ? cutoffIdx + 1 : -1;

    const players: PlayerGrade[] = [];
    const gradeCutoffs: GradeCutoff[] = [];

    for (const r of rows.slice(1)) {
      const player = cell(r, idx.player);
      const score = cell(r, idx.score);

      if (player && score) {
        players.push({
          player,
          pos: cell(r, idx.pos),
          team: cell(r, idx.team),
          status: cell(r, idx.status),
          age: cell(r, idx.age),
          posRank: cell(r, idx.posRank),
          projTgt: cell(r, idx.projTgt),
          projCar: cell(r, idx.projCar),
          rzShare: cell(r, idx.rzShare),
          pctTimeOut: cell(r, idx.pctTimeOut),
          dur: cell(r, idx.dur),
          volumeIdx: cell(r, idx.volumeIdx),
          rzIdx: cell(r, idx.rzIdx),
          availIdx: cell(r, idx.availIdx),
          trajIdx: cell(r, idx.trajIdx),
          score: Number(score),
          grade: cell(r, idx.grade),
        });
      }

      const cutoff = cell(r, cutoffIdx);
      const cutoffGrade = cell(r, cutoffGradeIdx);
      if (cutoff !== "" && cutoffGrade) {
        gradeCutoffs.push({ cutoff: Number(cutoff), grade: cutoffGrade });
      }
    }

    gradeCutoffs.sort((a, b) => a.cutoff - b.cutoff);
    return { players, gradeCutoffs };
  } catch {
    // Sheet unreachable/unshared/renamed — degrade to no grades rather than
    // taking down the Teams page over an external dependency.
    return { players: [], gradeCutoffs: [] };
  }
}

// Cached independently of the page's own (fully dynamic) rendering — the
// sheet changes rarely, so re-fetching it on every /teams view isn't worth
// the latency or the risk of Google rate-limiting/blocking the request.
export const getPlayerGrades = unstable_cache(fetchPlayerGradesUncached, ["player-grades"], {
  revalidate: 60 * 60,
});

// Unicode combining diacritical marks block (U+0300-U+036F), written as
// an escaped code-point range so no literal combining characters end up
// in the source file.
const COMBINING_DIACRITICS = /[\u0300-\u036f]/g;

export function normalizePlayerName(name: string): string {
  return name
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .replace(/[.']/g, "")
    .replace(/\b(jr|sr|ii|iii|iv|v)\.?\b/gi, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function scoreToGrade(score: number, cutoffs: GradeCutoff[]): string | null {
  let result: string | null = null;
  for (const c of cutoffs) {
    if (score >= c.cutoff) result = c.grade;
  }
  return result;
}

export function gradeColor(grade: string): { bg: string; text: string } {
  switch (grade[0]) {
    case "A":
      return { bg: "#5fe0c7", text: "#04372c" };
    case "B":
      return { bg: "#7fb8f5", text: "#0b2c52" };
    case "C":
      return { bg: "#f5c86a", text: "#4a3603" };
    case "D":
      return { bg: "#f0a868", text: "#4a2603" };
    default:
      return { bg: "#e88a8a", text: "#4a0f0f" };
  }
}
