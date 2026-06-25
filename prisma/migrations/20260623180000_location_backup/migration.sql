-- Condensed client-synced backup of map markers.
-- Additive only: a new table. Safe for the shared stable (:3001) DB — older code
-- ignores it. Idempotent guards so it can re-run cleanly.

CREATE TABLE IF NOT EXISTS "LocationBackup" (
    "locationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "status" "VisitStatus" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LocationBackup_pkey" PRIMARY KEY ("locationId")
);

CREATE INDEX IF NOT EXISTS "LocationBackup_userId_idx" ON "LocationBackup"("userId");

ALTER TABLE "LocationBackup" DROP CONSTRAINT IF EXISTS "LocationBackup_userId_fkey";
ALTER TABLE "LocationBackup" ADD CONSTRAINT "LocationBackup_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
