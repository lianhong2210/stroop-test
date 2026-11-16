"use client";

import { useEffect, useRef } from "react";
import type { AuthState } from "@/lib/auth";
import { duckMusic } from "@/lib/bgm";
import { NARRATION_ENABLED } from "@/lib/narration";
import { silence } from "@/lib/soundbot";
import { DIFFICULTIES, type DifficultyId } from "@/lib/difficulty";
import type { Submission } from "@/lib/ranked";
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
  auth: AuthState;
  /** Signed in: what the server made of this run (null = it wasn't ranked). */
  submission: Submission | null;
  onOpenLeaderboard: () => void;
  onOpenAccount: () => void;
}

function Ranking({
  auth,
  submission,
  rounds,
  onOpenAccount,
}: {
  auth: AuthState;
  submission: Submission | null;
  rounds: number | null;
  onOpenAccount: () => void;
}) {
  if (auth.status !== "signed-in") {
    return (
      <p className="ranking">
        <span>Leaderboard:</span> not ranked.{" "}
        <button className="act act-quiet" onClick={onOpenAccount}>
          <u>Sign in</u>
        </button>{" "}
        to put your scores on it.
      </p>
    );
  }
  if (!submission) {
    return (
      <p className="ranking">
        <span>Leaderboard:</span> not ranked. The bot check or the server
        didn&apos;t answer when the run started.
      </p>
    );
  }
  switch (submission.status) {
    case "pending":
      return (
        <p className="ranking">
          <span>Leaderboard:</span> checking your run
          <span className="loading-cursor" aria-hidden>
            ▍
          </span>
        </p>
      );
    case "accepted": {
      if (submission.score === 0) {
        return (
          <p className="ranking">
            <span>Leaderboard:</span> no correct answers, nothing to rank.
          </p>
        );
      }
      const of = rounds !== null ? `/${rounds}` : "";
      return (
        <p className="ranking">
          <span>Leaderboard:</span>{" "}
          {submission.rank !== null && <strong>#{submission.rank}</strong>}
          {submission.isBest
            ? " · new personal best"
            : submission.best
              ? ` · your best stays ${submission.best.score}${of} (${submission.best.avgRtMs} ms)`
              : ""}
        </p>
      );
    }
    case "rejected":
      return (
        <p className="ranking is-bad">
          <span>Leaderboard:</span> run not counted ({submission.reason}).
        </p>
      );
    case "error":
      return (
        <p className="ranking is-bad">
          <span>Leaderboard:</span> couldn&apos;t submit ({submission.reason}).
        </p>
      );
  }
}

const ms = (v: number | null) => (v === null ? "n/a" : `${Math.round(v)} ms`);

const MARK = { correct: "✓", wrong: "✗", timeout: "–" } as const;

export function Results({
  info,
  onRetry,
  onMenu,
  onPlay,
  onNarrate,
  auth,
  submission,
  onOpenLeaderboard,
  onOpenAccount,
}: Props) {
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

        {auth.status !== "off" && auth.status !== "loading" && (
          <>
            <hr />
            <Ranking
              auth={auth}
              submission={submission}
              rounds={d.rounds}
              onOpenAccount={onOpenAccount}
            />
          </>
        )}

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
        {auth.status !== "off" && (
          <button className="act" onClick={onOpenLeaderboard}>
            Leaderboard
          </button>
        )}
        <button className="act" onClick={onMenu}>
          Menu
        </button>
      </div>
    </div>
  );
}
