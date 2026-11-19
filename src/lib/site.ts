/** Public address and wording used for link previews and sharing. */
export const SITE_URL = "https://stroop.lianhonglim.my";
export const SITE_NAME = "Stroop";
export const SITE_TITLE = "Stroop";
/**
 * Search-result title for the home page: the name first (it must match the
 * Google sign-in app name), then what people search for.
 */
export const SITE_SEO_TITLE = "Stroop · Horror Stroop Effect Test, Play Free Online";
export const SITE_DESCRIPTION =
  "Name the ink, not the word. A free online Stroop effect test turned horror game, with a voice that reads every colour word aloud to trip you up.";
/**
 * Optional contact address shown on the privacy and terms pages. Empty: the
 * pages point players to the in-game "Delete account" option instead.
 */
export const CONTACT_EMAIL = "";
/**
 * When each page's content last changed (YYYY-MM-DD). Shown on the policy
 * pages and sent to search engines in the sitemap: update the date when you
 * change a page's text.
 */
export const PAGE_UPDATED = {
  home: "2026-11-19",
  howToPlay: "2026-11-19",
  privacy: "2026-11-17",
  terms: "2026-11-17",
} as const;

/** "2026-11-17" → "17 November 2026". */
export function formatPageDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Text that goes with the link when a player shares the game. */
export const SHARE_TEXT =
  "Name the colour of the ink. Not the word. Not what you hear. Can you pass?";
