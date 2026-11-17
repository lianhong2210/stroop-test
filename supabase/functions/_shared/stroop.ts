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
  | {
      ok: true;
      score: number;
      avgRtMs: number;
      rounds: number;
      /** How human the run looks. Doesn't reject; finish-run decides what to do. */
      review: RunReview;
    }
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
  const played: PlayedRound[] = [];

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
    played.push({
      rt: t,
      outcome: p === null ? "timeout" : correct ? "correct" : "wrong",
      congruent: round.word === round.ink,
      pickedWord: p !== null && !correct && p === round.word,
    });
  }

  if (wallMs < busyMs * 0.9 - 1000) {
    return { ok: false, reason: "finished faster than the answers allow" };
  }

  return {
    ok: true,
    score,
    avgRtMs: score ? Math.round(rtSum / score) : 0,
    rounds: answers.length,
    review: reviewRun(mode, played),
  };
}

/* ---------- does the run look human? ---------- */
//
// The checks above reject runs that are impossible. These look for runs that
// are possible but unlike people: a script that reads the ink from the page
// and clicks after a delay passes every hard check, but it rarely plays like
// a person does. Each sign adds weight; finish-run holds a run for review
// when the total reaches REVIEW_THRESHOLD and the run would make the top of
// the board. Nothing here rejects a run on its own, so a real player who
// trips a sign gets reviewed, not punished.
//
// The limits are starting points. Every accepted run keeps its answers, so
// they can be tuned against real players later.

export interface PlayedRound {
  rt: number;
  outcome: "correct" | "wrong" | "timeout";
  /** Word and ink matched. */
  congruent: boolean;
  /** A wrong answer that picked the written (and spoken) word. */
  pickedWord: boolean;
}

export interface RunReview {
  /** Sum of the weights of the signs found. */
  suspicion: number;
  /** Short codes for the signs found, for the review queue. */
  flags: string[];
}

/** Hold a run for review at this much suspicion. */
export const REVIEW_THRESHOLD = 2;

/**
 * Median correct reaction time below which a run is "faster than people".
 * Set above what typical players reach, so it mostly catches the very top:
 * those are the runs worth a look, and a real player there just gets
 * approved.
 */
export const FAST_MEDIAN_MS: Record<DifficultyId, number> = {
  easy: 400,
  normal: 520,
  hard: 600,
  overload: 780,
};

/** Human reaction times vary: spread / mean is rarely under this. */
const MIN_HUMAN_CV = 0.1;
/** Enough correct answers to judge the spread and shape of reaction times. */
const MIN_FOR_SPREAD = 10;
const MIN_FOR_SHAPE = 30;
/** With this many, a missing slow tail is a strong sign rather than a hint. */
const MANY_FOR_SHAPE = 60;
/** Overload runs this long without a single miss are rare for people. */
const FLAWLESS_MIN_ROUNDS = 60;
/** Enough wrong answers on mismatched words to judge what kind of mistakes they are. */
const MIN_ERRORS_FOR_KIND = 8;

function median(xs: number[]): number {
  const s = xs.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function meanSd(xs: number[]): { mean: number; sd: number } {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / (xs.length - 1));
  return { mean, sd };
}

/** Sample skewness: human reaction times have a long slow tail (positive). */
function skewness(xs: number[]): number {
  const { mean, sd } = meanSd(xs);
  if (sd === 0) return 0;
  const n = xs.length;
  const m3 = xs.reduce((a, x) => a + ((x - mean) / sd) ** 3, 0);
  return (n / ((n - 1) * (n - 2))) * m3;
}

export function reviewRun(mode: DifficultyId, played: PlayedRound[]): RunReview {
  const flags: string[] = [];
  let suspicion = 0;
  const add = (flag: string, weight: number) => {
    flags.push(flag);
    suspicion += weight;
  };

  const correctRts = played.filter((r) => r.outcome === "correct").map((r) => r.rt);

  // Faster than people play this mode, judged on the middle answer so one
  // lucky click doesn't count.
  if (correctRts.length >= MIN_FOR_SPREAD && median(correctRts) < FAST_MEDIAN_MS[mode]) {
    add("fast", 2);
  }

  if (correctRts.length >= MIN_FOR_SPREAD) {
    const { mean, sd } = meanSd(correctRts);
    // A fixed or narrow delay: people are never this even.
    if (mean > 0 && sd / mean < MIN_HUMAN_CV) add("steady", 2);
  }

  // People's reaction times bunch up with a long slow tail. Delays drawn
  // evenly or symmetrically from a range don't have one.
  if (correctRts.length >= MANY_FOR_SHAPE && skewness(correctRts) < 0.2) {
    add("no-slow-tail", 2);
  } else if (correctRts.length >= MIN_FOR_SHAPE && skewness(correctRts) < 0) {
    add("no-slow-tail", 1);
  }

  // A long Overload run with no miss at all.
  const misses = played.filter((r) => r.outcome !== "correct").length;
  if (mode === "overload" && played.length >= FLAWLESS_MIN_ROUNDS && misses === 0) {
    add("flawless", 1);
  }

  // The Stroop effect shows in the mistakes: when people get a mismatched
  // word wrong, they usually pick the word they read and heard. Mistakes
  // that never pick the word look like they were thrown in on purpose.
  const wrongOnMismatch = played.filter((r) => r.outcome === "wrong" && !r.congruent);
  if (
    wrongOnMismatch.length >= MIN_ERRORS_FOR_KIND &&
    !wrongOnMismatch.some((r) => r.pickedWord)
  ) {
    add("random-mistakes", 1);
  }

  return { suspicion, flags };
}
