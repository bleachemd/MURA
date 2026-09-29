// Temporary: phone screenshots of every screen. Deleted after the UI pass.
import { chromium } from '@playwright/test';
const [url, out] = [process.argv[2], process.argv[3]];
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
const ctx = await browser.newContext({ locale: 'ru-RU', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
const page = await ctx.newPage();
const shot = (n, full = false) => page.screenshot({ path: `${out}/${n}.png`, fullPage: full });
await page.goto(url); await page.evaluate(() => document.fonts.ready);
await shot('01-home'); await shot('01-home-full', true);
await page.getByRole('button', { name: 'Меню' }).click().catch(() => {}); await page.waitForTimeout(300); await shot('02-menu');
await page.goto(url + '/?instrument=dombyra'); await page.waitForTimeout(800); await shot('03-session-intro'); await shot('03-session-intro-full', true);
await page.getByRole('button', { name: 'Попробовать демо без камеры' }).click(); await page.waitForTimeout(600); await shot('04-demo');
await page.getByRole('button', { name: 'Начать выступление', exact: true }).click().catch(() => {}); await page.waitForTimeout(600); await shot('05-demo-playing');
await page.goto(url + '/?instrument=dombyra'); await page.waitForTimeout(500);
await page.getByRole('button', { name: 'Включить камеру', exact: true }).click();
await page.getByText('Ищем руку', { exact: true }).waitFor({ timeout: 120000 }).catch(() => {}); await page.waitForTimeout(800); await shot('06-camera');
await browser.close();
