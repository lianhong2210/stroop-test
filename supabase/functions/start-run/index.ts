// start-run: check the player's Turnstile token, then issue a ranked run.
//
// POST { mode: "easy" | "normal" | "hard" | "overload", token: string }
// → 200 { runId, seed }
// → 400 / 401 / 403 / 429 { error }
//
// The seed decides every round of the run, so the server can replay it later
// in finish-run and score the answers itself.
//
// Banned players and players over the hourly limit get no run; the game then
// plays unranked. The limit stops a script from playing thousands of runs
// until one happens to look human.
import { adminClient, corsHeaders, json, readJson, requireUser } from "../_shared/http.ts";
import { isDifficultyId } from "../_shared/stroop.ts";

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
/** Must match the `action` the game sets on its Turnstile widget. */
const TURNSTILE_ACTION = "start-run";
/** Ranked runs one player may start per hour. A real player rarely gets near it. */
const RUNS_PER_HOUR = 60;

async function verifyTurnstile(token: string, ip: string | null): Promise<string | null> {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) return "server is missing TURNSTILE_SECRET_KEY";
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  const res = await fetch(SITEVERIFY, { method: "POST", body: form });
  if (!res.ok) return `turnstile siteverify returned ${res.status}`;
  const out = (await res.json()) as {
    success: boolean;
    action?: string;
    "error-codes"?: string[];
  };
  if (!out.success) return `bot check failed (${(out["error-codes"] ?? []).join(", ") || "unknown"})`;
  if (out.action && out.action !== TURNSTILE_ACTION) return "bot check was for another action";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const admin = adminClient();
  const user = await requireUser(req, admin);
  if (!user) return json({ error: "sign in to play ranked runs" }, 401);

  const body = await readJson(req);
  const mode = body?.mode;
  const token = body?.token;
  if (!isDifficultyId(mode)) return json({ error: "unknown mode" }, 400);
  if (typeof token !== "string" || !token || token.length > 4096) {
    return json({ error: "missing bot check token" }, 400);
  }

  // Cheap checks before asking Cloudflare.
  const [{ data: ban, error: banError }, { count, error: countError }] = await Promise.all([
    admin.from("banned_players").select("user_id").eq("user_id", user.id).maybeSingle(),
    admin
      .from("runs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("started_at", new Date(Date.now() - 60 * 60 * 1000).toISOString()),
  ]);
  if (banError || countError) {
    console.error("start-run checks failed", banError ?? countError);
    return json({ error: "could not start the run" }, 500);
  }
  if (ban) return json({ error: "ranked play is off for this account" }, 403);
  if ((count ?? 0) >= RUNS_PER_HOUR) {
    return json({ error: "too many ranked runs this hour; try again later" }, 429);
  }

  const ip =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    null;
  const failed = await verifyTurnstile(token, ip);
  if (failed) return json({ error: failed }, 403);

  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  const { data, error } = await admin
    .from("runs")
    .insert({ user_id: user.id, mode, seed })
    .select("id")
    .single();
  if (error || !data) {
    console.error("start-run insert failed", error);
    return json({ error: "could not start the run" }, 500);
  }

  return json({ runId: data.id, seed });
});
