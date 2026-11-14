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
  /** Preferred language tag, e.g. "en-ZA"; used to pick between same-named voices. */
  lang?: string;
  pitch: number;
  rate: number;
  fallbackPitch: number;
  fallbackRate: number;
  volume?: number;
}

/**
 * The six reading voices. They are Apple system voices (macOS / iOS), so they
 * exist only on Apple devices. Elsewhere each option falls back to the
 * device's default voice, retuned so the six still sound different.
 */
export const PERSONAS: Persona[] = [
  {
    id: "samantha",
    name: "Samantha",
    tagline: "American English",
    candidates: ["Samantha"],
    lang: "en-US",
    pitch: 1,
    rate: 1.05,
    fallbackPitch: 1.05,
    fallbackRate: 1.05,
  },
  {
    id: "tessa",
    name: "Tessa",
    tagline: "South African English",
    candidates: ["Tessa"],
    lang: "en-ZA",
    pitch: 1,
    rate: 1.05,
    fallbackPitch: 1.2,
    fallbackRate: 1.05,
  },
  {
    id: "moira",
    name: "Moira",
    tagline: "Irish English",
    candidates: ["Moira"],
    lang: "en-IE",
    pitch: 1,
    rate: 1.05,
    fallbackPitch: 1.35,
    fallbackRate: 1,
  },
  {
    id: "karen",
    name: "Karen",
    tagline: "Australian English",
    candidates: ["Karen"],
    lang: "en-AU",
    pitch: 1,
    rate: 1.05,
    fallbackPitch: 0.95,
    fallbackRate: 1.1,
  },
  {
    id: "daniel",
    name: "Daniel",
    tagline: "British English",
    candidates: ["Daniel"],
    lang: "en-GB",
    pitch: 1,
    rate: 1.05,
    fallbackPitch: 0.7,
    fallbackRate: 1,
  },
  {
    id: "fred",
    name: "Fred",
    tagline: "American English, classic synthesiser",
    candidates: ["Fred"],
    lang: "en-US",
    pitch: 1,
    rate: 1.05,
    fallbackPitch: 0.4,
    fallbackRate: 1.05,
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
  const lang = persona.lang?.toLowerCase().replace("_", "-");
  for (const c of persona.candidates) {
    const needle = c.toLowerCase();
    const named = voices.filter((v) => v.name.toLowerCase().startsWith(needle));
    const hit =
      (lang &&
        named.find((v) => v.lang.toLowerCase().replace("_", "-") === lang)) ||
      named[0];
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

/**
 * Hand an utterance to the browser. Chrome can silently drop an utterance
 * queued straight after cancel(), so only cancel when something is actually
 * playing, and give the engine a moment before speaking again. When idle we
 * speak immediately, which keeps the call inside the user's tap (iOS needs it).
 */
/* ---------- speech engine health ---------- */

/**
 * "stuck": the browser accepted speech but never started it, even after a
 * reset. A known Chrome-on-desktop failure; only restarting the browser fixes it.
 */
export type SpeechHealth = "unknown" | "ok" | "stuck";
let health: SpeechHealth = "unknown";
const healthListeners = new Set<() => void>();
function setHealth(h: SpeechHealth) {
  if (h === health) return;
  health = h;
  healthListeners.forEach((l) => l());
}
export function useSpeechHealth(): SpeechHealth {
  return useSyncExternalStore(
    (cb) => {
      healthListeners.add(cb);
      return () => healthListeners.delete(cb);
    },
    () => health,
    () => "unknown",
  );
}

/** Strong reference: Chrome can drop an utterance it is still holding. */
let current: SpeechSynthesisUtterance | null = null;

/** How long an accepted utterance may take to start before we intervene. */
const START_TIMEOUT_MS = 1500;

function clone(u: SpeechSynthesisUtterance) {
  const c = new SpeechSynthesisUtterance(u.text);
  if (u.voice) c.voice = u.voice;
  c.lang = u.lang;
  c.pitch = u.pitch;
  c.rate = u.rate;
  c.volume = u.volume;
  c.onstart = u.onstart;
  c.onend = u.onend;
  c.onerror = u.onerror;
  return c;
}

/**
 * Hand an utterance to the browser, robustly:
 *  - Only cancel when something is actually playing, then give the engine a
 *    moment: Chrome can silently drop speech queued straight after cancel().
 *  - When idle, speak immediately so the call stays inside the user's tap
 *    (iOS needs that).
 *  - Watchdog: if speech is accepted but never starts, reset the queue and
 *    retry once; if it still doesn't start, report the engine as stuck.
 */
function play(synth: SpeechSynthesis, u: SpeechSynthesisUtterance, retry = false) {
  const prevError = u.onerror;
  u.onerror = function (e) {
    if (e.error !== "interrupted" && e.error !== "canceled") {
      console.warn("[speech] utterance failed:", e.error);
    }
    prevError?.call(this, e);
  };

  let started = false;
  u.addEventListener("start", () => {
    started = true;
    setHealth("ok");
  });
  u.addEventListener("end", () => {
    if (current === u) current = null;
  });
  current = u;

  const send = () => {
    if (current === u) synth.speak(u);
  };
  if (!retry && (synth.speaking || synth.pending)) {
    synth.cancel();
    setTimeout(send, 80);
  } else {
    if (synth.paused) synth.resume();
    send();
  }

  setTimeout(() => {
    // Superseded by newer speech, or it played: nothing to do.
    if (started || current !== u) return;
    if (retry) {
      console.warn("[speech] engine accepted speech but never started it");
      setHealth("stuck");
      synth.cancel();
      current = null;
      return;
    }
    synth.cancel();
    const again = clone(u);
    setTimeout(() => play(synth, again, true), 120);
  }, START_TIMEOUT_MS + (retry ? 0 : 80));
}

export function isSpeechMuted() {
  return muted;
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
  play(synth, u);
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
  play(synth, u);
}

export function silence() {
  if (hasSpeech()) window.speechSynthesis.cancel();
}
