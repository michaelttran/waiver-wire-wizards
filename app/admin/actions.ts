"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { checkPassword, createSession, destroySession, isAuthed } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { syncSleeperLeague } from "@/lib/sleeper";

async function requireAuth() {
  if (!(await isAuthed())) {
    redirect("/admin/login");
  }
}

function revalidatePublicPages() {
  revalidatePath("/");
  revalidatePath("/challenges");
  revalidatePath("/faab");
  revalidatePath("/draft");
}

export async function login(formData: FormData) {
  const ip = await getClientIp();
  const withinLimit = await checkRateLimit("login", ip, {
    windowMs: 15 * 60 * 1000,
    max: 5,
  });
  if (!withinLimit) {
    redirect("/admin/login?error=ratelimited");
  }

  const password = String(formData.get("password") ?? "");
  if (!checkPassword(password)) {
    redirect("/admin/login?error=1");
  }
  await createSession();
  redirect("/admin");
}

export async function logout() {
  await destroySession();
  redirect("/admin/login");
}

export async function updateTeam(formData: FormData) {
  await requireAuth();
  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const ownerName = String(formData.get("ownerName") ?? "").trim();
  const faabStarting = Number(formData.get("faabStarting") ?? 100);
  const buyInPaid = formData.get("buyInPaid") === "on";
  const playoffPaid = formData.get("playoffPaid") === "on";
  const draftPositionRaw = String(formData.get("draftPosition") ?? "").trim();
  const draftPosition = draftPositionRaw === "" ? null : Number(draftPositionRaw);

  if (!id || !name) return;

  await prisma.team.update({
    where: { id },
    data: { name, ownerName, faabStarting, buyInPaid, playoffPaid, draftPosition },
  });

  revalidatePath("/admin");
  revalidatePublicPages();
}

export async function addFaabMove(formData: FormData) {
  await requireAuth();
  const teamId = String(formData.get("teamId") ?? "");
  const week = Number(formData.get("week") ?? 0);
  const description = String(formData.get("description") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);

  if (!teamId || !description || !week || Number.isNaN(amount)) return;

  await prisma.faabTransaction.create({
    data: { teamId, week, description, amount },
  });

  revalidatePath("/admin");
  revalidatePublicPages();
}

export async function deleteFaabMove(formData: FormData) {
  await requireAuth();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.faabTransaction.delete({ where: { id } });

  revalidatePath("/admin");
  revalidatePublicPages();
}

export async function setChallengeWinner(formData: FormData) {
  await requireAuth();
  const id = String(formData.get("id") ?? "");
  const winnerIdRaw = String(formData.get("winnerId") ?? "");
  const winnerId = winnerIdRaw === "" ? null : winnerIdRaw;

  if (!id) return;

  await prisma.weeklyChallenge.update({
    where: { id },
    data: { winnerId },
  });

  revalidatePath("/admin");
  revalidatePublicPages();
}

export async function updateDraftNote(formData: FormData) {
  await requireAuth();
  const note = String(formData.get("draftOrderNote") ?? "").trim();
  if (!note) return;

  await prisma.appSettings.upsert({
    where: { id: 1 },
    update: { draftOrderNote: note },
    create: { id: 1, draftOrderNote: note },
  });

  revalidatePath("/admin");
  revalidatePublicPages();
}

// Bulk-replaces all draft picks. Each non-empty line is:
//   round, team name (exact match), player, position, nfl team[, note]
// Pick number and overall pick are derived from the team's draftPosition
// using standard snake-draft order, so only the round needs to be typed.
export async function replaceDraftPicks(formData: FormData) {
  await requireAuth();
  const raw = String(formData.get("picksCsv") ?? "");
  const teams = await prisma.team.findMany({ where: { draftPosition: { not: null } } });
  const teamCount = teams.length;
  const teamByName = new Map(teams.map((t) => [t.name.trim().toLowerCase(), t]));

  const rows: {
    teamId: string;
    round: number;
    pick: number;
    overall: number;
    playerName: string;
    playerPosition: string;
    nflTeam: string;
    note: string | null;
  }[] = [];

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const parts = trimmed.split(",").map((p) => p.trim());
    const [roundRaw, teamName, player, position, nflTeam, note] = parts;
    const round = Number(roundRaw);
    const team = teamByName.get((teamName ?? "").toLowerCase());

    if (!team || !round || !player || !position || !nflTeam || team.draftPosition == null) {
      continue;
    }

    const pick =
      round % 2 === 1 ? team.draftPosition : teamCount + 1 - team.draftPosition;
    const overall = (round - 1) * teamCount + pick;

    rows.push({
      teamId: team.id,
      round,
      pick,
      overall,
      playerName: player,
      playerPosition: position,
      nflTeam,
      note: note || null,
    });
  }

  if (rows.length === 0) return;

  await prisma.$transaction([
    prisma.draftPick.deleteMany({}),
    ...rows.map((r) => prisma.draftPick.create({ data: r })),
  ]);

  revalidatePath("/admin");
  revalidatePublicPages();
}

export async function syncFromSleeper() {
  await requireAuth();
  const leagueId = process.env.SLEEPER_LEAGUE_ID;
  if (!leagueId) return;

  // Guards against accidentally hammering Sleeper's API (and churning the
  // DB) from a mis-clicked or double-submitted button.
  const withinLimit = await checkRateLimit("sleeper-sync", "global", {
    windowMs: 60 * 1000,
    max: 3,
  });
  if (!withinLimit) return;

  await syncSleeperLeague(leagueId);

  revalidatePath("/admin");
  revalidatePublicPages();
}
