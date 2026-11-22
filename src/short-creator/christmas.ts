/**
 * Christmas 2026 is a TEMPORARY 13:00 IST replacement for the quote slot.
 * Pure date logic (no server timezone dependence): the caller provides an
 * Asia/Kolkata YYYY-MM-DD date; the server still validates it here.
 */
export const CHRISTMAS_START = "2026-11-22";
export const CHRISTMAS_DAY = "2026-12-25";
export const CHRISTMAS_FINALE = "2026-12-26";

export type ChristmasMode = "countdown" | "christmas_day" | "finale";
export type ChristmasCard = {
  date: string;
  mode: ChristmasMode;
  contentId: string;
  headline: string;
  emphasis: "Christmas" | "Christmas Eve" | "Birth of Christ";
  subline: string;
  daysRemaining: number | null;
  title: string;
  description: string;
  colorway: "red" | "green" | "blue";
};

function isoDayNumber(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Date must be YYYY-MM-DD");
  const ms = Date.parse(value + "T00:00:00Z");
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value) {
    throw new Error("Invalid calendar date");
  }
  return Math.floor(ms / 86400000);
}

/** Returns null outside the season. In n8n, null means run normal quote. */
export function christmasCard(date: string): ChristmasCard | null {
  const day = isoDayNumber(date);
  const start = isoDayNumber(CHRISTMAS_START);
  const christmas = isoDayNumber(CHRISTMAS_DAY);
  const finale = isoDayNumber(CHRISTMAS_FINALE);
  if (day < start || day > finale) return null;

  const base = {
    date,
    contentId: "christmas-countdown-" + date,
    colorway: (["red", "green", "blue"] as const)[(day - start) % 3],
  };

  if (day === finale) {
    return {
      ...base,
      mode: "finale",
      headline: "Until next Christmas",
      emphasis: "Christmas",
      subline: "One more year to wait. The joy stays with us.",
      daysRemaining: null,
      title: "See You Next Christmas ✨ | Grace In A Minute",
      description: "Christmas has passed, but its joy remains. See you next Christmas! 🎄 #Christmas #GraceInAMinute",
    };
  }

  if (day === christmas) {
    return {
      ...base,
      mode: "christmas_day",
      headline: "Merry Christmas!",
      emphasis: "Birth of Christ",
      subline: "Today we celebrate the Birth of Christ.",
      daysRemaining: 0,
      title: "Merry Christmas! ✨ | Birth of Christ",
      description: "Merry Christmas! Today we celebrate the Birth of Christ. 🎄✨ #Christmas #BirthOfChrist #GraceInAMinute",
    };
  }

  // At Christmas Eve, display a genuinely correct 1-day countdown.
  const rotation = (["Christmas", "Christmas Eve", "Birth of Christ"] as const)[(day - start) % 3];
  const emphasis = date === "2026-12-24" ? "Christmas" : rotation;
  // Christmas Eve falls on Dec 24; the other two phrases refer to Dec 25.
  const target = emphasis === "Christmas Eve" ? christmas - 1 : christmas;
  const remaining = target - day;
  if (remaining < 1) throw new Error("A countdown must never show zero/negative days");
  const headline = remaining === 1 ? "1 Day to" : remaining + " Days to";
  return {
    ...base,
    mode: "countdown",
    headline,
    emphasis,
    subline: "A little more joy, a little closer to Christmas.",
    daysRemaining: remaining,
    title: headline + " " + emphasis + " 🎄 | Grace In A Minute",
    description: headline + " " + emphasis + "! 🎄✨ A season of hope and joy. #Christmas #ChristmasCountdown #BirthOfChrist #GraceInAMinute",
  };
}

/** Always compute dates in India: do not rely on UTC day boundaries. */
export function indiaDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}
