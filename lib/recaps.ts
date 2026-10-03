import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";

// Weekly recaps live as Markdown files in content/recaps so the Tuesday recap
// job can publish one by committing a file, with no database write and no
// admin login. next.config.ts traces this folder into the /challenges bundle.
const RECAPS_DIR = path.join(process.cwd(), "content", "recaps");

export type Recap = { week: number; title: string; html: string };

// Splits a file's leading "# Title" line from its body, so the title can sit
// in the collapsible header and the body renders underneath it.
async function renderFile(fileName: string): Promise<{ title: string; html: string }> {
  const raw = await readFile(path.join(RECAPS_DIR, fileName), "utf8");
  const [firstLine, ...rest] = raw.trimStart().split("\n");
  const hasTitle = firstLine.startsWith("# ");
  const title = hasTitle ? firstLine.slice(2).trim() : "";
  const body = hasTitle ? rest.join("\n") : raw;
  return { title, html: await marked.parse(body) };
}

export async function getRecaps(): Promise<Recap[]> {
  let files: string[];
  try {
    files = await readdir(RECAPS_DIR);
  } catch {
    return [];
  }
  const weeks = files
    .map((f) => ({ file: f, match: /^week-(\d+)\.md$/.exec(f) }))
    .filter((f): f is { file: string; match: RegExpExecArray } => f.match !== null)
    .map((f) => ({ file: f.file, week: Number(f.match[1]) }))
    .sort((a, b) => b.week - a.week);

  return Promise.all(
    weeks.map(async ({ file, week }) => {
      const { title, html } = await renderFile(file);
      return { week, title: title || `Week ${week}`, html };
    }),
  );
}

export type StandingsRow = {
  sleeperUserId: string;
  name: string;
  wins: number;
  losses: number;
  ties?: number;
  points: number;
  allPlayWins: number;
  allPlayLosses: number;
  playoffOdds: number;
};

export type Standings = { afterWeek: number; rows: StandingsRow[]; notesHtml: string };

export async function getStandings(): Promise<Standings | null> {
  let data: { afterWeek: number; rows: StandingsRow[] };
  try {
    data = JSON.parse(await readFile(path.join(RECAPS_DIR, "standings.json"), "utf8"));
  } catch {
    return null;
  }
  let notesHtml = "";
  try {
    notesHtml = (await renderFile("standings.md")).html;
  } catch {
    // Commentary is optional; the table stands on its own.
  }
  return { ...data, notesHtml };
}
