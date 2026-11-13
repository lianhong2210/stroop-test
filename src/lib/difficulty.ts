export type DifficultyId = "easy" | "normal" | "hard" | "overload";

export interface Difficulty {
  id: DifficultyId;
  label: string;
  codename: string;
  blurb: string;
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
  /** Hidden from the menu until unlocked. */
  hidden: boolean;
  /** Paint the answer-button labels in misleading inks. */
  mislabelButtons: boolean;
  /** Reshuffle the answer-button positions every round. */
  shuffleButtons: boolean;
  /** Clock penalty for a wrong answer or timeout in endless mode. */
  penaltyMs: number;
}

export const DIFFICULTIES: Record<DifficultyId, Difficulty> = {
  easy: {
    id: "easy",
    label: "Easy",
    codename: "PROTOCOL A",
    blurb: "Orientation. Three inks, generous timing.",
    options: 3,
    rounds: 10,
    roundMs: 6000,
    durationMs: null,
    goal: 7,
    requires: null,
    hidden: false,
    mislabelButtons: false,
    shuffleButtons: false,
    penaltyMs: 0,
  },
  normal: {
    id: "normal",
    label: "Normal",
    codename: "PROTOCOL B",
    blurb: "Six inks. Three seconds per stimulus.",
    options: 6,
    rounds: 20,
    roundMs: 3000,
    durationMs: null,
    goal: 15,
    requires: "easy",
    hidden: false,
    mislabelButtons: false,
    shuffleButtons: false,
    penaltyMs: 0,
  },
  hard: {
    id: "hard",
    label: "Hard",
    codename: "PROTOCOL C",
    blurb: "Nine inks. Zero tolerance for error.",
    options: 9,
    rounds: 20,
    roundMs: 3000,
    durationMs: null,
    goal: 20,
    requires: "normal",
    hidden: false,
    mislabelButtons: false,
    shuffleButtons: false,
    penaltyMs: 0,
  },
  overload: {
    id: "overload",
    label: "Overload",
    codename: "PROTOCOL Ω",
    blurb:
      "Two minutes, no round limit. The buttons move and lie. Every mistake costs 3 seconds.",
    options: 9,
    rounds: null,
    roundMs: 3000,
    durationMs: 120_000,
    goal: null,
    requires: "hard",
    hidden: true,
    mislabelButtons: true,
    shuffleButtons: true,
    penaltyMs: 3000,
  },
};

export const DIFFICULTY_ORDER: DifficultyId[] = [
  "easy",
  "normal",
  "hard",
  "overload",
];

/** Which mode a pass of `id` unlocks, if any. */
export function nextUnlock(id: DifficultyId): DifficultyId | null {
  return DIFFICULTY_ORDER.find((d) => DIFFICULTIES[d].requires === id) ?? null;
}

/** Share of rounds where word and ink match, so players can't blindly reject the word. */
export const CONGRUENT_CHANCE = 0.15;
