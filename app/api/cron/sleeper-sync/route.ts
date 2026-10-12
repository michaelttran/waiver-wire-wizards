import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { syncSleeperLeague } from "@/lib/sleeper";

// The full sync (rosters, draft picks, season points + weekly usage stats
// for every week so far, NGS receiving, ADP) reliably takes ~30s end to end.
// Vercel's default function timeout is 10s unless raised explicitly — this
// opts into the max a Hobby plan allows (Pro/Enterprise can go higher, but
// 60s already leaves 2x headroom over the measured runtime).
export const maxDuration = 60;

// Vercel Cron invokes this on the schedule in vercel.json and sends
// `Authorization: Bearer $CRON_SECRET` automatically when that env var is
// set — this rejects anyone else who finds the URL.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const leagueId = process.env.SLEEPER_LEAGUE_ID;
  if (!leagueId) {
    return NextResponse.json({ error: "SLEEPER_LEAGUE_ID is not set" }, { status: 500 });
  }

  const result = await syncSleeperLeague(leagueId);

  revalidatePath("/");
  revalidatePath("/challenges");
  revalidatePath("/faab");
  revalidatePath("/draft");
  revalidatePath("/teams");
  revalidatePath("/data");
  revalidatePath("/admin");

  return NextResponse.json(result);
}
