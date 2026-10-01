# Changelog

## 0.1.0 — unreleased

First version.

- Blue tracker ingest for the US and EU English WoW forums: polled every minute,
  full post bodies, reply context, US/EU crossposts merged.
- Community-manager chatter filtered out: CM replies in player threads or
  answering players are hidden from the feed and push; their updates to
  Blizzard threads (hotfix entries, PTR notes, known issues) and every
  developer post are kept.
- Auto-classification by game (Retail / Classic / Forever) and topic (news,
  hotfixes, patch notes, PTR/beta, maintenance, bugs, classes).
- Feed with search (with in-body snippets), game/topic/region/dev/thread filters
  in the URL, infinite scroll, "N new posts" pill, unread markers, saved posts
  (offline), author pages.
- Push notifications filtered per device by game, topic, keywords and
  devs-only, plus optional alerts when hotfix / patch-notes threads are edited.
- Display settings: class colours (class and spec names in official class
  colours; ambiguous specs like Frost/Holy resolved from the surrounding
  class), reader text size, compact feed, keyword highlighting, absolute
  timestamps — with a live preview.
- Installable PWA (offline feed cache, update prompt, iOS install guide), EN/FR.
