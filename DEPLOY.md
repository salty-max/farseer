# Deploying Farseer

Same shape as Lucarne: **one Docker image** (Hono on Bun serving the SPA, the
API and the in-process poller on port 3000) + **one Postgres addon**, on
**Northflank**'s free tier.

> 🔑 Secrets (`VAPID_PRIVATE_KEY`, `CRON_SECRET`) go in as Northflank secret env
> vars and never land in git or the image. Keep the VAPID pair in your password
> manager: **regenerating it silently kills notifications on every installed
> PWA**.

## Option 1 — Infrastructure as code (recommended)

[`northflank.template.json`](northflank.template.json) describes the project,
the Postgres addon and the service. Secrets are passed as arguments at run time.

```bash
npm i -g @northflank/cli
northflank login -t <API_TOKEN>
northflank get addon-types   # confirm the "postgresql" slug / version
northflank list plans        # confirm nf-compute-20 / the build plan
northflank run template -f ./northflank.template.json
```

What the template wires up:

- **`DATABASE_URL`** ← the addon's **`POSTGRES_URI_ADMIN`**. Not `POSTGRES_URI`:
  the standard user can't `CREATE SCHEMA`, so the boot-time migration fails with
  `permission denied for database` and the container crash-loops (the Lucarne
  gotcha).
- **Port** 3000, public HTTPS (Northflank doesn't inject `PORT`; the server
  defaults to 3000).
- **CI**: every push to `main` rebuilds and redeploys.

## Option 2 — dashboard

1. New project (EU-West) → **Add-on** PostgreSQL (`farseer-db`, external access off).
2. **Combined service** from `salty-max/farseer@main`, Dockerfile build, port
   3000 public.
3. Env: `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`, `LOG_FORMAT=json`; secrets:
   `VAPID_PRIVATE_KEY`, `CRON_SECRET`; link the addon and expose
   **`POSTGRES_URI_ADMIN` as `DATABASE_URL`**.

## First boot

Nothing to seed by hand. The CMD runs migrations, then the server backfills
the last ~200 blue posts per region (no pushes for history, ~2–3 min) and starts
polling every minute. Watch for `backfill.done` then `scheduler.started` in the
logs.

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
