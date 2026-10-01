import { describe, expect, it } from "bun:test";
import { classify } from "./classify";

const c = (category: string, parentCategory: string | null, title: string, role = "community" as const) =>
  classify({ category, parentCategory, title, role });

describe("classify", () => {
  it("reads the game from the category tree first", () => {
    expect(c("The Burning Crusade Classic", "WoW Classic", "The Burning Crusade Hotfixes").game).toBe("classic");
    expect(c("WoW: Forever Beta Discussion", "In Development", "Beta Update Maintenance").game).toBe("forever");
    expect(c("Midnight: 12.1.5 Public Test Realm", "In Development", "PTR notes").game).toBe("retail");
  });

  it("falls back to the title in generic categories", () => {
    expect(c("General Discussion", "Community", "World of Warcraft: Forever Class Deep Dives").game).toBe("forever");
    expect(c("General Discussion", "Community", "Season of Discovery Phase 8").game).toBe("classic");
    expect(c("General Discussion", "Community", "Midnight’s 12.1.5 Content Update").game).toBe("retail");
  });

  it("tags topics", () => {
    expect(c("General Discussion", "Community", "World of Warcraft: Midnight Hotfixes - September 29").topics).toEqual([
      "hotfix",
    ]);
    expect(c("Midnight: 12.1.5 Public Test Realm", "In Development", "Midnight: 12.1.5 PTR Development Notes").topics).toEqual(
      ["patchnotes", "ptr"],
    );
    expect(c("WoW: Forever Beta Discussion", "In Development", "Beta Update Maintenance - October 1").topics).toEqual([
      "ptr",
      "maintenance",
    ]);
    expect(c("Shaman", "Classes", "Totems feedback").topics).toEqual(["classes"]);
    expect(c("General Discussion", "Community", "Gold buying rules").topics).toEqual(["community"]);
    expect(c("General Discussion", "Community", "Watch the keynote", "official" as never).topics).toEqual(["news"]);
  });
});
