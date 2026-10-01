import { GAMES, TOPICS, type Game, type Lang, type PushFilters, type Topic } from "@farseer/shared";
import { useQuery } from "@tanstack/react-query";
import { Bell, BellOff, CheckCheck, Download, Plus, Send, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { RichText } from "@/components/RichText";
import { TOPIC_COLOR } from "@/lib/colors";
import { api } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";
import { canInstall, openInstallGuide } from "@/lib/install";
import { markAllRead } from "@/lib/library";
import { currentSubscription, disablePush, enablePush, pushSupport, resyncPush, type EnableResult } from "@/lib/notifications";
import { setDisplay, setSettings, useSettings, type TextSize } from "@/lib/settings";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel p-4 sm:p-5">
      <h2 className="title-display mb-3 text-gold-soft">{title}</h2>
      {children}
    </section>
  );
}

function Toggle({
  on,
  onChange,
  label,
  hint,
  disabled,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn("flex items-start gap-3 py-2", disabled ? "opacity-50" : "cursor-pointer")}>
      <span className="flex-1">
        <span className="block text-sm">{label}</span>
        <span className="block text-xs text-ink-faint">{hint}</span>
      </span>
      <input
        type="checkbox"
        className="peer sr-only"
        checked={on}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden
        className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full border border-edge bg-stone-3 transition-colors peer-checked:border-gold/60 peer-checked:bg-gold/25 peer-focus-visible:outline-2 peer-focus-visible:outline-gold-soft after:absolute after:top-0.5 after:left-0.5 after:size-4.5 after:rounded-full after:bg-ink-dim after:transition-transform peer-checked:after:translate-x-5 peer-checked:after:bg-gold"
      />
    </label>
  );
}

