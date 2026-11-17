"use client";

import type { DifficultyId } from "./difficulty";
import { getSupabase } from "./supabase";
import { takeTurnstileToken } from "./turnstile";
import type { RoundRecord } from "./trial";

/** A run issued by the server: its rounds come from `seed`. */
export interface RankedRun {
  runId: string;
  seed: number;
}

export type Submission =
  | { status: "pending" }
  | {
      status: "accepted";
      score: number;
      avgRtMs: number;
      isBest: boolean;
      rank: number | null;
      best: { score: number; avgRtMs: number } | null;
    }
  /** Passed the checks but waits for a manual look before reaching the board. */
  | { status: "held"; score: number; avgRtMs: number }
  | { status: "rejected"; reason: string }
  | { status: "error"; reason: string };

async function errorText(error: unknown): Promise<string> {
  // FunctionsHttpError carries the Response; our functions return { error }.
  const ctx = (error as { context?: unknown })?.context;
  if (ctx instanceof Response) {
    try {
      const body = (await ctx.clone().json()) as { error?: string };
      if (body?.error) return body.error;
    } catch {
      /* not JSON */
    }
  }
  return error instanceof Error ? error.message : "network error";
}

/**
 * Ask the server for a ranked run: passes the bot check, then gets a seed.
 * Resolves to null if anything fails, and the game runs unranked instead.
 */
export async function startRankedRun(
  mode: DifficultyId,
): Promise<RankedRun | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const token = await takeTurnstileToken();
  if (!token) {
    console.warn("[ranked] bot check unavailable; playing unranked");
    return null;
  }
  const { data, error } = await sb.functions.invoke<RankedRun>("start-run", {
    body: { mode, token },
  });
  if (error || !data) {
    console.warn("[ranked] start-run failed:", await errorText(error));
    return null;
  }
  return data;
}

export async function finishRankedRun(
  runId: string,
  records: RoundRecord[],
): Promise<Submission> {
  const sb = getSupabase();
  if (!sb) return { status: "error", reason: "accounts are off" };
  const answers = records.map((r) => ({ p: r.picked, t: Math.round(r.rt) }));
  const { data, error } = await sb.functions.invoke<Submission>("finish-run", {
    body: { runId, answers },
  });
  if (error || !data) {
    return { status: "error", reason: await errorText(error) };
  }
  return data;
}
