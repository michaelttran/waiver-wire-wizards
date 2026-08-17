"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { checkPassword, createSession, destroySession, isAuthed } from "@/lib/auth";

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

  if (!id || !name) return;

  await prisma.team.update({
    where: { id },
    data: { name, ownerName, faabStarting, buyInPaid, playoffPaid },
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
