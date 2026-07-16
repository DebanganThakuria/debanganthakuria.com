# debanganthakuria.com — Claude Code Context

Personal blog and portfolio built with Astro v6 + Tailwind CSS v4. Static output, deployed on Vercel.

## Stack

- **Astro v6** (static output, `output: 'static'`)
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin — no `tailwind.config.js`
- **Node / npm** (not bun)

## Critical: Astro v6 API differences

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

The site is themed as a **TES IV: Oblivion menu screen** — dark smoky backdrop, a
gold-framed parchment panel, journal-tab nav, character-sheet homepage, quest-log post
list, manuscript reading pages with drop caps. Defined in `src/styles/global.css`
under `@theme {}`:

```text
Backdrop:     #1d150c (day) / #0d0904 (night) — dark smoke behind the panel, both modes
Parchment:    #eadec0 panel + #e2d3ab surface (day); #2c2317 + #362b1c (candlelit night)
Ink text:     #3a2c18 (day), #e2d4ac (night); red-ink accent = --color-coral (#7a1f1f day)
Gold/brass:   --color-gold #8a6d3f, --color-gold-bright #b08d4f (frames, diamonds, labels)
Tag inks:     --color-sky (Tech), --color-purple (Anime), --color-sun (Writing), --color-mint (Life)
Dark mode:    html.dark = "candlelit night" (ThemeToggle sets this; icon is sun/candle)
Fonts:        Kingthings Petrock (headings/UI — Oblivion's actual menu font, self-hosted
              TTF in public/fonts/, free license in public/fonts/kingthingsEULA.txt);
              EB Garamond (body) via @fontsource
CSS vars:     --font-family-heading, --font-family-body, --font-family-mono
Motifs:       .rule-diamond (—◆— divider), .ui-label (gold small-caps), squared corners
              everywhere (no border-radius), diamond bullets, "a N-candle read",
              "Inscribed the 16th of July, 2026" dates
```

Legacy var names (`--color-coral`, `--color-sky`, etc.) were kept and remapped to the
Oblivion palette so older components inherit the theme — don't rename them.

## Project Structure

```text
src/
  content.config.ts          ← collection schema (Astro v6 glob loader)
  content/posts/
    life/     tech/     anime/     writing/     travel/
  assets/images/             ← post images (referenced via relative paths in markdown)
  layouts/
    BaseLayout.astro          ← head, fonts, gold-framed parchment panel, smoke backdrop
    PostLayout.astro          ← manuscript reading layout (drop cap, inscribed dates)
  components/
    Header.astro              ← Oblivion journal-tab nav with diamond separators
    Footer.astro              ← rotating signoffs, HEALTH/MAGICKA/FATIGUE vitals bars
    PostCard.astro            ← quest-log entry (diamond marker, candle read time)
    ThemeToggle.astro         ← day parchment / candlelit night toggle (sun / candle)
    AuroraBackground.astro    ← dark smoke + ember-glow backdrop (name kept from old design)
    TableOfContents.astro     ← "Contents of this entry" TOC with scroll-spy
    BackToTop.astro           ← floating back-to-top button
  pages/
    index.astro               ← character sheet: framed portrait, level/class/birthsign,
                                 skill bars, faction chips, journal + books previews
    posts/index.astro         ← "The Journal" quest log grouped by year
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
