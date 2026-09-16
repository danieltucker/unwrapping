import { site } from "@/config/site";

/** "Saturday 14 November" — the caps line above a list headline. */
export function formatEventDate(date: Date | null): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat(site.locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

export function weeksUntil(date: Date | null): number | null {
  if (!date) return null;
  const days = Math.ceil((date.getTime() - Date.now()) / 86_400_000);
  return Math.ceil(days / 7);
}

/** "8 weeks away" / "This week" / "Passed" for the meta line. */
export function relativeEvent(date: Date | null): string | null {
  const weeks = weeksUntil(date);
  if (weeks === null) return null;
  if (weeks < 0) return "Passed";
  if (weeks === 0) return "This week";
  if (weeks === 1) return "1 week away";
  return `${weeks} weeks away`;
}
