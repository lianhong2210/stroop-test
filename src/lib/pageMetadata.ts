import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "./site";

/**
 * Metadata for a page other than the home page: its title (the layout adds
 * " · Stroop"), description, canonical address, and link-preview tags that
 * point at the page itself rather than the home page.
 */
/** The home page's preview banner (src/app/opengraph-image.jpg), reused. */
const PREVIEW_IMAGE = {
  url: "/opengraph-image.jpg",
  width: 1200,
  height: 630,
  alt: "STROOP: Name the colour of the ink, not the word.",
};

export function pageMetadata(title: string, description: string, path: string): Metadata {
  const full = `${title} · ${SITE_NAME}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      url: path,
      siteName: SITE_NAME,
      title: full,
      description,
      locale: "en_GB",
      images: [PREVIEW_IMAGE],
    },
    twitter: { card: "summary_large_image", title: full, description, images: [PREVIEW_IMAGE] },
  };
}

/** Home › page trail, shown by Google in place of the bare URL. */
export function breadcrumbJsonLd(name: string, path: string) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_URL },
      { "@type": "ListItem", position: 2, name, item: `${SITE_URL}${path}` },
    ],
  };
}
