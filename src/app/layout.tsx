import type { Metadata, Viewport } from "next";
import { Anton, Special_Elite } from "next/font/google";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_SEO_TITLE,
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
  // Pages set a short title ("Privacy") and get " · Stroop" added.
  title: { default: SITE_SEO_TITLE, template: `%s · ${SITE_NAME}` },
  // <meta name="application-name">: the app's name in machine-readable form,
  // which Google's brand check can match against the OAuth app name.
  applicationName: SITE_NAME,
  description: SITE_DESCRIPTION,
  keywords: [
    "Stroop test",
    "Stroop effect",
    "Stroop test online",
    "colour word test",
    "reaction time test",
    "horror game",
    "brain game",
  ],
  category: "game",
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: SITE_SEO_TITLE,
    description: SITE_DESCRIPTION,
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_SEO_TITLE,
    description: SITE_DESCRIPTION,
  },
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
      </head>
      <body>{children}</body>
    </html>
  );
}
