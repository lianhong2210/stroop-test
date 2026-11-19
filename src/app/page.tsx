import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { StroopGame } from "@/components/StroopGame";
import { PAGE_UPDATED, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// Tells search engines the site's name (shown above the result) and that
// the home page is a free browser game.
const STRUCTURED_DATA = {
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      inLanguage: "en",
    },
    {
      "@type": ["VideoGame", "WebApplication"],
      "@id": `${SITE_URL}/#game`,
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      image: `${SITE_URL}/opengraph-image.jpg`,
      inLanguage: "en",
      genre: ["Horror", "Reaction", "Puzzle"],
      gamePlatform: "Web browser",
      applicationCategory: "GameApplication",
      operatingSystem: "Any",
      isAccessibleForFree: true,
      playMode: "SinglePlayer",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      dateModified: PAGE_UPDATED.home,
      isPartOf: { "@id": `${SITE_URL}/#website` },
    },
  ],
};

export default function Home() {
  return (
    <>
      <JsonLd data={STRUCTURED_DATA} />
      <StroopGame />
    </>
  );
}
