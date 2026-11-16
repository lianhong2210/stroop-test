"use client";

import Link from "next/link";
import type { AuthState } from "@/lib/auth";
import { COLORS } from "@/lib/colors";
import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  type DifficultyId,
} from "@/lib/difficulty";
import { isUnlocked, type Progress } from "@/lib/progress";
import { CUSTOM_PERSONA_ID, PERSONAS } from "@/lib/soundbot";
import type { Settings } from "@/lib/settings";
import { useHydrated } from "@/lib/store";

interface Props {
  progress: Progress;
  settings: Settings;
  freshUnlock: DifficultyId | null;
  onStart: (id: DifficultyId) => void;
  onOpenVoice: () => void;
  onOpenSettings: () => void;
  auth: AuthState;
  onOpenAccount: () => void;
  onOpenLeaderboard: () => void;
}

function detail(id: DifficultyId) {
  const d = DIFFICULTIES[id];
  const length =
    d.rounds !== null
      ? `${d.rounds} rounds`
      : `${(d.durationMs ?? 0) / 60000} minutes`;
  const target =
    d.goal !== null ? `pass ${d.goal}/${d.rounds}` : "score as high as you can";
  return `${d.options} colours · ${length} · ${d.roundMs / 1000}s each · ${target}`;
}

function lockText(id: DifficultyId) {
  const req = DIFFICULTIES[id].requires;
  if (!req) return "";
  const r = DIFFICULTIES[req];
  return `Locked. Score ${r.goal}/${r.rounds} on ${r.label} to open.`;
}

export function Menu({
  progress,
  settings,
  freshUnlock,
  onStart,
  onOpenVoice,
  onOpenSettings,
  auth,
  onOpenAccount,
  onOpenLeaderboard,
}: Props) {
  const ready = useHydrated();
  const voice = !ready
    ? "…"
    : !settings.soundbot.enabled
      ? "off"
      : settings.soundbot.personaId === CUSTOM_PERSONA_ID
        ? "Custom"
        : (PERSONAS.find((p) => p.id === settings.soundbot.personaId)?.name ??
          PERSONAS[0].name);

  return (
    <div className="menu">
      <header>
        <h1 className="title scratch" aria-label="Stroop">
          <span style={{ color: COLORS.blue.hex }}>ST</span>
          <span style={{ color: COLORS.red.hex }}>RO</span>
          <span style={{ color: COLORS.yellow.hex }}>OP</span>
        </h1>
        <p className="tagline">
          Name the colour of the ink. Not the word. Not what you hear.
        </p>
        <div className="example" aria-hidden>
          <span className="example-word" style={{ color: COLORS.green.hex }}>
            RED
          </span>
          <span className="example-arrow">answer</span>
          <span className="example-answer">GREEN</span>
        </div>
      </header>

      {!ready ? (
        // The page is static HTML, so until the browser has read the saved
        // progress it only knows the defaults (everything locked). Show this
        // instead of a locked list that would flip a moment later.
        <ul
          className="modes is-loading"
          aria-busy="true"
          aria-label="Loading your progress"
        >
          {DIFFICULTY_ORDER.filter((id) => !DIFFICULTIES[id].hidden).map(
            (id, i) => (
              <li key={id} className="mode">
                <div className="mode-btn">
                  <span className="mode-marker" aria-hidden />
                  <span className="mode-name scratch">
                    {DIFFICULTIES[id].label}
                  </span>
                  <span className="mode-detail">
                    {i === 0 ? (
                      <>
                        Retrieving your file
                        <span className="loading-cursor" aria-hidden>
                          ▍
                        </span>
                      </>
                    ) : (
                      " "
                    )}
                  </span>
                </div>
              </li>
            ),
          )}
        </ul>
      ) : (
        <ul className="modes" aria-label="Choose a difficulty">
          {DIFFICULTY_ORDER.map((id) => {
            const d = DIFFICULTIES[id];
            const unlocked = isUnlocked(progress, id);
            if (d.hidden && !unlocked) return null;
            const best = progress.best[id];
            return (
              <li
                key={id}
                className={`mode mode-${id} ${freshUnlock === id ? "is-fresh" : ""}`}
              >
                <button
                  className="mode-btn"
                  disabled={!unlocked}
                  onClick={() => onStart(id)}
                >
                  <span className="mode-marker" aria-hidden>
                    ▸
                  </span>
                  <span className="mode-name scratch">
                    {d.label}
                    {freshUnlock === id && (
                      <span className="mode-new">new</span>
                    )}
                  </span>
                  <span className="mode-detail">
                    {unlocked ? (
                      detail(id)
                    ) : (
                      <span className="mode-lock">{lockText(id)}</span>
                    )}
                  </span>
                  <span className="mode-side">
                    {unlocked &&
                      (best !== null ? (
                        <>
                          best{" "}
                          <strong>
                            {best}
                            {d.rounds !== null && `/${d.rounds}`}
                          </strong>
                        </>
                      ) : (
                        "not attempted"
                      ))}
                    {progress.cleared[id] && d.goal !== null && (
                      <span className="mode-passed">passed</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <footer className="menu-foot">
        <button className="act" onClick={onOpenVoice}>
          Voice <span>· {voice}</span>
        </button>
        <button className="act" onClick={onOpenSettings}>
          Settings
        </button>
        {auth.status !== "off" && (
          <>
            <button className="act" onClick={onOpenLeaderboard}>
              Leaderboard
            </button>
            <button
              className="act"
              onClick={onOpenAccount}
              disabled={auth.status === "loading"}
            >
              {auth.status === "signed-in" ? (
                <>
                  Subject <span>· {auth.profile?.username ?? "…"}</span>
                </>
              ) : auth.status === "loading" ? (
                <span>…</span>
              ) : (
                "Sign in"
              )}
            </button>
          </>
        )}
        <span className="menu-hint">
          keys <kbd>1</kbd>–<kbd>9</kbd> answer · <kbd>esc</kbd> quits a run
        </span>
        <Link className="menu-link" href="/privacy">
          privacy
        </Link>
      </footer>
    </div>
  );
}
