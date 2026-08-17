import path from "node:path";
import { PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// The generated client resolves relative `file:` sqlite URLs against its own
// output directory, which breaks once Next.js bundles this module into a
// different chunk location. Resolve local sqlite paths against the project
// root (process.cwd(), which Next.js keeps stable) instead. Non-file
// datasource URLs (e.g. Postgres in production) pass through unchanged.
function resolveDatasourceUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (url.startsWith("file:")) {
    const relative = url.slice("file:".length);
    if (!path.isAbsolute(relative)) {
      return `file:${path.join(process.cwd(), "prisma", path.basename(relative))}`;
    }
  }
  return url;
}

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl: resolveDatasourceUrl() });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
