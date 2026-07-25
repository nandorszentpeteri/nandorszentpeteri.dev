/**
 * The canonical origin, in one place: `metadataBase`, the sitemap and robots.txt
 * all have to agree, and a preview deployment on a different host can override
 * it with NEXT_PUBLIC_SITE_URL at build time.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://nandorszentpeteri.dev").replace(/\/$/, "");
