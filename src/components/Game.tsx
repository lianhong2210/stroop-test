"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { COLORS, paletteFor, type ColorId } from "@/lib/colors";
import type { Difficulty } from "@/lib/difficulty";
import type { Settings } from "@/lib/settings";
import { sfx, startDrone, stopDrone } from "@/lib/sfx";
import type { RankedRun } from "@/lib/ranked";
import { silence, speak } from "@/lib/soundbot";
import { seededRandom, type Rand } from "@shared/stroop";
import {
  makeTrial,
  type GameResult,
  type Outcome,
  type RoundRecord,
  type Trial,
} from "@/lib/trial";

interface Props {
  difficulty: Difficulty;
  settings: Settings;
  voices: SpeechSynthesisVoice[];
  onFinish: (result: GameResult) => void;
  onAbort: () => void;
  /**
   * Signed-in players: the server is issuing a ranked run. Its seed decides
   * the rounds, so play waits for it after the countdown (briefly; if it
   * doesn't arrive the run goes ahead unranked).
   */
  ranked: Promise<RankedRun | null> | null;
}

/** Extra wait after the countdown for a ranked run before playing unranked. */
const RANKED_WAIT_MS = 5000;

type RankState = "connecting" | "ranked" | "unranked";

const RANK_TEXT: Record<RankState, string> = {
  connecting: "connecting",
  ranked: "ranked",
  unranked: "unranked",
};

type Phase = "countdown" | "play" | "done";

const FEEDBACK_TEXT: Record<Outcome, string> = {
  correct: "CORRECT",
  wrong: "WRONG",
  timeout: "TOO SLOW",
};

