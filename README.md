# debanganthakuria.com

Personal site of Debangan Thakuria — backend engineer, anime nerd, web novel writer.

The site is themed as a **cozy illustrated storybook**: a painted valley with a cottage
crowns every page (day scene by daylight, twilight scene at night), content sits on
parchment, cards have torn-paper edges, and the whole thing speaks in gentle fantasy —
posts are journal entries, reading time is measured in candles, and the homepage is a
character sheet.

Built with **Astro v6** + **Tailwind CSS v4**. Deployed on Vercel.

---

## Stack

| Thing | Choice |
| --- | --- |
| Framework | Astro v6 (static output) |
| Styling | Tailwind CSS v4 (CSS-based config, no `tailwind.config.js`) |
| Fonts | Almendra (headings) + EB Garamond (body) via `@fontsource`; Kingthings Petrock self-hosted as fallback |
| Hero art | AI-generated watercolor paintings (`src/assets/images/hero-{day,night}.png`), with a hand-coded SVG landscape as fallback |
| Hosting | Vercel |

---

## Structure

```text
src/
├── content.config.ts          # Collection schemas (posts, novels, chapters)
├── content/
│   ├── posts/                 # life/ tech/ anime/ writing/ travel/
│   └── novels/ + chapters     # Original web novels with chapter files
├── lib/
│   ├── tags.ts                # Single source of truth for the tag palette
│   ├── dates.ts               # Site-voice date formatters ("the 31st of May, 2026")
│   ├── reading.ts             # Reading time + "a 6-candle read" phrasing
│   └── covers.ts              # Novel cover image resolution
├── layouts/
│   ├── BaseLayout.astro       # Head/meta, hero band, header overlay, page shell
│   └── PostLayout.astro       # Manuscript reading layout (drop cap, inscribed dates)
├── components/
│   ├── Hero.astro             # Painted landscape band (day/night, SVG fallback)
│   ├── Header.astro           # Pill nav floating over the hero sky
│   ├── Footer.astro           # Rotating signoffs + HEALTH/MAGICKA/FATIGUE bars
│   ├── PostCard.astro         # Journal entry card (torn edges, candle read time)
│   ├── ThemeToggle.astro      # Day / twilight toggle
│   ├── TableOfContents.astro  # "Contents of this entry" with scroll-spy
│   └── BackToTop.astro        # Floating back-to-top button
├── assets/images/             # Hero paintings, novel covers, post images
├── pages/
│   ├── index.astro            # Character sheet: portrait, level, skills, journal
│   ├── narad.astro            # "Notable Deed" showcase for the Narad message broker
│   ├── posts/                 # The Journal (quest-log timeline) + post pages
│   └── novels/                # The Bookshelf + novel/chapter reader
└── styles/global.css          # Theme tokens, prose styles, torn-edge utility
```

---

## Design system

Defined in `src/styles/global.css` under `@theme {}`. Two modes:

- **Day** — warm cream parchment, dusty terracotta accent, pastel tag tints
- **Night (twilight)** — indigo parchment, ember accents; the hero painting swaps
  to the night scene

Everything colors through CSS variables (`--color-*`), so components adapt to both
modes automatically. Signature motifs: torn parchment card edges (`.torn` utility),
diamond rules (`.rule-diamond`), gold small-caps labels (`.ui-label`).

The character level on the homepage is computed from a career start date at build
time and refreshed client-side, so it stays current between deploys.

---

## Writing a post

Create a `.md` or `.mdx` file in the appropriate subfolder:

```text
src/content/posts/life/my-post.md
```

Frontmatter schema:

```yaml
---
title: "Post title"
description: "One-line summary shown in cards and meta tags"
date: 2026-03-15
tags: ["Life"]          # Life | Tech | Anime | Writing | Travel
draft: false
cover_image: ../../../assets/images/category/photo.jpg   # optional
type: post              # post | photo
---
```

The post URL will be `/posts/life/my-post`. No route changes needed.

---

## Commands

```bash
npm run dev      # localhost:4321
npm run build    # build to dist/
npm run preview  # preview the build locally
```

---

## UX features

- **Day/night hero** — matching painted scenes swap with the theme toggle
- **View Transitions** — smooth cross-fade between pages via Astro `ClientRouter`
- **Table of Contents** — auto-generated from headings with scroll-spy highlighting
- **Prev/next navigation** — at the bottom of each post
- **Reading progress** — novel chapters remember where you left off (`localStorage`)
- **Image lightbox** — click any image in a post to zoom
- **Back-to-top button** — appears after scrolling past the first viewport
- **Reading time** — "a 6-candle read", on cards and post headers
- **Skip to content** — accessible skip link for keyboard navigation
- **Focus-visible** — visible focus rings on all interactive elements

## Fonts & licensing

Kingthings Petrock (fallback heading font) is freeware by Kevin King; its license
ships alongside the font files in `public/fonts/kingthingsEULA.txt`. Almendra and
EB Garamond are OFL, bundled via `@fontsource`. Site content (posts, novels,
images) is not licensed for reuse.
