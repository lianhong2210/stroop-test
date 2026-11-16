/**
 * Game rules and round generation, shared by the game (Next.js) and the
 * Edge Functions (Deno). The server replays a ranked run from its seed with
 * exactly this code, so both sides must stay in lockstep.
 *
 * Keep this file free of imports: Deno needs explicit ".ts" paths while the
 * Next.js app doesn't, and a dependency-free file works in both.
 */

export type ColorId =
  | "red"
  | "blue"
  | "green"
  | "yellow"
  | "purple"
  | "orange"
  | "pink"
  | "cyan"
  | "white";

/** Palettes grow in this order: 3 → 6 → 9 options. */
export const COLOR_ORDER: ColorId[] = [
  "red",
  "blue",
  "green",
  "yellow",
  "purple",
  "orange",
  "pink",
  "cyan",
  "white",
];

export function paletteFor(options: number): ColorId[] {
  return COLOR_ORDER.slice(0, options);
}

export type DifficultyId = "easy" | "normal" | "hard" | "overload";

export const DIFFICULTY_IDS: DifficultyId[] = [
  "easy",
  "normal",
  "hard",
  "overload",
];

export function isDifficultyId(v: unknown): v is DifficultyId {
  return typeof v === "string" && (DIFFICULTY_IDS as string[]).includes(v);
}

/** The parts of a mode that decide what happens in a run. */
export interface Rules {
  /** Number of colour options on the panel. */
  options: number;
  /** Fixed number of rounds, or null for endless (time-boxed) mode. */
  rounds: number | null;
  /** Time allowed to answer a single round. */
  roundMs: number;
  /** Total session length for endless mode. */
  durationMs: number | null;
  /** Correct answers required to pass. Null when the mode is score-attack. */
  goal: number | null;
  /** Mode that must be passed before this one unlocks. */
  requires: DifficultyId | null;
  /** Paint the answer-button labels in misleading inks. */
  mislabelButtons: boolean;
  /** Reshuffle the answer-button positions every round. */
  shuffleButtons: boolean;
  /** Clock penalty for a wrong answer or timeout in endless mode. */
  penaltyMs: number;
}

export const RULES: Record<DifficultyId, Rules> = {
  easy: {
    options: 3,
    rounds: 10,
    roundMs: 6000,
    durationMs: null,
    goal: 7,
    requires: null,
    mislabelButtons: false,
    shuffleButtons: false,
    penaltyMs: 0,
  },
  normal: {
    options: 6,
    rounds: 20,
    roundMs: 3000,
    durationMs: null,
    goal: 15,
    requires: "easy",
    mislabelButtons: false,
    shuffleButtons: false,
    penaltyMs: 0,
  },
  hard: {
    options: 9,
    rounds: 20,
    roundMs: 3000,
    durationMs: null,
    goal: 20,
    requires: "normal",
    mislabelButtons: false,
    shuffleButtons: false,
    penaltyMs: 0,
  },
  overload: {
    options: 9,
    rounds: null,
    roundMs: 3000,
    durationMs: 120_000,
    goal: null,
    requires: "hard",
    mislabelButtons: true,
    shuffleButtons: true,
    penaltyMs: 3000,
  },
};

/** Share of rounds where word and ink match, so players can't blindly reject the word. */
export const CONGRUENT_CHANCE = 0.15;

/** Pause after an answer before the next word: short after a hit, longer after a miss. */
export const PAUSE_AFTER_CORRECT_MS = 220;
export const PAUSE_AFTER_MISS_MS = 650;

/* ---------- randomness ---------- */

export type Rand = () => number;

