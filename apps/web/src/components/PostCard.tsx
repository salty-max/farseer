import type { PostSummary } from "@farseer/shared";
import { Link } from "@tanstack/react-router";
import { Bookmark, BookmarkCheck, CornerDownRight, Pencil } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { GameBadge, RegionTags, RoleBadge, TopicTag } from "@/components/Badges";
import { RichText } from "@/components/RichText";
import { When } from "@/components/When";
import { useT } from "@/lib/i18n";
import { isSaved, isUnread, toggleSaved, useLibrary } from "@/lib/library";
import { useSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

export function PostCard({ post, query }: { post: PostSummary; query?: string }) {
  const t = useT();
  const lib = useLibrary();
  const { compact } = useSettings().display;
  const unread = isUnread(lib, post);
  const saved = isSaved(lib, post.id);
  const isReply = post.postNumber > 1;
  const topics = post.topics.filter((tp) => tp !== "community");

  return (
    <article
      className={cn(
        "panel group relative transition-colors hover:border-edge-gold",
        unread && "border-l-2 border-l-blue",
      )}
    >
      <Link
        to="/post/$id"
        params={{ id: String(post.id) }}
        className={cn("block outline-none", compact ? "px-3 py-2.5 pr-11" : "p-4 pr-12")}
        aria-label={post.topicTitle}
      >
        <header className={cn("flex items-center", compact ? "gap-2" : "gap-3")}>
          <Avatar author={post.author} size={compact ? 22 : 36} />
          <div className={cn("min-w-0 flex-1", compact && "flex items-center gap-2")}>
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
              <span
                className={cn(
                  "font-semibold",
                  compact && "text-sm",
                  post.author.role === "official" ? "text-gold" : "text-blue",
                )}
              >
                {post.author.username}
              </span>
              <RoleBadge role={post.author.role} />
              {!compact && post.author.title && post.author.role !== "official" && (
                <span className="truncate text-xs text-ink-faint">{post.author.title}</span>
              )}
            </div>
            <div className={cn("flex items-center gap-2 text-xs text-ink-faint", compact && "ml-auto shrink-0")}>
              <When iso={post.createdAt} />
              {!compact && <RegionTags regions={post.regions} />}
              {post.editedAt && (
                <span className="inline-flex items-center gap-0.5 text-q-artifact" title={t.feed.edited}>
                  <Pencil className="size-3" /> {!compact && t.feed.edited}
                </span>
              )}
            </div>
          </div>
        </header>

        <h2
          className={cn(
            "leading-snug",
            compact ? "mt-1.5 text-[15px]" : "mt-3",
            unread ? "font-semibold text-parchment" : "text-parchment/85",
          )}
        >
          {isReply && <CornerDownRight className="mr-1 inline size-4 -translate-y-px text-ink-faint" aria-hidden />}
          <RichText text={post.topicTitle} query={query} />
        </h2>
        <p
          className={cn(
            "text-sm leading-relaxed text-ink-dim",
            compact ? "mt-0.5 line-clamp-1" : "mt-1.5 line-clamp-3",
          )}
        >
          <RichText text={post.excerpt} query={query} />
        </p>

        <footer className={cn("flex flex-wrap items-center gap-x-2 gap-y-1", compact ? "mt-1.5" : "mt-3")}>
          <GameBadge game={post.game} />
          {topics.map((tp) => (
            <TopicTag key={tp} topic={tp} />
          ))}
          {!compact && (
            <span className="truncate text-xs text-ink-faint">
              {post.category}
              {isReply && ` · ${t.feed.reply(post.postNumber)}`}
            </span>
          )}
        </footer>
      </Link>

      <button
        type="button"
        onClick={() => toggleSaved(post)}
        aria-pressed={saved}
        aria-label={saved ? t.post.saved : t.post.save}
        className={cn("icon-btn absolute right-2", compact ? "top-1 size-9" : "top-2", saved && "text-gold hover:text-gold")}
      >
        {saved ? <BookmarkCheck className="size-5" /> : <Bookmark className="size-5" />}
      </button>
      {unread && <span className="sr-only">unread</span>}
    </article>
  );
}

export function PostCardSkeleton() {
  return (
    <div className="panel animate-pulse p-4">
      <div className="flex items-center gap-3">
        <div className="size-9 rounded-full bg-stone-3" />
        <div className="h-3 w-32 rounded bg-stone-3" />
      </div>
      <div className="mt-4 h-4 w-3/4 rounded bg-stone-3" />
      <div className="mt-2 h-3 w-full rounded bg-stone-3" />
      <div className="mt-1.5 h-3 w-5/6 rounded bg-stone-3" />
    </div>
  );
}
