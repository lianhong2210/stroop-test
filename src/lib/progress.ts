"use client";

import { DIFFICULTIES, type DifficultyId } from "./difficulty";
import { createPersistentStore, isRecord } from "./store";

export interface Progress {
  /** Modes whose goal has been achieved at least once. */
  cleared: Record<DifficultyId, boolean>;
  /** Best correct-answer count per mode (Overload: best score). */
  best: Record<DifficultyId, number | null>;
}

export const DEFAULT_PROGRESS: Progress = {
  cleared: { easy: false, normal: false, hard: false, overload: false },
  best: { easy: null, normal: null, hard: null, overload: null },
};

export function sanitizeProgress(raw: unknown): Progress {
  const out: Progress = {
    cleared: { ...DEFAULT_PROGRESS.cleared },
    best: { ...DEFAULT_PROGRESS.best },
  };
  if (!isRecord(raw)) return out;
  const cleared = isRecord(raw.cleared) ? raw.cleared : {};
  const best = isRecord(raw.best) ? raw.best : {};
  for (const id of Object.keys(out.cleared) as DifficultyId[]) {
    out.cleared[id] = cleared[id] === true;
    const b = best[id];
    out.best[id] = typeof b === "number" && Number.isFinite(b) ? b : null;
  }
  return out;
}

export const progressStore = createPersistentStore<Progress>(
  "stroop.progress.v1",
  DEFAULT_PROGRESS,
  sanitizeProgress,
);

export function isUnlocked(progress: Progress, id: DifficultyId): boolean {
  const req = DIFFICULTIES[id].requires;
  return req === null || progress.cleared[req];
}

export function resetProgress() {
  progressStore.set(DEFAULT_PROGRESS);
}
