-- Move authentication to Supabase Auth. The Prisma `User` row stays the app's
-- domain record (username, role, locations, friends…); Supabase Auth owns the
-- credentials/OAuth identity. We link the two with `authId` = the Supabase
-- `auth.users.id` (a UUID), and add `email` so an existing username-only row can
-- be claimed by its owner the first time that email signs in.
--
-- `passwordHash` is no longer written (Supabase stores credentials) so it becomes
-- nullable; the column is kept rather than dropped to avoid losing the legacy
-- hashes during the transition. Additive + idempotent.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "authId" TEXT;
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- Case-insensitive uniqueness would need a citext/expression index; emails are
-- stored already-lowercased by the app, so a plain unique index is sufficient.
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User" ("email");
CREATE UNIQUE INDEX IF NOT EXISTS "User_authId_key" ON "User" ("authId");
