-- Per-spot public publishing for the public feed. Additive and idempotent:
-- each Location can be individually published (isPublic=true) while the rest of
-- the owner's board stays private. Index supports the feed query
-- (where isPublic=true order by createdAt desc).
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "Location_isPublic_createdAt_idx" ON "Location" ("isPublic", "createdAt");
