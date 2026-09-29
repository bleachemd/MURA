// Temporary: phone screenshots of every screen. Deleted after the UI pass.
import { chromium } from '@playwright/test';
const [url, out, w = 390, h = 844] = [process.argv[2], process.argv[3], ...process.argv.slice(4).map(Number)];
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', ...(process.env.FAKE_VIDEO ? [`--use-file-for-fake-video-capture=${process.env.FAKE_VIDEO}`] : [])] });
const ctx = await browser.newContext({ locale: 'ru-RU', viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message));
const shot = (n, full = false) => page.screenshot({ path: `${out}/${n}.png`, fullPage: full });
await page.goto(url); await page.evaluate(() => document.fonts.ready);
await shot('01-home'); await page.evaluate(() => scrollTo(0, 900)); await page.waitForTimeout(200); await shot('01b-home-cards'); await page.evaluate(() => scrollTo(0, 0));
await page.getByRole('button', { name: 'Меню' }).click(); await page.waitForTimeout(300); await shot('02-menu');
await page.goto(url + '/?instrument=dombyra'); await page.waitForTimeout(800); await shot('03-session-intro');
await page.getByRole('button', { name: 'Попробовать демо без камеры' }).click(); await page.waitForTimeout(600); await shot('04-demo');
await page.getByRole('button', { name: 'Начать выступление', exact: true }).click(); await page.waitForTimeout(600); await shot('05-demo-playing');
for (let i = 0; i < 9; i++) { const b = page.locator('.gesture-control.expected'); if (!(await b.count())) break; await b.click(); await page.waitForTimeout(250); }
await page.waitForTimeout(800); await shot('06-done'); await shot('06b-done-full', true);
await page.goto(url + '/?instrument=kobyz'); await page.waitForTimeout(500);
await page.getByRole('button', { name: 'Включить камеру', exact: true }).click();
await page.getByText('Ищем руку', { exact: true }).waitFor({ timeout: 120000 }).catch(() => {}); await page.waitForTimeout(800); await shot('07-camera');
console.log('errors', errors);
await browser.close();
