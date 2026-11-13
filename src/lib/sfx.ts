"use client";

/**
 * Procedural sound effects (Web Audio). No audio files to load; every cue is
 * synthesised on demand. The context is created lazily on the first user
 * gesture so browsers' autoplay policies are satisfied.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
let muted = false;
const MASTER = 0.55;
let drone: { stop: () => void } | null = null;

export function audio(): { ctx: AudioContext; out: GainNode } | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return { ctx, out: master! };
}

export function setSfxEnabled(on: boolean) {
  enabled = on;
  if (!on) stopDrone();
}

/** Session-wide mute: silences effects, ambience and music together. */
export function setMuted(on: boolean) {
  muted = on;
  if (master && ctx) master.gain.setTargetAtTime(on ? 0 : MASTER, ctx.currentTime, 0.05);
}

/** Call from a click handler to unlock audio on iOS/Safari. */
export function primeAudio() {
  audio();
}

function tone(
  freq: number,
  dur: number,
  {
    type = "sine",
    gain = 0.25,
    at = 0,
    slideTo,
  }: { type?: OscillatorType; gain?: number; at?: number; slideTo?: number } = {},
) {
  const a = audio();
  if (!a || !enabled) return;
  const t = a.ctx.currentTime + at;
  const osc = a.ctx.createOscillator();
  const g = a.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.out);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur: number, gain: number, cutoff: number, at = 0) {
  const a = audio();
  if (!a || !enabled) return;
  const t = a.ctx.currentTime + at;
  const len = Math.floor(a.ctx.sampleRate * dur);
  const buf = a.ctx.createBuffer(1, len, a.ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = a.ctx.createBufferSource();
  src.buffer = buf;
  const filter = a.ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = cutoff;
  filter.Q.value = 0.8;
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(g).connect(a.out);
  src.start(t);
}

export const sfx = {
  tick() {
    tone(1800, 0.03, { type: "square", gain: 0.05 });
  },
  correct() {
    tone(880, 0.09, { type: "triangle", gain: 0.18 });
    tone(1320, 0.12, { type: "triangle", gain: 0.14, at: 0.06 });
  },
  /** The "shock": buzzy saw + crackle. */
  wrong() {
    tone(92, 0.38, { type: "sawtooth", gain: 0.32, slideTo: 70 });
    tone(97, 0.38, { type: "square", gain: 0.12, slideTo: 60 });
    noise(0.32, 0.35, 2400);
    noise(0.12, 0.25, 5200, 0.12);
  },
  timeout() {
    tone(440, 0.35, { type: "square", gain: 0.1, slideTo: 110 });
    noise(0.2, 0.12, 900);
  },
  count(final: boolean) {
    tone(final ? 1046 : 523, final ? 0.32 : 0.14, {
      type: "square",
      gain: 0.1,
    });
  },
  /** Low clock warning in timed mode. */
  pulse() {
    tone(60, 0.18, { type: "sine", gain: 0.35, slideTo: 40 });
  },
  end() {
    tone(660, 0.18, { type: "square", gain: 0.1 });
    tone(440, 0.18, { type: "square", gain: 0.1, at: 0.18 });
    tone(220, 0.5, { type: "square", gain: 0.1, at: 0.36 });
  },
  unlock() {
    [523, 659, 784, 1046].forEach((f, i) =>
      tone(f, 0.22, { type: "triangle", gain: 0.16, at: i * 0.09 }),
    );
    noise(0.5, 0.08, 6000, 0.36);
  },
  ui() {
    tone(1200, 0.025, { type: "square", gain: 0.04 });
  },
};

/** Low fluorescent hum under gameplay. */
export function startDrone() {
  const a = audio();
  if (!a || !enabled || drone) return;
  const { ctx: c, out } = a;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.07, c.currentTime + 1.5);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 220;
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = 0.13;
  lfoGain.gain.value = 90;
  lfo.connect(lfoGain).connect(lp.frequency);
  const oscs = [55, 55.6, 110.4].map((f) => {
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = f;
    o.connect(lp);
    o.start();
    return o;
  });
  lp.connect(g).connect(out);
  lfo.start();
  drone = {
    stop() {
      const t = c.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      [...oscs, lfo].forEach((o) => o.stop(t + 0.65));
    },
  };
}

export function stopDrone() {
  drone?.stop();
  drone = null;
}
