# debanganthakuria.com — Claude Code Context

Personal blog and portfolio built with Astro v7 + Tailwind CSS v4. Static output, deployed on Vercel.

## Stack

- **Astro v7** (static output, `output: 'static'`)
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin — no `tailwind.config.js`
- **Node / npm** (not bun)

## Critical: Astro v7 API differences

These differ from older Astro tutorials — use these, not the legacy patterns:

| Task | Correct (v6) | Wrong (legacy) |
| ------ | ------------- | ---------------- |
| Content config location | `src/content.config.ts` | `src/content/config.ts` |
| Collection loader | `glob` from `astro/loaders` | `defineCollection` without loader |
| Render a post | `render(post)` from `astro:content` | `post.render()` |
| Post slug | `post.id` | `post.slug` |

## Critical: Tailwind v4 differences

- Theme is defined in `src/styles/global.css` under `@theme {}` — not in a config file
- No `tailwind.config.js` exists — don't create one
- Vite plugin wired in `astro.config.mjs`: `import tailwindcss from '@tailwindcss/vite'`

## Design Tokens

The site is themed as a **cozy illustrated storybook** (Side Quests-inspired) — a
painted watercolor valley crowns every page and fades into parchment, content flows
on the open page, cards have torn-paper edges, nav is floating pills, and the voice
is gentle fantasy (journal entries, candle reads, character-sheet homepage). Defined
in `src/styles/global.css` under `@theme {}`:

```text
Day:          #f4e9cf parchment page, #ead9b4 cards, #4b3621 ink,
              #a34e2f dusty-terracotta accent (--color-coral)
Night:        html.dark = twilight — #272138 indigo page, #332c4c cards,
              #e6dabc cream ink, #e08a5e ember accent
Gold:         --color-gold #a0793d / --color-gold-bright #c2913e (labels, diamonds)
Tag inks:     --color-sky (Tech), --color-purple (Anime), --color-sun (Writing),
              --color-mint (Life) — single source of truth in src/lib/tags.ts
Hero art:     src/assets/images/hero-day.png + hero-night.png (AI watercolors,
              matching composition; bottom third is mist for the page fade).
              Hero.astro falls back to a hand-coded SVG scene if images are removed.
Fonts:        Almendra (headings) + EB Garamond (body) via @fontsource
Base size:    20px — the owner prefers large text; all sizes are rem-based
Motifs:       .torn (torn parchment clip), .rule-diamond (—◆— divider),
              .ui-label (gold small-caps), pill nav/filters, "a N-candle read",
              "Inscribed the 16th of July, 2026" dates
```

Legacy var names (`--color-coral`, `--color-sky`, etc.) are remapped to this palette
so all components inherit the theme — don't rename them.

## Shared code (src/lib/)

Never duplicate these — import them:

- `lib/tags.ts` — tag palette + `tagChipStyle(tag)` / `primaryInk(tags)`
- `lib/dates.ts` — `inscribedDate` / `shortDate` / `dayMonth` / `monthYear`
- `lib/reading.ts` — `readingTimeMins(body)` + `candleRead(mins)`
- `lib/covers.ts` — `novelCover(slug)` for novel cover images

## Project Structure

```text
src/
  content.config.ts          ← collection schema (Astro v7 glob loader)
  content/posts/
    life/     tech/     anime/     writing/     travel/
  assets/images/             ← post images (referenced via relative paths in markdown)
  lib/                        ← shared helpers: tags, dates, reading time, covers
  layouts/
    BaseLayout.astro          ← head/meta, hero band + header overlay, page shell
    PostLayout.astro          ← manuscript reading layout (drop cap, inscribed dates)
  components/
    Hero.astro                ← painted landscape band (day/night art, SVG fallback)
    Header.astro              ← pill nav floating over the hero sky
    Footer.astro              ← rotating signoffs, HEALTH/MAGICKA/FATIGUE vitals bars
    PostCard.astro            ← journal entry card (torn edges, candle read time)
    ThemeToggle.astro         ← day / twilight toggle
    TableOfContents.astro     ← "Contents of this entry" TOC with scroll-spy
    BackToTop.astro           ← floating back-to-top button
  pages/
    index.astro               ← character sheet: portrait, dynamic level (from career
                                 start 2021-07-19), skill bars, journal + books previews
    narad.astro               ← "Notable Deed" artifact showcase for the Narad broker
    posts/index.astro         ← "The Journal" quest-log timeline grouped by year
    posts/[...slug].astro     ← dynamic post pages with prev/next navigation
  styles/global.css           ← Tailwind + @theme palette + @font-face + prose + motifs
```

## Post Frontmatter Schema

```yaml
title: string           # required
description: string     # required
date: date              # required — YYYY-MM-DD
tags: string[]          # Tech | Anime | Writing | Life | Travel
draft: boolean          # true = excluded from build
cover_image: string     # optional, for photo posts
type: 'post' | 'photo'  # default: 'post'
```

## URL Structure

- File: `src/content/posts/life/hello-world.md`
- `post.id` = `life/hello-world`
- URL = `/posts/life/hello-world`
- The `[...slug].astro` spread route handles multi-segment paths automatically

## Key Design Decisions

- **Aurora background**: 5 CSS blobs with `mix-blend-mode: multiply` (light) / `screen` (dark). Lives in `AuroraBackground.astro`, included in `BaseLayout.astro`.
- **Social link chips**: On the homepage, social links render as pill-shaped chips (`social-chip` class) with colored icon circles. Two rows — `socials` and `writing` — defined as `groups` in `index.astro` frontmatter.
- **Post images**: Store in `src/assets/images/<category>/`. Reference from markdown body using relative paths (e.g. `../../../assets/images/yuru-camp/foo.jpg`). Cover images in frontmatter use the same relative path convention.
- **Timeline**: `/posts` page groups all posts by year with a vertical line and colored dots.
- **Nav active state**: Uses `currentPath.startsWith(link.href)` so `/posts/tech/foo` correctly highlights the Posts nav item. Active link has a coral underline; hover shows a border-colored underline.
- **View Transitions**: `ClientRouter` from `astro:transitions` in `BaseLayout.astro` for smooth cross-fade navigation.
- **Table of Contents**: `TableOfContents.astro` auto-generates from headings (depth <= 3) with scroll-spy. Only renders when post has >2 headings.
- **Prev/next navigation**: `[...slug].astro` passes sorted adjacent posts to `PostLayout.astro`.
- **Image lightbox**: Click-to-zoom on prose images. Script in `PostLayout.astro`, overlay styles in `global.css`.
- **Back-to-top**: `BackToTop.astro` — floating button, appears after scrolling 1 viewport.
- **Profile photo**: `index.astro` uses `import.meta.glob` to optionally load `src/assets/images/me.{png,jpg,webp}`. Falls back to "DT" initials circle.
- **Accessibility**: `focus-visible` coral rings globally, skip-to-content link in `BaseLayout.astro`.
- **Mobile header**: Logo shortens to "debangan" at <600px. Social chips become icon-only.

## Commands

```bash
npm run dev      # localhost:4321
npm run build    # static output to dist/
npm run preview  # preview the built output
```

## Adding a New Post

1. Create `src/content/posts/<category>/<slug>.md`
2. Add required frontmatter (title, description, date, tags, draft)
3. Write content in Markdown below the `---` fence
4. No route changes needed — `[...slug].astro` picks it up automatically
