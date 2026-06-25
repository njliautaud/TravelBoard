-- Friends list + inbox notifications
-- Additive only: new enums + tables. Safe for the shared stable (:3001) DB —
-- older code simply ignores them. Idempotent guards so it can re-run cleanly.

-- CreateEnum (guarded — CREATE TYPE has no IF NOT EXISTS)
DO $$ BEGIN
  CREATE TYPE "FriendStatus" AS ENUM ('PENDING', 'ACCEPTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationType" AS ENUM ('FRIEND_REQUEST', 'FRIEND_ACCEPTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateTable: Friendship
CREATE TABLE IF NOT EXISTS "Friendship" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "addresseeId" TEXT NOT NULL,
    "status" "FriendStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Friendship_requesterId_addresseeId_key"
    ON "Friendship"("requesterId", "addresseeId");
CREATE INDEX IF NOT EXISTS "Friendship_addresseeId_status_idx"
    ON "Friendship"("addresseeId", "status");
CREATE INDEX IF NOT EXISTS "Friendship_requesterId_status_idx"
    ON "Friendship"("requesterId", "status");

ALTER TABLE "Friendship" DROP CONSTRAINT IF EXISTS "Friendship_requesterId_fkey";
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_requesterId_fkey"
    FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Friendship" DROP CONSTRAINT IF EXISTS "Friendship_addresseeId_fkey";
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_addresseeId_fkey"
    FOREIGN KEY ("addresseeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: Notification
CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "actorId" TEXT,
    "friendshipId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Notification_userId_read_createdAt_idx"
    ON "Notification"("userId", "read", "createdAt");

ALTER TABLE "Notification" DROP CONSTRAINT IF EXISTS "Notification_userId_fkey";
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" DROP CONSTRAINT IF EXISTS "Notification_actorId_fkey";
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
