import type { Gesture } from './gestures';
let context: AudioContext | undefined;
let enabled = true;
export function setSound(value: boolean) { enabled = value; }
export async function unlockAudio() {
  context ??= new AudioContext();
  if (context.state === 'suspended') await context.resume();
}
export function playNote(gesture: Gesture, instrument = 'dombyra') {
  if (!enabled || !context || context.state !== 'running') return;
  const ctx = context;
  const now = ctx.currentTime;
  const percussion = gesture === 'fist' || instrument === 'dauylpaz';
  const freq = percussion ? (gesture === 'peace' ? 170 : 105) : gesture === 'palm' ? 293.66 : 440;
  const duration = instrument === 'kobyz' && !percussion ? 1.3 : .85;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(.001, now);
  gain.gain.exponentialRampToValueAtTime(.19, now + .018);
  gain.gain.exponentialRampToValueAtTime(.001, now + duration);
  gain.connect(ctx.destination);
  if (percussion) {
    const osc = ctx.createOscillator(); osc.frequency.setValueAtTime(freq, now); osc.frequency.exponentialRampToValueAtTime(40, now + .32); osc.connect(gain); osc.start(now); osc.stop(now + duration);
  } else if (instrument === 'kobyz') {
    const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = freq / 2;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1300;
    osc.connect(filter); filter.connect(gain); osc.start(now); osc.stop(now + duration);
  } else {
    // Karplus–Strong: a decaying delay line gives the virtual strings a plucked timbre.
    const length = Math.round(ctx.sampleRate / freq);
    const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buffer.getChannelData(0); const ring = new Float32Array(length);
    for (let i = 0; i < length; i++) ring[i] = Math.random() * 2 - 1;
    for (let i = 0; i < data.length; i++) { const j = i % length; data[i] = ring[j]; ring[j] = .496 * (ring[j] + ring[(j + 1) % length]); }
    const source = ctx.createBufferSource(); source.buffer = buffer; source.connect(gain); source.start(now);
  }
}
