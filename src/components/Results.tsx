"use client";

import { useEffect, useRef } from "react";
import { duckMusic } from "@/lib/bgm";
import { NARRATION_ENABLED } from "@/lib/narration";
import { silence } from "@/lib/soundbot";
import { DIFFICULTIES, type DifficultyId } from "@/lib/difficulty";
import { summarize, type GameResult } from "@/lib/trial";

export interface ResultInfo {
  game: GameResult;
  passed: boolean | null;
  unlocked: DifficultyId | null;
  newBest: boolean;
  prevBest: number | null;
  endedAt: number;
  /** The Doctor's spoken comment, also printed on the report. */
  remark: string;
}

interface Props {
  info: ResultInfo;
  onRetry: () => void;
  onMenu: () => void;
  onPlay: (id: DifficultyId) => void;
  onNarrate: (line: string) => void;
}

const ms = (v: number | null) => (v === null ? "n/a" : `${Math.round(v)} ms`);

const MARK = { correct: "✓", wrong: "✗", timeout: "–" } as const;

export function Results({ info, onRetry, onMenu, onPlay, onNarrate }: Props) {
  const d = DIFFICULTIES[info.game.difficulty];
  const s = summarize(info.game.records);
  const scoreMode = d.goal === null;
  const primary = useRef<HTMLButtonElement>(null);

  // The Doctor speaks once the stamp has landed; leaving cuts him off.
  const narrateRef = useRef(onNarrate);
  useEffect(() => {
    narrateRef.current = onNarrate;
  });
  useEffect(() => {
    if (!NARRATION_ENABLED) return;
    const t = setTimeout(() => narrateRef.current(info.remark), 1100);
    return () => {
      clearTimeout(t);
      silence();
      duckMusic(false);
    };
  }, [info]);

  useEffect(() => {
    primary.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onMenu();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onMenu]);

  const stamp = scoreMode
    ? info.newBest
      ? "NEW RECORD"
      : "LOGGED"
    : info.passed
      ? "PASSED"
      : "FAILED";
  const good = scoreMode ? info.newBest : info.passed;
  const when = new Date(info.endedAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="results">
      <article className="paper report">
        <h2>Evaluation record</h2>
        <p className="paper-meta">
          {d.label} · {d.options} colours · {when}
        </p>
        <div
          className={`stamp ${good ? "stamp-good" : ""}`}
          role="status"
        >
          {stamp}
        </div>

        <div className="score-row">
          <span className="score-big">{s.correct}</span>
          <span className="score-of">
            {scoreMode
              ? "correct in two minutes"
              : `of ${d.rounds} correct. Pass mark ${d.goal}.`}
          </span>
        </div>

        <hr />

        <dl className="fields">
          <div>
            <dt>Accuracy</dt>
            <dd>{Math.round(s.accuracy * 100)}%</dd>
          </div>
          <div>
            <dt>Best streak</dt>
            <dd>{s.bestStreak}</dd>
          </div>
          <div>
            <dt>Avg reaction</dt>
            <dd>{ms(s.avgRt)}</dd>
          </div>
          <div>
            <dt>Fastest</dt>
            <dd>{ms(s.fastest)}</dd>
          </div>
          <div>
            <dt>Wrong / too slow</dt>
            <dd>
              {s.wrong} / {s.timeouts}
            </dd>
          </div>
          <div>
            <dt title="How much slower you were when word and ink disagreed">
              Word interference
            </dt>
            <dd>
              {s.interference === null
                ? "n/a"
                : `${s.interference >= 0 ? "+" : ""}${Math.round(s.interference)} ms`}
            </dd>
          </div>
          {info.prevBest !== null && (
            <div>
              <dt>Previous best</dt>
              <dd>{info.prevBest}</dd>
            </div>
          )}
        </dl>

        <hr />

        <ol className="marks" aria-label="Round by round">
          {info.game.records.map((r, i) => (
            <li key={i} className={`mark-${r.outcome}`} title={`Round ${i + 1}: ${r.outcome}`}>
              {MARK[r.outcome]}
            </li>
          ))}
        </ol>

        {NARRATION_ENABLED && (
          <>
            <hr />
            <p className="remark">
              <span>Remarks:</span> &ldquo;{info.remark}&rdquo;
            </p>
          </>
        )}

        {info.unlocked && (
          <>
            <hr />
            <p className="note">
              Note: subject cleared for{" "}
              <u>{DIFFICULTIES[info.unlocked].label.toUpperCase()}</u>.
              {DIFFICULTIES[info.unlocked].hidden &&
                " This level does not appear in the menu until now."}
            </p>
          </>
        )}
      </article>

      <div className="results-actions">
        {info.unlocked ? (
          <button
            ref={primary}
            className="act act-primary"
            onClick={() => onPlay(info.unlocked!)}
          >
            Begin {DIFFICULTIES[info.unlocked].label} →
          </button>
        ) : (
          <button ref={primary} className="act act-primary" onClick={onRetry}>
            Try again
          </button>
        )}
        {info.unlocked && (
          <button className="act" onClick={onRetry}>
            Replay {d.label}
          </button>
        )}
        <button className="act" onClick={onMenu}>
          Menu
        </button>
      </div>
    </div>
  );
}
