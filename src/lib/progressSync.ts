"use client";

import { useSyncExternalStore } from "react";
import { progressStore } from "./progress";
import { fromRow, planSync, sameProgress, toRow } from "./progressMerge";
import { getSupabase } from "./supabase";

/**
 * Keeps this device's progress (unlocks, personal bests) and the signed-in
 * account's progress in step. The rules live in progressMerge.ts.
 */

/** Which account this device's progress was last synced with. */
const OWNER_KEY = "stroop.progress.owner.v1";

function readOwner(): string | null {
  try {
    return window.localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

function writeOwner(id: string | null) {
  try {
    if (id) window.localStorage.setItem(OWNER_KEY, id);
    else window.localStorage.removeItem(OWNER_KEY);
  } catch {
    /* storage unavailable */
  }
}

/**
 * After an account is deleted, what's on this device counts as a guest's
 * progress again, so it can carry over to a new account.
 */
export function forgetProgressOwner() {
  writeOwner(null);
}

/* ---------- sync status, for the menu's loading state ---------- */

interface SyncStatus {
  /** Account the latest sync was for. */
  forUser: string | null;
  busy: boolean;
}

let status: SyncStatus = { forUser: null, busy: false };
const listeners = new Set<() => void>();
function setStatus(next: SyncStatus) {
  status = next;
  listeners.forEach((l) => l());
}

const SERVER_STATUS: SyncStatus = { forUser: null, busy: false };

export function useProgressSync(): SyncStatus {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => status,
    () => SERVER_STATUS,
  );
}

/** Stop showing the loading state if the account takes longer than this. */
const SYNC_TIMEOUT_MS = 5000;

async function push(userId: string, progress: ReturnType<typeof progressStore.get>) {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb
    .from("progress")
    .upsert({ user_id: userId, ...toRow(progress), updated_at: new Date().toISOString() });
  if (error) console.warn("[progress] save failed:", error.message);
}

/**
 * Sync once for this account, then save every later change to it.
 * Returns a function that stops syncing (on sign-out or account switch).
 */
export function attachProgressSync(userId: string): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};

  let stopped = false;
  let applying = false;
  let synced = false;

  setStatus({ forUser: userId, busy: true });
  const giveUp = setTimeout(() => {
    if (!stopped) setStatus({ forUser: userId, busy: false });
  }, SYNC_TIMEOUT_MS);

  void (async () => {
    try {
      const { data, error } = await sb
        .from("progress")
        .select("cleared, best")
        .eq("user_id", userId)
        .maybeSingle();
      if (stopped) return;
      if (error) throw error;

      const local = progressStore.get();
      const plan = planSync(local, readOwner(), data ? fromRow(data) : null, userId);
      if (!sameProgress(plan.local, local)) {
        applying = true;
        progressStore.set(plan.local);
        applying = false;
      }
      writeOwner(userId);
      synced = true;
      if (plan.push) await push(userId, plan.push);
    } catch (e) {
      console.warn("[progress] sync failed:", e);
    } finally {
      clearTimeout(giveUp);
      if (!stopped) setStatus({ forUser: userId, busy: false });
    }
  })();

  // Progress only changes when a run ends or is erased, so save each change
  // straight away.
  const unsubscribe = progressStore.subscribe(() => {
    if (applying || !synced || stopped) return;
    void push(userId, progressStore.get());
  });

  return () => {
    stopped = true;
    unsubscribe();
    clearTimeout(giveUp);
    setStatus({ forUser: null, busy: false });
  };
}
