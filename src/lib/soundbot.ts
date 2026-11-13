"use client";

import { useSyncExternalStore } from "react";
import type { SoundbotSettings } from "./settings";

/**
 * A soundbot persona = a preferred list of real system voices plus a tone.
 * Installed voices differ per OS/browser, so each persona also has a fallback
 * tone that reshapes the default voice when none of its candidates exist.
 */
export interface Persona {
  id: string;
  name: string;
  tagline: string;
  /** Matched case-insensitively against voice names, in order of preference. */
  candidates: string[];
  pitch: number;
  rate: number;
  fallbackPitch: number;
  fallbackRate: number;
  volume?: number;
}

export const PERSONAS: Persona[] = [
  {
    id: "proctor",
    name: "Proctor",
    tagline: "Calm, clinical, patient.",
    candidates: [
      "Samantha",
      "Google US English",
      "Microsoft Aria",
      "Microsoft Jenny",
      "Microsoft Zira",
      "Allison",
      "Ava",
      "Karen",
    ],
    pitch: 1,
    rate: 1.1,
    fallbackPitch: 1,
    fallbackRate: 1.1,
  },
  {
    id: "warden",
    name: "Warden",
    tagline: "Low, flat, unimpressed.",
    candidates: [
      "Daniel",
      "Google UK English Male",
      "Microsoft Guy",
      "Microsoft Ryan",
      "Microsoft David",
      "Alex",
      "Tom",
      "Reed",
    ],
    pitch: 0.7,
    rate: 1.0,
    fallbackPitch: 0.5,
    fallbackRate: 1.0,
  },
  {
    id: "nurse",
    name: "Nurse",
    tagline: "Sweet. Far too sweet.",
    candidates: [
      "Moira",
      "Tessa",
      "Google UK English Female",
      "Microsoft Libby",
      "Microsoft Sonia",
      "Serena",
      "Kate",
      "Shelley",
    ],
    pitch: 1.35,
    rate: 1.05,
    fallbackPitch: 1.65,
    fallbackRate: 1.05,
  },
  {
    id: "machine",
    name: "Machine",
    tagline: "The test apparatus speaks.",
    candidates: ["Zarvox", "Trinoids", "Ralph", "Fred"],
    pitch: 1,
    rate: 1.05,
    fallbackPitch: 0.1,
    fallbackRate: 1.15,
  },
  {
    id: "dirge",
    name: "Dirge",
    tagline: "Sung, slowly, off-key.",
    candidates: ["Bad News", "Cellos", "Organ", "Bells"],
    pitch: 1,
    rate: 1.2,
    fallbackPitch: 0.15,
    fallbackRate: 0.8,
  },
];

export const CUSTOM_PERSONA_ID = "custom";

/** Session-wide mute (player chose "continue without sound"). */
let muted = false;
export function setSpeechMuted(on: boolean) {
  muted = on;
  if (on) silence();
}

/* ---------- voice list (reactive) ---------- */

const NO_VOICES: SpeechSynthesisVoice[] = [];
let voiceCache: SpeechSynthesisVoice[] = NO_VOICES;

const hasSpeech = () =>
  typeof window !== "undefined" && "speechSynthesis" in window;

function readVoices(): SpeechSynthesisVoice[] {
  const all = window.speechSynthesis.getVoices();
  const english = all.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const list = (english.length ? english : all)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
  return list.length ? list : NO_VOICES;
}

function subscribeVoices(cb: () => void) {
  if (!hasSpeech()) return () => {};
  const synth = window.speechSynthesis;
  const update = () => {
    voiceCache = readVoices();
    cb();
  };
  synth.addEventListener("voiceschanged", update);
  return () => synth.removeEventListener("voiceschanged", update);
}

function getVoicesSnapshot() {
  if (voiceCache === NO_VOICES && hasSpeech()) {
    const v = readVoices();
    if (v.length) voiceCache = v;
  }
  return voiceCache;
}

export function useVoices(): SpeechSynthesisVoice[] {
  return useSyncExternalStore(
    subscribeVoices,
    getVoicesSnapshot,
    () => NO_VOICES,
  );
}

