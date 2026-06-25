-- Tracks whether a user has explicitly chosen their username. Existing rows and
-- email/password signups (which pick a username up front) are complete (true).
-- OAuth signups are auto-provisioned with a derived placeholder and start false
-- so the UI prompts them to pick one. Additive + idempotent.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "usernameSet" BOOLEAN NOT NULL DEFAULT true;
