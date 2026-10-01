import { describe, expect, it } from "bun:test";
import { absolutize, decodeEntities, htmlToText, truncate } from "./html";

describe("html", () => {
  it("decodes named and numeric entities", () => {
    expect(decodeEntities("r&hellip; &amp; &#8217; &#x2014;")).toBe("r… & ’ —");
  });

  it("turns cooked HTML into readable text", () => {
    expect(htmlToText("<p>Hello <b>there</b></p><ul><li>One</li><li>Two</li></ul>")).toBe("Hello there\n• One\n• Two");
  });

  it("absolutizes relative and protocol-relative URLs", () => {
    const html = '<a href="/en/wow/t/x/1">x</a><img src="//cdn.example/a.png" srcset="/a.png 1x, /b.png 2x">';
    expect(absolutize(html, "https://us.forums.blizzard.com")).toBe(
      '<a href="https://us.forums.blizzard.com/en/wow/t/x/1">x</a><img src="https://cdn.example/a.png" srcset="https://us.forums.blizzard.com/a.png 1x, https://us.forums.blizzard.com/b.png 2x">',
    );
  });

  it("truncates on a word boundary", () => {
    expect(truncate("the quick brown fox jumps", 18)).toBe("the quick brown…");
    expect(truncate("short", 15)).toBe("short");
  });
});
