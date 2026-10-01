import { describe, expect, it } from "bun:test";
import { searchSnippet } from "./feed";

describe("searchSnippet", () => {
  it("returns the passage around the first hit", () => {
    const text = `${"intro ".repeat(60)}Shaman: Fixed Totemic Recall.${" outro".repeat(60)}`;
    const s = searchSnippet(text, "shaman", 20, 20)!;
    expect(s.startsWith("…")).toBe(true);
    expect(s.endsWith("…")).toBe(true);
    expect(s).toContain("Shaman: Fixed Totemic Recall.");
  });

  it("returns null without a hit", () => {
    expect(searchSnippet("nothing here", "mage")).toBeNull();
  });
});
