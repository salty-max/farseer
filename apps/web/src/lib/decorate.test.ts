import { describe, expect, it } from "bun:test";
import { decorateHtml, decorateText } from "./decorate";

const off = { classColors: false, keywords: [] };
const on = { classColors: true, keywords: [] };

describe("decorateText", () => {
  it("highlights keywords to the end of the word, and the search query", () => {
    const segs = decorateText("Hotfixes for Shaman totems", { ...off, keywords: ["hotfix"], query: "totem" });
    expect(segs.filter((s) => s.mark).map((s) => `${s.text}:${s.mark}`)).toEqual(["Hotfixes:kw", "totem:q"]);
  });

  it("combines class colours with highlights", () => {
    const segs = decorateText("Shaman fixes", { ...on, keywords: ["shaman"] });
    expect(segs[0]).toEqual({ text: "Shaman", cls: "shaman", mark: "kw" });
  });

  it("is a no-op when everything is off", () => {
    expect(decorateText("Death Knight", off)).toEqual([{ text: "Death Knight" }]);
  });
});

describe("decorateHtml", () => {
  const hotfix =
    "<p><strong>Classes</strong></p><ul><li><strong>Death Knight</strong><ul><li><strong>Unholy</strong><ul><li>Fixed Frost damage.</li></ul></li></ul></li></ul><p><strong>Delves</strong></p><ul><li><strong>Unholy</strong></li></ul>";

  it("colours class headings and the specs nested under them", () => {
    const out = decorateHtml(hotfix, on);
    expect(out).toContain('<strong><span class="cc" data-c="deathknight">Death Knight</span></strong>');
    expect(out).toContain('<strong><span class="cc" data-c="deathknight">Unholy</span></strong>');
    expect(out).toContain("Fixed Frost damage."); // prose, not a heading
  });

  it("ends the class section at the next paragraph title", () => {
    const out = decorateHtml(hotfix, on);
    expect(out.match(/data-c="deathknight">Unholy/g)?.length).toBe(1);
  });

  it("never touches code blocks", () => {
    expect(decorateHtml("<pre>Shaman</pre>", on)).toBe("<pre>Shaman</pre>");
  });
});
