import { describe, expect, it } from "bun:test";
import { isUnread } from "./library";

describe("library", () => {
  const lib = { read: [2], readBefore: "2026-10-01T00:00:00.000Z", saved: [] };
  it("treats old and opened posts as read", () => {
    expect(isUnread(lib, { id: 1, createdAt: "2026-10-01T10:00:00.000Z" })).toBe(true);
    expect(isUnread(lib, { id: 2, createdAt: "2026-10-01T10:00:00.000Z" })).toBe(false);
    expect(isUnread(lib, { id: 3, createdAt: "2026-09-30T10:00:00.000Z" })).toBe(false);
  });
});
