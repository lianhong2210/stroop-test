"use client";

import type { DifficultyId } from "./difficulty";
import { getSupabase } from "./supabase";

export interface LeaderRow {
  rank: number;
  username: string;
  score: number;
  avgRtMs: number;
  isMe: boolean;
}

export interface Leaderboard {
  /** Top entries, best first. */
  top: LeaderRow[];
  /** The signed-in player's row when they're outside the top. */
  me: LeaderRow | null;
  /** Players with a score in this mode. */
  total: number;
}

export const LEADERBOARD_SIZE = 5;

export async function fetchLeaderboard(
  mode: DifficultyId,
): Promise<Leaderboard> {
  const sb = getSupabase();
  if (!sb) throw new Error("accounts are off");
  const { data, error } = await sb.rpc("get_leaderboard", {
    p_mode: mode,
    p_limit: LEADERBOARD_SIZE,
  });
  if (error) throw error;
  const rows = (
    (data ?? []) as {
      rank: number;
      username: string;
      score: number;
      avg_rt_ms: number;
      is_me: boolean;
      total: number;
    }[]
  ).map((r) => ({
    rank: r.rank,
    username: r.username,
    score: r.score,
    avgRtMs: r.avg_rt_ms,
    isMe: r.is_me,
    total: r.total,
  }));
  const top = rows.filter((r) => r.rank <= LEADERBOARD_SIZE);
  const me = rows.find((r) => r.isMe && r.rank > LEADERBOARD_SIZE) ?? null;
  return { top, me, total: rows[0]?.total ?? 0 };
}
