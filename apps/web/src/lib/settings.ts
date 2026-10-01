import { DEFAULT_PUSH_FILTERS, type Lang, type PushFilters } from "@farseer/shared";
import { createStore } from "@/lib/store";

export type TextSize = "sm" | "md" | "lg";

export type Display = {
  /** Colour class & spec names in their class colour. */
  classColors: boolean;
  /** Post body text size in the reader. */
  textSize: TextSize;
  /** Denser feed cards. */
  compact: boolean;
  /** Highlight the push keywords wherever they appear. */
  highlightKeywords: boolean;
  /** "30 Sept, 21:56" instead of "2 days ago". */
  absoluteTime: boolean;
};

export const DEFAULT_DISPLAY: Display = {
  classColors: true,
  textSize: "md",
  compact: false,
  highlightKeywords: true,
  absoluteTime: false,
};

export type Settings = {
  lang: Lang;
  /** The push filters this device subscribes with (also editable while off). */
  push: PushFilters;
  display: Display;
};

function defaultLang(): Lang {
  try {
    return navigator.language?.toLowerCase().startsWith("fr") ? "fr" : "en";
  } catch {
    return "en";
  }
}

const initial: Settings = { lang: defaultLang(), push: DEFAULT_PUSH_FILTERS, display: DEFAULT_DISPLAY };

export const settings = createStore<Settings>("farseer:settings", initial, (raw) => {
  const r = (raw ?? {}) as Partial<Settings>;
  return {
    lang: r.lang ?? initial.lang,
    push: { ...DEFAULT_PUSH_FILTERS, ...(r.push ?? {}) },
    display: { ...DEFAULT_DISPLAY, ...(r.display ?? {}) },
  };
});

export const useSettings = settings.use;
export const getSettings = settings.get;
export function setSettings(patch: Partial<Settings>): void {
  settings.set((s) => ({ ...s, ...patch }));
}

export function setDisplay(patch: Partial<Display>): void {
  settings.set((s) => ({ ...s, display: { ...s.display, ...patch } }));
}

/** The decoration settings for post text (see lib/decorate.ts). */
export function useDecor(query?: string) {
  const { display, push } = useSettings();
  return {
    classColors: display.classColors,
    keywords: display.highlightKeywords ? push.keywords : [],
    query,
  };
}
