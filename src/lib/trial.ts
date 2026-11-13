import type { ColorId } from "./colors";
import { CONGRUENT_CHANCE, type DifficultyId } from "./difficulty";

export interface Trial {
  id: number;
  /** The word that is written (and spoken). */
  word: ColorId;
  /** The ink the word is painted in: the correct answer. */
  ink: ColorId;
  /** Button order for this round (left→right, top→bottom). */
  order: ColorId[];
  /** Label ink per button (aligned with `order`) when the panel lies too, else null. */
  labelInks: ColorId[] | null;
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
}

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function pickExcept<T>(arr: T[], ...not: (T | undefined)[]): T {
  const pool = arr.filter((x) => !not.includes(x));
  return pick(pool.length ? pool : arr);
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A shuffle of `arr` where no element stays matched to `against[i]`. */
function derange<T>(arr: T[], against: T[]): T[] {
  for (;;) {
    const a = shuffle(arr);
    if (a.every((x, i) => x !== against[i])) return a;
  }
}

export function makeTrial(
  palette: ColorId[],
  prev: Trial | null,
  opts: { shuffle: boolean; mislabel: boolean },
  id: number,
): Trial {
  // Avoid repeating the previous answer so every round demands a fresh read.
  const ink = pickExcept(palette, prev?.ink);
  const congruent = Math.random() < CONGRUENT_CHANCE;
  const word = congruent ? ink : pickExcept(palette, ink, prev?.word);
  const order = opts.shuffle ? shuffle(palette) : palette;
  // Every ink is used exactly once across the panel, never on its own name.
  const labelInks = opts.mislabel ? derange(palette, order) : null;
  return { id, word, ink, order, labelInks, start: 0 };
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
