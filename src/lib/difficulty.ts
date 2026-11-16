import { RULES, type DifficultyId, type Rules } from "@shared/stroop";

// Rules (rounds, timings, pass marks) are shared with the server, which
// replays ranked runs with them. Only presentation lives here.
export { CONGRUENT_CHANCE, type DifficultyId } from "@shared/stroop";

export interface Difficulty extends Rules {
  id: DifficultyId;
  label: string;
  codename: string;
  blurb: string;
  /** Hidden from the menu until unlocked. */
  hidden: boolean;
}

const TEXT: Record<
  DifficultyId,
  Pick<Difficulty, "label" | "codename" | "blurb" | "hidden">
> = {
  easy: {
    label: "Easy",
    codename: "PROTOCOL A",
    blurb: "Orientation. Three inks, generous timing.",
    hidden: false,
  },
  normal: {
    label: "Normal",
    codename: "PROTOCOL B",
    blurb: "Six inks. Three seconds per stimulus.",
    hidden: false,
  },
  hard: {
    label: "Hard",
    codename: "PROTOCOL C",
    blurb: "Nine inks. Zero tolerance for error.",
    hidden: false,
  },
  overload: {
    label: "Overload",
    codename: "PROTOCOL Ω",
    blurb:
      "Two minutes, no round limit. The buttons move and lie. Every mistake costs 3 seconds.",
    hidden: true,
  },
};

export const DIFFICULTY_ORDER: DifficultyId[] = [
  "easy",
  "normal",
  "hard",
  "overload",
];

export const DIFFICULTIES = Object.fromEntries(
  DIFFICULTY_ORDER.map((id) => [id, { id, ...RULES[id], ...TEXT[id] }]),
) as Record<DifficultyId, Difficulty>;

/** Which mode a pass of `id` unlocks, if any. */
export function nextUnlock(id: DifficultyId): DifficultyId | null {
  return DIFFICULTY_ORDER.find((d) => DIFFICULTIES[d].requires === id) ?? null;
}
