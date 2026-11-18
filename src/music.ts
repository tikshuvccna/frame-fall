/**
 * Procedural music: a tiny step sequencer (drums, bass, pad, lead) with one track per mood.
 * Patterns are 16 steps a bar. Lead tokens: '.' rest, '-' hold, '0'..'3' a chord tone, '4'..'7' the same an octave up.
 * All tracks are original patterns written for this game.
 */
import { audioCtx, musicBus, noiseBuffer } from './sfx';

interface Track {
  bpm: number;
  chords: number[][];
  kick: string; snare: string; hat: string;
  /** 'r' root, 'o' root an octave up, 'f' fifth, '.' rest */
  bass: string;
  lead: string;
  leadWave: OscillatorType; leadVol: number;
  pad: number;
}
const maj = (r: number) => [r, r + 4, r + 7];
const min = (r: number) => [r, r + 3, r + 7];

export const TRACKS: Record<string, Track> = {
  menu: {
    bpm: 108, chords: [maj(60), min(57), maj(65), maj(67)],
    kick: 'x.......x.......', snare: '....x.......x...', hat: '..x...x...x...x-', bass: 'r.....r.o...r.f.',
    lead: '4.2.0.2.4.-.5.4.' + '2.-.0.2.1.-.-...', leadWave: 'triangle', leadVol: 0.07, pad: 0.025,
  },
  race: {
    bpm: 140, chords: [maj(65), min(62), maj(58), maj(60)],
    kick: 'x...x...x...x...', snare: '....x.......x..-', hat: '-.x.-.x.-.x.-.xx', bass: 'r.ro.r.or.ro.r.o',
    lead: '4.4.5.6.-.5.4.2.' + '4.-.-.2.4.5.6.-.', leadWave: 'square', leadVol: 0.045, pad: 0.018,
  },
  survive: {
    bpm: 126, chords: [min(57), maj(53), maj(60), maj(64)],
    kick: 'x..x..x.x..x..x.', snare: '....x.......x...', hat: '..x.x.x-..x.x.xx', bass: 'r..r..r.r..r..ro',
    lead: '0.0.4.0.2.0.5.0.' + '0.0.4.0.6.5.4.2.', leadWave: 'square', leadVol: 0.04, pad: 0.02,
  },
  lesson: {
    bpm: 84, chords: [maj(55), min(52), maj(60), maj(62)],
    kick: '................', snare: '................', hat: '....-.......-...', bass: 'r.......f.......',
    lead: '0...2...4...2...' + '1...2...5...-...', leadWave: 'sine', leadVol: 0.06, pad: 0.03,
  },
  final: {
    bpm: 150, chords: [maj(62), min(59), maj(55), maj(57)],
    kick: 'x...x...x...x.x.', snare: '....x.......x.xx', hat: 'x-x-x-x-x-x-x-x-', bass: 'roroo.rorororo.o',
    lead: '4.5.6.-.5.4.5.-.' + '6.-.7.6.5.4.2.-.', leadWave: 'square', leadVol: 0.045, pad: 0.02,
  },
};

const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
let cur: { name: string; tr: Track; gain: GainNode; step: number; next: number } | null = null;
let timer: number | null = null;
let wanted: string | null = null;

/** Switch to a track (fades). null stops the music. Safe to call before audio is unlocked: it starts later. */
export function playMusic(name: string | null): void {
  wanted = name;
  const ac = audioCtx(), bus = musicBus();
  if (!ac || !bus) return;
  if (cur && cur.name === name) return;
  if (cur) { const g = cur.gain; g.gain.setTargetAtTime(0, ac.currentTime, 0.25); setTimeout(() => g.disconnect(), 1500); cur = null; }
  if (!name) return;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0, ac.currentTime);
  gain.gain.setTargetAtTime(1, ac.currentTime, 0.3);
  gain.connect(bus);
  cur = { name, tr: TRACKS[name], gain, step: 0, next: ac.currentTime + 0.1 };
  timer ??= window.setInterval(tick, 25);
}
/** Call after the first user gesture: starts the track that was asked for while audio was locked. */
export function resumeMusic(): void { const w = wanted; if (w && (!cur || cur.name !== w)) { wanted = null; playMusic(w); } }

