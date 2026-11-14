"use client";

import { useEffect, useRef } from "react";
import { COLOR_ORDER, COLORS } from "@/lib/colors";
import { settingsStore, updateSoundbot, type Settings } from "@/lib/settings";
import { sfx } from "@/lib/sfx";
import {
  CUSTOM_PERSONA_ID,
  findPersonaVoice,
  PERSONAS,
  speak,
  speechSupported,
  useSpeechHealth,
} from "@/lib/soundbot";

interface Props {
  settings: Settings;
  voices: SpeechSynthesisVoice[];
  onClose: () => void;
  /** Player chose "Continue without sound" this visit: all speech is off. */
  muted: boolean;
  onUnmute: () => void;
}

const sample = () =>
  COLORS[COLOR_ORDER[Math.floor(Math.random() * COLOR_ORDER.length)]].name;

export function SoundbotPanel({
  settings,
  voices,
  onClose,
  muted,
  onUnmute,
}: Props) {
  const sb = settings.soundbot;
  const ref = useRef<HTMLDivElement>(null);
  const supported = speechSupported();
  const health = useSpeechHealth();

  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Preview with what was just saved, not the render-time snapshot.
  const preview = () =>
    speak(sample(), settingsStore.get().soundbot, voices, true);

  const choose = (personaId: string) => {
    updateSoundbot({ personaId });
    sfx.ui();
    preview();
  };

  // Browsers fire no "change" when an already-selected radio is clicked,
  // so a second click on the current voice replays it from here.
  const replayIfSelected = (personaId: string) => {
    if (settingsStore.get().soundbot.personaId !== personaId) return;
    sfx.ui();
    preview();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={ref}
        className="modal paper"
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h2 id="voice-title">The voice</h2>
            <p className="paper-meta">
              Reads the written word aloud each round. Don&apos;t listen to it.
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>
            [close]
          </button>
        </div>

        <hr />

        {muted && (
          <p className="warn" style={{ marginBottom: 12 }}>
            Sound is off for this visit, so the voice can&apos;t play.{" "}
            <button className="act act-quiet" onClick={onUnmute}>
              <u>Turn sound on</u>
            </button>
          </p>
        )}

        {health === "stuck" && !muted && (
          <p className="warn" style={{ marginBottom: 12 }} role="alert">
            Your browser&apos;s speech engine isn&apos;t responding. It accepts
            the voice but never plays it. Fully quit the browser (on a Mac:
            ⌘Q, not just closing the window), reopen it, and try again.
          </p>
        )}

        {!supported && (
          <p className="warn">This browser can&apos;t speak. The voice is unavailable.</p>
        )}

        <label className="check">
          <input
            type="checkbox"
            checked={sb.enabled}
            onChange={(e) => updateSoundbot({ enabled: e.target.checked })}
          />
          <span>Voice on</span>
        </label>

        <fieldset className="choices" disabled={!sb.enabled || !supported}>
          <legend className="sr-only">Choose a voice</legend>
          {PERSONAS.map((p) => {
            const v = findPersonaVoice(voices, p);
            return (
              <label key={p.id} className="choice">
                <input
                  type="radio"
                  name="persona"
                  checked={sb.personaId === p.id}
                  onChange={() => choose(p.id)}
                  onClick={() => replayIfSelected(p.id)}
                />
                <span>
                  <span className="choice-name">{p.name}</span>
                  <span className="choice-tag">
                    {p.tagline} ({p.lang})
                  </span>
                </span>
                <span className={`choice-voice ${v ? "is-found" : ""}`}>
                  {v ? "on this device" : "not on this device: default voice"}
                </span>
              </label>
            );
          })}
          <label className="choice">
            <input
              type="radio"
              name="persona"
              checked={sb.personaId === CUSTOM_PERSONA_ID}
              onChange={() => choose(CUSTOM_PERSONA_ID)}
              onClick={() => replayIfSelected(CUSTOM_PERSONA_ID)}
            />
            <span>
              <span className="choice-name">Custom</span>
              <span className="choice-tag">Any installed voice, your tuning.</span>
            </span>
            <span className="choice-voice">{voices.length} on this device</span>
          </label>
        </fieldset>

        {sb.personaId === CUSTOM_PERSONA_ID && sb.enabled && (
          <div className="custom-voice">
            <label>
              <span>Voice</span>
              <select
                value={sb.customVoiceURI ?? ""}
                onChange={(e) =>
                  updateSoundbot({ customVoiceURI: e.target.value || null })
                }
              >
                <option value="">Browser default</option>
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang}){v.localService ? "" : " · online"}
                  </option>
                ))}
              </select>
            </label>
            <label className="slider">
              <span>Pitch</span>
              <input
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={sb.customPitch}
                onChange={(e) =>
                  updateSoundbot({ customPitch: Number(e.target.value) })
                }
              />
              <output>{sb.customPitch.toFixed(2)}</output>
            </label>
            <label className="slider">
              <span>Speed</span>
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.05}
                value={sb.customRate}
                onChange={(e) =>
                  updateSoundbot({ customRate: Number(e.target.value) })
                }
              />
              <output>{sb.customRate.toFixed(2)}×</output>
            </label>
          </div>
        )}

        <label className="slider" style={{ paddingLeft: 0, marginTop: 8 }}>
          <span>Volume</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={sb.volume}
            disabled={!sb.enabled}
            onChange={(e) => updateSoundbot({ volume: Number(e.target.value) })}
          />
          <output>{Math.round(sb.volume * 100)}%</output>
        </label>

        <div className="paper-actions">
          {sb.enabled ? (
            <button
              className="act"
              onClick={preview}
              disabled={!supported || muted}
            >
              ▶ Test voice
            </button>
          ) : (
            <span />
          )}
          <button className="act act-quiet" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
