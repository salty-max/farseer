// Client side of Web Push: permission, (un)subscribing this browser, and
// keeping the server's copy of this device's filters + language in sync.
import type { SubscribeRequest } from "@farseer/shared";
import { getDeviceId } from "@/lib/device";
import { canInstall } from "@/lib/install";
import { getSettings } from "@/lib/settings";

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Why push can't be turned on, for a targeted hint. iOS only exposes Push to a
 *  web app opened from the Home Screen — in a Safari tab it doesn't exist. */
export type PushSupport = "ok" | "install" | "insecure" | "unsupported";

export function pushSupport(): PushSupport {
  if (pushSupported()) return "ok";
  if (typeof window === "undefined") return "unsupported";
  if (!window.isSecureContext) return "insecure";
  if (canInstall()) return "install";
  return "unsupported";
}

function urlB64ToU8(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function postSubscribe(sub: PushSubscription, welcome = false): Promise<boolean> {
  const { push, lang } = getSettings();
  const json = sub.toJSON() as SubscribeRequest["subscription"];
  const body: SubscribeRequest = { subscription: json, deviceId: getDeviceId(), filters: push, lang, welcome };
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export type EnableResult = "ok" | "denied" | "unavailable" | "unsupported" | "error";

/** Ask permission, subscribe, register with the API (+ a welcome push). */
export async function enablePush(): Promise<EnableResult> {
  if (!pushSupported()) return "unsupported";
  if ((await Notification.requestPermission()) !== "granted") return "denied";
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const res = await fetch("/api/push/key");
      const { key } = (await res.json()) as { key: string | null };
      if (!key) return "unavailable";
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToU8(key) });
    }
    return (await postSubscribe(sub, true)) ? "ok" : "error";
  } catch {
    return "error";
  }
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {});
  await sub.unsubscribe();
}

/** Re-send filters + language for an existing subscription (idempotent upsert). */
export async function resyncPush(welcome = false): Promise<boolean> {
  const sub = await currentSubscription();
  return sub ? postSubscribe(sub, welcome) : false;
}
