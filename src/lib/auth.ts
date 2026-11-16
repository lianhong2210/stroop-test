"use client";

import type { User } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import { forgetProgressOwner } from "./progressSync";
import { getSupabase, supabaseConfigured } from "./supabase";

export interface Profile {
  id: string;
  username: string;
}

export type AuthState =
  /** No Supabase env vars: accounts are switched off. */
  | { status: "off"; user: null; profile: null }
  | { status: "loading"; user: null; profile: null }
  | { status: "signed-out"; user: null; profile: null }
  | { status: "signed-in"; user: User; profile: Profile | null };

const OFF: AuthState = { status: "off", user: null, profile: null };
const LOADING: AuthState = { status: "loading", user: null, profile: null };
const SIGNED_OUT: AuthState = { status: "signed-out", user: null, profile: null };

let state: AuthState = supabaseConfigured() ? LOADING : OFF;
const listeners = new Set<() => void>();
let started = false;

function set(next: AuthState) {
  state = next;
  listeners.forEach((l) => l());
}

async function loadProfile(user: User) {
  const sb = getSupabase();
  if (!sb) return;
  const { data } = await sb
    .from("profiles")
    .select("id, username")
    .eq("id", user.id)
    .maybeSingle();
  // Ignore if the player signed out (or switched) while this was loading.
  if (state.status === "signed-in" && state.user.id === user.id) {
    set({ status: "signed-in", user, profile: data ?? null });
  }
}

function start() {
  if (started) return;
  started = true;
  const sb = getSupabase();
  if (!sb) {
    set(OFF);
    return;
  }
  sb.auth.onAuthStateChange((_event, session) => {
    const user = session?.user ?? null;
    if (!user) {
      set(SIGNED_OUT);
      return;
    }
    const same = state.status === "signed-in" && state.user.id === user.id;
    set({ status: "signed-in", user, profile: same ? state.profile : null });
    // Don't call Supabase inside this callback (it can deadlock the client).
    if (!same) setTimeout(() => void loadProfile(user), 0);
  });
}

function subscribe(cb: () => void) {
  start();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getAuth(): AuthState {
  return state;
}

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribe, getAuth, () => LOADING);
}

/* ---------- actions ---------- */

export async function signInWithGoogle(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return "Accounts aren't set up on this site.";
  const { error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
  return error ? error.message : null;
}

export async function signOut() {
  await getSupabase()?.auth.signOut();
}

export const USERNAME_PATTERN = /^[A-Za-z0-9_-]{3,16}$/;

/** Returns an error message for the player, or null on success. */
export async function changeUsername(username: string): Promise<string | null> {
  const sb = getSupabase();
  const s = state;
  if (!sb || s.status !== "signed-in") return "Sign in first.";
  const name = username.trim();
  if (!USERNAME_PATTERN.test(name)) {
    return "Use 3–16 letters, numbers, _ or -.";
  }
  const { data, error } = await sb
    .from("profiles")
    .update({ username: name })
    .eq("id", s.user.id)
    .select("id, username")
    .single();
  if (error) {
    if (error.code === "23505") return "That name is taken.";
    if (error.code === "23514") return "Use 3–16 letters, numbers, _ or -.";
    return "Couldn't save. Try again.";
  }
  if (state.status === "signed-in" && state.user.id === s.user.id) {
    set({ ...state, profile: data });
  }
  return null;
}

/** Permanently deletes the account, its username, runs and scores. */
export async function deleteAccount(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb || state.status !== "signed-in") return "Sign in first.";
  const { error } = await sb.rpc("delete_my_account");
  if (error) return "Couldn't delete the account. Try again.";
  // Progress on this device stays, and counts as a guest's again.
  forgetProgressOwner();
  // The session belongs to a user that no longer exists; clear it locally.
  await sb.auth.signOut({ scope: "local" });
  return null;
}
