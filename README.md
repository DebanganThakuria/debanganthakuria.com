# debanganthakuria.com

Personal site of Debangan Thakuria — backend engineer, anime nerd, web novel writer.

Built with **Astro v6** + **Tailwind CSS v4**. Deployed on Vercel.

---

## Stack

| Thing | Choice |
|---|---|
| Framework | Astro v6 (static output) |
| Styling | Tailwind CSS v4 (CSS-based config, no `tailwind.config.js`) |
| Fonts | Lora (headings), Inter (body) via `@fontsource` |
| Hosting | Vercel |

---

## Structure

```
src/
├── content.config.ts          # Collection schema (Astro v6 glob loader)
├── content/posts/
│   ├── life/                  # Personal posts
│   ├── tech/                  # Engineering posts
│   ├── anime/                 # Anime / manga posts
│   ├── writing/               # Writing posts
│   └── travel/                # Travel + photo posts
├── layouts/
│   ├── BaseLayout.astro       # Floating card shell, aurora background
│   └── PostLayout.astro       # Reading layout with cover image support
├── components/
│   ├── Header.astro
│   ├── Footer.astro
│   ├── PostCard.astro
│   ├── ThemeToggle.astro
│   └── AuroraBackground.astro # 5-blob CSS aurora (dreamy background)
├── pages/
│   ├── index.astro            # Homepage: hero + bento + recent posts
│   ├── about.astro            # Bio + grouped socials
│   └── posts/
│       ├── index.astro        # Timeline: all posts by year + tag filter
│       └── [...slug].astro    # Dynamic post pages
└── styles/global.css          # Design tokens, prose, aurora, utilities
```

---

## Writing a post

Create a `.md` or `.mdx` file in the appropriate subfolder:

```
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
cover_image: /images/photo.jpg   # optional, for photo posts
type: post                        # post | photo
---
```

The post URL will be `/posts/life/my-post`.

---

## Commands

```bash
npm run dev      # localhost:4321
npm run build    # build to dist/
npm run preview  # preview the build locally
```

---

## Dark mode

Toggleable via the moon/sun button in the nav. Preference is saved to `localStorage`. Initial state respects `prefers-color-scheme`.
