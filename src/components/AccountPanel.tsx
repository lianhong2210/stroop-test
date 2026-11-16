"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  changeUsername,
  deleteAccount,
  signInWithGoogle,
  signOut,
  USERNAME_PATTERN,
  type AuthState,
} from "@/lib/auth";
import { googleButtonConfigured, mountGoogleButton } from "@/lib/googleSignIn";

interface Props {
  auth: AuthState;
  onClose: () => void;
}

export function AccountPanel({ auth, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const current = auth.status === "signed-in" ? (auth.profile?.username ?? "") : "";
  const [name, setName] = useState(current);
  const [lastCurrent, setLastCurrent] = useState(current);
  // The profile can arrive after the form opens: follow it until edited.
  if (current !== lastCurrent) {
    setLastCurrent(current);
    if (name === lastCurrent) setName(current);
  }

  // Google's own button (pop-up on this site). Falls back to the redirect
  // flow if it isn't configured or Google's script can't load.
  const googleRef = useRef<HTMLDivElement>(null);
  const [google, setGoogle] = useState<"loading" | "ready" | "failed">(() =>
    googleButtonConfigured() ? "loading" : "failed",
  );
  const signedOut = auth.status === "signed-out";
  useEffect(() => {
    const el = googleRef.current;
    if (!signedOut || !el) return;
    let alive = true;
    mountGoogleButton(
      el,
      (err) => {
        if (alive) setError(err);
      },
      Math.min(320, Math.max(200, el.parentElement?.clientWidth ?? 260)),
    ).then(
      () => alive && setGoogle("ready"),
      () => alive && setGoogle("failed"),
    );
    return () => {
      alive = false;
    };
  }, [signedOut]);

  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true);
    setError(null);
    setSaved(false);
    const err = await fn();
    setBusy(false);
    setError(err);
    return err;
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() === current) return;
    const err = await run(() => changeUsername(name));
    if (!err) setSaved(true);
  };

  const remove = async () => {
    if (
      !window.confirm(
        "Delete your account? Your username and leaderboard scores are removed for good. Progress saved on this device stays.",
      )
    ) {
      return;
    }
    const err = await run(deleteAccount);
    if (!err) onClose();
  };

  const valid = USERNAME_PATTERN.test(name.trim());

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={ref}
        className="modal paper"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h2 id="account-title">Subject file</h2>
            <p className="paper-meta">
              {auth.status === "signed-in"
                ? `Signed in as ${auth.user.email ?? "a Google account"}. Only you see this.`
                : "Sign in to put your scores on the leaderboard."}
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>
            [close]
          </button>
        </div>

        <hr />

        {auth.status === "signed-in" ? (
          <>
            <form className="account-form" onSubmit={save}>
              <label htmlFor="username">Name on the leaderboard</label>
              <div className="account-row">
                <input
                  id="username"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setSaved(false);
                  }}
                  maxLength={16}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={busy || !auth.profile}
                  aria-describedby="username-help"
                />
                <button
                  className="act"
                  type="submit"
                  disabled={busy || !valid || name.trim() === current}
                >
                  Save
                </button>
              </div>
              <small id="username-help">
                3–16 letters, numbers, _ or -. Everyone can see it.
              </small>
            </form>
            {saved && <p className="account-ok">Saved.</p>}
            {error && <p className="warn">{error}</p>}

            <hr />

            <div className="paper-actions">
              <button className="act" onClick={() => void signOut()} disabled={busy}>
                Sign out
              </button>
              <button
                className="act act-quiet act-danger"
                onClick={() => void remove()}
                disabled={busy}
              >
                Delete account
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="account-copy">
              Playing doesn&apos;t need an account. Signing in with Google
              ties your best scores to a name of your choosing, so they can
              appear on the leaderboard. Your email is never shown.{" "}
              <Link href="/privacy">Privacy</Link> ·{" "}
              <Link href="/terms">Terms</Link>
            </p>
            {error && <p className="warn">{error}</p>}
            <div className="paper-actions google-actions">
              {google !== "failed" && (
                <div ref={googleRef} className="google-btn" />
              )}
              {google === "loading" && (
                <span className="lb-status">
                  Loading Google sign-in
                  <span className="loading-cursor" aria-hidden>
                    ▍
                  </span>
                </span>
              )}
              {google === "failed" && (
                <button
                  className="act act-primary"
                  disabled={busy || auth.status === "loading"}
                  onClick={() => void run(signInWithGoogle)}
                >
                  Sign in with Google
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
