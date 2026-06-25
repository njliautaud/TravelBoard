-- Passport feature: per-user list of visited regions (country ISO-3 codes like
-- "USA"/"FRA" and US-state codes like "US-CA"). Stored as a plain text array on
-- the User, entirely independent of Location/Wish rows so logging a visited
-- region never creates an empty wish nor changes the wishlist heatmap brightness.
-- Additive + idempotent.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "visitedRegions" TEXT[] NOT NULL DEFAULT '{}';

-- Tracks when the user finished or dismissed the "map where you've been"
-- onboarding. NULL means it hasn't been shown yet, so every existing row gets
-- the welcome prompt exactly once; new signups also start NULL.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passportOnboardedAt" TIMESTAMP(3);
