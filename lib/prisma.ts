import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Wasm-based driver adapter instead of the binary Rust query engine — the
// binary approach doesn't reliably survive Vercel's serverless bundling with
// a custom generator output path (see the "Query Engine ... rhel-openssl"
// deployment errors this replaced). The adapter needs a plain connection
// string, so it uses the pooled DATABASE_URL directly rather than Prisma's
// own URL parsing.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
