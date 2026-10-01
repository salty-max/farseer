import { describe, expect, it } from "bun:test";
import { app } from "./app";

describe("app", () => {
  it("is healthy", async () => {
    const res = await app.request("/api/health");
    expect(await res.json()).toEqual({ ok: true });
  });

  it("guards admin routes", async () => {
    const res = await app.request("/api/admin/poll", { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("rejects subscriptions to non-push endpoints", async () => {
    const res = await app.request("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription: { endpoint: "https://evil.example/x", keys: { p256dh: "a", auth: "b" } },
        deviceId: "d",
        filters: { games: [], topics: [], keywords: [] },
        lang: "en",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("validates post ids", async () => {
    expect((await app.request("/api/posts/abc")).status).toBe(400);
  });
});
