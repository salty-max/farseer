import type { Lang } from "@farseer/shared";

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 86400],
  ["month", 30 * 86400],
  ["week", 7 * 86400],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

/** "3 h ago" / "il y a 3 h"; "now" under a minute. */
export function timeAgo(iso: string, lang: Lang, now = Date.now()): string {
  const secs = Math.round((new Date(iso).getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto", style: "short" });
  for (const [unit, s] of UNITS) {
    if (Math.abs(secs) >= s) return rtf.format(Math.round(secs / s), unit);
  }
  return rtf.format(0, "minute");
}

export function fullDate(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleString(lang === "fr" ? "fr-FR" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** Compact absolute date: "30 Sept, 21:56" (year added when it isn't this year). */
export function shortDate(iso: string, lang: Lang, now = new Date()): string {
  const d = new Date(iso);
  return d.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB", {
    day: "numeric",
    month: "short",
    year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
