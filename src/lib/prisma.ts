import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Ensure the DATABASE_URL has a reasonable connection_limit for serverless.
 * The Supabase migration guide recommends connection_limit=1, but that
 * causes pool timeouts when routes make concurrent queries.
 */
function patchedDatasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  // Replace connection_limit=1 with connection_limit=5
  return url.replace(/connection_limit=1\b/, "connection_limit=5");
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: patchedDatasourceUrl(),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
