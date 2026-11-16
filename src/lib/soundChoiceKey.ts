/**
 * Shared by the client store (soundChoice.ts) and the pre-paint script in
 * layout.tsx. No "use client" here, so the server layout can read the values.
 */
export const SOUND_CHOICE_KEY = "stroop.sound.v1";

/** How long the answer on the sound screen is remembered. */
export const SOUND_CHOICE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Runs in <head> before the page paints. The page is static HTML, so it ships
 * with the sound screen in it; React only learns the saved answer once it has
 * loaded, which can take a moment. This marks <html> straight away so CSS can
 * hide the screen for returning players and it never flashes up.
 */
export const SOUND_CHOICE_PRELOAD_SCRIPT = `try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(
  SOUND_CHOICE_KEY,
)}));var a=Date.now()-s.at;if(typeof s.on==="boolean"&&a>=0&&a<=${SOUND_CHOICE_MAX_AGE_MS})document.documentElement.setAttribute("data-sound","known")}catch(e){}`;
