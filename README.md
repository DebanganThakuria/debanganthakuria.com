# debanganthakuria.com

Personal site of Debangan Thakuria — backend engineer, anime nerd, web novel writer.

Built with **Astro v6** + **Tailwind CSS v4**. Deployed on Vercel.

---

## Stack

| Thing | Choice |
| --- | --- |
| Framework | Astro v6 (static output) |
| Styling | Tailwind CSS v4 (CSS-based config, no `tailwind.config.js`) |
| Fonts | Lora (headings), Inter (body) via `@fontsource` |
| Hosting | Vercel |

---

## Structure

```text
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
│   ├── Header.astro           # Nav with hover states, mobile-responsive logo
│   ├── Footer.astro           # Rotating signoffs, GitHub link
│   ├── PostCard.astro         # Card with reading time, tag chips
│   ├── ThemeToggle.astro      # Animated sun/moon toggle
│   ├── AuroraBackground.astro # 5-blob CSS aurora (dreamy background)
│   ├── TableOfContents.astro  # Auto-generated TOC with scroll-spy
│   └── BackToTop.astro        # Floating back-to-top button
├── assets/images/             # Post images (referenced via relative paths in markdown)
├── pages/
│   ├── index.astro            # Homepage: profile photo + condensed bio + recent posts
│   └── posts/
│       ├── index.astro        # Timeline: all posts by year + tag filter
│       └── [...slug].astro    # Dynamic post pages with prev/next nav
└── styles/global.css          # Design tokens, prose, aurora, focus styles, lightbox
```

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
cover_image: ../../../assets/images/category/photo.jpg   # optional, relative path from post file
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

Toggleable via the animated moon/sun button in the nav. Preference is saved to `localStorage`. Initial state respects `prefers-color-scheme`.

---

## UX features

- **View Transitions** — smooth cross-fade between pages via Astro `ClientRouter`
- **Table of Contents** — auto-generated from headings with scroll-spy highlighting
- **Prev/next navigation** — at the bottom of each post
- **Image lightbox** — click any image in a post to zoom
- **Back-to-top button** — appears after scrolling past the first viewport
- **Card entrance animations** — staggered fade-up on homepage post cards
- **Reading time** — shown on post cards and timeline entries
- **Skip to content** — accessible skip link for keyboard navigation
- **Focus-visible** — coral focus rings on all interactive elements
- **Mobile-first header** — shortened logo on small screens
