# Deploying Farseer

**Setup** (since 2026-10-02): **Vercel Pro** (the PWA on the CDN, the API as
one Node function, Vercel Cron for the poller) + an external **Supabase**
Postgres (free tier). Before that it ran on Northflank (one combined service);
the `Dockerfile` still works for any host with a long-lived process.

> 🔑 Secrets live in Vercel's environment variables and in gitignored local
> files only: `apps/api/.env.local` (VAPID keypair, CRON_SECRET) and
> `apps/api/.env.prod.local` (Supabase URLs). Keep them in your password
> manager: **regenerating the VAPID pair silently kills notifications on every
> installed PWA**.

How it fits together:

- `vercel.json` runs `scripts/vercel-build.sh`, which writes `.vercel/output`
  (Build Output API v3): the web build as static files, the whole API bundled
  into `functions/api.func` (entry `apps/api/src/vercel.ts`, 300 s limit), and
  the routes: `/api/*` → the function, files, then `index.html`.
- **Vercel Cron** calls `/api/admin/tick` every minute (declared in the build's
  `config.json`; Vercel sends `Authorization: Bearer $CRON_SECRET`). A tick
  polls the US + EU trackers and pushes what's new; on minutes divisible by 15
  it also re-checks edited threads (`apps/api/src/lib/tick.ts`). A lease row in
  `state` keeps two ticks from running at once.
- Production builds apply database migrations (`MIGRATE_URL`).
- In-memory data (forum categories, blue-thread lookups) is only a cache: each
  function instance rebuilds its own.

## Supabase

The database (500 MB, always on: it only pauses after a week of inactivity,
and the poller writes every minute). **Connect** gives two URLs, each used with
`?sslmode=require` appended:

- **Transaction pooler** (port 6543) → `DATABASE_URL` (serverless functions
  open many short connections; prepared statements are turned off for it)
- **Session pooler** (port 5432) → `MIGRATE_URL` (migrations need a session)

The direct connection is IPv6-only: don't use it.

## Vercel

1. **Add New → Project**, import `salty-max/farseer`, framework preset
   **Other**, root directory the repo root (`vercel.json` sets the commands).
2. **Settings → Functions → Region**: next to the Supabase project (`fra1` for
   Frankfurt, the EU regions for Ireland: `dub1`).
3. **Settings → Environment Variables** (Production): `DATABASE_URL`,
   `MIGRATE_URL`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`,
   `CRON_SECRET`, `LOG_FORMAT=json`.
4. Deploy. `https://<project>.vercel.app/api/health` → `{"ok":true}`, and
   **Settings → Cron Jobs** lists `/api/admin/tick`.

Moving from Northflank: same database, same VAPID keys, so posts, settings and
push subscriptions carry over. The installed PWA belongs to the old address,
though: install it again from the new one (and enable notifications there),
then delete the Northflank service.

## First boot

On a fresh database the first tick backfills recent blue posts (no pushes for
history) instead of polling: 3 pages per region on Vercel (under 2 minutes,
paced at ~1 request/s), 10 on the Bun server. For more history, run it locally
against production: `DATABASE_URL=<session pooler URL> bun run --filter @farseer/api db:backfill`.

Rate limits: Blizzard publishes none; the forums run Discourse (default 50
requests / 10 s and 200 / min per IP). Live polling uses ~2 requests/min plus
≤10 every 15 min. Any `forum.rate_limited` warning in the logs means we're being
throttled.

Manual levers (Bearer `CRON_SECRET`):

```bash
URL="https://<project>.vercel.app"; SECRET="<CRON_SECRET>"
curl "$URL/api/admin/tick" -H "Authorization: Bearer $SECRET"            # one tick now
curl -X POST "$URL/api/admin/poll"   -H "Authorization: Bearer $SECRET"   # poll only
curl -X POST "$URL/api/admin/edits"  -H "Authorization: Bearer $SECRET"   # re-check edited threads
curl -X POST "$URL/api/admin/backfill?pages=3" -H "Authorization: Bearer $SECRET"
```

## Releases

Bump `apps/web/package.json` `version` on each deploy (patch = fixes, minor =
visible feature) and add a `CHANGELOG.md` entry. Every push to `main` deploys.
The installed PWA shows a "new version — reload" banner once the new service
worker is ready.
