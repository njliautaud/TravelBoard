-- Multi-user auth, drafts inbox, seasons, cover images

ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "coverImageUrl" TEXT;
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "seasonSpring" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "seasonSummer" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "seasonFall" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "seasonWinter" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;

-- bcrypt hash for password "asdf"
INSERT INTO "User" ("id", "email", "username", "passwordHash", "role", "createdAt")
VALUES (
  'legacy-owner-user',
  'william@travelboard.local',
  'william',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'OWNER',
  NOW()
)
ON CONFLICT DO NOTHING;

UPDATE "User"
SET
  "username" = COALESCE("username", 'william'),
  "passwordHash" = COALESCE("passwordHash", '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy')
WHERE "id" = 'legacy-owner-user' OR "email" = 'william@travelboard.local';

UPDATE "Location"
SET "userId" = (SELECT "id" FROM "User" WHERE "username" = 'william' LIMIT 1)
WHERE "userId" IS NULL;

ALTER TABLE "Location" ALTER COLUMN "userId" SET NOT NULL;

ALTER TABLE "Location" DROP CONSTRAINT IF EXISTS "Location_userId_fkey";
ALTER TABLE "Location" ADD CONSTRAINT "Location_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "User_email_key";
ALTER TABLE "User" DROP COLUMN IF EXISTS "email";
ALTER TABLE "User" DROP COLUMN IF EXISTS "name";
ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "passwordHash" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");

CREATE INDEX IF NOT EXISTS "Location_userId_idx" ON "Location"("userId");

CREATE TABLE IF NOT EXISTS "Draft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rawText" TEXT,
    "extractedUrl" TEXT,
    "source" TEXT NOT NULL DEFAULT 'whatsapp',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Draft_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Draft_userId_createdAt_idx" ON "Draft"("userId", "createdAt");

ALTER TABLE "Draft" DROP CONSTRAINT IF EXISTS "Draft_userId_fkey";
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
