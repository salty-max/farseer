import { describe, expect, it } from "bun:test";
import { colorizeClasses, type ClassContext } from "./classes";

const colored = (text: string, ctx?: ClassContext) =>
  colorizeClasses(text, ctx)
    .filter((s) => s.cls)
    .map((s) => `${s.text}=${s.cls}`);

describe("colorizeClasses", () => {
  it("colours class names, plurals and all-caps headings", () => {
    expect(colored("Death Knights and Shaman, also DEMON HUNTER")).toEqual([
      "Death Knights=deathknight",
      "Shaman=shaman",
      "DEMON HUNTER=demonhunter",
    ]);
  });

  it("ignores lowercase prose and lowercase abbreviations", () => {
    expect(colored("a rogue wave hit the dk channel")).toEqual([]);
    expect(colored("DK tanks")).toEqual(["DK=deathknight"]);
  });

  it("colours a spec next to its class, and resolves ambiguous specs by that class", () => {
    expect(colored("Frost Mages and Frost Death Knights")).toEqual([
      "Frost=mage",
      "Mages=mage",
      "Frost=deathknight",
      "Death Knights=deathknight",
    ]);
    expect(colored("Paladin • Holy")).toEqual(["Paladin=paladin", "Holy=paladin"]);
  });

  it("does not colour a spec that doesn't belong to the adjacent class", () => {
    expect(colored("Arcane Warriors")).toEqual(["Warriors=warrior"]);
  });

  it("follows patch-notes structure across bullet segments", () => {
    expect(
      colored("CLASSES • Death Knight • Unholy • Fixed an issue • Priest • Holy • Shadow • DUNGEONS AND RAIDS • Holy"),
    ).toEqual([
      "Death Knight=deathknight",
      "Unholy=deathknight",
      "Priest=priest",
      "Holy=priest",
      "Shadow=priest",
    ]);
  });

  it("carries the class context across text nodes (HTML lists)", () => {
    const ctx: ClassContext = { current: null };
    colored("SHAMAN", ctx);
    expect(colored("Restoration", ctx)).toEqual(["Restoration=shaman"]);
    expect(colored("Restoration Druids rejoice")).toEqual(["Restoration=druid", "Druids=druid"]);
  });

  it("leaves specs used as ordinary words alone", () => {
    expect(colored("Shaman: Fixed Fire damage on the Blood Elf quest")).toEqual(["Shaman=shaman"]);
  });
});
