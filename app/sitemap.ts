import type { MetadataRoute } from "next";

import { SITE_URL } from "@/modules/site";

/**
 * Two pages, both the same CV. `lastModified` is deliberately omitted: it would
 * be the build time, so every deploy would claim the content had changed.
 */
const sitemap = (): MetadataRoute.Sitemap => [
  { url: `${SITE_URL}/`, changeFrequency: "monthly", priority: 1 },
  { url: `${SITE_URL}/classic/`, changeFrequency: "monthly", priority: 0.8 },
];

export default sitemap;

/** Required by `output: "export"`: without it Next treats the route as dynamic. */
export const dynamic = "force-static";
