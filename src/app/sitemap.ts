import type { MetadataRoute } from "next";
import { PAGE_UPDATED, SITE_URL } from "@/lib/site";

// Built into out/sitemap.xml by the static export. Add new pages here.
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, lastModified: PAGE_UPDATED.home, changeFrequency: "monthly", priority: 1 },
    {
      url: `${SITE_URL}/how-to-play`,
      lastModified: PAGE_UPDATED.howToPlay,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    { url: `${SITE_URL}/privacy`, lastModified: PAGE_UPDATED.privacy, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/terms`, lastModified: PAGE_UPDATED.terms, changeFrequency: "yearly", priority: 0.2 },
  ];
}
