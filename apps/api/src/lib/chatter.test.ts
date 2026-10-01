import { describe, expect, it } from "bun:test";
import { isBluePost } from "./blizzard";
import { isChatter } from "./ingest";

const cm = { role: "community" as const, postNumber: 12, blueThread: true, answersPlayer: false };

describe("isChatter", () => {
  it("keeps CM updates in Blizzard threads (hotfix entries, PTR notes)", () => {
    expect(isChatter(cm)).toBe(false);
  });

  it("drops CM replies in player threads", () => {
    expect(isChatter({ ...cm, blueThread: false })).toBe(true);
  });

  it("drops CM answers to players, even in Blizzard threads", () => {
    expect(isChatter({ ...cm, answersPlayer: true })).toBe(true);
  });

  it("never drops thread openers or developers", () => {
    expect(isChatter({ ...cm, postNumber: 1, blueThread: false })).toBe(false);
    expect(isChatter({ ...cm, role: "developer", blueThread: false, answersPlayer: true })).toBe(false);
  });
});

describe("isBluePost", () => {
  it("recognises staff and blue groups", () => {
    expect(isBluePost({ username: "Kaivax", staff: true, primary_group_name: "community-manager" })).toBe(true);
    expect(isBluePost({ username: "BlizzardEntertainment" })).toBe(true);
    expect(isBluePost({ username: "Nyaria-39568", staff: false, primary_group_name: null })).toBe(false);
  });
});
