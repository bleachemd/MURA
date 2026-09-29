// Temporary: finds anything wider than a 390px phone screen. Deleted after the UI pass.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await (await browser.newContext({ locale: 'ru-RU', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
const wide = async label => console.log(label, await page.evaluate(() => ({ inner: innerWidth, scroll: document.documentElement.scrollWidth })));
await page.goto('http://localhost:4303/'); await page.waitForTimeout(600); await wide('home');
for (const n of ['Как это работает', 'Мои достижения', 'О проекте']) { await page.getByRole('button', { name: 'Меню' }).click(); await page.getByRole('button', { name: n }).click(); await page.waitForTimeout(300); await wide(n); }
for (const l of ['EN', 'ҚАЗ']) { await page.getByRole('button', { name: l, exact: true }).click(); await page.waitForTimeout(200); await wide(l); }
await page.goto('http://localhost:4303/?instrument=zhetygen'); await page.waitForTimeout(600); await wide('intro');
await page.getByRole('button', { name: 'Попробовать демо без камеры' }).click(); await page.waitForTimeout(500); await wide('demo');
await browser.close();
