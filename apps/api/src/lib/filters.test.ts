import { describe, expect, it } from "bun:test";
import { DEFAULT_PUSH_FILTERS, type PushFilters } from "@farseer/shared";
import { matchesFilters, parseFilters, type Matchable } from "./filters";

const post: Matchable = {
  game: "retail",
  topics: ["hotfix"],
  role: "community",
  topicTitle: "World of Warcraft: Midnight Hotfixes - September 29",
  text: "Shaman: Fixed an issue where Totemic Recall did not reset Earth Elemental.",
};
const f = (o: Partial<PushFilters>): PushFilters => ({ ...DEFAULT_PUSH_FILTERS, games: [], ...o });

describe("matchesFilters", () => {
  it("matches everything with empty filters", () => {
    expect(matchesFilters(post, f({}))).toBe(true);
  });

  it("requires game, topic and devs-only to all pass", () => {
    expect(matchesFilters(post, f({ games: ["classic"] }))).toBe(false);
    expect(matchesFilters(post, f({ games: ["retail"], topics: ["hotfix", "ptr"] }))).toBe(true);
    expect(matchesFilters(post, f({ topics: ["news"] }))).toBe(false);
    expect(matchesFilters(post, f({ devsOnly: true }))).toBe(false);
  });

  it("matches keywords on word starts, case-insensitively", () => {
    expect(matchesFilters(post, f({ keywords: ["shaman"] }))).toBe(true);
    expect(matchesFilters(post, f({ keywords: ["HOTFIX"] }))).toBe(true); // "Hotfixes"
    expect(matchesFilters(post, f({ keywords: ["mage"] }))).toBe(false);
    expect(matchesFilters({ ...post, text: "Increased damage of Fireball." }, f({ keywords: ["mage"] }))).toBe(false);
    expect(matchesFilters(post, f({ keywords: ["earth elemental"] }))).toBe(true);
  });
});

describe("parseFilters", () => {
  it("accepts and normalizes valid filters", () => {
    expect(
      parseFilters({ games: ["retail", "retail"], topics: ["hotfix"], keywords: [" Shaman ", ""], devsOnly: true }),
    ).toEqual({ games: ["retail"], topics: ["hotfix"], keywords: ["Shaman"], devsOnly: true, updates: true });
  });

  it("rejects unknown values", () => {
    expect(parseFilters({ games: ["diablo"] })).toBeNull();
    expect(parseFilters({ keywords: [1] })).toBeNull();
    expect(parseFilters(null)).toBeNull();
  });
});
