import { chromium } from '@playwright/test';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await (await browser.newContext({ locale: 'ru-RU', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
await page.goto('http://localhost:4303/?instrument=dombyra'); await page.waitForTimeout(600);
await page.getByRole('button', { name: 'Попробовать демо без камеры' }).click(); await page.waitForTimeout(500);
console.log(await page.evaluate(() => [...document.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > 391).slice(0, 25).map(e => `${e.tagName}.${[...e.classList].join('.')} r=${Math.round(e.getBoundingClientRect().right)} w=${Math.round(e.getBoundingClientRect().width)}`).join('\n')));
console.log(await page.evaluate(() => ['.session-sheet','.session-inner','.session-play','.session-main','.session-bar','.motion-stage','.session-side','.coach-feedback','.gesture-controls','.melody-track'].map(s => { const e = document.querySelector(s); if (!e) return s + ' none'; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return `${s} w=${Math.round(r.width)} h=${Math.round(r.height)} display=${cs.display} minW=${cs.minWidth}`; }).join('\n')));
await browser.close();
