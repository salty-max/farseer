import { afterEach, describe, expect, it } from "bun:test";
import { avatarUrl, fetchTracker, postUrl, roleOf, setFetch } from "./blizzard";
import { blueText, stripQuotes } from "./ingest";

describe("blizzard", () => {
  it("maps groups to roles", () => {
    expect(roleOf("wow-developer", "Aggrend")).toBe("developer");
    expect(roleOf("community-manager", "Kaivax")).toBe("community");
    expect(roleOf("api_users", "BlizzardEntertainment")).toBe("official");
    expect(roleOf(null, "Someone")).toBe("staff");
  });

  it("builds forum URLs", () => {
    expect(postUrl("eu", "slug", 12, 3)).toBe("https://eu.forums.blizzard.com/en/wow/t/slug/12/3");
    expect(avatarUrl("us", "/en/wow/user_avatar/x/{size}/1.png")).toBe(
      "https://us.forums.blizzard.com/en/wow/user_avatar/x/96/1.png",
    );
    expect(avatarUrl("us", null)).toBeNull();
  });

  it("drops quoted player text", () => {
    expect(stripQuotes('<aside class="quote no-group"><blockquote>player</blockquote></aside><p>blue</p>')).toBe(
      "<p>blue</p>",
    );
    expect(blueText('<aside class="quote"><blockquote><p>Dev notes</p></blockquote></aside>')).toBe("Dev notes");
  });
});

describe("getJson retries", () => {
  afterEach(() => setFetch((input, init) => fetch(input, init)));

  it("retries a 429 and then succeeds", async () => {
    let calls = 0;
    setFetch(async () => {
      calls++;
      return calls === 1
        ? new Response("", { status: 429, headers: { "retry-after": "0.01" } })
        : Response.json({ posts: [{ id: 1 }] });
    });
    expect((await fetchTracker("us")).length).toBe(1);
    expect(calls).toBe(2);
  });

  it("does not retry a 404", async () => {
    let calls = 0;
    setFetch(async () => {
      calls++;
      return new Response("", { status: 404 });
    });
    await expect(fetchTracker("us")).rejects.toThrow("404");
    expect(calls).toBe(1);
  });
});
