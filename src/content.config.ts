import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: ({ image: img }) => z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    cover_image: img().optional(),
    type: z.enum(['post', 'photo']).default('post'),
  }),
});

const novels = defineCollection({
  loader: glob({ pattern: '*/index.md', base: './src/content/novels' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    genre: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    order: z.number().optional(),
    status: z.enum(['ongoing', 'completed', 'hiatus', 'dropped']).default('ongoing'),
  }),
});

const chapters = defineCollection({
  loader: glob({ pattern: '*/chapter-*.md', base: './src/content/novels' }),
  schema: z.object({
    chapterNumber: z.number(),
    title: z.string(),
    chapterTitle: z.string(),
    novel: z.string(),
  }),
});

export const collections = { posts, novels, chapters };
