import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AuthorRole, Game, PushFilters, Region, ReplyContext, Topic } from "@farseer/shared";

/**
 * One blue post, as seen on one regional forum. US/EU crossposts are both stored;
 * the later one points at the first via `dupOf` and is hidden from the feed, while
 * the canonical row's `regions` lists every region it appeared in.
 */
export const posts = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    region: text("region").$type<Region>().notNull(),
    forumPostId: integer("forum_post_id").notNull(),
    topicId: integer("topic_id").notNull(),
    topicSlug: text("topic_slug").notNull(),
    topicTitle: text("topic_title").notNull(),
    postNumber: integer("post_number").notNull(),
    categoryId: integer("category_id").notNull(),
    category: text("category").notNull(),
    username: text("username").notNull(),
    userTitle: text("user_title"),
    role: text("role").$type<AuthorRole>().notNull(),
    avatarUrl: text("avatar_url"),
    excerpt: text("excerpt").notNull(),
    /** Cooked HTML of the full post (absolutized links). Null until fetched. */
    html: text("html"),
    /** Plain text of the full post, for search + keyword matching. */
    text: text("text").notNull().default(""),
    replyTo: jsonb("reply_to").$type<ReplyContext | null>(),
    game: text("game").$type<Game>().notNull(),
    topics: text("topics").array().$type<Topic[]>().notNull(),
    regions: text("regions").array().$type<Region[]>().notNull(),
    dupOf: integer("dup_of"),
    /**
     * A CM/staff reply in a player's thread, or answering a player's post:
     * support chatter, kept out of the feed and push. Thread updates by blues
     * (hotfix entries, PTR notes additions…) are not chatter.
     */
    chatter: boolean("chatter").notNull().default(false),
    /** Discourse post `version`, bumped on every edit. */
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    /** Set once the new-post push fan-out is done (or nobody matched). */
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("posts_region_forum_post").on(t.region, t.forumPostId),
    index("posts_created").on(t.createdAt),
    index("posts_feed").on(t.dupOf, t.chatter, t.createdAt),
  ],
);

/** Forum category tree per region (ids differ between US and EU). */
export const categories = pgTable(
  "categories",
  {
    region: text("region").$type<Region>().notNull(),
    id: integer("id").notNull(),
    name: text("name").notNull(),
    parentId: integer("parent_id"),
  },
  (t) => [uniqueIndex("categories_region_id").on(t.region, t.id)],
);

export const pushSubscription = pgTable("push_subscription", {
  endpoint: text("endpoint").primaryKey(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  deviceId: text("device_id").notNull(),
  filters: jsonb("filters").$type<PushFilters>().notNull(),
  lang: text("lang").notNull().default("en"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Tiny key/value store for job state (last poll time, backfill done…). */
export const state = pgTable("state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type PostRow = typeof posts.$inferSelect;
export type NewPostRow = typeof posts.$inferInsert;
export type SubscriptionRow = typeof pushSubscription.$inferSelect;
