# Farseer

Every **World of Warcraft blue post** (developers, community managers, official
news) from the US and EU forums in one installable PWA, with filters and push
notifications.

- **Feed**: search, game (Retail / Classic / Forever), topic (hotfixes, patch
  notes, PTR/beta, news, maintenance, bugs, classes), region, devs only,
  thread openers only, posts by author. US/EU crossposts are merged, and
  community-manager support chatter ("We're working on it!" in player threads)
  is filtered out, while their hotfix / PTR-notes updates stay.
- **Reader**: the full post with the player message it answers, edit tracking
  for living threads (hotfixes, patch notes), share / open on the forums.
- **Display**: class & spec names in class colours (patch notes become
  scannable), reader text size, compact feed, keyword highlighting, absolute
  timestamps.
- **QoL**: unread markers + mark all read, saved posts (offline), "new posts"
  pill, offline feed cache, `/` to search, `Esc` to go back, EN/FR.
- **Push**: per-device filters by game, topic and keywords, devs only,
  optional edited-thread alerts.

Data comes from the forums' public blue tracker
(`/groups/blizzard-tracker/posts.json`). Not affiliated with Blizzard
Entertainment.

## Stack

Turborepo + Bun workspaces: `apps/api` (Hono, Drizzle, Postgres, node-cron),
`apps/web` (React 19, Vite, Tailwind v4, TanStack Router/Query,
vite-plugin-pwa), `packages/shared` (wire contract).

## Develop

```bash
bun install
bun run db             # Postgres in Docker on :5433
bun run db:migrate
bun run db:backfill    # optional; the server also backfills on first boot
bun run --filter @farseer/api vapid   # paste into apps/api/.env.local (see .env.example)
bun run dev            # api :3000 + web :5173 (TUNNEL=1 for an https phone URL)
```

Checks: `bun run typecheck && bun run lint && bun run test && bun run build`.
`bun run --filter @farseer/api db:sim` exercises the whole push pipeline against
a fake push service.

Deploying: see [DEPLOY.md](DEPLOY.md).
