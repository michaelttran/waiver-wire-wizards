import { prisma } from "@/lib/prisma";
import { playerKey } from "@/lib/fpor";
import type { SleeperPlayersMap } from "@/lib/sleeper";

// Market ADP comes from Fantasy Football Calculator's public API (Sleeper
// doesn't publish ADP). It aggregates real and mock drafts by scoring format
// and league size, so this pulls half-PPR for the league's team count.
const FFC_API = "https://fantasyfootballcalculator.com/api/v1/adp/half-ppr";
const FFC_TEAM_SIZES = [8, 10, 12, 14];

type FfcResponse = {
  status: string;
  meta?: { total_drafts?: number; start_date?: string; end_date?: string };
  players?: {
    name: string;
    position: string;
    team: string | null;
    adp: number;
  }[];
};

// FFC labels kickers "PK"; everything else matches Sleeper.
function sleeperPosition(ffcPosition: string): string {
  return ffcPosition === "PK" ? "K" : ffcPosition;
}

// Replaces the AdpEntry snapshot with FFC's current half-PPR ADP. Returns the
// number of players stored.
export async function snapshotMarketAdp(
  teamCount: number,
  season: string,
  players: SleeperPlayersMap
): Promise<number> {
  const teams = FFC_TEAM_SIZES.reduce((best, size) =>
    Math.abs(size - teamCount) < Math.abs(best - teamCount) ? size : best
  );
  const res = await fetch(`${FFC_API}?teams=${teams}&year=${season}&position=all`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`FFC ADP request failed (${res.status})`);
  const body = (await res.json()) as FfcResponse;
  if (body.status !== "Success" || !body.players?.length) {
    throw new Error(`FFC ADP returned no players (status: ${body.status})`);
  }

  const sleeperIdByKey = new Map<string, string>();
  for (const [id, p] of Object.entries(players)) {
    const name = p.full_name || `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
    if (name && p.position && p.team) sleeperIdByKey.set(playerKey(name, p.position), id);
  }

  const rows = [...body.players]
    .sort((a, b) => a.adp - b.adp)
    .map((p, i) => {
      const position = sleeperPosition(p.position);
      return {
        overall: i + 1,
        adp: p.adp,
        playerName: p.name,
        playerPosition: position,
        nflTeam: p.team,
        sleeperPlayerId: sleeperIdByKey.get(playerKey(p.name, position)) ?? null,
      };
    });

  const { meta } = body;
  const note = [
    `Fantasy Football Calculator half-PPR, ${teams} teams`,
    meta?.start_date && meta?.end_date && `drafts ${meta.start_date} to ${meta.end_date}`,
    meta?.total_drafts && `${meta.total_drafts.toLocaleString("en-US")} drafts`,
  ]
    .filter(Boolean)
    .join(", ");

  await prisma.$transaction([
    prisma.adpEntry.deleteMany({}),
    prisma.adpEntry.createMany({ data: rows }),
    prisma.appSettings.upsert({
      where: { id: 1 },
      update: { adpSnapshotAt: new Date(), adpSnapshotNote: note },
      create: { id: 1, adpSnapshotAt: new Date(), adpSnapshotNote: note },
    }),
  ]);

  return rows.length;
}
