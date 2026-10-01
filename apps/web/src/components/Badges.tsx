import type { AuthorRole, Game, Region, Topic } from "@farseer/shared";
import { TOPIC_COLOR } from "@/lib/colors";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const GAME_COLOR: Record<Game, string> = {
  retail: "text-g-retail border-g-retail/40 bg-g-retail/10",
  classic: "text-g-classic border-g-classic/40 bg-g-classic/10",
  forever: "text-g-forever border-g-forever/40 bg-g-forever/10",
};


export function GameBadge({ game }: { game: Game }) {
  const t = useT();
  return (
    <span className={cn("rounded-md border px-1.5 py-px text-[11px] font-semibold uppercase tracking-wider", GAME_COLOR[game])}>
      {t.game[game]}
    </span>
  );
}

export function TopicTag({ topic }: { topic: Topic }) {
  const t = useT();
  return <span className={cn("text-xs font-medium", TOPIC_COLOR[topic])}>[{t.topic[topic]}]</span>;
}

const ROLE_STYLE: Record<AuthorRole, string> = {
  developer: "bg-blue-dev/15 text-blue-dev border-blue-dev/40",
  community: "bg-blue/10 text-blue border-blue/30",
  official: "bg-gold/10 text-gold border-gold/40",
  staff: "bg-stone-3 text-ink-dim border-edge",
};

export function RoleBadge({ role }: { role: AuthorRole }) {
  const t = useT();
  return (
    <span className={cn("rounded px-1 py-px text-[10px] font-bold uppercase tracking-wider border", ROLE_STYLE[role])}>
      {t.role[role]}
    </span>
  );
}

export function RegionTags({ regions }: { regions: Region[] }) {
  return (
    <span className="inline-flex gap-1">
      {regions.map((r) => (
        <span key={r} className="rounded bg-stone-3 px-1 text-[10px] font-semibold uppercase text-ink-dim">
          {r}
        </span>
      ))}
    </span>
  );
}
