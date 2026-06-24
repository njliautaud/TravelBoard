# Mac setup — sync with the shared cloud database

**Note left by the Windows-PC Claude for the Mac's Claude Code.**

This repo now uses a **shared Neon Postgres (cloud)** as its database, so every
machine — this Mac, the Windows PC — and the Tailscale-served app all read/write
the **same** wishes. You do **NOT** need a local Postgres on the Mac.

The Mac's `npm run dev` wasn't synced before because it was hitting its own empty
local Postgres. The fix is just pointing it at the shared Neon DB via `.env`.

## One-time setup (run in the repo root after `git pull`)

1. **Get the `.env`.** It is gitignored (it holds secrets) so it is intentionally
   NOT in this repo. Copy `.env` from the Windows PC verbatim into this repo root.
   It contains:
   - `DATABASE_URL` and `DIRECT_URL` → the Neon connection string (`...neon.tech...`).
   - `SESSION_SECRET` → **must be identical to the PC's**, or logins won't carry
     across machines.
   - the other keys (`WHATSAPP_INGEST_KEY`, etc.).
   Ask William to send/AirDrop the file or paste its contents. **Never commit it.**

2. Install deps + generate the Prisma client:
   ```bash
   npm install
   npx prisma generate
   ```
   Do **NOT** run `prisma migrate dev` — the Neon schema is already current
   (migrations were applied from the PC, and `migrate dev` can cause mapTheme
   drift / data loss). If you ever add a new migration, use `npx prisma migrate deploy`.

3. Start it:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000, log in, and you should see the SAME wishes as the
   PC (swann currently has 25). Add a wish here and it shows up on the PC too —
   both hit the same Neon database.

## Troubleshooting
- DB connection errors → re-check `.env`: `DATABASE_URL` must be the `...neon.tech`
  URL, not `localhost`.
- Wishes still not showing → confirm you logged in as the same user, and that
  `SESSION_SECRET` matches the PC's.

## Context
- This Mac is for building the iOS app later. The web app data is shared via Neon,
  so whatever you build/test here uses the live shared dataset.
- The Neon connection string is a secret — it lives only in `.env`, never in git.
