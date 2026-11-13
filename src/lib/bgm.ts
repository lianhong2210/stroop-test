"use client";

/**
 * Generative horror score. Nothing is pre-recorded; three scenes are
 * synthesised live with Web Audio:
 *
 *  - menu: detuned drone, broken music box, scattered events
 *          (heartbeat, metal scrape, distant clank, breath, sub boom)
 *  - pass: a warm-but-wrong lullaby over a slow major pad
 *  - fail: a collapsing chord, then a dissonant pad and a slow heartbeat
 *
 * Only one scene plays at a time; switching crossfades.
 */

import { audio } from "./sfx";

export type Scene = "menu" | "pass" | "fail";

interface Running {
  scene: Scene;
  bus: GainNode;
  ctx: AudioContext;
  stop: () => void;
}

let running: Running | null = null;
let volume = 0.7;
let ducked = false;
const LEVEL = 0.9;
const DUCK = 0.35;

const target = () => Math.max(0.0001, volume * LEVEL * (ducked ? DUCK : 1));

function applyLevel(timeConstant = 0.15) {
  if (!running) return;
  const { bus, ctx } = running;
  bus.gain.cancelScheduledValues(ctx.currentTime);
  bus.gain.setTargetAtTime(target(), ctx.currentTime, timeConstant);
}

export function setMusicVolume(v: number) {
  volume = v;
  applyLevel();
}

/** Lower the music while the narrator speaks. */
export function duckMusic(on: boolean) {
  ducked = on;
  applyLevel(on ? 0.08 : 0.4);
}

/** Start `scene` (crossfading from whatever plays), or stop with null. */
export function playScene(scene: Scene | null) {
  if (running?.scene === scene) return;
  running?.stop();
  running = null;
  if (scene) running = SCENES[scene]();
}

export function stopMusic() {
  playScene(null);
}

/* ---------- shared building blocks ---------- */

const NOTE: Record<string, number> = {
  A2: 110, E3: 164.81, "C#4": 277.18,
  "G#4": 415.3, A4: 440, B4: 493.88, C5: 523.25, "C#5": 554.37,
  D5: 587.33, "D#5": 622.25, E5: 659.25, F5: 698.46, "F#5": 739.99,
  A5: 880,
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function reverb(c: AudioContext, seconds = 3.6, decay = 2.4) {
  const len = Math.floor(c.sampleRate * seconds);
  const ir = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  const conv = c.createConvolver();
  conv.buffer = ir;
  return conv;
}

function noiseBuffer(c: AudioContext, seconds = 3) {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

/** Bus, reverb, timers and source tracking shared by every scene. */
function rig(scene: Scene, fadeIn: number) {
  const a = audio();
  if (!a) return null;
  const c = a.ctx;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const sources = new Set<AudioScheduledSourceNode>();
  let alive = true;

  const bus = c.createGain();
  bus.gain.setValueAtTime(0.0001, c.currentTime);
  bus.gain.exponentialRampToValueAtTime(target(), c.currentTime + fadeIn);
  bus.connect(a.out);

  const verb = reverb(c);
  const wet = c.createGain();
  wet.gain.value = 0.7;
  verb.connect(wet).connect(bus);
  const dry = c.createGain();
  dry.gain.value = 0.75;
  dry.connect(bus);

  const later = (fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      timers.delete(t);
      if (alive) fn();
    }, ms);
    timers.add(t);
  };
  const track = <T extends AudioScheduledSourceNode>(n: T) => {
    sources.add(n);
    n.onended = () => sources.delete(n);
    return n;
  };
  const panner = (pan: number) => {
    const p = c.createStereoPanner();
    p.pan.value = pan;
    return p;
  };

  const handle: Running = {
    scene,
    bus,
    ctx: c,
    stop() {
      alive = false;
      timers.forEach(clearTimeout);
      timers.clear();
      const t = c.currentTime;
      bus.gain.cancelScheduledValues(t);
      bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), t);
      bus.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      sources.forEach((s) => {
        try {
          s.stop(t + 1.3);
        } catch {
          /* already stopped */
        }
      });
      setTimeout(() => bus.disconnect(), 1500);
    },
  };

  return { c, bus, verb, dry, noise: noiseBuffer(c), later, track, panner, handle };
}

type Rig = NonNullable<ReturnType<typeof rig>>;

/** Music-box tine: fundamental, octave and a bright inharmonic partial. */
function boxNote(r: Rig, freq: number, t: number, gain = 0.07, decay = 2.2) {
  const { c, verb, dry, track } = r;
  const detune = rand(-18, 18);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  g.connect(verb);
  const gDry = c.createGain();
  gDry.gain.value = 0.35;
  g.connect(gDry).connect(dry);
  for (const [mult, lvl] of [
    [1, 1],
    [2.01, 0.35],
    [4.2, 0.08],
  ]) {
    const o = track(c.createOscillator());
    o.type = "sine";
    o.frequency.value = freq * mult;
    o.detune.value = detune;
    const og = c.createGain();
    og.gain.value = lvl;
    o.connect(og).connect(g);
    o.start(t);
    o.stop(t + decay + 0.1);
  }
}

