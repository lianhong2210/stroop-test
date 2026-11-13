/**
 * What the Doctor says on the results page. All lines are original to this
 * game: clinical, pleased, and not quite kind. Edit freely.
 */

/**
 * Switched off for now: no spoken line, no printed remark, no settings
 * toggle. Set back to true to restore everything.
 */
export const NARRATION_ENABLED = false;

export type Verdict = "pass" | "fail" | "record" | "logged" | "declassified";

export const LINES: Record<Verdict, string[]> = {
  pass: [
    "Excellent. Your eyes obeyed and your tongue did not. I'm almost proud.",
    "Well done. The words lied to you, and you didn't believe them. Remarkable.",
    "Very good. We'll make the next one harder. You won't mind.",
    "Clean results. Your mind is exactly where we want it.",
  ],
  fail: [
    "Disappointing. But failure is still data, and you've given us plenty.",
    "The words won this time. Don't worry. We'll keep going until they don't.",
    "Again, please. We have all the time in the world. You, perhaps a little less.",
    "Your hands betrayed you. We'll retrain them.",
  ],
  record: [
    "A new record. Your brain is adapting. How wonderful for us both.",
    "Faster than ever. Something in you is changing. Good.",
  ],
  logged: [
    "Your mind slowed down near the end. We noticed.",
    "Not your best. We keep every result, you know.",
  ],
  declassified: [
    "You weren't supposed to get this far. Let's see what else you can endure.",
  ],
};

let last = "";

export function pickLine(v: Verdict): string {
  const pool = LINES[v].filter((l) => l !== last);
  const line = (pool.length ? pool : LINES[v])[
    Math.floor(Math.random() * (pool.length || LINES[v].length))
  ];
  last = line;
  return line;
}
