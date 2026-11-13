import type { Metadata, Viewport } from "next";
import { Anton, Special_Elite } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Stroop Test",
  description:
    "Name the ink, not the word. A Stroop-effect reaction game with a voice that reads the words aloud to throw you off.",
};

export const viewport: Viewport = {
  themeColor: "#080807",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${type.variable}`}>
      <body>{children}</body>
    </html>
  );
}
