import { colorizeClasses, type ClassContext, type ClassKey } from "@/lib/classes";

/** What to decorate post text with, from the Display settings + the search. */
export type Decor = {
  classColors: boolean;
  keywords: string[]; // the user's notification keywords, highlighted when enabled
  query?: string; // the active search, highlighted as a substring
};

export type DecoratedSegment = { text: string; cls?: ClassKey; mark?: "q" | "kw" };

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Keywords match at a word start and run to the end of the word, mirroring the
 *  server's push matching ("hotfix" lights up all of "hotfixes"). */
function keywordRe(keywords: string[]): RegExp | null {
  const ks = keywords.map((k) => k.trim()).filter(Boolean);
  if (!ks.length) return null;
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${ks.map(esc).join("|")})[\\p{L}\\p{N}]*`, "giu");
}

function marks(text: string, decor: Decor): { start: number; end: number; kind: "q" | "kw" }[] {
  const out: { start: number; end: number; kind: "q" | "kw" }[] = [];
  const q = decor.query?.trim();
  if (q) for (const m of text.matchAll(new RegExp(esc(q), "gi"))) out.push({ start: m.index!, end: m.index! + m[0].length, kind: "q" });
  const kw = keywordRe(decor.keywords);
  if (kw) {
    for (const m of text.matchAll(kw)) {
      const start = m.index!;
      const end = start + m[0].length;
      if (!out.some((o) => start < o.end && end > o.start)) out.push({ start, end, kind: "kw" });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Split a string into class-coloured and highlighted segments. */
export function decorateText(text: string, decor: Decor, ctx: ClassContext = { current: null }): DecoratedSegment[] {
  const base = decor.classColors ? colorizeClasses(text, ctx) : [{ text }];
  const ms = marks(text, decor);
  if (!ms.length) return base;
  // Cut the class segments again at highlight boundaries.
  const out: DecoratedSegment[] = [];
  let offset = 0;
  for (const seg of base) {
    const segEnd = offset + seg.text.length;
    let pos = offset;
    for (const m of ms) {
      if (m.end <= pos || m.start >= segEnd) continue;
      const a = Math.max(m.start, pos);
      const b = Math.min(m.end, segEnd);
      if (a > pos) out.push({ text: text.slice(pos, a), cls: seg.cls });
      out.push({ text: text.slice(a, b), cls: seg.cls, mark: m.kind });
      pos = b;
    }
    if (pos < segEnd) out.push({ text: text.slice(pos, segEnd), cls: seg.cls });
    offset = segEnd;
  }
  return out;
}

const SKIP = new Set(["CODE", "PRE", "SCRIPT", "STYLE"]);
const BLOCK = "p,h1,h2,h3,h4,h5,h6,li,blockquote,td,th,summary";

/**
 * Decorate already-sanitized post HTML in place: wrap class/spec names and
 * highlights in spans/marks. Walks text nodes in document order with one shared
 * class context, so a "Death Knight" list item colours the "Unholy" under it.
 */
export function decorateHtml(html: string, decor: Decor): string {
  if (!decor.classColors && !decor.keywords.length && !decor.query?.trim()) return html;
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  const ctx: ClassContext = { current: null };
  const walker = document.createTreeWalker(tpl.content, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);

  for (const node of nodes) {
    const parent = node.parentElement;
    if (!node.data.trim() || (parent && SKIP.has(parent.tagName))) continue;
    // A paragraph/heading that is just a title ("Delves", "Dungeons and Raids")
    // closes the current class section; list-item titles (specs, hero talents)
    // don't.
    const block = parent?.closest(BLOCK);
    if (block && block.tagName !== "LI" && block.textContent?.trim() === node.data.trim()) ctx.current = null;

    const segs = decorateText(node.data, decor, ctx);
    if (segs.length === 1 && !segs[0].cls && !segs[0].mark) continue;
    const frag = document.createDocumentFragment();
    for (const s of segs) {
      if (!s.cls && !s.mark) {
        frag.append(s.text);
        continue;
      }
      let el: HTMLElement = document.createElement(s.mark ? "mark" : "span");
      if (s.mark) el.className = s.mark === "kw" ? "kw" : "hl";
      if (s.cls) {
        const span = document.createElement("span");
        span.className = "cc";
        span.dataset.c = s.cls;
        if (s.mark) {
          span.append(s.text);
          el.append(span);
        } else {
          el = span;
          el.append(s.text);
        }
      } else el.append(s.text);
      frag.append(el);
    }
    node.replaceWith(frag);
  }
  return tpl.innerHTML;
}
