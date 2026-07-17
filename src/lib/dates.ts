function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

/** Site voice for post dates: "the 31st of May, 2026". */
export function inscribedDate(date: Date): string {
  const monthYear = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(date);
  return `the ${ordinal(date.getDate())} of ${monthYear.replace(' ', ', ')}`;
}

/** Compact date for cards: "15 Jul 2026". */
export function shortDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

/** Day and month only, for timeline entries: "15 Jul". */
export function dayMonth(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date);
}

/** Month and year, for the Narad quest chain: "Jul 2026". */
export function monthYear(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' }).format(date);
}
