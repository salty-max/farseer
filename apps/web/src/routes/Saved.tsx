import { Bookmark } from "lucide-react";
import { PostCard } from "@/components/PostCard";
import { useT } from "@/lib/i18n";
import { useLibrary } from "@/lib/library";

export function Saved() {
  const t = useT();
  const { saved } = useLibrary();
  return (
    <div className="space-y-3">
      <h1 className="title-display px-1 pt-1 text-lg text-gold">{t.saved.title}</h1>
      {saved.length === 0 ? (
        <div className="panel flex flex-col items-center gap-3 p-8 text-center text-ink-dim">
          <Bookmark className="size-8 text-ink-faint" />
          <p className="max-w-xs text-sm">{t.saved.empty}</p>
        </div>
      ) : (
        saved.map((p) => <PostCard key={p.id} post={p} />)
      )}
    </div>
  );
}