export function speechSupported() {
  return hasSpeech();
}

/* ---------- resolution + speaking ---------- */

export interface ResolvedVoice {
  voice: SpeechSynthesisVoice | null;
  pitch: number;
  rate: number;
  volume: number;
  /** True when a preferred real voice was found for the persona. */
  matched: boolean;
}

export function findPersonaVoice(
  voices: SpeechSynthesisVoice[],
  persona: Persona,
): SpeechSynthesisVoice | null {
  for (const c of persona.candidates) {
    const needle = c.toLowerCase();
    const hit = voices.find((v) => v.name.toLowerCase().startsWith(needle));
    if (hit) return hit;
  }
  return null;
}

export function resolveVoice(
  voices: SpeechSynthesisVoice[],
  cfg: SoundbotSettings,
): ResolvedVoice {
  if (cfg.personaId === CUSTOM_PERSONA_ID) {
    const voice = voices.find((v) => v.voiceURI === cfg.customVoiceURI) ?? null;
    return {
      voice,
      pitch: cfg.customPitch,
      rate: cfg.customRate,
      volume: 1,
      matched: voice !== null,
    };
  }
  const persona = PERSONAS.find((p) => p.id === cfg.personaId) ?? PERSONAS[0];
  const voice = findPersonaVoice(voices, persona);
  return voice
    ? {
        voice,
        pitch: persona.pitch,
        rate: persona.rate,
        volume: persona.volume ?? 1,
        matched: true,
      }
    : {
        voice: null,
        pitch: persona.fallbackPitch,
        rate: persona.fallbackRate,
        volume: persona.volume ?? 1,
        matched: false,
      };
}

export function speak(
  text: string,
  cfg: SoundbotSettings,
  voices: SpeechSynthesisVoice[],
  force = false,
) {
  if (muted || (!cfg.enabled && !force) || !hasSpeech()) return;
  const synth = window.speechSynthesis;
  const r = resolveVoice(voices, cfg);
  // Never let words queue up behind each other: the newest stimulus wins.
  synth.cancel();
  synth.resume();
  const u = new SpeechSynthesisUtterance(text.toLowerCase());
  if (r.voice) {
    u.voice = r.voice;
    u.lang = r.voice.lang;
  } else {
    u.lang = "en-US";
  }
  u.pitch = r.pitch;
  u.rate = r.rate;
  u.volume = Math.max(0, Math.min(1, cfg.volume * r.volume));
  synth.speak(u);
}

/* ---------- the Doctor (results narrator) ---------- */

/** Not player-selectable: a measured, cultured, slightly too pleased voice. */
export const DOCTOR: Persona = {
  id: "doctor",
  name: "The Doctor",
  tagline: "Reads your results.",
  candidates: [
    "Daniel",
    "Google UK English Male",
    "Microsoft Ryan",
    "Microsoft George",
    "Arthur",
    "Oliver",
    "Alex",
    "Reed",
  ],
  pitch: 0.82,
  rate: 0.88,
  fallbackPitch: 0.7,
  fallbackRate: 0.86,
};

export function speakNarration(
  text: string,
  volume: number,
  voices: SpeechSynthesisVoice[],
  hooks: { onStart?: () => void; onEnd?: () => void } = {},
) {
  if (muted || !hasSpeech()) return;
  const synth = window.speechSynthesis;
  const voice = findPersonaVoice(voices, DOCTOR);
  synth.cancel();
  synth.resume();
  const u = new SpeechSynthesisUtterance(text);
  if (voice) {
    u.voice = voice;
    u.lang = voice.lang;
  } else {
    u.lang = "en-GB";
  }
  u.pitch = voice ? DOCTOR.pitch : DOCTOR.fallbackPitch;
  u.rate = voice ? DOCTOR.rate : DOCTOR.fallbackRate;
  u.volume = Math.max(0, Math.min(1, volume));
  u.onstart = () => hooks.onStart?.();
  u.onend = () => hooks.onEnd?.();
  u.onerror = () => hooks.onEnd?.();
  synth.speak(u);
}

export function silence() {
  if (hasSpeech()) window.speechSynthesis.cancel();
}
