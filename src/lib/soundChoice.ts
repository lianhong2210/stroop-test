"use client";

import { SOUND_CHOICE_KEY, SOUND_CHOICE_MAX_AGE_MS } from "./soundChoiceKey";
import { createPersistentStore, isRecord } from "./store";

/**
 * The player's answer on the opening sound screen, remembered so the screen
 * only appears on a first visit or once the answer is older than
 * SOUND_CHOICE_MAX_AGE_MS.
 */

export interface SoundChoice {
  on: boolean;
  /** When the player answered (ms since epoch). */
  at: number;
}

function sanitize(raw: unknown): SoundChoice | null {
  if (!isRecord(raw)) return null;
  const { on, at } = raw;
  if (typeof on !== "boolean" || typeof at !== "number") return null;
  const age = Date.now() - at;
  // Expired, or a clock/date that makes no sense: ask again.
  if (!Number.isFinite(age) || age < 0 || age > SOUND_CHOICE_MAX_AGE_MS) {
    return null;
  }
  return { on, at };
}

export const soundChoiceStore = createPersistentStore<SoundChoice | null>(
  SOUND_CHOICE_KEY,
  null,
  sanitize,
);

export function rememberSoundChoice(on: boolean) {
  soundChoiceStore.set({ on, at: Date.now() });
}
