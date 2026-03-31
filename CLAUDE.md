# debanganthakuria.com — Claude Code Context

Personal blog and portfolio built with Astro v6 + Tailwind CSS v4. Static output, deployed on Vercel.

## Stack

- **Astro v6** (static output, `output: 'static'`)
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin — no `tailwind.config.js`
- **Node / npm** (not bun)

## Critical: Astro v6 API differences

These differ from older Astro tutorials — use these, not the legacy patterns:

| Task | Correct (v6) | Wrong (legacy) |
|------|-------------|----------------|
| Content config location | `src/content.config.ts` | `src/content/config.ts` |
| Collection loader | `glob` from `astro/loaders` | `defineCollection` without loader |
| Render a post | `render(post)` from `astro:content` | `post.render()` |
| Post slug | `post.id` | `post.slug` |

## Critical: Tailwind v4 differences

- Theme is defined in `src/styles/global.css` under `@theme {}` — not in a config file
- No `tailwind.config.js` exists — don't create one
- Vite plugin wired in `astro.config.mjs`: `import tailwindcss from '@tailwindcss/vite'`

## Design Tokens

Defined in `src/styles/global.css` under `@theme {}`:

```
Backgrounds:  #FAF8F4 (light bg), #F2EDE6 (surface), #1C1A18 (dark bg)
Text:         #2C2825 (light), #E8E0D5 (dark)
Accent:       #6B8F71 (sage green)
Dark mode:    triggered by html.dark class (ThemeToggle sets this)
Fonts:        Lora (headings), Inter (body) — via @fontsource/* npm packages
CSS vars:     --font-family-heading, --font-family-body, --font-family-mono
```

## Project Structure

```
src/
  content.config.ts          ← collection schema (Astro v6 glob loader)
  content/posts/
    life/     tech/     anime/     writing/     travel/
  assets/images/             ← post images (referenced via relative paths in markdown)
  layouts/
    BaseLayout.astro          ← head, fonts, nav, footer, aurora background
    PostLayout.astro          ← reading layout with prose styles
  components/
    Header.astro
    Footer.astro
    PostCard.astro
    ThemeToggle.astro
    AuroraBackground.astro    ← 5-blob CSS aurora (mix-blend-mode)
  pages/
    index.astro               ← intro (bio + social links) + recent posts
    posts/index.astro         ← timeline grouped by year
    posts/[...slug].astro     ← dynamic post pages (spread route for subfolders)
  styles/global.css           ← Tailwind imports + @theme + prose + aurora styles
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
- **Nav active state**: Uses `currentPath.startsWith(link.href)` so `/posts/tech/foo` correctly highlights the Posts nav item.

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
