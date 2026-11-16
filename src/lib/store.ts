"use client";

import { useSyncExternalStore } from "react";

export interface PersistentStore<T> {
  subscribe: (listener: () => void) => () => void;
  get: () => T;
  getServer: () => T;
  set: (next: T | ((prev: T) => T)) => void;
}

/**
 * Tiny localStorage-backed store. Reads are lazy and cached, so the snapshot
 * stays referentially stable for useSyncExternalStore; storage failures
 * (private mode, blocked site data) fall back to in-memory state.
 */
export function createPersistentStore<T>(
  key: string,
  fallback: T,
  sanitize: (raw: unknown) => T,
): PersistentStore<T> {
  let value: T | undefined;
  const listeners = new Set<() => void>();

  const read = (): T => {
    if (value === undefined) {
      try {
        const raw = window.localStorage.getItem(key);
        value = raw ? sanitize(JSON.parse(raw)) : fallback;
      } catch {
        value = fallback;
      }
    }
    return value;
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get: read,
    getServer: () => fallback,
    set(next) {
      value =
        typeof next === "function"
          ? (next as (prev: T) => T)(read())
          : next;
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* storage unavailable: keep in-memory value */
      }
      listeners.forEach((l) => l());
    },
  };
}

export function useStore<T>(store: PersistentStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.getServer);
}

const noopSubscribe = () => () => {};

/**
 * False in the static HTML and during hydration, true once the page runs in
 * the browser and saved data (localStorage) can be read. Use it to show a
 * loading state instead of defaults that would flip a moment later.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
