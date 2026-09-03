import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

// Resolves the caller's IP from the headers Vercel's edge network sets.
// Falls back to "unknown" locally (dev) where those headers aren't present —
// that just means all local requests share one bucket, which is fine.
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwardedFor = h.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  const realIp = h.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

// Sliding-window rate limit backed by the database, so it holds up across
// Vercel's independent serverless instances (an in-memory counter would not).
// Returns true if the caller is still within the limit; also records this
// attempt when it is. Opportunistically prunes rows older than the window so
// the table doesn't grow unbounded under sustained abuse.
export async function checkRateLimit(
  scope: string,
  key: string,
  { windowMs, max }: { windowMs: number; max: number }
): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowMs);

  await prisma.rateLimitAttempt.deleteMany({
    where: { scope, createdAt: { lt: windowStart } },
  });

  const count = await prisma.rateLimitAttempt.count({
    where: { scope, key, createdAt: { gte: windowStart } },
  });

  if (count >= max) return false;

  await prisma.rateLimitAttempt.create({ data: { scope, key } });
  return true;
}
