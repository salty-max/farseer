import type { PostDetail, PostsPage, PostSummary } from "@farseer/shared";
import { useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { getRouteApi, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Bookmark, BookmarkCheck, CornerDownRight, ExternalLink, Pencil, Share2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { GameBadge, RegionTags, RoleBadge, TopicTag } from "@/components/Badges";
import { RichText } from "@/components/RichText";
import { api } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";
import { isSaved, markRead, toggleSaved, useLibrary } from "@/lib/library";
import { decorateHtml } from "@/lib/decorate";
import { sanitize } from "@/lib/sanitize";
import { useDecor, useSettings } from "@/lib/settings";
import { fullDate } from "@/lib/time";
import { cn } from "@/lib/utils";

const route = getRouteApi("/post/$id");

/** The summary already in the feed cache, so the header renders instantly. */
function useCachedSummary(id: number): PostSummary | undefined {
  const qc = useQueryClient();
  return useMemo(() => {
    for (const [, data] of qc.getQueriesData<InfiniteData<PostsPage>>({ queryKey: ["posts"] })) {
      const hit = data?.pages?.flatMap((p) => p.posts).find((p) => p.id === id);
      if (hit) return hit;
    }
    return undefined;
  }, [qc, id]);
}

export function Post() {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const id = Number(route.useParams().id);
  const cached = useCachedSummary(id);
  const lib = useLibrary();
  const [copied, setCopied] = useState(false);

  const q = useQuery({ queryKey: ["post", id], queryFn: () => api.post(id), enabled: Number.isInteger(id) });
  const post: PostSummary | PostDetail | undefined = q.data ?? cached;
  const { textSize } = useSettings().display;
  const decor = useDecor();
  const decorKey = `${decor.classColors}|${decor.keywords.join("\u0000")}`;
  const html = useMemo(
    () => (q.data ? decorateHtml(sanitize(q.data.html), decor) : null),
    [q.data, decorKey], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    if (q.data) markRead(q.data.id);
  }, [q.data]);

  const back = () => (window.history.length > 1 ? router.history.back() : void router.navigate({ to: "/" }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && back();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!post) {
    return q.isError ? (
      <div className="panel p-8 text-center text-ink-dim">
        {t.post.notFound}
        <div className="mt-4">
          <Link to="/" className="btn">
            <ArrowLeft className="size-4" /> {t.post.back}
          </Link>
        </div>
      </div>
    ) : (
      <div className="panel h-96 animate-pulse" />
    );
  }

  const saved = isSaved(lib, post.id);
  const share = async () => {
    const url = `${location.origin}/post/${post.id}`;
    try {
      if (navigator.share) await navigator.share({ title: post.topicTitle, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* cancelled */
    }
  };
  const detail = q.data;
  // When the blue already quoted what they answer, our own context box is noise.
  const showReplyTo = detail?.replyTo && !/class="[^"]*\bquote\b/.test(detail.html);

  return (
    <article className="space-y-3">
      <button onClick={back} className="inline-flex items-center gap-1 px-1 text-sm text-ink-dim hover:text-parchment">
        <ArrowLeft className="size-4" /> {t.post.back}
      </button>

      <div className="panel-gold p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <GameBadge game={post.game} />
          {post.topics
            .filter((tp) => tp !== "community")
            .map((tp) => (
              <TopicTag key={tp} topic={tp} />
            ))}
          <span className="text-xs text-ink-faint">{post.category}</span>
        </div>

        <h1 className="title-display mt-3 text-xl leading-snug text-gold sm:text-2xl">
          {post.postNumber > 1 && <CornerDownRight className="mr-1.5 inline size-5 -translate-y-0.5 text-ink-faint" />}
          <RichText text={post.topicTitle} />
        </h1>

        <div className="mt-4 flex items-center gap-3">
          <Avatar author={post.author} size={44} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/"
                search={{ author: post.author.username }}
                className={cn("font-semibold hover:underline", post.author.role === "official" ? "text-gold" : "text-blue")}
              >
                {post.author.username}
              </Link>
              <RoleBadge role={post.author.role} />
            </div>
            <div className="flex flex-wrap items-center gap-x-2 text-xs text-ink-faint">
              {post.author.title && <span>{post.author.title}</span>}
              <time dateTime={post.createdAt}>{fullDate(post.createdAt, lang)}</time>
              <RegionTags regions={post.regions} />
            </div>
          </div>
        </div>
        {post.editedAt && (
          <p className="mt-3 inline-flex items-center gap-1 text-xs text-q-artifact">
            <Pencil className="size-3" /> {t.post.editedOn(fullDate(post.editedAt, lang))}
          </p>
        )}

        <div className="gold-rule my-4" />

        {showReplyTo && detail?.replyTo && (
          <a
            href={detail.replyTo.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-4 block rounded-lg border-l-2 border-edge bg-stone-2/70 px-3 py-2 text-sm hover:border-ink-faint"
          >
            <span className="text-xs text-ink-faint">{t.post.inReplyTo(detail.replyTo.username)}</span>
            <p className="mt-0.5 text-ink-dim italic">
              <RichText text={detail.replyTo.excerpt} />
            </p>
          </a>
        )}

        {html ? (
          <div className="post-body" data-size={textSize} dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <p className="post-body text-ink-dim" data-size={textSize}>
            <RichText text={post.excerpt} />
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <a href={post.url} target="_blank" rel="noopener noreferrer" className="btn-gold">
            <ExternalLink className="size-4" />
            {t.post.openForum}
          </a>
          <button className="btn" onClick={share}>
            <Share2 className="size-4" />
            {copied ? t.post.copied : t.post.share}
          </button>
          <button className={cn("btn", saved && "border-gold/50 text-gold")} onClick={() => toggleSaved(post)} aria-pressed={saved}>
            {saved ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
            {saved ? t.post.saved : t.post.save}
          </button>
        </div>
      </div>

      <Link
        to="/"
        search={{ author: post.author.username }}
        className="block px-1 text-sm text-ink-dim hover:text-blue"
      >
        {t.post.moreFrom(post.author.username)} →
      </Link>
    </article>
  );
}
