import { prisma } from "@/lib/prisma";
import { VALUE_POSITIONS } from "@/lib/fpor";
import { snapshotMarketAdp } from "@/lib/marketAdp";

const SLEEPER_API = "https://api.sleeper.app/v1";

type SleeperLeague = {
  season: string;
  total_rosters: number;
  scoring_settings: Record<string, number>;
};

type SleeperNflState = {
  season: string;
  season_type: string; // "pre" | "regular" | "post" | "off"
  week: number;
};

type SleeperWeekStats = Record<string, Record<string, number>>;

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
  player_id: string;
  round: number;
  pick_no: number;
  draft_slot: number;
  picked_by: string;
  metadata: SleeperPickMetadata;
};

type SleeperRoster = {
  owner_id: string | null;
  players: string[] | null;
  starters: string[] | null;
  reserve: string[] | null;
  taxi: string[] | null;
};

type SleeperPlayer = {
  first_name?: string;
  last_name?: string;
  full_name?: string;
  position?: string;
  team?: string | null;
};

export type SleeperPlayersMap = Record<string, SleeperPlayer>;

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

function rosterPlayerName(playerId: string, player: SleeperPlayer | undefined): string {
  if (!player) return playerId;
  if (player.position === "DEF") return player.last_name || player.full_name || playerId;
  return (
    player.full_name ||
    `${player.first_name ?? ""} ${player.last_name ?? ""}`.trim() ||
    playerId
  );
}

function rosterSlot(playerId: string, roster: SleeperRoster): string {
  if (roster.starters?.includes(playerId)) return "starter";
  if (roster.reserve?.includes(playerId)) return "ir";
  if (roster.taxi?.includes(playerId)) return "taxi";
  return "bench";
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
          sleeperPlayerId: p.player_id,
        },
      });
      pickCount++;
    }
  }

  const rosters = await sleeperFetch<SleeperRoster[]>(`/league/${leagueId}/rosters`);
  // Sleeper asks that this ~5MB dump be pulled "at most once per day" per
  // league — fine here since this runs from the daily cron and the
  // occasional manual admin click, never per-request.
  const players = await sleeperFetch<SleeperPlayersMap>(`/players/nfl`);

  const rosterRows: {
    teamId: string;
    sleeperPlayerId: string;
    playerName: string;
    playerPosition: string;
    nflTeam: string | null;
    slot: string;
  }[] = [];

  for (const roster of rosters) {
    const teamId = roster.owner_id ? teamIdBySleeperUserId.get(roster.owner_id) : undefined;
    if (!teamId) continue;

    for (const playerId of roster.players ?? []) {
      const player = players[playerId];
      rosterRows.push({
        teamId,
        sleeperPlayerId: playerId,
        playerName: rosterPlayerName(playerId, player),
        playerPosition: player?.position ?? "?",
        nflTeam: player?.team ?? null,
        slot: rosterSlot(playerId, roster),
      });
    }
  }

  // createMany instead of one create() per row (as draft picks use) — a full
  // league roster sync is 150+ rows, which blew past the interactive
  // transaction's default 5s timeout when done as individual creates.
  await prisma.$transaction([
    prisma.rosterPlayer.deleteMany({}),
    prisma.rosterPlayer.createMany({ data: rosterRows }),
  ]);

  // Season points and the market ADP snapshot feed only the value grid on
  // /draft, so a failure there (e.g. a third-party API being down) is logged
  // rather than failing the whole sync.
  const league = await sleeperFetch<SleeperLeague>(`/league/${leagueId}`);
  let statsThroughWeek: number | null = null;
  try {
    statsThroughWeek = await syncSeasonPoints(league, players);
  } catch (err) {
    console.error("Season points sync failed", err);
  }

  let adpEntryCount = await prisma.adpEntry.count();
  if (adpEntryCount === 0) {
    try {
      adpEntryCount = await snapshotMarketAdp(league.total_rosters, league.season, players);
    } catch (err) {
      console.error("Market ADP snapshot failed", err);
    }
  }

  await prisma.appSettings.upsert({
    where: { id: 1 },
    update: {
      sleeperLastSynced: new Date(),
      ...(statsThroughWeek !== null && { statsThroughWeek }),
    },
    create: {
      id: 1,
      sleeperLastSynced: new Date(),
      statsThroughWeek,
    },
  });

  return {
    teamCount: users.length,
    pickCount,
    rosterPlayerCount: rosterRows.length,
    statsThroughWeek,
    adpEntryCount,
  };
}

// Rebuilds PlayerSeasonPoints from Sleeper's weekly stat lines, scored with the
// league's own scoring_settings — Sleeper keys stats and scoring rules by the
// same names (pass_td, rec, rush_yd, ...), so a player's points are just the
// sum of stat × rule. Returns the last week included.
async function syncSeasonPoints(
  league: SleeperLeague,
  players: SleeperPlayersMap
): Promise<number> {
  const state = await sleeperFetch<SleeperNflState>(`/state/nfl`);
  let lastWeek = 0;
  if (state.season === league.season) {
    if (state.season_type === "regular") lastWeek = state.week;
    else if (state.season_type === "post" || state.season_type === "off") lastWeek = 18;
  } else if (Number(state.season) > Number(league.season)) {
    lastWeek = 18;
  }

  const totals = new Map<string, { points: number; gamesPlayed: number }>();
  for (let week = 1; week <= lastWeek; week++) {
    const stats = await sleeperFetch<SleeperWeekStats>(
      `/stats/nfl/regular/${league.season}/${week}`
    );
    for (const [playerId, line] of Object.entries(stats)) {
      const position = players[playerId]?.position;
      if (!position || !(VALUE_POSITIONS as readonly string[]).includes(position)) continue;

      let points = 0;
      for (const [stat, value] of Object.entries(line)) {
        points += value * (league.scoring_settings[stat] ?? 0);
      }
      const total = totals.get(playerId) ?? { points: 0, gamesPlayed: 0 };
      total.points += points;
      if ((line.gp ?? 0) > 0) total.gamesPlayed++;
      totals.set(playerId, total);
    }
  }

  const rows = [...totals.entries()]
    .filter(([, t]) => t.gamesPlayed > 0)
    .map(([playerId, t]) => ({
      sleeperPlayerId: playerId,
      playerName: rosterPlayerName(playerId, players[playerId]),
      playerPosition: players[playerId]?.position ?? "?",
      nflTeam: players[playerId]?.team ?? null,
      points: Math.round(t.points * 100) / 100,
      gamesPlayed: t.gamesPlayed,
    }));

  await prisma.$transaction([
    prisma.playerSeasonPoints.deleteMany({}),
    prisma.playerSeasonPoints.createMany({ data: rows }),
  ]);

  return lastWeek;
}

// Retakes the market ADP snapshot on demand (from /admin). The daily sync only
// takes one when none exists, so the grid stays frozen at draft-season ADP.
export async function refreshMarketAdp(leagueId: string) {
  const league = await sleeperFetch<SleeperLeague>(`/league/${leagueId}`);
  const players = await sleeperFetch<SleeperPlayersMap>(`/players/nfl`);
  return snapshotMarketAdp(league.total_rosters, league.season, players);
}
