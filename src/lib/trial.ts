import { makeRound, type Rand, type RoundSpec } from "@shared/stroop";
import type { ColorId } from "./colors";
import type { DifficultyId } from "./difficulty";

export interface Trial extends RoundSpec {
  id: number;
  start: number;
}

export type Outcome = "correct" | "wrong" | "timeout";

export interface RoundRecord {
  word: ColorId;
  ink: ColorId;
  picked: ColorId | null;
  outcome: Outcome;
  rt: number;
}

export interface GameResult {
  difficulty: DifficultyId;
  records: RoundRecord[];
  correct: number;
  /** Set when the run was issued by the server and can go on the leaderboard. */
  runId: string | null;
}

/**
 * Next round. Ranked runs pass a generator seeded by the server, so it can
 * replay exactly the same rounds when checking the answers.
 */
export function makeTrial(
  palette: ColorId[],
  prev: Trial | null,
  opts: { shuffle: boolean; mislabel: boolean },
  id: number,
  rand: Rand = Math.random,
): Trial {
  return { ...makeRound(palette, prev, opts, rand), id, start: 0 };
}

export interface Summary {
  correct: number;
  wrong: number;
  timeouts: number;
  accuracy: number;
  avgRt: number | null;
  fastest: number | null;
  bestStreak: number;
  /** Mean RT on mismatched trials minus matched trials: the Stroop effect. */
  interference: number | null;
}

const mean = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

export function summarize(records: RoundRecord[]): Summary {
  const hits = records.filter((r) => r.outcome === "correct");
  let streak = 0;
  let bestStreak = 0;
  for (const r of records) {
    streak = r.outcome === "correct" ? streak + 1 : 0;
    bestStreak = Math.max(bestStreak, streak);
  }
  // Need a couple of samples on each side or the figure is pure noise.
  const congRts = hits.filter((r) => r.word === r.ink).map((r) => r.rt);
  const incongRts = hits.filter((r) => r.word !== r.ink).map((r) => r.rt);
  const cong = congRts.length >= 2 ? mean(congRts) : null;
  const incong = incongRts.length >= 2 ? mean(incongRts) : null;
  return {
    correct: hits.length,
    wrong: records.filter((r) => r.outcome === "wrong").length,
    timeouts: records.filter((r) => r.outcome === "timeout").length,
    accuracy: records.length ? hits.length / records.length : 0,
    avgRt: mean(hits.map((r) => r.rt)),
    fastest: hits.length ? Math.min(...hits.map((r) => r.rt)) : null,
    bestStreak,
    interference: cong !== null && incong !== null ? incong - cong : null,
  };
}
