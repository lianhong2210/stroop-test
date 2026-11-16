"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAuth, useAuth } from "@/lib/auth";
import { duckMusic, playScene, setMusicVolume, stopMusic, type Scene } from "@/lib/bgm";
import { pickLine, type Verdict } from "@/lib/narration";
import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  nextUnlock,
  type DifficultyId,
} from "@/lib/difficulty";
import { isUnlocked, progressStore, resetProgress } from "@/lib/progress";
import {
  finishRankedRun,
  startRankedRun,
  type RankedRun,
  type Submission,
} from "@/lib/ranked";
import { settingsStore } from "@/lib/settings";
import { rememberSoundChoice, soundChoiceStore } from "@/lib/soundChoice";
import { primeAudio, setMuted, setSfxEnabled, sfx } from "@/lib/sfx";
import {
  setSpeechMuted,
  silence,
  speakNarration,
  useVoices,
} from "@/lib/soundbot";
import { useStore } from "@/lib/store";
import type { GameResult } from "@/lib/trial";
import { warmTurnstile } from "@/lib/turnstile";
import { AccountPanel } from "./AccountPanel";
import { Game } from "./Game";
import { LeaderboardPanel } from "./LeaderboardPanel";
import { Menu } from "./Menu";
import { Results, type ResultInfo } from "./Results";
import { SettingsPanel } from "./SettingsPanel";
import { SoundbotPanel } from "./SoundbotPanel";
import { SoundGate } from "./SoundGate";

type Screen = "menu" | "game" | "results";
type Modal = "settings" | "voice" | "account" | "leaderboard" | null;

