import { prisma } from "@/lib/prisma";

const SLEEPER_API = "https://api.sleeper.app/v1";

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
  round: number;
  pick_no: number;
  draft_slot: number;
  picked_by: string;
  metadata: SleeperPickMetadata;
};

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
      name: user.metadata?.team_name?.trim() || `Team ${user.display_name}`,
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
        },
      });
      pickCount++;
    }
  }

  await prisma.appSettings.upsert({
    where: { id: 1 },
    update: { sleeperLastSynced: new Date() },
    create: { id: 1, sleeperLastSynced: new Date() },
  });

  return { teamCount: users.length, pickCount };
}
