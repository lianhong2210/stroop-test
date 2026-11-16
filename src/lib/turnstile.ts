"use client";

/**
 * Cloudflare Turnstile, loaded only for signed-in players (the check runs
 * when a ranked run starts, as the privacy page says). The widget is created
 * once and kept warm: it fetches a token in the background, we spend it on
 * start-run, and it immediately fetches the next one.
 */

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
/** Checked by the start-run function. */
export const TURNSTILE_ACTION = "start-run";

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null;
let widgetId: string | null = null;
let token: string | null = null;
let waiters: ((t: string | null) => void)[] = [];

function loadScript(): Promise<TurnstileApi> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error("no turnstile"));
    s.onerror = () => reject(new Error("turnstile failed to load"));
    document.head.appendChild(s);
  });
  scriptPromise.catch(() => {
    scriptPromise = null; // allow a retry later (e.g. after going back online)
  });
  return scriptPromise;
}

function settle(t: string | null) {
  const w = waiters;
  waiters = [];
  w.forEach((fn) => fn(t));
}

async function ensureWidget(): Promise<TurnstileApi | null> {
  if (!SITE_KEY) return null;
  const api = await loadScript();
  if (widgetId) return api;
  const slot = document.createElement("div");
  slot.className = "turnstile-slot";
  document.body.appendChild(slot);
  widgetId = api.render(slot, {
    sitekey: SITE_KEY,
    action: TURNSTILE_ACTION,
    // Only ever visible if Cloudflare needs the player to click (Managed mode).
    appearance: "interaction-only",
    "refresh-expired": "auto",
    callback: (t: string) => {
      token = t;
      settle(t);
    },
    "expired-callback": () => {
      token = null;
    },
    "error-callback": () => {
      token = null;
      settle(null);
      return true; // handled: don't throw
    },
  });
  return api;
}

/** Start fetching a token in the background so a run can start instantly. */
export function warmTurnstile() {
  void ensureWidget().catch(() => {});
}

/** A fresh single-use token, or null if the check failed or took too long. */
export async function takeTurnstileToken(timeoutMs = 8000): Promise<string | null> {
  let api: TurnstileApi | null;
  try {
    api = await ensureWidget();
  } catch {
    return null;
  }
  if (!api || !widgetId) return null;
  const t =
    token ??
    (await new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => {
        waiters = waiters.filter((w) => w !== done);
        resolve(null);
      }, timeoutMs);
      const done = (v: string | null) => {
        clearTimeout(timer);
        resolve(v);
      };
      waiters.push(done);
    }));
  // Tokens are single-use: spend this one and start on the next.
  token = null;
  if (t) api.reset(widgetId);
  return t;
}