export function StroopGame() {
  const progress = useStore(progressStore);
  const settings = useStore(settingsStore);
  const voices = useVoices();
  const auth = useAuth();

  // The sound screen shows on a first visit, or once the remembered answer
  // has expired. Otherwise the saved answer is used straight away.
  const soundChoice = useStore(soundChoiceStore);
  const [gateClosing, setGateClosing] = useState(false);
  const gate = soundChoice === null || gateClosing;
  const [audioReady, setAudioReady] = useState(false);
  const [audioFailed, setAudioFailed] = useState(false);
  const muted = soundChoice?.on === false || audioFailed;
  const [screen, setScreen] = useState<Screen>("menu");
  const [mode, setMode] = useState<DifficultyId>("easy");
  const [runKey, setRunKey] = useState(0);
  const [result, setResult] = useState<ResultInfo | null>(null);
  const [freshUnlock, setFreshUnlock] = useState<DifficultyId | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [boardMode, setBoardMode] = useState<DifficultyId>("easy");
  /** Signed in: the server issuing this run's seed. */
  const [ranked, setRanked] = useState<Promise<RankedRun | null> | null>(null);
  /** Signed in: what the server made of the last finished run. */
  const [submission, setSubmission] = useState<Submission | null>(null);
  const submittingRun = useRef<string | null>(null);

  // Keep a bot-check token ready so ranked runs start without delay.
  useEffect(() => {
    if (auth.status === "signed-in") warmTurnstile();
  }, [auth.status]);

  // Leaderboard tabs: only modes this player can see, so it never gives away
  // a hidden mode.
  const boardModes = DIFFICULTY_ORDER.filter(
    (id) => !DIFFICULTIES[id].hidden || isUnlocked(progress, id),
  );
  // Opens on the given mode, else the hardest mode the player has unlocked.
  const openBoard = (mode?: DifficultyId) => {
    const unlocked = boardModes.filter((id) => isUnlocked(progress, id));
    setBoardMode(mode ?? unlocked.at(-1) ?? "easy");
    setModal("leaderboard");
  };

  useEffect(() => setSfxEnabled(settings.sfx), [settings.sfx]);

  // Every screen opens at the top. Browsers would otherwise restore the old
  // scroll position on reload, or carry it over from the previous screen.
  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  }, []);
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [screen]);
  useEffect(() => setMusicVolume(settings.musicVolume), [settings.musicVolume]);

  // Music: menu score on the menu, pass/fail score on results, silence in play.
  // Nothing plays until the player has answered the sound screen.
  const resultGood = result ? (result.passed ?? result.newBest) : false;
  const scene: Scene | null =
    !audioReady || muted || !settings.music
      ? null
      : screen === "menu"
        ? "menu"
        : screen === "results"
          ? resultGood
            ? "pass"
            : "fail"
          : null;
  useEffect(() => playScene(scene), [scene]);
  useEffect(() => () => stopMusic(), []);

  // The pre-paint hint from layout.tsx has done its job once React has read
  // the saved answer (that re-render is flushed synchronously, before any
  // timer). Drop it, so if React decides the screen is needed after all, the
  // screen can show. A timer rather than requestAnimationFrame, which never
  // fires in a background tab.
  useEffect(() => {
    const id = window.setTimeout(() =>
      document.documentElement.removeAttribute("data-sound"),
    );
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    setMuted(muted);
    setSpeechMuted(muted);
  }, [muted]);

  // Audio setup must never trap the player: if the device refuses (old
  // browser, locked-down webview), carry on silently.
  const unlockAudio = useCallback(() => {
    try {
      primeAudio();
    } catch {
      setAudioFailed(true);
    }
    setAudioReady(true);
  }, []);

  // A returning player skips the sound screen, so there was no tap to unlock
  // audio (browsers block it until the player interacts). Unlock on their
  // first tap or key press instead; the menu music starts then.
  useEffect(() => {
    if (gate || audioReady) return;
    const events = ["pointerup", "touchend", "click", "keydown"] as const;
    const opts = { capture: true } as const;
    events.forEach((e) => window.addEventListener(e, unlockAudio, opts));
    return () =>
      events.forEach((e) => window.removeEventListener(e, unlockAudio, opts));
  }, [gate, audioReady, unlockAudio]);

  const unmute = useCallback(() => {
    setAudioFailed(false);
    rememberSoundChoice(true);
  }, []);

  const chooseSound = (on: boolean) => {
    unlockAudio();
    setGateClosing(true);
    rememberSoundChoice(on);
    setTimeout(() => setGateClosing(false), 700);
  };

  const narrate = useCallback(
    (line: string) => {
      const s = settingsStore.get();
      if (!s.narrator) return;
      speakNarration(line, s.soundbot.volume, voices, {
        onStart: () => duckMusic(true),
        onEnd: () => duckMusic(false),
      });
    },
    [voices],
  );

  const start = useCallback((id: DifficultyId) => {
    primeAudio();
    sfx.ui();
    setModal(null);
    setSubmission(null);
    submittingRun.current = null;
    setRanked(
      getAuth().status === "signed-in"
        ? startRankedRun(id).catch(() => null)
        : null,
    );
    setMode(id);
    setRunKey((k) => k + 1);
    setScreen("game");
    setFreshUnlock((f) => (f === id ? null : f));
  }, []);

  const toMenu = useCallback(() => {
    silence();
    setScreen("menu");
  }, []);

  const finish = useCallback((game: GameResult) => {
    const id = game.difficulty;
    const d = DIFFICULTIES[id];
    const before = progressStore.get();
    const prevBest = before.best[id];
    const passed = d.goal === null ? null : game.correct >= d.goal;
    const newBest = prevBest === null || game.correct > prevBest;
    const unlocked = passed && !before.cleared[id] ? nextUnlock(id) : null;
    const verdict: Verdict =
      unlocked === "overload"
        ? "declassified"
        : passed === null
          ? newBest
            ? "record"
            : "logged"
          : passed
            ? "pass"
            : "fail";

    progressStore.set((p) => ({
      cleared: { ...p.cleared, [id]: p.cleared[id] || passed === true },
      best: { ...p.best, [id]: Math.max(p.best[id] ?? 0, game.correct) },
    }));

    if (unlocked) {
      setFreshUnlock(unlocked);
      setTimeout(() => sfx.unlock(), 700);
    }
    setResult({
      game,
      passed,
      unlocked,
      newBest,
      prevBest,
      endedAt: Date.now(),
      remark: pickLine(verdict),
    });
    setScreen("results");

    if (game.runId) {
      const runId = game.runId;
      submittingRun.current = runId;
      setSubmission({ status: "pending" });
      finishRankedRun(runId, game.records).then(
        (s) => submittingRun.current === runId && setSubmission(s),
        () =>
          submittingRun.current === runId &&
          setSubmission({ status: "error", reason: "network error" }),
      );
    }
  }, []);

  const closeModal = useCallback(() => setModal(null), []);

  const reset = () => {
    if (
      window.confirm("Erase all unlocks and best scores? This cannot be undone.")
    ) {
      resetProgress();
      setFreshUnlock(null);
    }
  };

  return (
    <div className={`shell ${screen === "game" ? "shell-game" : ""}`}>
      <div className="room-light" aria-hidden />
      {screen === "menu" && (
        <div className="tv" aria-hidden>
          <div className="tv-roll" />
          <div className="tv-static" />
          <div className="tv-tear" />
        </div>
      )}

      {screen === "menu" && (
        <Menu
          progress={progress}
          settings={settings}
          freshUnlock={freshUnlock}
          onStart={start}
          onOpenVoice={() => setModal("voice")}
          onOpenSettings={() => setModal("settings")}
          auth={auth}
          onOpenAccount={() => setModal("account")}
          onOpenLeaderboard={() => openBoard()}
        />
      )}

      {screen === "game" && (
        <Game
          key={runKey}
          difficulty={DIFFICULTIES[mode]}
          settings={settings}
          voices={voices}
          onFinish={finish}
          onAbort={toMenu}
          ranked={ranked}
        />
      )}

      {screen === "results" && result && (
        <Results
          info={result}
          onRetry={() => start(result.game.difficulty)}
          onMenu={toMenu}
          onPlay={start}
          onNarrate={narrate}
          auth={auth}
          submission={submission}
          onOpenLeaderboard={() => openBoard(result.game.difficulty)}
          onOpenAccount={() => setModal("account")}
        />
      )}

      {modal === "settings" && (
        <SettingsPanel
          settings={settings}
          muted={muted}
          onUnmute={unmute}
          onOpenVoice={() => setModal("voice")}
          onReset={reset}
          onClose={closeModal}
        />
      )}

      {modal === "voice" && (
        <SoundbotPanel
          settings={settings}
          voices={voices}
          onClose={closeModal}
          muted={muted}
          onUnmute={unmute}
        />
      )}

      {modal === "account" && <AccountPanel auth={auth} onClose={closeModal} />}

      {modal === "leaderboard" && (
        <LeaderboardPanel
          modes={boardModes}
          initialMode={boardMode}
          auth={auth}
          onOpenAccount={() => setModal("account")}
          onClose={closeModal}
        />
      )}

      {gate && <SoundGate onChoose={chooseSound} />}

      <div className="grain" aria-hidden />
      <div className="vignette" aria-hidden />
    </div>
  );
}