/** Small, fast, seedable PRNG (mulberry32). Same seed → same sequence everywhere. */
export function seededRandom(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(arr: T[], rand: Rand): T =>
  arr[Math.floor(rand() * arr.length)];

function pickExcept<T>(arr: T[], rand: Rand, ...not: (T | undefined)[]): T {
  const pool = arr.filter((x) => !not.includes(x));
  return pick(pool.length ? pool : arr, rand);
}

function shuffle<T>(arr: T[], rand: Rand): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A shuffle of `arr` where no element stays matched to `against[i]`. */
function derange<T>(arr: T[], against: T[], rand: Rand): T[] {
  for (;;) {
    const a = shuffle(arr, rand);
    if (a.every((x, i) => x !== against[i])) return a;
  }
}

/* ---------- rounds ---------- */

export interface RoundSpec {
  /** The word that is written (and spoken). */
  word: ColorId;
  /** The ink the word is painted in: the correct answer. */
  ink: ColorId;
  /** Button order for this round (left→right, top→bottom). */
  order: ColorId[];
  /** Label ink per button (aligned with `order`) when the panel lies too, else null. */
  labelInks: ColorId[] | null;
}

export function makeRound(
  palette: ColorId[],
  prev: RoundSpec | null,
  opts: { shuffle: boolean; mislabel: boolean },
  rand: Rand,
): RoundSpec {
  // Avoid repeating the previous answer so every round demands a fresh read.
  const ink = pickExcept(palette, rand, prev?.ink);
  const congruent = rand() < CONGRUENT_CHANCE;
  const word = congruent ? ink : pickExcept(palette, rand, ink, prev?.word);
  const order = opts.shuffle ? shuffle(palette, rand) : palette;
  // Every ink is used exactly once across the panel, never on its own name.
  const labelInks = opts.mislabel ? derange(palette, order, rand) : null;
  return { word, ink, order, labelInks };
}

/* ---------- checking a ranked run ---------- */

/** One answer as sent by the game: the colour picked (null = too slow) and the reaction time. */
export interface SubmittedAnswer {
  p: ColorId | null;
  t: number;
}

/** Faster than this is not a human reading a colour. */
export const MIN_HUMAN_RT_MS = 150;
/** Timers in a busy or background tab can fire late. */
const LATE_TIMER_SLACK_MS = 2500;
const LATE_CLICK_SLACK_MS = 600;
/** Interval clock in endless mode ticks every 100 ms, plus scheduling jitter. */
const CLOCK_SLACK_MS = 1500;
const MAX_ANSWERS = 2000;

export type RunCheck =
  | { ok: true; score: number; avgRtMs: number; rounds: number }
  | { ok: false; reason: string };

/**
 * Replay a run from its seed and check every answer against what the game
 * would have shown. The score comes from this replay, never from the client.
 *
 * `wallMs` is the real time between the server issuing the run and receiving
 * the answers; a run can't be finished faster than its answers add up to.
 */
export function checkRun(
  mode: DifficultyId,
  seed: number,
  answers: unknown,
  wallMs: number,
): RunCheck {
  const rules = RULES[mode];
  if (!Array.isArray(answers)) return { ok: false, reason: "malformed answers" };
  if (answers.length > MAX_ANSWERS) return { ok: false, reason: "too many answers" };
  if (rules.rounds !== null && answers.length !== rules.rounds) {
    return { ok: false, reason: "incomplete run" };
  }

  const palette = paletteFor(rules.options);
  const rand = seededRandom(seed);
  const opts = { shuffle: rules.shuffleButtons, mislabel: rules.mislabelButtons };

  let prev: RoundSpec | null = null;
  let clock = 0; // endless mode: time used so far
  let penalties = 0;
  let busyMs = 0; // minimum real time the answers take
  let score = 0;
  let rtSum = 0;

  for (let i = 0; i < answers.length; i++) {
    const a = answers[i] as Partial<SubmittedAnswer> | null;
    if (!a || typeof a !== "object") return { ok: false, reason: `answer ${i + 1} malformed` };
    const { p, t } = a;
    if (typeof t !== "number" || !Number.isFinite(t)) {
      return { ok: false, reason: `answer ${i + 1} has no time` };
    }
    if (p !== null && !palette.includes(p as ColorId)) {
      return { ok: false, reason: `answer ${i + 1} is not a colour in this mode` };
    }

    const round = makeRound(palette, prev, opts, rand);
    prev = round;

    if (p === null) {
      if (t < rules.roundMs - 150 || t > rules.roundMs + LATE_TIMER_SLACK_MS) {
        return { ok: false, reason: `answer ${i + 1} timed out at an impossible time` };
      }
    } else if (t < MIN_HUMAN_RT_MS || t > rules.roundMs + LATE_CLICK_SLACK_MS) {
      return { ok: false, reason: `answer ${i + 1} has an impossible reaction time` };
    }

    const correct = p === round.ink;
    if (rules.durationMs !== null) {
      clock += t;
      const limit = rules.durationMs - penalties * rules.penaltyMs + CLOCK_SLACK_MS;
      if (clock > limit) return { ok: false, reason: "answers continue after time ran out" };
    }
    if (correct) {
      score++;
      rtSum += t;
    } else if (rules.penaltyMs > 0) {
      penalties++;
    }
    const pause = correct ? PAUSE_AFTER_CORRECT_MS : PAUSE_AFTER_MISS_MS;
    clock += pause;
    busyMs += t + pause;
  }

  if (wallMs < busyMs * 0.9 - 1000) {
    return { ok: false, reason: "finished faster than the answers allow" };
  }

  return {
    ok: true,
    score,
    avgRtMs: score ? Math.round(rtSum / score) : 0,
    rounds: answers.length,
  };
}
