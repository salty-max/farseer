import { RefreshCw, X } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useT } from "@/lib/i18n";

// vite-plugin-pwa only checks for a new SW at cold start; an installed PWA that
// is never fully closed would never see an update without this poll.
const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000;

/** "New version available" banner (registerType: "prompt"). Production only. */
export function UpdatePrompt() {
  const t = useT();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const recheck = () => void registration.update().catch(() => {});
      setInterval(recheck, UPDATE_CHECK_INTERVAL);
      const onForeground = () => {
        if (document.visibilityState === "visible") recheck();
      };
      document.addEventListener("visibilitychange", onForeground);
      window.addEventListener("online", onForeground);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed inset-x-3 bottom-20 z-50 mx-auto flex max-w-md items-center gap-2 panel-gold px-3 py-2 shadow-2xl">
      <span className="flex-1 text-sm">{t.update.available}</span>
      <button onClick={() => updateServiceWorker(true)} className="btn-gold py-1.5">
        <RefreshCw className="size-4" />
        {t.update.reload}
      </button>
      <button onClick={() => setNeedRefresh(false)} aria-label={t.update.close} className="icon-btn size-8">
        <X className="size-4" />
      </button>
    </div>
  );
}
