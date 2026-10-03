import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const PER_IP_PER_MINUTE = 30;
// Real site paths only, so a script can't fill the log with junk text.
const VALID_PATH = /^\/[A-Za-z0-9\-_/]{0,99}$/;
const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|vercel-screenshot/i;

// Vercel's edge sets these; city is URL-encoded.
function header(request: NextRequest, name: string): string | null {
  const value = request.headers.get(name);
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// Receives the page-view beacon from components/VisitTracker.tsx.
export async function POST(request: NextRequest) {
  const path = (await request.text()).trim().slice(0, 200);
  const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? null;
  if (!VALID_PATH.test(path) || (userAgent && BOT_UA.test(userAgent))) {
    return new NextResponse(null, { status: 204 });
  }

  // Vercel sets x-forwarded-for itself and drops any value the client sent,
  // so this can't be spoofed in production.
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown";

  // The endpoint is public, so cap how fast one IP can add rows; nobody
  // browsing the site opens 30 pages a minute.
  const recent = await prisma.pageVisit.count({
    where: { ip, createdAt: { gte: new Date(Date.now() - 60 * 1000) } },
  });
  if (recent >= PER_IP_PER_MINUTE) return new NextResponse(null, { status: 204 });

  await prisma.pageVisit.create({
    data: {
      path,
      ip,
      userAgent,
      city: header(request, "x-vercel-ip-city"),
      region: header(request, "x-vercel-ip-country-region"),
      country: header(request, "x-vercel-ip-country"),
    },
  });
  await prisma.pageVisit.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - RETENTION_MS) } },
  });

  return new NextResponse(null, { status: 204 });
}
