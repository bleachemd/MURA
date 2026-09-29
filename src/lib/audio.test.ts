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
