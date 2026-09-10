import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { syncSleeperLeague } from "@/lib/sleeper";

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
  revalidatePath("/admin");

  return NextResponse.json(result);
}
