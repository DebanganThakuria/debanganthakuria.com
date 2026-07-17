/** Estimated reading time in minutes, at ~200 words per minute. */
export function readingTimeMins(body?: string): number {
  const words = body?.split(/\s+/).length ?? 0;
  return Math.max(1, Math.round(words / 200));
}

/** Site voice for reading time: "a 6-candle read". */
export function candleRead(mins: number): string {
  return `a ${mins}-candle read`;
}
