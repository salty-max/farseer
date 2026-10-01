/**
 * HTML helpers for Discourse "cooked" post bodies. We never render these on the
 * server; the web sanitizes before injecting. Here we only fix up URLs and
 * extract plain text for search, keyword matching and push bodies.
 */

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  bull: "•",
  copy: "©",
  reg: "®",
  trade: "™",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

/** Strip tags → readable plain text (block elements become line breaks). */
export function htmlToText(html: string): string {
  const text = html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|blockquote|tr|aside|pre)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(text)
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Collapse to one line, for excerpts and notification bodies. */
export function oneLine(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return `${sp > max * 0.6 ? cut.slice(0, sp) : cut}…`;
}

/** Make origin-relative (`/en/wow/…`) and protocol-relative (`//cdn…`) URLs absolute. */
export function absolutize(html: string, origin: string): string {
  return html.replace(/\b(href|src|srcset)="([^"]*)"/gi, (_m, attr: string, value: string) => {
    const fix = (u: string) =>
      u.startsWith("//") ? `https:${u}` : u.startsWith("/") ? `${origin}${u}` : u;
    const out =
      attr.toLowerCase() === "srcset"
        ? value
            .split(",")
            .map((part) => {
              const [u, ...rest] = part.trim().split(/\s+/);
              return [fix(u), ...rest].join(" ");
            })
            .join(", ")
        : fix(value);
    return `${attr}="${out}"`;
  });
}
