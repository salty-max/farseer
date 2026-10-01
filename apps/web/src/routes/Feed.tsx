import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { ArrowUp, CheckCheck, RefreshCw, WifiOff } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { FilterBar } from "@/components/FilterBar";
import { PostCard, PostCardSkeleton } from "@/components/PostCard";
import { api } from "@/lib/api";
import { hasFilters, lastFeedSearch, toPostsQuery, type FeedSearch } from "@/lib/feedSearch";
import { useT } from "@/lib/i18n";
import { isUnread, markAllRead, useLibrary } from "@/lib/library";
import { useSettings } from "@/lib/settings";
import { useOnline } from "@/lib/useOnline";
import { cn } from "@/lib/utils";

const route = getRouteApi("/");
const NEW_POSTS_INTERVAL = 60_000;

export function Feed() {
  const t = useT();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const qc = useQueryClient();
  const lib = useLibrary();
  const online = useOnline();
  const { compact } = useSettings().display;
  const query = useMemo(() => toPostsQuery(search), [search]);
  const key = ["posts", query] as const;

  useEffect(() => lastFeedSearch.set({ search }), [search]);

  const feed = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => api.posts({ ...query, before: pageParam }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const posts = useMemo(() => feed.data?.pages.flatMap((p) => p.posts) ?? [], [feed.data]);
  const newestId = posts[0]?.id;

  // Poll for posts newer than the top of the list → "N new posts" pill.
  const fresh = useQuery({
    queryKey: ["posts-new", query, newestId],
    queryFn: () => api.posts({ ...query, after: newestId, limit: 50 }),
    enabled: newestId != null,
    refetchInterval: NEW_POSTS_INTERVAL,
    refetchIntervalInBackground: false,
  });
  const newCount = fresh.data?.posts.length ?? 0;

  const showNew = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    void qc.resetQueries({ queryKey: key });
  };

  // Infinite scroll.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
      },
      { rootMargin: "800px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [feed]);

  const unread = posts.filter((p) => isUnread(lib, p)).length;
  const onChange = (next: FeedSearch) => void navigate({ search: next, replace: true });

  return (
    <div className="space-y-3">
      <FilterBar search={search} onChange={onChange} />

      <div className="flex items-center gap-1 px-1 text-xs text-ink-faint">
        {!online && (
          <span className="inline-flex items-center gap-1 text-q-legendary">
            <WifiOff className="size-3.5" /> {t.feed.offline}
          </span>
        )}
        {hasFilters(search) && (
          <button className="rounded-md px-2 py-1 underline-offset-2 hover:text-parchment hover:underline" onClick={() => onChange({})}>
            {t.feed.clear}
          </button>
        )}
        <span className="ml-auto" />
        <button
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-stone-2 hover:text-parchment"
          onClick={() => void qc.resetQueries({ queryKey: key })}
        >
          <RefreshCw className={cn("size-3.5", feed.isFetching && !feed.isFetchingNextPage && "animate-spin")} />
          {t.feed.refresh}
        </button>
        {unread > 0 && (
          <button
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-stone-2 hover:text-parchment"
            onClick={markAllRead}
          >
            <CheckCheck className="size-3.5" />
            {t.feed.markAllRead} ({unread})
          </button>
        )}
      </div>

      {newCount > 0 && (
        <div className="pointer-events-none sticky top-16 z-20 flex justify-center">
          <button onClick={showNew} className="btn-gold pointer-events-auto rounded-full px-4 shadow-xl shadow-black/60">
            <ArrowUp className="size-4" />
            {t.feed.newPosts(newCount)}
          </button>
        </div>
      )}

      {feed.isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <PostCardSkeleton key={i} />
          ))}
        </div>
      ) : feed.isError ? (
        <div className="panel p-6 text-center">
          <p className="text-ink-dim">{t.feed.error}</p>
          <button className="btn mt-3" onClick={() => void feed.refetch()}>
            {t.feed.retry}
          </button>
        </div>
      ) : posts.length === 0 ? (
        <p className="panel p-8 text-center text-ink-dim">{t.feed.empty}</p>
      ) : (
        <div className={compact ? "space-y-2" : "space-y-3"}>
          {posts.map((p) => (
            <PostCard key={p.id} post={p} query={search.q} />
          ))}
        </div>
      )}

      <div ref={sentinel} />
      {feed.isFetchingNextPage && <PostCardSkeleton />}
      {!feed.hasNextPage && posts.length > 0 && (
        <p className="py-6 text-center font-display text-sm text-ink-faint">{t.feed.end}</p>
      )}
    </div>
  );
}
