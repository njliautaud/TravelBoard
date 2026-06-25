-- Repair long-standing schema drift.
--
-- Migration 20260613120000_user_settings added User.mapTheme as TEXT, but
-- schema.prisma models it as the MapTheme enum. The enum + column conversion
-- was applied to the original (Neon) DB by hand and never captured as a
-- migration, so replaying history onto a fresh DB (Supabase) left mapTheme as
-- TEXT with no MapTheme type -> the Prisma client's enum cast fails.
--
-- This captures that repair. It is GUARDED and data-preserving so it is a safe
-- no-op where already correct (Neon) and an in-place convert where not
-- (Supabase). It NEVER drops/recreates the column (golden rule: no data loss).

-- CreateEnum (guarded — CREATE TYPE has no IF NOT EXISTS)
DO $$ BEGIN
  CREATE TYPE "MapTheme" AS ENUM ('CLASSIC', 'FLAG');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Convert TEXT -> MapTheme in place, preserving existing values, only if the
-- column is still TEXT (skip where it is already the enum).
DO $$
BEGIN
  IF (
    SELECT data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'mapTheme'
  ) = 'text' THEN
    ALTER TABLE "User" ALTER COLUMN "mapTheme" DROP DEFAULT;
    ALTER TABLE "User" ALTER COLUMN "mapTheme" TYPE "MapTheme" USING "mapTheme"::"MapTheme";
    ALTER TABLE "User" ALTER COLUMN "mapTheme" SET DEFAULT 'CLASSIC';
  END IF;
END $$;