/** Slow-attack pad chord through a low-pass filter. */
function pad(
  r: Rig,
  freqs: number[],
  t: number,
  dur: number,
  level = 0.03,
  type: OscillatorType = "triangle",
  cutoff = 1200,
) {
  const { c, verb, dry, track } = r;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = cutoff;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(level, t + Math.min(1.6, dur / 3));
  g.gain.setValueAtTime(level, t + dur - 1.8);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  lp.connect(g);
  g.connect(verb);
  g.connect(dry);
  for (const f of freqs) {
    for (const cents of [-7, 7]) {
      const o = track(c.createOscillator());
      o.type = type;
      o.frequency.value = f;
      o.detune.value = cents;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }
}

function heartbeatAt(r: Rig, t: number, lvl = 0.5) {
  const { c, dry, track } = r;
  for (const [off, l] of [
    [0, lvl],
    [0.24, lvl * 0.65],
  ]) {
    const o = track(c.createOscillator());
    const g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(62, t + off);
    o.frequency.exponentialRampToValueAtTime(34, t + off + 0.16);
    g.gain.setValueAtTime(0.0001, t + off);
    g.gain.exponentialRampToValueAtTime(l, t + off + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.22);
    o.connect(g).connect(dry);
    o.start(t + off);
    o.stop(t + off + 0.25);
  }
}

function boom(r: Rig, t: number, level = 0.5) {
  const { c, dry, verb, track } = r;
  const o = track(c.createOscillator());
  const g = c.createGain();
  o.frequency.setValueAtTime(52, t);
  o.frequency.exponentialRampToValueAtTime(26, t + 2.4);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(level, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
  o.connect(g);
  g.connect(dry);
  g.connect(verb);
  o.start(t);
  o.stop(t + 2.7);
}

function clank(r: Rig, t: number) {
  const { c, verb, track, panner } = r;
  const g = c.createGain();
  g.gain.value = 0.05;
  g.connect(panner(rand(-1, 1))).connect(verb);
  for (const f of [311, 734, 1187, 1789, 2633]) {
    const o = track(c.createOscillator());
    const og = c.createGain();
    o.frequency.value = f * rand(0.97, 1.03);
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(1, t + 0.004);
    og.gain.exponentialRampToValueAtTime(0.0001, t + rand(0.6, 1.4));
    o.connect(og).connect(g);
    o.start(t);
    o.stop(t + 1.5);
  }
}

function scrape(r: Rig, t: number) {
  const { c, verb, noise, track, panner } = r;
  const dur = rand(1.4, 2.6);
  const src = track(c.createBufferSource());
  src.buffer = noise;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 22;
  const up = Math.random() < 0.5;
  bp.frequency.setValueAtTime(up ? 700 : 2600, t);
  bp.frequency.exponentialRampToValueAtTime(up ? 2400 : 650, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5, t + dur * 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp).connect(g).connect(panner(rand(-0.8, 0.8))).connect(verb);
  src.start(t);
  src.stop(t + dur);
}

function breath(r: Rig, t: number) {
  const { c, dry, noise, track, panner } = r;
  const src = track(c.createBufferSource());
  src.buffer = noise;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = rand(900, 1600);
  bp.Q.value = 1.4;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.12, t + 0.9);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 2);
  src.connect(bp).connect(g).connect(panner(rand(-1, 1))).connect(dry);
  src.start(t);
  src.stop(t + 2.1);
}

/** Low detuned drone with a breathing filter. `tritone` adds the "wrong" interval. */
function drone(r: Rig, tritone: boolean, level = 0.1) {
  const { c, verb, dry, track } = r;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 240;
  lp.Q.value = 5;
  const g = c.createGain();
  g.gain.value = level;
  lp.connect(g);
  g.connect(dry);
  g.connect(verb);
  const voices: [number, OscillatorType][] = [
    [55, "sawtooth"],
    [55.3, "sawtooth"],
    [tritone ? 77.78 : 82.41, "triangle"],
    [110.4, "sine"],
  ];
  for (const [f, type] of voices) {
    const o = track(c.createOscillator());
    o.type = type;
    o.frequency.value = f;
    o.connect(lp);
    o.start();
  }
  const lfo = track(c.createOscillator());
  lfo.frequency.value = 0.045;
  const lfoAmt = c.createGain();
  lfoAmt.gain.value = 150;
  lfo.connect(lfoAmt).connect(lp.frequency);
  lfo.start();
  const swell = track(c.createOscillator());
  swell.frequency.value = 0.06;
  const swellAmt = c.createGain();
  swellAmt.gain.value = level * 0.45;
  swell.connect(swellAmt).connect(g.gain);
  swell.start();
}

/* ---------- scenes ---------- */

/* An original, deliberately unresolved lullaby fragment. */
const MENU_MOTIF: (string | null)[] = [
  "A4", "C5", "E5", "D#5", null, "C5", "B4", "G#4", null, null,
  "A4", "E5", "F5", "E5", "D#5", null, "B4", "C5", "A4",
];

