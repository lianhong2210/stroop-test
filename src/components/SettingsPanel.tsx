"use client";

import { useEffect, useRef } from "react";
import { NARRATION_ENABLED } from "@/lib/narration";
import { settingsStore, type Settings } from "@/lib/settings";

interface Props {
  settings: Settings;
  muted: boolean;
  onUnmute: () => void;
  onOpenVoice: () => void;
  onReset: () => void;
  onClose: () => void;
}

type Toggle = "music" | "sfx" | "ambience" | "narrator";

export function SettingsPanel({
  settings,
  muted,
  onUnmute,
  onOpenVoice,
  onReset,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggle = (key: Toggle) =>
    settingsStore.set((s) => ({ ...s, [key]: !s[key] }));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={ref}
        className="modal paper"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h2 id="settings-title">Settings</h2>
            <p className="paper-meta">Saved on this device.</p>
          </div>
          <button className="modal-close" onClick={onClose}>
            [close]
          </button>
        </div>

        <hr />

        {muted && (
          <p className="warn" style={{ marginBottom: 12 }}>
            Sound is off.{" "}
            <button className="act act-quiet" onClick={onUnmute}>
              <u>Turn it on</u>
            </button>
          </p>
        )}

        <div className="form">
          <label className="check">
            <input
              type="checkbox"
              checked={settings.music}
              onChange={() => toggle("music")}
            />
            <span>
              Music
              <small>The score on the menu and the results page.</small>
            </span>
          </label>
          <label className="slider">
            <span>Volume</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.musicVolume}
              disabled={!settings.music}
              onChange={(e) =>
                settingsStore.set((s) => ({
                  ...s,
                  musicVolume: Number(e.target.value),
                }))
              }
            />
            <output>{Math.round(settings.musicVolume * 100)}%</output>
          </label>

          <label className="check">
            <input
              type="checkbox"
              checked={settings.sfx}
              onChange={() => toggle("sfx")}
            />
            <span>
              Sound effects
              <small>Countdown, answer feedback, clock warnings.</small>
            </span>
          </label>

          <label className="check">
            <input
              type="checkbox"
              checked={settings.ambience}
              disabled={!settings.sfx}
              onChange={() => toggle("ambience")}
            />
            <span>
              Ambience
              <small>Low electrical hum while you play.</small>
            </span>
          </label>

          {NARRATION_ENABLED && (
            <label className="check">
              <input
                type="checkbox"
                checked={settings.narrator}
                onChange={() => toggle("narrator")}
              />
              <span>
                The Doctor&apos;s remarks
                <small>A spoken comment on each result.</small>
              </span>
            </label>
          )}
        </div>

        <hr />

        <div className="paper-actions">
          <button className="act" onClick={onOpenVoice}>
            Voice settings →
          </button>
          <button className="act act-quiet act-danger" onClick={onReset}>
            Erase progress
          </button>
        </div>
      </div>
    </div>
  );
}
