import { Fragment, useMemo } from "react";
import { decorateText } from "@/lib/decorate";
import { useDecor } from "@/lib/settings";

/** Plain post text (titles, excerpts) with class colours and highlights per the
 *  Display settings, plus the active search query. */
export function RichText({ text, query }: { text: string; query?: string }) {
  const decor = useDecor(query);
  const segs = useMemo(() => decorateText(text, decor), [text, decor.classColors, decor.query, decor.keywords.join("\u0000")]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      {segs.map((s, i) => {
        const inner = s.cls ? (
          <span className="cc" data-c={s.cls}>
            {s.text}
          </span>
        ) : (
          s.text
        );
        return s.mark ? (
          <mark key={i} className={s.mark === "kw" ? "kw" : "hl"}>
            {inner}
          </mark>
        ) : (
          <Fragment key={i}>{inner}</Fragment>
        );
      })}
    </>
  );
}
