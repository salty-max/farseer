import { afterEach, describe, expect, it } from "bun:test";
import { render } from "@testing-library/react";
import { setDisplay } from "@/lib/settings";
import { RichText } from "./RichText";

describe("RichText", () => {
  afterEach(() => setDisplay({ classColors: true }));

  it("colours classes and marks search hits (regex-safe)", () => {
    const { container } = render(<RichText text="Shaman (Totem+) changes" query="totem+" />);
    expect(container.querySelector('.cc[data-c="shaman"]')?.textContent).toBe("Shaman");
    expect(container.querySelector("mark.hl")?.textContent).toBe("Totem+");
  });

  it("respects the class colours toggle", () => {
    setDisplay({ classColors: false });
    const { container } = render(<RichText text="Shaman changes" />);
    expect(container.querySelector(".cc")).toBeNull();
  });
});
