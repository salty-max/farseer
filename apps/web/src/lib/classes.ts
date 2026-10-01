/**
 * WoW class & spec recognition for colour-coding names in posts.
 *
 * Class names are unambiguous and always coloured. Spec names are not ("Frost"
 * is Mage or Death Knight, "Holy" Paladin or Priest, "Fury" is also a word), so
 * a spec is only coloured when its class is clear from context:
 *   - next to the class: "Unholy Death Knights", "Death Knight • Unholy";
 *   - standing alone (a list item / "•" segment / heading) under a class
 *     section — how patch notes and hotfixes are laid out:
 *       CLASSES • Death Knight • Unholy • Fixed an issue…
 * A capital letter is required either way, so prose ("a holy relic") is left alone.
 */

export type ClassKey =
  | "deathknight"
  | "demonhunter"
  | "druid"
  | "evoker"
  | "hunter"
  | "mage"
  | "monk"
  | "paladin"
  | "priest"
  | "rogue"
  | "shaman"
  | "warlock"
  | "warrior";

type ClassDef = { key: ClassKey; names: string[]; specs: string[] };

export const CLASSES: ClassDef[] = [
  { key: "deathknight", names: ["Death Knights", "Death Knight", "DKs", "DK"], specs: ["Blood", "Frost", "Unholy"] },
  { key: "demonhunter", names: ["Demon Hunters", "Demon Hunter", "DHs", "DH"], specs: ["Havoc", "Vengeance", "Devourer"] },
  { key: "druid", names: ["Druids", "Druid"], specs: ["Balance", "Feral", "Guardian", "Restoration"] },
  { key: "evoker", names: ["Evokers", "Evoker"], specs: ["Devastation", "Preservation", "Augmentation"] },
  { key: "hunter", names: ["Hunters", "Hunter"], specs: ["Beast Mastery", "Marksmanship", "Survival"] },
  { key: "mage", names: ["Mages", "Mage"], specs: ["Arcane", "Fire", "Frost"] },
  { key: "monk", names: ["Monks", "Monk"], specs: ["Brewmaster", "Mistweaver", "Windwalker"] },
  { key: "paladin", names: ["Paladins", "Paladin"], specs: ["Holy", "Protection", "Retribution"] },
  { key: "priest", names: ["Priests", "Priest"], specs: ["Discipline", "Holy", "Shadow"] },
  { key: "rogue", names: ["Rogues", "Rogue"], specs: ["Assassination", "Outlaw", "Subtlety"] },
  { key: "shaman", names: ["Shamans", "Shaman"], specs: ["Elemental", "Enhancement", "Restoration"] },
  { key: "warlock", names: ["Warlocks", "Warlock"], specs: ["Affliction", "Demonology", "Destruction"] },
  { key: "warrior", names: ["Warriors", "Warrior"], specs: ["Arms", "Fury", "Protection"] },
];

const BY_KEY = new Map(CLASSES.map((c) => [c.key, c]));
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const byLength = (a: string, b: string) => b.length - a.length;

// Class names: Title case, ALL CAPS, or "Death knight"-style (first word capped).
const CLASS_NAME = new Map<string, ClassKey>();
for (const c of CLASSES) for (const n of c.names) CLASS_NAME.set(n.toLowerCase(), c.key);
const CLASS_RE = new RegExp(
  `(?<![\\p{L}\\p{N}])(${[...CLASS_NAME.keys()].sort(byLength).map(esc).join("|")})(?![\\p{L}\\p{N}])`,
  "giu",
);
const SPECS = [...new Set(CLASSES.flatMap((c) => c.specs))].sort(byLength);
const SPEC_RE = new RegExp(`(?<![\\p{L}\\p{N}])(${SPECS.map(esc).join("|")})(?![\\p{L}\\p{N}])`, "giu");

