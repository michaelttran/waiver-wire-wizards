import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";
import { prisma } from "@/lib/prisma";

// Weekly recaps live as Markdown files in content/recaps so the Tuesday recap
// job can publish one by committing a file, with no database write and no
// admin login. next.config.ts traces this folder into the /challenges bundle.
const RECAPS_DIR = path.join(process.cwd(), "content", "recaps");

export type Recap = { week: number; title: string; html: string };

// Recap and standings Markdown never spells out a team name. It writes
// {{team:<sleeperUserId>}} instead, and that's swapped for the team's current
// name from the database at render time, so renames show up everywhere
// without editing old recaps. Tokens are replaced after Markdown rendering so
// a name with * or _ in it can't turn into formatting.
const TEAM_TOKEN = /\{\{team:(\d+)\}\}/g;

type NameMap = Map<string, string>;

async function getTeamNames(): Promise<NameMap> {
  const names: NameMap = new Map();
  // standings.json names are the fallback for a team the database can't match.
  try {
    const data = JSON.parse(await readFile(path.join(RECAPS_DIR, "standings.json"), "utf8"));
    for (const row of data.rows as { sleeperUserId: string; name: string }[]) {
      names.set(row.sleeperUserId, row.name);
    }
  } catch {
    // No standings file yet; the database names are enough.
  }
  const teams = await prisma.team.findMany({
    where: { sleeperUserId: { not: null } },
    select: { sleeperUserId: true, name: true },
  });
  for (const t of teams) if (t.sleeperUserId) names.set(t.sleeperUserId, t.name);
  return names;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function resolveNames(text: string, names: NameMap, escape: boolean): string {
  return text.replace(TEAM_TOKEN, (_, id: string) => {
    const name = names.get(id) ?? "a mystery team";
    return escape ? escapeHtml(name) : name;
  });
}

// Splits a file's leading "# Title" line from its body, so the title can sit
// in the collapsible header and the body renders underneath it.
async function renderFile(
  fileName: string,
  names: NameMap,
): Promise<{ title: string; html: string }> {
  const raw = await readFile(path.join(RECAPS_DIR, fileName), "utf8");
  const [firstLine, ...rest] = raw.trimStart().split("\n");
  const hasTitle = firstLine.startsWith("# ");
  const title = hasTitle ? firstLine.slice(2).trim() : "";
  const body = hasTitle ? rest.join("\n") : raw;
  return {
    title: resolveNames(title, names, false),
    html: resolveNames(await marked.parse(body), names, true),
  };
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
  if (weeks.length === 0) return [];

  const names = await getTeamNames();
  return Promise.all(
    weeks.map(async ({ file, week }) => {
      const { title, html } = await renderFile(file, names);
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
    notesHtml = (await renderFile("standings.md", await getTeamNames())).html;
  } catch {
    // Commentary is optional; the table stands on its own.
  }
  return { ...data, notesHtml };
}