function menuScene(): Running | null {
  // Short fade-in so the room is audible the moment the player clicks.
  const r = rig("menu", 0.6);
  if (!r) return null;
  const { c, later } = r;

  drone(r, true);
  // An immediate opening hit: the door closes behind you.
  boom(r, c.currentTime + 0.05, 0.45);
  clank(r, c.currentTime + 0.35);

  const playMotif = () => {
    let t = c.currentTime + 0.1;
    const step = rand(0.5, 0.62);
    const sag = Math.random() < 0.4; // the mechanism winding down
    MENU_MOTIF.forEach((n, i) => {
      const drift = sag ? Math.pow(0.985, Math.max(0, i - 10)) : 1;
      t += step * (sag ? 1 + Math.max(0, i - 10) * 0.08 : 1) + rand(-0.03, 0.05);
      if (n && Math.random() > 0.06) boxNote(r, NOTE[n] * drift, t);
    });
    later(playMotif, rand(22, 34) * 1000);
  };
  later(playMotif, 1200);

  const heartbeat = () => {
    const beats = Math.floor(rand(6, 11));
    let t = c.currentTime + 0.05;
    let gap = 1.15;
    for (let i = 0; i < beats; i++) {
      heartbeatAt(r, t, 0.55 * (0.5 + i / beats / 2));
      t += gap;
      gap *= 0.96;
    }
  };
  const events = [
    heartbeat,
    () => scrape(r, c.currentTime + 0.05),
    () => scrape(r, c.currentTime + 0.05),
    () => clank(r, c.currentTime + 0.05),
    () => clank(r, c.currentTime + 0.05),
    () => breath(r, c.currentTime + 0.05),
    () => breath(r, c.currentTime + 0.05),
    () => boom(r, c.currentTime + 0.05),
  ];
  const scatter = () => {
    events[Math.floor(Math.random() * events.length)]();
    later(scatter, rand(5, 12) * 1000);
  };
  later(scatter, 4000);

  return r.handle;
}

/* Major, gentle, and slightly off: praise from someone you shouldn't trust. */
const PASS_MOTIF: (string | null)[] = [
  "E5", "C#5", "A4", "C#5", "E5", null, "F#5", "E5", "C#5", null,
  "D5", "C#5", "B4", "A4", null, "B4", "C5", "A4",
];

function passScene(): Running | null {
  const r = rig("pass", 0.4);
  if (!r) return null;
  const { c, later } = r;

  drone(r, false, 0.06);
  // A bright chime as the result lands.
  [880, 1108.73, 1318.51].forEach((f, i) =>
    boxNote(r, f, c.currentTime + 0.05 + i * 0.07, 0.06, 3),
  );

  const cycle = () => {
    const t0 = c.currentTime + 0.1;
    pad(r, [NOTE.A2, NOTE.E3, NOTE["C#4"]], t0, 7.5, 0.028);
    // The borrowed minor chord is the "something's wrong" moment.
    pad(r, [87.31, 130.81, 261.63], t0 + 7, 6.5, 0.026);
    let t = t0 + 0.6;
    const step = 0.62;
    PASS_MOTIF.forEach((n) => {
      t += step + rand(-0.02, 0.04);
      if (n) boxNote(r, NOTE[n], t, 0.065, 2.6);
    });
    later(cycle, 14_000);
  };
  cycle();

  return r.handle;
}

function failScene(): Running | null {
  const r = rig("fail", 0.15);
  if (!r) return null;
  const { c, later, track, verb, dry } = r;
  const t0 = c.currentTime + 0.05;

  // A minor chord that collapses: every voice slides down a few semitones.
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(1800, t0);
  lp.frequency.exponentialRampToValueAtTime(180, t0 + 3.2);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.09, t0 + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.6);
  lp.connect(g);
  g.connect(dry);
  g.connect(verb);
  for (const f of [146.83, 174.61, 220, 293.66]) {
    for (const cents of [-9, 9]) {
      const o = track(c.createOscillator());
      o.type = "sawtooth";
      o.frequency.setValueAtTime(f, t0);
      o.frequency.exponentialRampToValueAtTime(f * 0.7, t0 + 3.2);
      o.detune.value = cents;
      o.connect(lp);
      o.start(t0);
      o.stop(t0 + 3.7);
    }
  }
  boom(r, t0, 0.6);

  // What remains: a low, dissonant hum and a slow pulse.
  later(() => {
    drone(r, true, 0.08);
    const sustain = () => {
      const t = c.currentTime + 0.1;
      pad(r, [233.08, 246.94, 349.23], t, 12, 0.014, "sine", 900);
      later(sustain, 11_000);
    };
    sustain();
    const pulse = () => {
      heartbeatAt(r, c.currentTime + 0.05, 0.4);
      later(pulse, 1550);
    };
    pulse();
    const creak = () => {
      if (Math.random() < 0.5) scrape(r, c.currentTime + 0.05);
      else breath(r, c.currentTime + 0.05);
      later(creak, rand(7, 13) * 1000);
    };
    later(creak, 5000);
  }, 2200);

  return r.handle;
}

const SCENES: Record<Scene, () => Running | null> = {
  menu: menuScene,
  pass: passScene,
  fail: failScene,
};
