import type { PostSummary } from "@farseer/shared";
import { createStore } from "@/lib/store";

/**
 * Per-device reading state: which posts were read, which are saved (snapshots,
 * so the Saved list works offline), and a "read everything before" watermark set
 * by "mark all as read". New installs start with everything older than a day
 * read, so the first feed isn't a wall of unread dots.
 */
type Library = {
  read: number[]; // capped ring of recently read ids
  readBefore: string; // ISO — anything older counts as read
  saved: PostSummary[];
};

const MAX_READ = 2000;

const library = createStore<Library>("farseer:library", {
  read: [],
  readBefore: new Date(Date.now() - 86400_000).toISOString(),
  saved: [],
});

export const useLibrary = library.use;

export function isUnread(lib: Library, p: Pick<PostSummary, "id" | "createdAt">): boolean {
  return p.createdAt > lib.readBefore && !lib.read.includes(p.id);
}

export function markRead(id: number): void {
  library.set((l) => (l.read.includes(id) ? l : { ...l, read: [id, ...l.read].slice(0, MAX_READ) }));
}

export function markAllRead(): void {
  library.set((l) => ({ ...l, read: [], readBefore: new Date().toISOString() }));
}

export function isSaved(lib: Library, id: number): boolean {
  return lib.saved.some((p) => p.id === id);
}

export function toggleSaved(p: PostSummary): void {
  library.set((l) =>
    l.saved.some((s) => s.id === p.id)
      ? { ...l, saved: l.saved.filter((s) => s.id !== p.id) }
      : { ...l, saved: [p, ...l.saved] },
  );
}
