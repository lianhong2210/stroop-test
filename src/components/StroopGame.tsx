"use client";

import { useCallback, useEffect, useState } from "react";
import { duckMusic, playScene, setMusicVolume, stopMusic, type Scene } from "@/lib/bgm";
import { pickLine, type Verdict } from "@/lib/narration";
import { DIFFICULTIES, nextUnlock, type DifficultyId } from "@/lib/difficulty";
import { progressStore, resetProgress } from "@/lib/progress";
import { settingsStore } from "@/lib/settings";
import { primeAudio, setMuted, setSfxEnabled, sfx } from "@/lib/sfx";
import {
  setSpeechMuted,
  silence,
  speakNarration,
  useVoices,
} from "@/lib/soundbot";
import { useStore } from "@/lib/store";
import type { GameResult } from "@/lib/trial";
import { Game } from "./Game";
import { Menu } from "./Menu";
import { Results, type ResultInfo } from "./Results";
import { SettingsPanel } from "./SettingsPanel";
import { SoundbotPanel } from "./SoundbotPanel";
import { SoundGate } from "./SoundGate";

type Screen = "menu" | "game" | "results";
type Modal = "settings" | "voice" | null;

export function StroopGame() {
  const progress = useStore(progressStore);
  const settings = useStore(settingsStore);
  const voices = useVoices();

  const [gate, setGate] = useState(true);
  const [audioReady, setAudioReady] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [screen, setScreen] = useState<Screen>("menu");
  const [mode, setMode] = useState<DifficultyId>("easy");
  const [runKey, setRunKey] = useState(0);
  const [result, setResult] = useState<ResultInfo | null>(null);
  const [freshUnlock, setFreshUnlock] = useState<DifficultyId | null>(null);
  const [modal, setModal] = useState<Modal>(null);

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

  const applyMute = (on: boolean) => {
    setMutedState(on);
    setMuted(on);
    setSpeechMuted(on);
  };

  const chooseSound = (on: boolean) => {
    // Audio setup must never trap the player on this screen: if the device
    // refuses (old browser, locked-down webview), carry on silently.
    try {
      primeAudio();
      applyMute(!on);
    } catch {
      setMutedState(true);
    }
    setAudioReady(true);
    setTimeout(() => setGate(false), 700);
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
        />
      )}

      {screen === "results" && result && (
        <Results
          info={result}
          onRetry={() => start(result.game.difficulty)}
          onMenu={toMenu}
          onPlay={start}
          onNarrate={narrate}
        />
      )}

      {modal === "settings" && (
        <SettingsPanel
          settings={settings}
          muted={muted}
          onUnmute={() => applyMute(false)}
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
        />
      )}

      {gate && <SoundGate onChoose={chooseSound} />}

      <div className="grain" aria-hidden />
      <div className="vignette" aria-hidden />
    </div>
  );
}
