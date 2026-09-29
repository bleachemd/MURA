/**
 * Full-flow check against the REAL camera (no --use-fake-device), with the permission
 * prompt auto-accepted. Complements check-ui.mjs, which uses a synthetic device:
 * this one proves the app opens actual hardware, feeds it to MediaPipe and reaches
 * the hand-search state.
 *
 *   CHROME_PATH="/path/to/msedge.exe" node scripts/check-real-camera.mjs [url]
 */
import { chromium } from '@playwright/test';

const baseURL = process.argv[2] ?? 'http://localhost:5173';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  headless: true,
  args: ['--use-fake-ui-for-media-stream'],
});
try {
  const page = await browser.newPage({ locale: 'ru-RU', viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto(`${baseURL}/?instrument=dombyra`);
  await page.getByRole('button', { name: 'Включить камеру', exact: true }).click();

  // "Ищем руку" only appears once getUserMedia resolved AND the detector loop is running.
  await page.getByText('Ищем руку', { exact: true }).waitFor({ timeout: 120000 });

  const video = await page.evaluate(() => {
    const v = document.querySelector('video');
    const track = v?.srcObject?.getVideoTracks?.()[0];
    return {
      videoWidth: v?.videoWidth ?? 0,
      videoHeight: v?.videoHeight ?? 0,
      paused: v?.paused ?? null,
      trackLabel: track?.label ?? null,
      trackReadyState: track?.readyState ?? null,
    };
  });

  // Deliberately no screenshot: a real camera frame shows whoever is in front of it.
  // The assertions below prove the stream is live without recording a picture of anyone.
  const problems = [];
  if (!video.videoWidth || !video.videoHeight) problems.push('video element has no frame dimensions');
  if (video.paused) problems.push('video element is paused');
  if (video.trackReadyState !== 'live') problems.push(`track is "${video.trackReadyState}", expected "live"`);
  if (errors.length) problems.push(`page errors: ${errors.join(' | ')}`);

  console.log(JSON.stringify({ baseURL, video, problems }, null, 2));
  if (problems.length) process.exitCode = 1;
} finally {
  await browser.close();
}
