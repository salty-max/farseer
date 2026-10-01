import { useLang } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { fullDate, shortDate, timeAgo } from "@/lib/time";

/** A post time, relative or absolute per the Display settings; the full date is
 *  always one hover away. */
export function When({ iso }: { iso: string }) {
  const lang = useLang();
  const { absoluteTime } = useSettings().display;
  return (
    <time dateTime={iso} title={fullDate(iso, lang)}>
      {absoluteTime ? shortDate(iso, lang) : timeAgo(iso, lang)}
    </time>
  );
}
