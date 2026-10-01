# Deploying Farseer

**Live setup** (since 2026-10-01): one Northflank **combined service**
(`farseer`, the root `Dockerfile`: Hono on Bun serving the SPA, the API and the
in-process poller on port 3000) + an external **Supabase** Postgres (free tier).

Why not the Lucarne layout (separate project + Postgres addon)? Northflank's
free tier is **1 project, 2 services, 1 database**, and Lucarne holds the
project and the database. So:

- the `farseer` service lives **inside the `lucarne` project** (2nd free
  service slot). Lucarne has no project-wide secret groups, so nothing leaks
  between the two services; each has its own env vars, build and URL;
- the database is **Supabase** (500 MB, always on; it only pauses after a week
  of inactivity, and the poller writes every minute). Neon's free tier does not
  fit: 100 compute-hours/month with scale-to-zero, and we're never idle.

> 🔑 Secrets live in the service's env vars (Northflank) and in gitignored
> local files only: `apps/api/.env.local` (VAPID keypair, CRON_SECRET) and
> `apps/api/.env.prod.local` (Supabase `DATABASE_URL`). Keep them in your
> password manager: **regenerating the VAPID pair silently kills notifications
> on every installed PWA**.

## Service settings

- Build: GitHub `salty-max/farseer@main`, Dockerfile `/Dockerfile`, CI on (every
  push to `main` redeploys). Plans `nf-compute-20` / build `nf-compute-400-16`.
- Port `p01` 3000, public HTTPS.
- Env: `DATABASE_URL` (Supabase **session pooler** URI + `?sslmode=require`; the
  direct connection is IPv6-only), `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
  `VAPID_SUBJECT`, `CRON_SECRET`, `LOG_FORMAT=json`.

[`northflank.template.json`](northflank.template.json) describes the same service
for a fresh account (own project, `DATABASE_URL` as an argument). On a free
account that already has a project, create the service directly instead:
`northflank create service combined --projectId <project> -f <spec.json>`.

## First boot

Nothing to seed by hand. The CMD runs migrations, then the server backfills
the last ~200 blue posts per region (no pushes for history) and starts polling
every minute. The backfill is deliberately paced at ~1 request/s to stay well
under the forums' rate limits, so it takes **about 6 minutes**: the feed fills
in at the end of each region. Watch for `backfill.done` then
`scheduler.started` in the logs.

Rate limits: Blizzard publishes none; the forums run Discourse (default 50
requests / 10 s and 200 / min per IP). Live polling uses ~2 requests/min plus
≤10 every 15 min. Any `forum.rate_limited` warning in the logs means we're being
throttled. If they recur, Northflank's egress IP may be shared with heavier
users.

Manual levers (Bearer `CRON_SECRET`):

```bash
URL="https://<service>.code.run"; SECRET="<CRON_SECRET>"
curl -X POST "$URL/api/admin/poll"   -H "Authorization: Bearer $SECRET"   # poll now
curl -X POST "$URL/api/admin/edits"  -H "Authorization: Bearer $SECRET"   # re-check edited threads
curl -X POST "$URL/api/admin/backfill?pages=20" -H "Authorization: Bearer $SECRET"
```

## Releases

Bump `apps/web/package.json` `version` on each deploy (patch = fixes, minor =
visible feature) and add a `CHANGELOG.md` entry. The installed PWA shows a
"new version — reload" banner once the new service worker is ready.
