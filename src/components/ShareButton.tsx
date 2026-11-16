"use client";

import { useEffect, useRef, useState } from "react";
import { SHARE_TEXT, SITE_TITLE, SITE_URL } from "@/lib/site";

type Status = "idle" | "copied" | "failed";

/**
 * Phones (and Safari) open the system share sheet: WhatsApp, Messages,
 * Telegram… Elsewhere the link is copied. Either way the receiving app shows
 * the preview image from opengraph-image.jpg.
 */
export function ShareButton() {
  const [status, setStatus] = useState<Status>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const flash = (s: Status) => {
    setStatus(s);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus("idle"), 2400);
  };

  const share = async () => {
    const data = { title: SITE_TITLE, text: SHARE_TEXT, url: SITE_URL };
    if (typeof navigator.share === "function" && navigator.canShare?.(data) !== false) {
      try {
        await navigator.share(data);
        return;
      } catch (e) {
        // Closing the share sheet isn't an error.
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${SHARE_TEXT} ${SITE_URL}`);
      flash("copied");
    } catch {
      flash("failed");
    }
  };

  return (
    <span className="share">
      <button className="act share-btn" onClick={() => void share()}>
        <svg
          className="share-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="18" cy="5" r="2.6" />
          <circle cx="6" cy="12" r="2.6" />
          <circle cx="18" cy="19" r="2.6" />
          <path d="M8.3 10.8 15.7 6.2M8.3 13.2l7.4 4.6" />
        </svg>
        Share
      </button>
      <span className="share-status" role="status">
        {status === "copied" && "link copied"}
        {status === "failed" && SITE_URL.replace("https://", "")}
      </span>
    </span>
  );
}
