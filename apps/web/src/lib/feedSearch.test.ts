import { describe, expect, it } from "bun:test";
import { postsUrl } from "./api";
import { toPostsQuery, validateFeedSearch } from "./feedSearch";

describe("feed search", () => {
  it("keeps only valid params", () => {
    expect(
      validateFeedSearch({ game: "retail", topics: ["hotfix", "nope"], region: "kr", devs: true, q: "", author: "Linxy" }),
    ).toEqual({ game: "retail", topics: ["hotfix"], devs: true, author: "Linxy" });
    expect(validateFeedSearch({ topics: "hotfix,ptr" })).toEqual({ topics: ["hotfix", "ptr"] });
  });

  it("maps to an API query string", () => {
    expect(postsUrl(toPostsQuery({ game: "classic", topics: ["hotfix", "ptr"], devs: true }))).toBe(
      "/api/posts?games=classic&topics=hotfix%2Cptr&devsOnly=1",
    );
    expect(postsUrl({})).toBe("/api/posts");
  });
});