function KeywordInput({ keywords, onChange }: { keywords: string[]; onChange: (k: string[]) => void }) {
  const t = useT();
  const [value, setValue] = useState("");
  const add = () => {
    const k = value.trim().replace(/,$/, "").slice(0, 40);
    if (k && !keywords.some((x) => x.toLowerCase() === k.toLowerCase())) onChange([...keywords, k]);
    setValue("");
  };
  return (
    <div>
      {keywords.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {keywords.map((k) => (
            <span key={k} className="chip border-gold-soft/50 py-1 text-parchment" aria-pressed="true">
              {k}
              <button onClick={() => onChange(keywords.filter((x) => x !== k))} aria-label={`remove ${k}`}>
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={t.settings.keywordAdd}
          className="h-10 min-w-0 flex-1 rounded-lg border border-edge bg-stone-2 px-3 text-sm placeholder:text-ink-faint focus:border-gold-soft/70 focus:outline-none"
        />
        <button className="btn" onClick={add} disabled={!value.trim()} aria-label="add">
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

function ChipGroup<T extends string>({
  all,
  selected,
  label,
  onChange,
  color,
}: {
  all: readonly T[];
  selected: T[];
  label: (v: T) => string;
  onChange: (v: T[]) => void;
  color?: (v: T) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {all.map((v) => {
        const on = selected.includes(v);
        return (
          <button
            key={v}
            className="chip"
            aria-pressed={on}
            onClick={() => onChange(on ? selected.filter((x) => x !== v) : [...selected, v])}
          >
            {color && <span className={cn("size-1.5 rounded-full bg-current", color(v))} />}
            {label(v)}
          </button>
        );
      })}
    </div>
  );
}

const PUSH_TOPICS = TOPICS.filter((t) => t !== "community");

function Notifications() {
  const t = useT();
  const { push } = useSettings();
  const support = pushSupport();
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [status, setStatus] = useState<EnableResult | "test" | "saved" | null>(null);
  const [busy, setBusy] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    void currentSubscription()
      .then((s) => setSubscribed(!!s))
      .catch(() => setSubscribed(false));
  }, []);

  // Filters apply immediately; the server copy follows, debounced.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!subscribed) return;
    const id = setTimeout(() => {
      void resyncPush().then((ok) => ok && setStatus("saved"));
    }, 600);
    return () => clearTimeout(id);
  }, [push, subscribed]);

  const update = (patch: Partial<PushFilters>) => setSettings({ push: { ...push, ...patch } });

  const toggle = async () => {
    setBusy(true);
    try {
      if (subscribed) {
        await disablePush();
        setSubscribed(false);
        setStatus(null);
      } else {
        const r = await enablePush();
        setStatus(r);
        setSubscribed(r === "ok");
      }
    } finally {
      setBusy(false);
    }
  };

  const message =
    support === "install"
      ? t.settings.needInstall
      : support === "insecure"
        ? t.settings.insecure
        : support === "unsupported"
          ? t.settings.unsupported
          : status === "denied" || (typeof Notification !== "undefined" && Notification.permission === "denied")
            ? t.settings.denied
            : status === "unavailable"
              ? t.settings.unavailable
              : status === "test"
                ? t.settings.testSent
                : status === "saved"
                  ? t.settings.filtersSaved
                  : subscribed
                    ? t.settings.enabled
                    : t.settings.notifyHint;

  return (
    <Section title={t.settings.notifications}>
      <p className={cn("text-sm", subscribed ? "text-q-uncommon" : "text-ink-dim")}>{message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {support === "ok" && (
          <button className={subscribed ? "btn" : "btn-gold"} onClick={toggle} disabled={busy || subscribed === null}>
            {subscribed ? <BellOff className="size-4" /> : <Bell className="size-4" />}
            {subscribed ? t.settings.disable : t.settings.enable}
          </button>
        )}
        {support === "install" && (
          <button className="btn-gold" onClick={openInstallGuide}>
            <Download className="size-4" />
            {t.settings.install}
          </button>
        )}
        {subscribed && (
          <button
            className="btn"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              if (await resyncPush(true)) setStatus("test");
              setBusy(false);
            }}
          >
            <Send className="size-4" />
            {t.settings.sendTest}
          </button>
        )}
      </div>

      <div className="gold-rule my-5" />

      <h3 className="text-sm font-semibold">{t.settings.games}</h3>
      <p className="mb-2 text-xs text-ink-faint">{t.settings.gamesHint}</p>
      <ChipGroup<Game> all={GAMES} selected={push.games} label={(g) => t.game[g]} onChange={(games) => update({ games })} />

      <h3 className="mt-5 text-sm font-semibold">{t.settings.topics}</h3>
      <p className="mb-2 text-xs text-ink-faint">{t.settings.topicsHint}</p>
      <ChipGroup<Topic>
        all={PUSH_TOPICS}
        selected={push.topics}
        label={(x) => t.topic[x]}
        color={(x) => TOPIC_COLOR[x]}
        onChange={(topics) => update({ topics })}
      />

      <h3 className="mt-5 text-sm font-semibold">{t.settings.keywords}</h3>
      <p className="mb-2 text-xs text-ink-faint">{t.settings.keywordsHint}</p>
      <KeywordInput keywords={push.keywords} onChange={(keywords) => update({ keywords })} />

      <div className="mt-4 divide-y divide-edge/60">
        <Toggle on={push.devsOnly} onChange={(devsOnly) => update({ devsOnly })} label={t.settings.devsOnly} hint={t.settings.devsOnlyHint} />
        <Toggle on={push.updates} onChange={(updates) => update({ updates })} label={t.settings.updates} hint={t.settings.updatesHint} />
      </div>
    </Section>
  );
}

function DisplaySection() {
  const t = useT();
  const { display, push } = useSettings();
  const noKeywords = push.keywords.length === 0;
  return (
    <Section title={t.settings.display}>
      <div className="rounded-lg border border-edge bg-stone-2/60 p-3">
        <p className="mb-1 text-[11px] tracking-wider text-ink-faint uppercase">{t.settings.preview}</p>
        <p className="post-body" data-size={display.textSize}>
          <RichText text={t.settings.previewText} />
        </p>
      </div>

      <div className="mt-2 divide-y divide-edge/60">
        <Toggle
          on={display.classColors}
          onChange={(classColors) => setDisplay({ classColors })}
          label={t.settings.classColors}
          hint={t.settings.classColorsHint}
        />
        <div className="py-2">
          <span className="block text-sm">{t.settings.textSize}</span>
          <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl border border-edge bg-stone-2 p-1" role="radiogroup">
            {(["sm", "md", "lg"] as TextSize[]).map((size) => (
              <button
                key={size}
                role="radio"
                aria-checked={display.textSize === size}
                onClick={() => setDisplay({ textSize: size })}
                className={cn(
                  "rounded-lg py-1.5",
                  { sm: "text-xs", md: "text-sm", lg: "text-base" }[size],
                  display.textSize === size ? "bg-stone-3 font-semibold text-gold" : "text-ink-dim hover:text-parchment",
                )}
              >
                {t.settings.textSizes[size]}
              </button>
            ))}
          </div>
        </div>
        <Toggle
          on={display.compact}
          onChange={(compact) => setDisplay({ compact })}
          label={t.settings.compact}
          hint={t.settings.compactHint}
        />
        <Toggle
          on={display.highlightKeywords && !noKeywords}
          disabled={noKeywords}
          onChange={(highlightKeywords) => setDisplay({ highlightKeywords })}
          label={t.settings.highlightKeywords}
          hint={noKeywords ? t.settings.highlightKeywordsEmpty : t.settings.highlightKeywordsHint}
        />
        <Toggle
          on={display.absoluteTime}
          onChange={(absoluteTime) => setDisplay({ absoluteTime })}
          label={t.settings.absoluteTime}
          hint={t.settings.absoluteTimeHint}
        />
      </div>
    </Section>
  );
}

export function Settings() {
  const t = useT();
  const lang = useLang();
  const meta = useQuery({ queryKey: ["meta"], queryFn: api.meta, staleTime: 60_000 });

  return (
    <div className="space-y-3">
      <h1 className="title-display px-1 pt-1 text-lg text-gold">{t.settings.title}</h1>

      <Section title={t.settings.language}>
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-edge bg-stone-2 p-1">
          {(["en", "fr"] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setSettings({ lang: l })}
              className={cn(
                "rounded-lg py-1.5 text-sm",
                lang === l ? "bg-stone-3 font-semibold text-gold" : "text-ink-dim hover:text-parchment",
              )}
            >
              {l === "en" ? "English" : "Français"}
            </button>
          ))}
        </div>
      </Section>

      <DisplaySection />

      <Notifications />

      <Section title={t.settings.reading}>
        <button className="btn" onClick={markAllRead}>
          <CheckCheck className="size-4" />
          {t.settings.markAllRead}
        </button>
        {canInstall() && (
          <div className="mt-4">
            <p className="mb-2 text-sm text-ink-dim">{t.settings.installHint}</p>
            <button className="btn" onClick={openInstallGuide}>
              <Download className="size-4" />
              {t.settings.install}
            </button>
          </div>
        )}
      </Section>

      <Section title={t.settings.about}>
        <p className="text-sm text-ink-dim">{t.settings.aboutText}</p>
        <p className="mt-3 text-xs text-ink-faint">{t.settings.version(__APP_VERSION__, __BUILD_DATE__)}</p>
        {meta.data?.lastPolledAt && (
          <p className="text-xs text-ink-faint">{t.settings.lastPoll(timeAgo(meta.data.lastPolledAt, lang))}</p>
        )}
      </Section>
    </div>
  );
}
