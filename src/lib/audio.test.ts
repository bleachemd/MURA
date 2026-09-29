import {test} from 'node:test';
import assert from 'node:assert/strict';

/**
 * Firefox leaves resume() pending while its autoplay policy still blocks the page,
 * and some browsers refuse to construct an AudioContext at all. Sound is optional:
 * neither case may hold up the camera or the demo, so unlockAudio must always settle.
 */
class StuckAudioContext {
  state = 'suspended';
  resume() { return new Promise<void>(() => {}); }
}
class RefusingAudioContext {
  constructor() { throw new Error('AudioContext blocked'); }
}

async function settlesQuickly(run: () => Promise<unknown>) {
  const timer = new Promise<'hung'>(resolve => setTimeout(() => resolve('hung'), 3000).unref?.());
  return Promise.race([run().then(() => 'settled' as const, () => 'rejected' as const), timer]);
}

test('unlockAudio settles when the browser never resumes the context', async () => {
  (globalThis as {AudioContext?: unknown}).AudioContext = StuckAudioContext;
  const {unlockAudio} = await import(`./audio.ts?stuck=${Date.now()}`);
  assert.equal(await settlesQuickly(() => unlockAudio()), 'settled');
});

test('unlockAudio settles when the browser refuses to create a context', async () => {
  (globalThis as {AudioContext?: unknown}).AudioContext = RefusingAudioContext;
  const {unlockAudio} = await import(`./audio.ts?refusing=${Date.now()}`);
  assert.equal(await settlesQuickly(() => unlockAudio()), 'settled');
});

/** iOS suspends a context that was already playing (camera start, call, app switch) and leaves it there. */
class InterruptibleAudioContext {
  state = 'running';
  resumes = 0;
  resume() { this.resumes++; return Promise.resolve(); }
}

test('a context the phone interrupted mid-session is resumed on the next sound', async () => {
  let ctx!: InterruptibleAudioContext;
  (globalThis as {AudioContext?: unknown}).AudioContext = class extends InterruptibleAudioContext { constructor() { super(); ctx = this; } };
  const {unlockAudio, playCue, playNote} = await import(`./audio.ts?interrupted=${Date.now()}`);
  await unlockAudio();
  ctx.state = 'interrupted';
  playCue('good');
  playNote('pluck');
  assert.equal(ctx.resumes, 2);
  await unlockAudio();
  assert.equal(ctx.resumes, 3, 'a tap on start must resume an interrupted context, not only a suspended one');
});

test('unlockAudio asks iOS for media playback so the silent switch does not mute it', async () => {
  const audioSession = {type: 'auto'};
  Object.defineProperty(globalThis, 'navigator', {value: {audioSession}, configurable: true});
  (globalThis as {AudioContext?: unknown}).AudioContext = InterruptibleAudioContext;
  const {unlockAudio} = await import(`./audio.ts?session=${Date.now()}`);
  await unlockAudio();
  assert.equal(audioSession.type, 'playback');
});
