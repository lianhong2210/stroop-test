"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

/**
 * Google sends the player back here (via Supabase) with a one-time code.
 * Swap it for a session, then return to the game.
 */
export function AuthCallback() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fail = (msg: string) => setError(msg);

    const denied = params.get("error_description") ?? params.get("error");
    if (denied) return fail(denied);
    const code = params.get("code");
    const sb = getSupabase();
    if (!sb) return fail("Accounts aren't set up on this site.");
    if (!code) return fail("The sign-in link is missing its code.");

    let cancelled = false;
    sb.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (cancelled) return;
      if (error) fail(error.message);
      else window.location.replace("/");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="shell policy-shell">
      <div className="room-light" aria-hidden />
      <article className="paper policy" aria-live="polite">
        <h2>{error ? "Sign-in failed" : "Signing in"}</h2>
        <hr />
        {error ? (
          <>
            <p>{error}</p>
            <div className="paper-actions">
              <Link className="act" href="/">
                ◂ Back to the game
              </Link>
            </div>
          </>
        ) : (
          <p>
            Retrieving your file
            <span className="loading-cursor" aria-hidden>
              ▍
            </span>
          </p>
        )}
      </article>
      <div className="grain" aria-hidden />
      <div className="vignette" aria-hidden />
    </main>
  );
}
