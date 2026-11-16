"use client";

import { useState } from "react";
import { SITE_NAME } from "@/lib/site";

interface Props {
  onChoose: (soundOn: boolean) => void;
}

/**
 * Shown on a first visit, and again once the remembered answer expires
 * (see soundChoice.ts). Browsers block audio until the player interacts, so
 * this click is also what unlocks the music, effects and voice.
 */
export function SoundGate({ onChoose }: Props) {
  const [leaving, setLeaving] = useState(false);

  const choose = (on: boolean) => {
    if (leaving) return;
    setLeaving(true);
    onChoose(on);
  };

  return (
    <div
      className={`gate ${leaving ? "is-leaving" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="gate-title"
    >
      <div className="gate-inner">
        {/* The app's name in plain, readable type on the first screen a
            visitor sees. Google's brand check looks for it (the big STROOP
            logo is masked and split into coloured pieces, so it can't). */}
        <p className="gate-brand">{SITE_NAME}</p>
        <svg
          className="gate-icon"
          viewBox="0 0 64 64"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          aria-hidden
        >
          <path d="M12 38v-6a20 20 0 0 1 40 0v6" />
          <rect x="8" y="37" width="11" height="18" rx="3" />
          <rect x="45" y="37" width="11" height="18" rx="3" />
        </svg>
        <h1 id="gate-title">This test speaks to you</h1>
        <p>
          A voice reads every word aloud to throw you off, and the room is
          never quite silent. Play with sound on, and wear headphones if you
          can.
        </p>
        <div className="gate-actions">
          <button
            className="act act-primary"
            autoFocus
            onClick={() => choose(true)}
          >
            Turn on sound
          </button>
          <button className="act act-quiet" onClick={() => choose(false)}>
            Continue without sound
          </button>
        </div>
      </div>
    </div>
  );
}
