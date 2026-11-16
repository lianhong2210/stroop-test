"use client";

import { getSupabase } from "./supabase";

/**
 * "Sign in with Google" through Google Identity Services, on our own page.
 *
 * Google's pop-up names this site (not the Supabase project domain, which the
 * redirect flow shows). Google hands back a signed ID token, and Supabase
 * checks it with signInWithIdToken: same users, same sessions, same Google
 * provider settings as before.
 *
 * Needs NEXT_PUBLIC_GOOGLE_CLIENT_ID (the Web client ID from Google Cloud).
 * Without it, or if Google's script can't load, the account form falls back
 * to the redirect flow.
 */

// Trimmed: a value pasted into a dashboard with a trailing newline makes
// Google answer "The OAuth client was not found".
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
const SCRIPT_SRC = "https://accounts.google.com/gsi/client";

interface CredentialResponse {
  credential: string;
}

interface GoogleIdApi {
  initialize: (config: Record<string, unknown>) => void;
  renderButton: (el: HTMLElement, options: Record<string, unknown>) => void;
  cancel: () => void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdApi } };
  }
}

export function googleButtonConfigured(): boolean {
  return Boolean(CLIENT_ID);
}

let scriptPromise: Promise<GoogleIdApi> | null = null;

function loadScript(): Promise<GoogleIdApi> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<GoogleIdApi>((resolve, reject) => {
    const ready = () => window.google?.accounts?.id;
    const existing = ready();
    if (existing) return resolve(existing);
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => {
      const api = ready();
      if (api) resolve(api);
      else reject(new Error("Google sign-in didn't load"));
    };
    s.onerror = () => reject(new Error("Google sign-in is blocked or offline"));
    document.head.appendChild(s);
  });
  scriptPromise.catch(() => {
    scriptPromise = null; // allow another try next time the form opens
  });
  return scriptPromise;
}

/** A random one-time value; Google signs its hash into the token. */
function randomNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/**
 * Draw Google's sign-in button into `el`. When the player finishes in the
 * pop-up, the token goes to Supabase and `onDone` gets null (signed in; the
 * auth store updates by itself) or an error message.
 */
export async function mountGoogleButton(
  el: HTMLElement,
  onDone: (error: string | null) => void,
  width: number,
): Promise<void> {
  const sb = getSupabase();
  if (!CLIENT_ID || !sb) throw new Error("Google sign-in isn't configured");
  const api = await loadScript();

  // A fresh nonce for every time the form opens. Google gets the hash and
  // signs it into the token; Supabase gets the raw value and checks they
  // match, so a token captured elsewhere can't be replayed here.
  const nonce = randomNonce();
  const hashed = await sha256Hex(nonce);

  api.initialize({
    client_id: CLIENT_ID,
    nonce: hashed,
    ux_mode: "popup",
    context: "signin",
    auto_select: false,
    itp_support: true,
    use_fedcm_for_button: true,
    callback: async ({ credential }: CredentialResponse) => {
      const { error } = await sb.auth.signInWithIdToken({
        provider: "google",
        token: credential,
        nonce,
      });
      onDone(error ? error.message : null);
    },
  });
  el.replaceChildren();
  api.renderButton(el, {
    type: "standard",
    theme: "filled_black",
    size: "large",
    text: "signin_with",
    shape: "rectangular",
    logo_alignment: "left",
    width,
  });
}
