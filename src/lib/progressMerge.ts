import type { DifficultyId } from "./difficulty";
import type { Progress } from "./progress";

/*
 * Rules for combining the progress saved on this device with the progress
 * saved to an account. Pure functions, no I/O, so they're easy to test.
 *
 * `owner` is the account this device's progress was last synced with, or
 * null if it has only ever been played as a guest.
 */

const MODES: DifficultyId[] = ["easy", "normal", "hard", "overload"];

export function emptyProgress(): Progress {
  return {
    cleared: { easy: false, normal: false, hard: false, overload: false },
    best: { easy: null, normal: null, hard: null, overload: null },
  };
}

/** Everything unlocked in either, and the higher best of the two. */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const out = emptyProgress();
  for (const m of MODES) {
    out.cleared[m] = a.cleared[m] || b.cleared[m];
    const x = a.best[m];
    const y = b.best[m];
    out.best[m] = x === null ? y : y === null ? x : Math.max(x, y);
  }
  return out;
}

export function sameProgress(a: Progress, b: Progress): boolean {
  return MODES.every(
    (m) => a.cleared[m] === b.cleared[m] && a.best[m] === b.best[m],
  );
}

export interface SyncPlan {
  /** What this device should hold afterwards. */
  local: Progress;
  /** What to save to the account, or null if it's already right. */
  push: Progress | null;
}

/**
 * - Account has data, and this device was last synced with it: merge, so
 *   nothing earned on either side is lost (e.g. played after signing out).
 * - Account has data, and this device's progress is a guest's or someone
 *   else's: load the account's progress.
 * - Account has no data yet (first sign-in): a guest's progress becomes the
 *   account's. Another account's progress is not handed over; start empty.
 */
export function planSync(
  local: Progress,
  owner: string | null,
  remote: Progress | null,
  userId: string,
): SyncPlan {
  if (remote) {
    if (owner === userId) {
      const merged = mergeProgress(local, remote);
      return { local: merged, push: sameProgress(merged, remote) ? null : merged };
    }
    return { local: remote, push: null };
  }
  if (owner === null || owner === userId) return { local, push: local };
  const empty = emptyProgress();
  return { local: empty, push: empty };
}

/* ---------- database row shape ---------- */

export interface ProgressRow {
  cleared: string[];
  best: Record<string, number>;
}

export function toRow(p: Progress): ProgressRow {
  const best: Record<string, number> = {};
  for (const m of MODES) {
    const v = p.best[m];
    if (v !== null) best[m] = v;
  }
  return { cleared: MODES.filter((m) => p.cleared[m]), best };
}

export function fromRow(row: { cleared?: unknown; best?: unknown }): Progress {
  const out = emptyProgress();
  const cleared = Array.isArray(row.cleared) ? row.cleared : [];
  const best =
    row.best && typeof row.best === "object" && !Array.isArray(row.best)
      ? (row.best as Record<string, unknown>)
      : {};
  for (const m of MODES) {
    out.cleared[m] = cleared.includes(m);
    const v = best[m];
    out.best[m] =
      typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null;
  }
  return out;
}
