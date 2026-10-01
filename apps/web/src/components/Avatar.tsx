import { useState } from "react";
import type { Author } from "@farseer/shared";
import { cn, initials } from "@/lib/utils";

export function Avatar({ author, size = 40 }: { author: Author; size?: number }) {
  const [broken, setBroken] = useState(false);
  const ring = author.role === "official" ? "ring-gold/60" : "ring-blue/50";
  return author.avatarUrl && !broken ? (
    <img
      src={author.avatarUrl}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setBroken(true)}
      className={cn("shrink-0 rounded-full bg-stone-3 object-cover ring-1", ring)}
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-stone-3 font-display text-xs text-blue ring-1", ring)}
      style={{ width: size, height: size }}
    >
      {initials(author.username)}
    </span>
  );
}
