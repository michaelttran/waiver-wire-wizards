import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { refreshMarketAdp } from "@/lib/sleeper";

// Weekly (Tuesday) retake of the market ADP snapshot behind the value grid on
// /draft, on the schedule in vercel.json. Same auth as the Sleeper sync cron:
// Vercel sends `Authorization: Bearer $CRON_SECRET`.
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

  const adpEntryCount = await refreshMarketAdp(leagueId);

  revalidatePath("/draft");
  revalidatePath("/admin");

  return NextResponse.json({ adpEntryCount });
}
