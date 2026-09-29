/**
 * Does the app's audio actually start in a real browser?
 *
 * unlockAudio() no longer blocks the UI, so this guards the other half of that
 * trade: the AudioContext must still reach "running" after a user gesture, and
 * playNote/playCue drop every sound silently while it has not.
 *
 *   CHROME_PATH="/path/to/msedge.exe" node scripts/check-audio.mjs [url]
 */
import { chromium } from '@playwright/test';

const baseURL = process.argv[2] ?? 'http://localhost:5173';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
try {
  const page = await browser.newPage({ locale: 'ru-RU', viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });

  // Record every AudioContext the app creates, and every node it actually starts.
  await page.addInitScript(() => {
    const Native = window.AudioContext;
    window.__audio = { created: 0, started: 0, states: [] };
    window.AudioContext = class extends Native {
      constructor(...args) {
        super(...args);
        window.__audio.created++;
        window.__audio.states.push(this.state);
        window.__ctx = this;
        const start = this.createBufferSource.bind(this);
        this.createBufferSource = (...a) => { window.__audio.started++; return start(...a); };
        const osc = this.createOscillator.bind(this);
        this.createOscillator = (...a) => { window.__audio.started++; return osc(...a); };
      }
    };
  });

  await page.goto(baseURL);
  // The preview button on the shelf is the shortest path from a click to a note.
  await page.locator('.listen-button').first().click();
  await page.waitForTimeout(1200);

  const audio = await page.evaluate(() => ({
    ...window.__audio,
    stateNow: window.__ctx ? window.__ctx.state : null,
    sampleRate: window.__ctx ? window.__ctx.sampleRate : null,
  }));

  const problems = [];
  if (!audio.created) problems.push('the app never created an AudioContext');
  if (audio.stateNow !== 'running') problems.push(`AudioContext is "${audio.stateNow}", expected "running"`);
  if (!audio.started) problems.push('no sound source was started, so nothing could be heard');

  console.log(JSON.stringify({ baseURL, audio, problems }, null, 2));
  if (problems.length) process.exitCode = 1;
} finally {
  await browser.close();
}
