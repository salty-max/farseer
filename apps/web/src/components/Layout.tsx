import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Bookmark, Rss, Settings } from "lucide-react";
import { useEffect } from "react";
import { InstallPrompt } from "@/components/InstallPrompt";
import { Logo } from "@/components/Logo";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import { lastFeedSearch } from "@/lib/feedSearch";
import { useT } from "@/lib/i18n";
import { useLibrary } from "@/lib/library";
import { resyncPush } from "@/lib/notifications";
import { useSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

export function Layout() {
  const t = useT();
  const { lang } = useSettings();
  const saved = useLibrary().saved.length;
  const path = useRouterState({ select: (s) => s.location.pathname });
  const feedSearch = lastFeedSearch.use().search;

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // Keep the server's copy of this device's language in sync (filters are
  // pushed explicitly from Settings).
  useEffect(() => {
    void resyncPush().catch(() => {});
  }, [lang]);

  const tabs = [
    { to: "/", label: t.nav.feed, icon: Rss, active: path === "/" || path.startsWith("/post"), search: feedSearch },
    { to: "/saved", label: t.nav.saved, icon: Bookmark, active: path === "/saved", badge: saved },
    { to: "/settings", label: t.nav.settings, icon: Settings, active: path === "/settings" },
  ] as const;

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <header className="pt-safe sticky top-0 z-30 border-b border-edge/60 bg-night/85 backdrop-blur-md">
        <div className="flex h-14 items-center gap-2.5 px-4">
          <Link to="/" search={{}} className="flex items-center gap-2.5" aria-label="Farseer">
            <Logo size={30} />
            <span className="title-display text-xl font-semibold text-gold">Farseer</span>
          </Link>
          <span className="mt-1 hidden text-xs text-ink-faint sm:inline">{t.app.tagline}</span>
          <nav className="ml-auto hidden gap-1 sm:flex">
            {tabs.map((tab) => (
              <Link
                key={tab.to}
                to={tab.to}
                search={"search" in tab ? tab.search : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
                  tab.active ? "bg-stone-2 text-gold" : "text-ink-dim hover:text-parchment",
                )}
              >
                <tab.icon className="size-4" />
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="gold-rule" />
      </header>

      <main className="flex-1 px-3 pt-3 pb-24 sm:px-4 sm:pb-10">
        <Outlet />
      </main>

      {/* Bottom tab bar (phones) */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-edge/70 bg-night/90 backdrop-blur-md sm:hidden">
        <div className="mx-auto flex max-w-2xl">
          {tabs.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              search={"search" in tab ? tab.search : undefined}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] transition-colors",
                tab.active ? "text-gold" : "text-ink-faint",
              )}
            >
              <tab.icon className="size-5" />
              {tab.label}
              {"badge" in tab && tab.badge > 0 && (
                <span className="absolute top-1 left-1/2 ml-2 rounded-full bg-gold px-1 text-[9px] font-bold text-night">
                  {tab.badge}
                </span>
              )}
            </Link>
          ))}
        </div>
      </nav>

      {import.meta.env.PROD && <UpdatePrompt />}
      <InstallPrompt />
    </div>
  );
}
