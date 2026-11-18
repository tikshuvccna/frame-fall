/**
 * Sound: everything is synthesised with Web Audio (no files). Two buses, music and effects, each with its own switch.
 * Music lives in music.ts and plays through `musicBus()`.
 */
let ac: AudioContext | null = null;
let master: GainNode | null = null, fxBus: GainNode | null = null, mBus: GainNode | null = null;
let noise: AudioBuffer | null = null;
const vol = { music: 0.55, sfx: 1 };

export function unlockAudio(): void {
  try {
    if (!ac) {
      ac = new AudioContext();
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      master = ac.createGain(); master.gain.value = 0.9;
      fxBus = ac.createGain(); fxBus.gain.value = vol.sfx;
      mBus = ac.createGain(); mBus.gain.value = vol.music;
      fxBus.connect(master); mBus.connect(master); master.connect(comp).connect(ac.destination);
      noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    void ac.resume();
  } catch { /* no audio */ }
}
export function audioCtx(): AudioContext | null { return ac; }
export function musicBus(): GainNode | null { return mBus; }
export function noiseBuffer(): AudioBuffer | null { return noise; }
/** Volumes 0..1 (0 turns a bus off). */
export function setVolumes(music: number, effects: number): void {
  vol.music = music * 0.55; vol.sfx = effects;
  if (ac && mBus && fxBus) { mBus.gain.setTargetAtTime(vol.music, ac.currentTime, 0.05); fxBus.gain.setTargetAtTime(vol.sfx, ac.currentTime, 0.05); }
}

function tone(f0: number, f1: number, dur: number, type: OscillatorType = 'sine', v = 0.16, delay = 0): void {
  if (!ac || !fxBus) return;
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(fxBus);
  o.start(t); o.stop(t + dur + 0.02);
}
function hiss(dur: number, f: number, v = 0.12, delay = 0, type: BiquadFilterType = 'bandpass', f1 = f): void {
  if (!ac || !fxBus || !noise) return;
  const t = ac.currentTime + delay, s = ac.createBufferSource(), bq = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noise;
  bq.type = type; bq.frequency.setValueAtTime(f, t); bq.frequency.exponentialRampToValueAtTime(f1, t + dur); bq.Q.value = 1.2;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(bq).connect(g).connect(fxBus);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}

let coinN = 0, coinT = 0;
export const sfx = {
  jump: () => tone(320, 620, 0.16, 'sine', 0.13),
  dive: () => { tone(520, 240, 0.2, 'triangle', 0.13); hiss(0.18, 1200, 0.06, 0, 'bandpass', 500); },
  land: () => tone(140, 70, 0.1, 'sine', 0.14),
  boing: () => { tone(180, 520, 0.22, 'sine', 0.2); tone(360, 900, 0.18, 'triangle', 0.07); },
  whack: () => { tone(240, 60, 0.25, 'square', 0.12); tone(900, 200, 0.12, 'sawtooth', 0.06); hiss(0.1, 2500, 0.08); },
  wrong: () => tone(200, 110, 0.28, 'sawtooth', 0.1),
  right: () => { tone(660, 660, 0.1, 'triangle', 0.15); tone(880, 880, 0.1, 'triangle', 0.15, 0.09); tone(1320, 1320, 0.2, 'triangle', 0.15, 0.18); },
  count: () => tone(440, 440, 0.12, 'square', 0.1),
  go: () => { tone(880, 880, 0.35, 'square', 0.12); hiss(0.4, 3000, 0.05, 0, 'highpass'); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.22, 'triangle', 0.16, i * 0.13)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, f, 0.3, 'triangle', 0.14, i * 0.2)),
  /** Coins picked up in a quick row climb in pitch. */
  coin: () => {
    const now = performance.now();
    coinN = now - coinT < 700 ? Math.min(coinN + 1, 8) : 0; coinT = now;
    const f = 988 * Math.pow(2, coinN / 12);
    tone(f, f, 0.07, 'square', 0.07); tone(f * 1.5, f * 1.5, 0.16, 'square', 0.07, 0.06);
  },
  card: () => { [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, f, 0.25, 'triangle', 0.11, i * 0.07)); hiss(0.6, 6000, 0.04, 0.1, 'highpass'); },
  fall: () => { tone(900, 160, 0.55, 'sine', 0.1); },
  out: () => { hiss(0.45, 400, 0.14, 0, 'lowpass', 120); tone(300, 80, 0.4, 'triangle', 0.1); },
  click: () => tone(660, 520, 0.05, 'triangle', 0.08),
  buy: () => { tone(1320, 1320, 0.06, 'square', 0.07); tone(1760, 1760, 0.18, 'square', 0.07, 0.07); tone(2093, 2093, 0.25, 'triangle', 0.08, 0.14); },
  nope: () => tone(180, 150, 0.15, 'square', 0.08),
  prize: () => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, f, 0.2, 'square', 0.07, i * 0.09)); hiss(0.8, 7000, 0.04, 0.3, 'highpass'); },
};
