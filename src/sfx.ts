/** Tiny synthesised sound effects (no audio files yet). */
let ac: AudioContext | null = null;
export function unlockAudio(): void {
  try { ac ??= new AudioContext(); void ac.resume(); } catch { /* no audio */ }
}
function tone(f0: number, f1: number, dur: number, type: OscillatorType = 'sine', vol = 0.16, delay = 0): void {
  if (!ac) return;
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ac.destination);
  o.start(t); o.stop(t + dur + 0.02);
}
export const sfx = {
  jump: () => tone(320, 620, 0.16, 'sine', 0.13),
  dive: () => tone(520, 240, 0.2, 'triangle', 0.13),
  land: () => tone(140, 70, 0.1, 'sine', 0.14),
  boing: () => { tone(180, 520, 0.22, 'sine', 0.2); tone(360, 900, 0.18, 'triangle', 0.07); },
  whack: () => { tone(240, 60, 0.25, 'square', 0.12); tone(900, 200, 0.12, 'sawtooth', 0.06); },
  wrong: () => tone(200, 110, 0.28, 'sawtooth', 0.1),
  right: () => { tone(660, 660, 0.1, 'triangle', 0.15); tone(880, 880, 0.1, 'triangle', 0.15, 0.09); tone(1320, 1320, 0.2, 'triangle', 0.15, 0.18); },
  count: () => tone(440, 440, 0.12, 'square', 0.1),
  go: () => tone(880, 880, 0.35, 'square', 0.12),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.22, 'triangle', 0.16, i * 0.13)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, f, 0.3, 'triangle', 0.14, i * 0.2)),
};
