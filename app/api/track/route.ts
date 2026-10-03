import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
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
  if (!path.startsWith("/") || (userAgent && BOT_UA.test(userAgent))) {
    return new NextResponse(null, { status: 204 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown";

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
