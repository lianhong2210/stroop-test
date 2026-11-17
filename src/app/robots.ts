import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Built into out/robots.txt by the static export.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Only the sign-in return page; it has nothing to read.
      disallow: "/auth/",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