/** 83400 → "01:23.4" */
function timecode(ms: number) {
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${(s - m * 60).toFixed(1).padStart(4, "0")}`;
}

const COUNT_WORDS = ["", "one", "two", "three"];

export function Game({
  difficulty,
  settings,
  voices,
  onFinish,
  onAbort,
  ranked,
}: Props) {
  const palette = useMemo(
    () => paletteFor(difficulty.options),
    [difficulty.options],
  );
  const [phase, setPhase] = useState<Phase>("countdown");
  const [count, setCount] = useState(3);
  const [trial, setTrial] = useState<Trial | null>(null);
  const [feedback, setFeedback] = useState<{
    outcome: Outcome;
    picked: ColorId | null;
  } | null>(null);
  const [records, setRecords] = useState<RoundRecord[]>([]);
  const [clockMs, setClockMs] = useState(difficulty.durationMs ?? 0);
  const [penalties, setPenalties] = useState(0);
  const [rankState, setRankState] = useState<RankState | null>(
    ranked ? "connecting" : null,
  );
  const [waiting, setWaiting] = useState(false);

  // Latest props for timer callbacks, without restarting the run.
  const latest = useRef({ settings, voices, onFinish, onAbort });
  useEffect(() => {
    latest.current = { settings, voices, onFinish, onAbort };
  });
  const answerRef = useRef<(c: ColorId | null) => void>(() => {});
  /** Answer by button position (keyboard 1–9); positions move in Overload. */
  const pickIndexRef = useRef<(i: number) => void>(() => {});

  /* ---------- the run: countdown → trials → finish ---------- */
  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let clock: ReturnType<typeof setInterval> | null = null;
    let roundTimer: ReturnType<typeof setTimeout> | null = null;
    let finished = false;
    let locked = true;
    let current: Trial | null = null;
    let nextId = 0;
    let endAt = 0;
    let lastPulse = -1;
    let rand: Rand = Math.random;
    let runId: string | null = null;
    const recs: RoundRecord[] = [];

    const later = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        timers.delete(t);
        fn();
      }, ms);
      timers.add(t);
      return t;
    };
    const say = (text: string) =>
      speak(text, latest.current.settings.soundbot, latest.current.voices);

    const finish = () => {
      if (finished) return;
      finished = true;
      locked = true;
      timers.forEach(clearTimeout);
      timers.clear();
      if (clock) clearInterval(clock);
      silence();
      stopDrone();
      sfx.end();
      setPhase("done");
      later(() => {
        latest.current.onFinish({
          difficulty: difficulty.id,
          records: recs.slice(),
          correct: recs.filter((r) => r.outcome === "correct").length,
          runId,
        });
      }, 900);
    };

    const startTrial = () => {
      if (finished) return;
      current = makeTrial(
        palette,
        current,
        {
          shuffle: difficulty.shuffleButtons,
          mislabel: difficulty.mislabelButtons,
        },
        ++nextId,
        rand,
      );
      current.start = performance.now();
      setTrial(current);
      setFeedback(null);
      locked = false;
      say(COLORS[current.word].name);
      sfx.tick();
      roundTimer = later(() => resolve(null), difficulty.roundMs);
    };

    const resolve = (picked: ColorId | null) => {
      if (locked || finished || !current) return;
      locked = true;
      if (roundTimer) {
        clearTimeout(roundTimer);
        timers.delete(roundTimer);
      }
      const outcome: Outcome =
        picked === null
          ? "timeout"
          : picked === current.ink
            ? "correct"
            : "wrong";
      recs.push({
        word: current.word,
        ink: current.ink,
        picked,
        outcome,
        rt: performance.now() - current.start,
      });
      setRecords(recs.slice());
      setFeedback({ outcome, picked });
      if (outcome === "correct") sfx.correct();
      else if (outcome === "wrong") sfx.wrong();
      else sfx.timeout();

      if (outcome !== "correct" && difficulty.penaltyMs > 0) {
        endAt -= difficulty.penaltyMs;
        setPenalties((n) => n + 1);
      }

      const outOfRounds =
        difficulty.rounds !== null && recs.length >= difficulty.rounds;
      const outOfTime =
        difficulty.durationMs !== null && endAt - performance.now() <= 0;
      const pause = outcome === "correct" ? 220 : 650;
      if (outOfRounds || outOfTime) later(finish, pause);
      else later(startTrial, pause);
    };
    answerRef.current = resolve;
    pickIndexRef.current = (i) => {
      const c = current?.order[i];
      if (c) resolve(c);
    };

    const tickClock = () => {
      const remaining = Math.max(0, endAt - performance.now());
      setClockMs(remaining);
      const sec = Math.ceil(remaining / 1000);
      if (remaining > 0 && sec <= 10 && sec !== lastPulse) {
        lastPulse = sec;
        sfx.pulse();
      }
      if (remaining <= 0) finish();
    };

    const begin = () => {
      sfx.count(true);
      setWaiting(false);
      setPhase("play");
      if (latest.current.settings.ambience) startDrone();
      if (difficulty.durationMs !== null) {
        endAt = performance.now() + difficulty.durationMs;
        clock = setInterval(tickClock, 100);
      }
      startTrial();
    };

    // 3 · 2 · 1 · go
    sfx.count(false);
    say(COUNT_WORDS[3]);
    later(() => {
      setCount(2);
      sfx.count(false);
      say(COUNT_WORDS[2]);
    }, 800);
    later(() => {
      setCount(1);
      sfx.count(false);
      say(COUNT_WORDS[1]);
    }, 1600);
    later(() => {
      if (!ranked) return begin();
      // Ranked: rounds must come from the server's seed.
      let settled = false;
      setWaiting(true);
      const giveUp = later(() => {
        if (settled) return;
        settled = true;
        setRankState("unranked");
        begin();
      }, RANKED_WAIT_MS);
      ranked.then((run) => {
        if (settled || finished) return;
        settled = true;
        clearTimeout(giveUp);
        timers.delete(giveUp);
        if (run) {
          rand = seededRandom(run.seed);
          runId = run.runId;
        }
        setRankState(run ? "ranked" : "unranked");
        begin();
      });
    }, 2400);

    return () => {
      finished = true;
      timers.forEach(clearTimeout);
      if (clock) clearInterval(clock);
      answerRef.current = () => {};
      pickIndexRef.current = () => {};
      silence();
      stopDrone();
    };
  }, [difficulty, palette, ranked]);

  /* ---------- keyboard: 1–9 answer, Esc aborts ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        latest.current.onAbort();
        return;
      }
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= palette.length) {
        e.preventDefault();
        pickIndexRef.current(n - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [palette]);

  /* ---------- derived HUD values ---------- */
  const correct = records.filter((r) => r.outcome === "correct").length;
  const misses = records.length - correct;
  let streak = 0;
  for (let i = records.length - 1; i >= 0; i--) {
    if (records[i].outcome !== "correct") break;
    streak++;
  }
  const allowedMisses =
    difficulty.goal !== null && difficulty.rounds !== null
      ? difficulty.rounds - difficulty.goal
      : null;
  const goalLost = allowedMisses !== null && misses > allowedMisses;
  const timed = difficulty.durationMs !== null;
  const roundNo = Math.min(
    records.length + (feedback ? 0 : 1),
    difficulty.rounds ?? Infinity,
  );
  const lowClock = timed && clockMs <= 10_000;
  const lastOutcome = records.at(-1)?.outcome;

  const buttons = trial?.order ?? palette;

  return (
    <div
      className={`game ${feedback?.outcome === "wrong" ? "is-shocked" : ""}`}
      data-mode={difficulty.id}
    >
      {/* full-screen flash, re-keyed per answer so the animation replays */}
      {lastOutcome && lastOutcome !== "correct" && (
        <div
          key={records.length}
          className={`flash flash-${lastOutcome}`}
          aria-hidden
        />
      )}

      <section className="viewfinder">
        <div className="vf-corners" aria-hidden />

        <header className="vf-top">
          <div>
            <span className="rec">REC</span>
            <span className="vf-mode">{difficulty.label}</span>
            {rankState && (
              <span className={`vf-rank is-${rankState}`}>
                {RANK_TEXT[rankState]}
              </span>
            )}
          </div>
          <div className="vf-right">
            {timed ? (
              <>
                <div className={`vf-big vf-clock ${lowClock ? "is-low" : ""}`}>
                  {timecode(clockMs)}
                </div>
                <div className="vf-sub">
                  score {correct} · streak ×{streak}
                </div>
                {penalties > 0 && (
                  <span key={penalties} className="penalty">
                    −{difficulty.penaltyMs / 1000}s
                  </span>
                )}
              </>
            ) : (
              <>
                <div className="vf-big">
                  {String(roundNo).padStart(2, "0")}
                  <small> / {difficulty.rounds}</small>
                </div>
                <div className="vf-sub">
                  {correct} correct ·{" "}
                  <span className={goalLost ? "is-bad" : ""}>
                    {goalLost
                      ? "goal lost"
                      : allowedMisses === 0
                        ? "no misses allowed"
                        : `${misses} of ${allowedMisses} misses`}
                  </span>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="stage" aria-live="polite">
          {phase === "countdown" && (
            <div key={waiting ? "wait" : count} className="countdown scratch">
              {waiting ? "…" : count}
            </div>
          )}

          {phase !== "countdown" && trial && (
            <>
              <div
                key={trial.id}
                className="stimulus scratch"
                style={{ color: COLORS[trial.ink].hex }}
                aria-label={`The word ${COLORS[trial.word].name} written in an ink colour`}
              >
                {COLORS[trial.word].name}
              </div>
              <div className="round-timer" aria-hidden>
                <div
                  key={trial.id}
                  className="round-timer-fill"
                  style={{
                    animationDuration: `${difficulty.roundMs}ms`,
                    animationPlayState:
                      feedback || phase === "done" ? "paused" : "running",
                  }}
                />
              </div>
              <div className="verdict-slot">
                {feedback && (
                  <div className={`verdict verdict-${feedback.outcome}`}>
                    {FEEDBACK_TEXT[feedback.outcome]}
                    {feedback.outcome !== "correct" && (
                      <span className="verdict-sub">
                        the ink was{" "}
                        <span style={{ color: COLORS[trial.ink].hex }}>
                          {COLORS[trial.ink].name.toLowerCase()}
                        </span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {phase === "done" && <div className="session-end">END OF TAPE</div>}
        </main>

        <footer className="vf-bottom">
          <button className="vf-stop" onClick={onAbort}>
            [esc] stop
          </button>
          <span className="vf-sub">ink, not word</span>
        </footer>
      </section>

      <section
        className={`panel panel-${palette.length}`}
        aria-label="Answer panel"
      >
        {buttons.map((c, i) => {
          const isPicked = feedback?.picked === c;
          const isAnswer = feedback && trial?.ink === c;
          const labelInk = trial?.labelInks?.[i];
          return (
            <button
              key={difficulty.shuffleButtons ? i : c}
              className={[
                "key",
                isPicked ? `is-picked is-${feedback?.outcome}` : "",
                isAnswer && !isPicked ? "is-answer" : "",
              ].join(" ")}
              disabled={phase !== "play" || !!feedback}
              onClick={() => answerRef.current(c)}
              style={labelInk ? { color: COLORS[labelInk].hex } : undefined}
            >
              <span className="key-label scratch">{COLORS[c].name}</span>
            </button>
          );
        })}
      </section>
    </div>
  );
}
