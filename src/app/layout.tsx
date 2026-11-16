import type { Metadata, Viewport } from "next";
import { Anton, Special_Elite } from "next/font/google";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
} from "@/lib/site";
import { SOUND_CHOICE_PRELOAD_SCRIPT } from "@/lib/soundChoiceKey";
import "./globals.css";

/* Display: heavy condensed, scratched via CSS mask. Also the stimulus word. */
const display = Anton({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

/* Everything else: worn typewriter. */
const type = Special_Elite({
  variable: "--font-type",
  subsets: ["latin"],
  weight: "400",
});

// Link previews (WhatsApp, Telegram, iMessage, Facebook, X, Discord…): the
// image comes from opengraph-image.jpg / twitter-image.jpg in this folder.
// Preview fetchers need absolute URLs, hence metadataBase.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  // <meta name="application-name">: the app's name in machine-readable form,
  // which Google's brand check can match against the OAuth app name.
  applicationName: SITE_NAME,
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: "en",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
    {
      "@type": "WebApplication",
      name: SITE_NAME,
      url: SITE_URL,
      applicationCategory: "GameApplication",
      operatingSystem: "Any",
      description: SITE_DESCRIPTION,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
  ],
};

export const viewport: Viewport = {
  themeColor: "#080807",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the script below may add data-sound to <html>
    // before React loads.
    <html
      lang="en"
      className={`${display.variable} ${type.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SOUND_CHOICE_PRELOAD_SCRIPT }} />
        {/* Structured data naming the site and app (used by Google). */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
