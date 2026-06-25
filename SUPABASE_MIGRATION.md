# Neon → Supabase migration runbook

Full move of TravelBoard from the shared **Neon** Postgres to **Supabase**
(DB + Storage), for the friends soft-launch. Chosen because Supabase bundles
Realtime + Edge Functions for the planned globe + AI agent.

**Golden rule:** never `prisma migrate dev` — it diffs the schema and will drop/
recreate columns (e.g. `User.mapTheme`) = data loss. We only ever
`prisma migrate deploy`, which replays the hand-written migration history as-is.

The migration history was audited and is Supabase-clean: no `CREATE EXTENSION`,
no `gen_random_uuid`, no `GRANT/REVOKE`, no schema/`search_path` tricks — so a
fresh `migrate deploy` reproduces the exact schema with no drift.

---

## 0. Backup (DONE)

A version-independent logical backup already exists (pg_dump is blocked: local
client is 16.x, Neon server is PG 17):

    backups/travelboard-data-<timestamp>.json   # 29 wishes + media/users/etc.

Re-run any time before cutover to refresh it:

    node scripts/export-db-backup.mjs

---

## 1. Create the Supabase project & bucket

1. New project at supabase.com. Note the **region** and the **DB password** you set.
2. Storage → **New bucket** → name `uploads` → **Public** (so `getPublicUrl` works).
3. Project Settings → **API**: copy `Project URL` and the `service_role` secret key.
4. Project Settings → **Database** → Connection string: copy the **Transaction
   pooler** (port 6543) and a migration URL — **Direct** (port 5432,
   `db.<ref>.supabase.co`) if you have IPv6, else the **Session pooler**
   (port 5432, `...pooler.supabase.com`) which is IPv4.

---

## 2. `.env` changes for Prisma  ← the connection-string checklist

Prisma needs two URLs (already wired in `schema.prisma`: `url` + `directUrl`).

| Var | Value | Notes |
|-----|-------|-------|
| `DATABASE_URL` | Transaction pooler, port **6543** | App runtime. **Append** `?pgbouncer=true&connection_limit=1` — required so Prisma disables prepared statements under PgBouncer. |
| `DIRECT_URL`   | Direct (5432, `db.<ref>...`) or Session pooler (5432, `...pooler...`) | Migrations only. Must **not** be the 6543 transaction pooler. |

```dotenv
# --- Supabase Postgres (replaces the Neon URLs) ---
DATABASE_URL="postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres:<PASSWORD>@db.<ref>.supabase.co:5432/postgres"
# If your network is IPv4-only, use the Session pooler for DIRECT_URL instead:
# DIRECT_URL="postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres"
```

> Keep the old Neon URLs commented out until cutover is verified — instant rollback.

### Storage env (for the upload route)

```dotenv
STORAGE_DRIVER="supabase"                 # dev can leave this unset/local
SUPABASE_URL="https://<ref>.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="<service_role secret>"   # SERVER ONLY — never NEXT_PUBLIC
SUPABASE_STORAGE_BUCKET="uploads"
```

`SUPABASE_SERVICE_ROLE_KEY` bypasses RLS — it must stay server-side only. `.env`
is gitignored; never expose it with a `NEXT_PUBLIC_` prefix.

---

## 3. Build the schema on Supabase (golden-rule safe)

With `.env` pointed at Supabase:

    npx prisma migrate deploy      # replays history into the empty DB — NOT migrate dev
    npx prisma generate

---

## 4. Load the data

    node scripts/import-db-backup.mjs backups/travelboard-data-<timestamp>.json

It inserts parents→children with `skipDuplicates`, decoding the base64 image
bytes. Confirm the printed counts match the backup:
`user 2, location 29, media 36, storedImage 2, imageCache 26, ...`

> No local upload files to migrate: 0 media rows use `/uploads/` and the folder
> is empty. The storage refactor only affects *future* uploads.

---

## 5. Cutover & verify

1. Restart both servers (dev :3000 and stable :3001) so they pick up the new `.env`.
2. Log in, confirm all 29 wishes + covers render.
3. Add a place and upload a photo → confirm the response URL is a
   `https://<ref>.supabase.co/storage/v1/object/public/uploads/...` link and the
   image loads.
4. Only then delete the Neon project (or keep it paused as a fallback).

---

## 6. Don't forget the stable worktree

Per the shared-deps rule, after this dep change run in `TravelBoard-stable`:

    npm install        # picks up @supabase/supabase-js

The DB is shared, so step 3–4 run **once** — both worktrees then point at Supabase.

---

## Follow-ups (not blocking launch)

- `StoredImage` keeps image bytes in Postgres. Free-tier DB is 500 MB; if reel
  covers pile up, move them to the `uploads` bucket too (same `saveUpload`).
- Pre-existing tsc errors in `src/app/api/hardware-cover/route.ts` are unrelated
  to this migration.
