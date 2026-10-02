# Farseer

WoW blue-post tracker PWA (US + EU English forums) with filters and push. Built
on the Lucarne template: same monorepo, stack and push code. Hosted on Vercel
Pro + Supabase (see DEPLOY.md).

## Monorepo (Turborepo + Bun workspaces)

- `apps/api` — Hono on Bun. `src/lib/blizzard.ts` (Discourse client),
  `ingest.ts` (poll / backfill / edit refresh / push fan-out), `classify.ts`
  (game + topics), `dedupe.ts` (US/EU crossposts), `filters.ts` (push matching),
  `feed.ts` (queries), `push.ts` + `webpush.ts` + `notify.ts` (Web Push).
  `lib/tick.ts`: one tick per minute (poll; edits every 15 min; backfill on a
  fresh DB), run by `src/scheduler.ts` on the Bun server or by Vercel Cron via
  `/api/admin/tick` (`src/vercel.ts` is the function entry, bundled by
  `scripts/vercel-build.sh`). Never keep request-spanning state in memory.
- `apps/web` — React 19 + Vite + Tailwind v4 + TanStack Router/Query. Routes in
  `src/router.tsx`; feed filters live in the URL (`lib/feedSearch.ts`); per-device
  state in localStorage stores (`lib/settings.ts`, `lib/library.ts`).
- `packages/shared` (`@farseer/shared`) — wire contract types. Source of truth.

## Commands

```bash
bun run dev | typecheck | lint | test | build
bun run db            # local Postgres :5433 (docker)
bun run db:generate   # migration from apps/api/src/db/schema.ts
bun run db:migrate
bun run --filter @farseer/api db:sim   # push pipeline simulation
```

Before calling a change done: typecheck + lint + test + web build pass.

## Conventions

- Conventional Commits, lowercase subjects; no AI co-author trailers.
- No hardcoded UI text: everything goes through `apps/web/src/lib/i18n.ts`
  (`fr` typed on `en`). Push copy is rendered server-side per device language in
  `apps/api/src/lib/notify.ts`.
- Theme tokens live in `apps/web/src/index.css` (`@theme`): night-stone
  surfaces, parchment text, gold accents, Blizzard blue for staff, item-quality
  colours for topics.
- Forum HTML is sanitized client-side (`lib/sanitize.ts`) before rendering.

## ⚠️ Secrets

`apps/api/.env.local` (gitignored) holds the VAPID keypair and CRON_SECRET.
Never commit or print the private key. Prod `DATABASE_URL` must be the addon's
**admin** URI (`POSTGRES_URI_ADMIN`), see DEPLOY.md.
