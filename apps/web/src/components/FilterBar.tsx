import { GAMES, TOPICS, type Game, type Topic } from "@farseer/shared";
import { Code2, Globe, MessageSquareText, Search, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { TOPIC_COLOR } from "@/lib/colors";
import type { FeedSearch } from "@/lib/feedSearch";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Props = {
  search: FeedSearch;
  onChange: (next: FeedSearch) => void;
};

const FILTER_TOPICS = TOPICS.filter((t) => t !== "community");
const REGION_CYCLE = [undefined, "us", "eu"] as const;

export function FilterBar({ search, onChange }: Props) {
  const t = useT();
  const set = (patch: Partial<FeedSearch>) => onChange({ ...search, ...patch });
  const [q, setQ] = useState(search.q ?? "");
  const input = useRef<HTMLInputElement>(null);

  // Debounce typing into the URL.
  useEffect(() => {
    if ((search.q ?? "") === q) return;
    const id = setTimeout(() => set({ q: q.trim() || undefined }), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  // …and follow external changes (clear filters, back button).
  useEffect(() => setQ(search.q ?? ""), [search.q]);

  // "/" focuses search (desktop).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === "/" && !/INPUT|TEXTAREA/.test(el.tagName)) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleTopic = (topic: Topic) => {
    const cur = search.topics ?? [];
    const next = cur.includes(topic) ? cur.filter((x) => x !== topic) : [...cur, topic];
    set({ topics: next.length ? next : undefined });
  };
  const regionIdx = REGION_CYCLE.indexOf(search.region);

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 rounded-xl border border-edge bg-stone px-3 focus-within:border-gold-soft/70">
        <Search className="size-4 shrink-0 text-ink-faint" />
        <input
          ref={input}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.feed.search}
          enterKeyHint="search"
          className="h-11 w-full bg-transparent text-[15px] placeholder:text-ink-faint focus:outline-none"
        />
        {q && (
          <button className="text-ink-faint hover:text-parchment" onClick={() => setQ("")} aria-label={t.feed.clear}>
            <X className="size-4" />
          </button>
        )}
      </label>

      {/* Game */}
      <div className="grid grid-cols-4 gap-1 rounded-xl border border-edge bg-stone p-1" role="radiogroup">
        {[undefined, ...GAMES].map((g: Game | undefined) => (
          <button
            key={g ?? "all"}
            role="radio"
            aria-checked={search.game === g}
            onClick={() => set({ game: g })}
            className={cn(
              "rounded-lg py-1.5 text-sm transition-colors",
              search.game === g
                ? "bg-gradient-to-b from-stone-3 to-stone-2 font-semibold text-gold shadow-inner"
                : "text-ink-dim hover:text-parchment",
            )}
          >
            {g ? t.game[g] : t.feed.all}
          </button>
        ))}
      </div>

      {/* Topics + toggles */}
      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        {FILTER_TOPICS.map((topic) => {
          const on = search.topics?.includes(topic) ?? false;
          return (
            <button key={topic} className="chip shrink-0" aria-pressed={on} onClick={() => toggleTopic(topic)}>
              <span className={cn("size-1.5 rounded-full bg-current", TOPIC_COLOR[topic])} />
              {t.topic[topic]}
            </button>
          );
        })}
        <span className="mx-1 w-px shrink-0 bg-edge" />
        <button className="chip shrink-0" aria-pressed={!!search.devs} onClick={() => set({ devs: search.devs ? undefined : true })}>
          <Code2 className="size-3.5" />
          {t.feed.devsOnly}
        </button>
        <button
          className="chip shrink-0"
          aria-pressed={!!search.threads}
          onClick={() => set({ threads: search.threads ? undefined : true })}
        >
          <MessageSquareText className="size-3.5" />
          {t.feed.threadsOnly}
        </button>
        <button
          className="chip shrink-0"
          aria-pressed={!!search.region}
          onClick={() => set({ region: REGION_CYCLE[(regionIdx + 1) % REGION_CYCLE.length] })}
          title={t.feed.regions}
        >
          <Globe className="size-3.5" />
          {search.region ? search.region.toUpperCase() : t.feed.allRegions}
        </button>
      </div>

      {search.author && (
        <span className="chip border-blue/40 text-blue" aria-pressed="true">
          <User className="size-3.5" />
          {t.feed.byAuthor(search.author)}
          <button onClick={() => set({ author: undefined })} aria-label={t.feed.clear}>
            <X className="size-3.5" />
          </button>
        </span>
      )}
    </div>
  );
}