function tick(): void {
  const ac = audioCtx();
  if (!ac || !cur) return;
  const c = cur, sp = 60 / c.tr.bpm / 4;
  if (c.next < ac.currentTime - 0.2) c.next = ac.currentTime + 0.05;          // the tab slept: skip ahead
  while (c.next < ac.currentTime + 0.14) {
    play(c.tr, c.step, c.next, sp, c.gain);
    c.step++; c.next += sp;
  }
}

function play(tr: Track, step: number, t: number, sp: number, out: GainNode): void {
  const ac = audioCtx() as AudioContext;
  const s = step % 16, bar = Math.floor(step / 16), ch = tr.chords[bar % tr.chords.length];
  const hit = (p: string) => (p[s] === 'x' ? 1 : p[s] === '-' ? 0.45 : 0);
  const vk = hit(tr.kick), vs = hit(tr.snare), vh = hit(tr.hat);
  if (vk) kick(ac, t, vk, out);
  if (vs) snare(ac, t, vs, out);
  if (vh) hat(ac, t, vh, out);
  const b = tr.bass[s];
  if (b !== '.') {
    const r = ch[0] - 24 + (b === 'o' ? 12 : b === 'f' ? 7 : 0);
    note(ac, t, hz(r), sp * 1.6, 'triangle', 0.16, out, 700);
    note(ac, t, hz(r), sp * 1.2, 'square', 0.03, out, 500);
  }
  if (s === 0 && tr.pad > 0) for (const m of ch) for (const det of [-6, 6]) {
    const o = note(ac, t, hz(m), sp * 15, 'sawtooth', tr.pad, out, 1300, 0.12);
    o.detune.value = det;
  }
  const ls = (bar % 2) * 16 + s, tok = tr.lead[ls];
  if (tok >= '0' && tok <= '7') {
    let len = 1;
    while (len < 8 && tr.lead[(ls + len) % tr.lead.length] === '-') len++;
    const k = Number(tok) % 4, up = Number(tok) >= 4 ? 12 : 0;
    const m = (k < ch.length ? ch[k] : ch[0] + 12) + 12 + up;
    note(ac, t, hz(m), sp * len * 0.95, tr.leadWave, tr.leadVol, out, 3200);
  }
}

function note(ac: AudioContext, t: number, f: number, dur: number, wave: OscillatorType, v: number, out: AudioNode, cut: number, attack = 0.006): OscillatorNode {
  const o = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter();
  o.type = wave; o.frequency.value = f;
  lp.type = 'lowpass'; lp.frequency.value = cut;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + attack);
  g.gain.setValueAtTime(v, t + Math.max(attack, dur * 0.6));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(lp).connect(g).connect(out);
  o.start(t); o.stop(t + dur + 0.05);
  return o;
}
function kick(ac: AudioContext, t: number, v: number, out: AudioNode): void {
  const o = ac.createOscillator(), g = ac.createGain();
  o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  g.gain.setValueAtTime(0.5 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  o.connect(g).connect(out); o.start(t); o.stop(t + 0.2);
}
function burst(ac: AudioContext, t: number, dur: number, f: number, type: BiquadFilterType, v: number, out: AudioNode): void {
  const nb = noiseBuffer();
  if (!nb) return;
  const s = ac.createBufferSource(), bq = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = nb; bq.type = type; bq.frequency.value = f;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(bq).connect(g).connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}
function snare(ac: AudioContext, t: number, v: number, out: AudioNode): void {
  burst(ac, t, 0.13, 1900, 'bandpass', 0.22 * v, out);
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = 'triangle'; o.frequency.value = 190;
  g.gain.setValueAtTime(0.12 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  o.connect(g).connect(out); o.start(t); o.stop(t + 0.1);
}
function hat(ac: AudioContext, t: number, v: number, out: AudioNode): void { burst(ac, t, 0.04, 7500, 'highpass', 0.07 * v, out); }
