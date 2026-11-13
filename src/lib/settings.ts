"use client";

import { createPersistentStore, isRecord } from "./store";

export interface SoundbotSettings {
  enabled: boolean;
  personaId: string;
  volume: number;
  /** Used only when personaId === "custom". */
  customVoiceURI: string | null;
  customPitch: number;
  customRate: number;
}

export interface Settings {
  soundbot: SoundbotSettings;
  /** Answer feedback, countdown and clock cues. */
  sfx: boolean;
  /** Low hum under gameplay. */
  ambience: boolean;
  /** Horror music on the menu and results pages. */
  music: boolean;
  musicVolume: number;
  /** The Doctor comments on your results. */
  narrator: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  soundbot: {
    enabled: true,
    personaId: "proctor",
    volume: 1,
    customVoiceURI: null,
    customPitch: 1,
    customRate: 1.1,
  },
  sfx: true,
  ambience: true,
  music: true,
  musicVolume: 0.7,
  narrator: true,
};

/** Voice ids that used to exist; stored values fall back to the default. */
const KNOWN_PERSONAS = new Set([
  "proctor",
  "warden",
  "nurse",
  "machine",
  "dirge",
  "custom",
]);

const num = (v: unknown, d: number, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.min(max, Math.max(min, v))
    : d;

function sanitize(raw: unknown): Settings {
  const d = DEFAULT_SETTINGS;
  if (!isRecord(raw)) return d;
  const sb = isRecord(raw.soundbot) ? raw.soundbot : {};
  return {
    soundbot: {
      enabled:
        typeof sb.enabled === "boolean" ? sb.enabled : d.soundbot.enabled,
      personaId:
        typeof sb.personaId === "string" && KNOWN_PERSONAS.has(sb.personaId)
          ? sb.personaId
          : d.soundbot.personaId,
      volume: num(sb.volume, d.soundbot.volume, 0, 1),
      customVoiceURI:
        typeof sb.customVoiceURI === "string" ? sb.customVoiceURI : null,
      customPitch: num(sb.customPitch, d.soundbot.customPitch, 0, 2),
      customRate: num(sb.customRate, d.soundbot.customRate, 0.5, 2),
    },
    sfx: typeof raw.sfx === "boolean" ? raw.sfx : d.sfx,
    ambience: typeof raw.ambience === "boolean" ? raw.ambience : d.ambience,
    music: typeof raw.music === "boolean" ? raw.music : d.music,
    musicVolume: num(raw.musicVolume, d.musicVolume, 0, 1),
    narrator: typeof raw.narrator === "boolean" ? raw.narrator : d.narrator,
  };
}

export const settingsStore = createPersistentStore<Settings>(
  "stroop.settings.v1",
  DEFAULT_SETTINGS,
  sanitize,
);

export function updateSoundbot(patch: Partial<SoundbotSettings>) {
  settingsStore.set((s) => ({ ...s, soundbot: { ...s.soundbot, ...patch } }));
}