const capitalised = (s: string) => /^\p{Lu}/u.test(s);
/** "DK"/"DH" must be upper-case: "dk" in prose is too loose. */
const validClassToken = (s: string) => capitalised(s) && (s.length > 3 || s === s.toUpperCase());

function specOf(spec: string, cls: ClassKey | null): boolean {
  if (!cls) return false;
  return BY_KEY.get(cls)!.specs.some((s) => s.toLowerCase() === spec.toLowerCase());
}

/** Shared across the text nodes of one document, so a class heading colours the
 *  spec lines below it. */
export type ClassContext = { current: ClassKey | null };

export type Segment = { text: string; cls?: ClassKey };

const SEPARATOR = /^[\s•·:\-–—/,(]*$/;
const SEGMENT_BREAK = /[•·\n]/;

type Hit = { start: number; end: number; kind: "class" | "spec" | "reset"; key?: ClassKey };

/** Split `text` into plain and class-coloured segments. */
export function colorizeClasses(text: string, ctx: ClassContext = { current: null }): Segment[] {
  const hits: Hit[] = [];
  for (const m of text.matchAll(CLASS_RE)) {
    if (validClassToken(m[0])) hits.push({ start: m.index!, end: m.index! + m[0].length, kind: "class", key: CLASS_NAME.get(m[0].toLowerCase()) });
  }
  for (const m of text.matchAll(SPEC_RE)) {
    const start = m.index!;
    if (!capitalised(m[0]) || hits.some((h) => start < h.end && start + m[0].length > h.start)) continue;
    hits.push({ start, end: start + m[0].length, kind: "spec" });
  }
  // An ALL-CAPS segment that isn't a class ("DUNGEONS AND RAIDS", "ITEMS")
  // ends the current class section.
  for (const m of text.matchAll(/[^•·\n]+/g)) {
    const seg = m[0].trim();
    if (seg.length > 3 && /\p{L}/u.test(seg) && seg === seg.toUpperCase() && !CLASS_NAME.has(seg.toLowerCase())) {
      hits.push({ start: m.index!, end: m.index!, kind: "reset" });
    }
  }
  hits.sort((a, b) => a.start - b.start || (a.kind === "reset" ? -1 : 1));

  const out: Segment[] = [];
  let pos = 0;
  const words = hits.filter((h) => h.kind !== "reset");
  hits.forEach((h) => {
    if (h.kind === "reset") {
      ctx.current = null;
      return;
    }
    const i = words.indexOf(h);
    const word = text.slice(h.start, h.end);
    let key: ClassKey | undefined;
    if (h.kind === "class") {
      key = h.key;
    } else {
      const next = words[i + 1];
      const prev = words[i - 1];
      // "Unholy Death Knight"
      if (next?.kind === "class" && /^\s+$/.test(text.slice(h.end, next.start)) && specOf(word, next.key!)) key = next.key;
      // "Death Knight • Unholy" / "Death Knight: Unholy"
      else if (prev?.kind === "class" && SEPARATOR.test(text.slice(prev.end, h.start)) && specOf(word, prev.key!)) key = prev.key;
      // A standalone segment under a class section.
      else if (isStandalone(text, h.start, h.end) && specOf(word, ctx.current)) key = ctx.current!;
    }
    if (h.kind === "class" && key) ctx.current = key;
    if (!key) return;
    if (h.start > pos) out.push({ text: text.slice(pos, h.start) });
    out.push({ text: word, cls: key });
    pos = h.end;
  });
  if (pos < text.length) out.push({ text: text.slice(pos) });
  return out;
}

/** The match fills its whole "•"/line segment ("• Unholy •", "<li>Unholy"). */
function isStandalone(text: string, start: number, end: number): boolean {
  let a = start;
  while (a > 0 && !SEGMENT_BREAK.test(text[a - 1])) a--;
  let b = end;
  while (b < text.length && !SEGMENT_BREAK.test(text[b])) b++;
  return text.slice(a, start).trim() === "" && /^\s*:?\s*$/.test(text.slice(end, b));
}
