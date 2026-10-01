import { describe, expect, it } from "bun:test";
import { findDuplicate, isSamePost, normAuthor } from "./dedupe";

const at = (iso: string) => new Date(iso);
const US =
  "Tomorrow morning PDT, we will take the WoW Forever Beta offline for maintenance. Several hours later, the Beta will resume with an updated build that includes changes and fixes, with the level cap raised to 30.";
const EU =
  "This evening CEST, we will take the WoW Forever Beta offline for maintenance. Several hours later, the Beta will resume with an updated build that includes changes and fixes, with the level cap raised to 30.";

describe("dedupe", () => {
  it("strips the EU battletag suffix", () => {
    expect(normAuthor("Linxy-376595")).toBe("linxy");
    expect(normAuthor("Kaivax")).toBe("kaivax");
  });

  it("merges a reworded US/EU crosspost by the same author", () => {
    expect(
      isSamePost(
        { username: "Kaivax", createdAt: at("2026-10-01T00:17:00Z"), topicTitle: "Beta Update Maintenance - October 1", text: US },
        {
          username: "Kaivax",
          createdAt: at("2026-10-01T00:19:00Z"),
          topicTitle: "Beta Update Maintenance - Evening of 1 October",
          text: EU,
        },
      ),
    ).toBe(true);
  });

  it("keeps different authors, distant dates and different text apart", () => {
    const base = { username: "Kaivax", createdAt: at("2026-10-01T00:17:00Z"), topicTitle: "Beta Update Maintenance", text: US };
    expect(isSamePost(base, { ...base, username: "Linxy" })).toBe(false);
    expect(isSamePost(base, { ...base, createdAt: at("2026-10-05T00:00:00Z") })).toBe(false);
    expect(
      isSamePost(base, {
        ...base,
        text: "We’re aware of an issue preventing some players from logging in and are investigating it now. Thanks for your patience.",
      }),
    ).toBe(false);
  });

  it("keeps templated posts with different titles apart", () => {
    const body =
      "We will be conducting raid testing on the PTR this week. Please join us and report any issues you encounter in the feedback thread linked below.";
    expect(
      isSamePost(
        { username: "Linxy", createdAt: at("2026-09-01T00:00:00Z"), topicTitle: "PTR Raid Testing: Mythic Kith’ix (15-25)", text: body },
        { username: "Linxy", createdAt: at("2026-09-01T01:00:00Z"), topicTitle: "PTR Raid Testing: Heroic Kith'ix (10-30)", text: body },
      ),
    ).toBe(false);
  });

  it("only merges short replies when identical", () => {
    const a = { username: "Nethaera", createdAt: at("2026-09-30T19:00:00Z"), topicTitle: "Deep Dives", text: "Thanks for the feedback!" };
    expect(isSamePost(a, { ...a })).toBe(true);
    expect(isSamePost(a, { ...a, text: "Thanks for the report!" })).toBe(false);
  });

  it("finds the first duplicate among candidates", () => {
    const cands = [
      { id: 1, username: "Linxy", createdAt: at("2026-10-01T00:00:00Z"), topicTitle: "Beta Update", text: US },
      { id: 2, username: "Kaivax", createdAt: at("2026-10-01T00:00:00Z"), topicTitle: "Beta Update", text: US },
    ];
    expect(
      findDuplicate({ username: "Kaivax", createdAt: at("2026-10-01T00:10:00Z"), topicTitle: "Beta Update", text: EU }, cands)
        ?.id,
    ).toBe(2);
  });
});
