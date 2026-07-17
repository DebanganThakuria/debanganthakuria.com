import type { ImageMetadata } from 'astro';

const coverGlob = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/images/novels/*.{png,jpg,jpeg,webp}',
  { eager: true }
);

/** Cover image for a novel slug, or null if none has been added. */
export function novelCover(slug: string): ImageMetadata | null {
  for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
    const hit = coverGlob[`/src/assets/images/novels/${slug}.${ext}`];
    if (hit) return hit.default;
  }
  return null;
}
