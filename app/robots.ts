import type { MetadataRoute } from "next";

import { SITE_URL } from "@/modules/site";

/** Emitted as a static /robots.txt by the export — nothing here is private. */
const robots = (): MetadataRoute.Robots => ({
  rules: { userAgent: "*", allow: "/" },
  sitemap: `${SITE_URL}/sitemap.xml`,
});

export default robots;

/** Required by `output: "export"`: without it Next treats the route as dynamic. */
export const dynamic = "force-static";
