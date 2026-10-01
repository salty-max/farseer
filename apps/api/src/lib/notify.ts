import type { Lang } from "@farseer/shared";

/**
 * Notification copy, per language. Pushes are written on the server, long after
 * the browser last spoke to us, so a trigger emits a language-neutral descriptor
 * and delivery renders it in the language the device stored with its
 * subscription. Post titles and bodies are Blizzard's own (English) text; only
 * our labels are translated.
 */
export const DEFAULT_LANG: Lang = "en";

export function asLang(v: unknown): Lang | null {
  return v === "en" || v === "fr" ? v : null;
}

export type NotifyMessage =
  | { id: "post"; author: string; title: string; reply: boolean; excerpt: string }
  | { id: "edited"; author: string; title: string }
  | { id: "welcome" };

export type Rendered = { title: string; body: string };

export function renderNotify(m: NotifyMessage, lang: Lang): Rendered {
  const t = (en: string, fr: string) => (lang === "fr" ? fr : en);
  switch (m.id) {
    case "post":
      return {
        title: `${m.author} · ${m.reply ? `${t("Re:", "Re :")} ` : ""}${m.title}`,
        body: m.excerpt,
      };
    case "edited":
      return { title: `${m.author} · ${m.title}`, body: t("✏️ Post updated", "✏️ Message mis à jour") };
    case "welcome":
      return {
        title: "Farseer",
        body: t("Notifications enabled ✓ Blue posts will land here.", "Notifications activées ✓ Les messages bleus arriveront ici."),
      };
  }
}
