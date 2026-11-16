// finish-run: replay a ranked run from its seed, score it, keep the best.
//
// POST { runId: string, answers: { p: colour | null, t: ms }[] }
// → 200 { status: "accepted", score, avgRtMs, isBest, rank, best: { score, avgRtMs } | null }
// → 200 { status: "rejected", reason }
// → 400 / 401 / 404 / 409 { error }
//
// The score is whatever the replay says. The game's own count is never used.
import { adminClient, corsHeaders, json, readJson, requireUser } from "../_shared/http.ts";
import { checkRun, isDifficultyId } from "../_shared/stroop.ts";

/** A ranked run must be submitted within this long of being issued. */
const MAX_RUN_AGE_MS = 15 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const admin = adminClient();
  const user = await requireUser(req, admin);
  if (!user) return json({ error: "not signed in" }, 401);

  const body = await readJson(req);
  const runId = body?.runId;
  if (typeof runId !== "string" || !/^[0-9a-f-]{36}$/i.test(runId)) {
    return json({ error: "bad run id" }, 400);
  }

  const { data: run, error: loadError } = await admin
    .from("runs")
    .select("id, user_id, mode, seed, started_at, status")
    .eq("id", runId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (loadError) {
    console.error("finish-run load failed", loadError);
    return json({ error: "could not load the run" }, 500);
  }
  if (!run || !isDifficultyId(run.mode)) return json({ error: "run not found" }, 404);
  if (run.status !== "started") return json({ error: "run already submitted" }, 409);

  const wallMs = Date.now() - new Date(run.started_at).getTime();
  const check =
    wallMs > MAX_RUN_AGE_MS
      ? ({ ok: false, reason: "run expired" } as const)
      : checkRun(run.mode, Number(run.seed), body?.answers, wallMs);

  // Close the run exactly once, even if the same answers arrive twice.
  const { data: closed, error: closeError } = await admin
    .from("runs")
    .update(
      check.ok
        ? {
            status: "accepted",
            finished_at: new Date().toISOString(),
            score: check.score,
            avg_rt_ms: check.avgRtMs,
            answers: body?.answers,
          }
        : {
            status: "rejected",
            finished_at: new Date().toISOString(),
            reject_reason: check.reason,
          },
    )
    .eq("id", run.id)
    .eq("status", "started")
    .select("id");
  if (closeError) {
    console.error("finish-run close failed", closeError);
    return json({ error: "could not save the run" }, 500);
  }
  if (!closed?.length) return json({ error: "run already submitted" }, 409);

  if (!check.ok) return json({ status: "rejected", reason: check.reason });

  let isBest = false;
  if (check.score > 0) {
    const { data, error } = await admin.rpc("submit_best", {
      p_user: user.id,
      p_mode: run.mode,
      p_score: check.score,
      p_avg_rt_ms: check.avgRtMs,
      p_run: run.id,
    });
    if (error) console.error("submit_best failed", error);
    isBest = data === true;
  }

  const [{ data: rank }, { data: best }] = await Promise.all([
    admin.rpc("player_rank", { p_user: user.id, p_mode: run.mode }),
    admin
      .from("best_scores")
      .select("score, avg_rt_ms")
      .eq("user_id", user.id)
      .eq("mode", run.mode)
      .maybeSingle(),
  ]);

  return json({
    status: "accepted",
    score: check.score,
    avgRtMs: check.avgRtMs,
    isBest,
    rank: typeof rank === "number" ? rank : null,
    best: best ? { score: best.score, avgRtMs: best.avg_rt_ms } : null,
  });
});
