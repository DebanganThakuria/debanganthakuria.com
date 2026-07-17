/**
 * Single source of truth for the tag palette. Colors resolve through the
 * theme variables in global.css, so they adapt to day/night automatically.
 */
interface TagColors {
  /** Pastel chip background. */
  bg: string;
  /** Chip text ink. */
  text: string;
  /** Accent ink for markers (timeline diamonds, card hover borders). */
  ink: string;
}

export const TAGS: Record<string, TagColors> = {
  Tech:    { bg: 'var(--color-tag-tech-bg)',    text: 'var(--color-tag-tech-text)',    ink: 'var(--color-sky)'    },
  Anime:   { bg: 'var(--color-tag-anime-bg)',   text: 'var(--color-tag-anime-text)',   ink: 'var(--color-purple)' },
  Writing: { bg: 'var(--color-tag-writing-bg)', text: 'var(--color-tag-writing-text)', ink: 'var(--color-sun)'    },
  Life:    { bg: 'var(--color-tag-life-bg)',    text: 'var(--color-tag-life-text)',    ink: 'var(--color-mint)'   },
  Travel:  { bg: 'var(--color-tag-writing-bg)', text: 'var(--color-coral)',            ink: 'var(--color-coral)'  },
};

const FALLBACK: TagColors = TAGS.Life;

export function tagColors(tag: string): TagColors {
  return TAGS[tag] ?? FALLBACK;
}

/** Inline style for a tag chip (background, ink, and a translucent border). */
export function tagChipStyle(tag: string): string {
  const { bg, text } = tagColors(tag);
  return `background-color: ${bg}; color: ${text}; border-color: color-mix(in srgb, ${text} 35%, transparent);`;
}

/** Accent ink of a post's primary (first) tag. */
export function primaryInk(tags: string[]): string {
  return tagColors(tags[0] ?? 'Life').ink;
}
