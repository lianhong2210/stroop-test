"use client";

import { useEffect, useRef, useState } from "react";
import type { AuthState } from "@/lib/auth";
import { DIFFICULTIES, type DifficultyId } from "@/lib/difficulty";
import {
  fetchLeaderboard,
  LEADERBOARD_SIZE,
  type Leaderboard,
  type LeaderRow,
} from "@/lib/leaderboard";

interface Props {
  /** Tabs to show: only modes the player can see (never a hidden one). */
  modes: DifficultyId[];
  initialMode: DifficultyId;
  auth: AuthState;
  onOpenAccount: () => void;
  onClose: () => void;
}

type Load =
  | { state: "loading" }
  | { state: "ready"; board: Leaderboard }
  | { state: "error" };

function Row({ row, mode }: { row: LeaderRow; mode: DifficultyId }) {
  const d = DIFFICULTIES[mode];
  return (
    <tr className={row.isMe ? "is-me" : undefined}>
      <td className="lb-rank">{row.rank}</td>
      <td className="lb-name">
        {row.username}
        {row.isMe && <span className="lb-you"> (you)</span>}
      </td>
      <td className="lb-score">
        {row.score}
        {d.rounds !== null && <small>/{d.rounds}</small>}
      </td>
      <td className="lb-rt">{row.avgRtMs} ms</td>
    </tr>
  );
}

export function LeaderboardPanel({
  modes,
  initialMode,
  auth,
  onOpenAccount,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState(initialMode);
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const userId = auth.status === "signed-in" ? auth.user.id : null;
  const key = `${mode}:${userId}`;
  // Switching tab (or account) starts a fresh load.
  if (loadedFor !== key) {
    setLoadedFor(key);
    setLoad({ state: "loading" });
  }

  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    fetchLeaderboard(mode).then(
      (board) => !cancelled && setLoad({ state: "ready", board }),
      () => !cancelled && setLoad({ state: "error" }),
    );
    return () => {
      cancelled = true;
    };
  }, [mode, userId]);

  const d = DIFFICULTIES[mode];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={ref}
        className="modal paper"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lb-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h2 id="lb-title">Leaderboard</h2>
            <p className="paper-meta">
              Top {LEADERBOARD_SIZE} subjects.{" "}
              {d.goal === null
                ? "Highest score, then fastest average."
                : "Most correct, then fastest average."}
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>
            [close]
          </button>
        </div>

        {modes.length > 1 && (
          <div className="lb-tabs" role="tablist" aria-label="Mode">
            {modes.map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={m === mode}
                className={m === mode ? "is-active" : undefined}
                onClick={() => setMode(m)}
              >
                {DIFFICULTIES[m].label}
              </button>
            ))}
          </div>
        )}

        <hr />

        {load.state === "loading" && (
          <p className="lb-status">
            Retrieving records
            <span className="loading-cursor" aria-hidden>
              ▍
            </span>
          </p>
        )}
        {load.state === "error" && (
          <p className="warn">Couldn&apos;t load the leaderboard. Try again later.</p>
        )}
        {load.state === "ready" &&
          (load.board.top.length === 0 ? (
            <p className="lb-status">No ranked runs yet. The first page is blank.</p>
          ) : (
            <table className="lb-table">
              <thead>
                <tr>
                  <th className="lb-rank">#</th>
                  <th className="lb-name">Subject</th>
                  <th className="lb-score">Score</th>
                  <th className="lb-rt">Avg</th>
                </tr>
              </thead>
              <tbody>
                {load.board.top.map((r) => (
                  <Row key={r.rank} row={r} mode={mode} />
                ))}
                {load.board.me && (
                  <>
                    <tr className="lb-gap" aria-hidden>
                      <td colSpan={4}>⋮</td>
                    </tr>
                    <Row row={load.board.me} mode={mode} />
                  </>
                )}
              </tbody>
            </table>
          ))}

        <hr />

        <div className="paper-actions">
          {auth.status === "signed-in" ? (
            <span className="lb-foot">
              {load.state === "ready" && load.board.total > 0
                ? `${load.board.total} ranked ${load.board.total === 1 ? "subject" : "subjects"}.`
                : ""}
            </span>
          ) : (
            <button className="act" onClick={onOpenAccount}>
              Sign in to be ranked →
            </button>
          )}
          <button className="act act-quiet" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
