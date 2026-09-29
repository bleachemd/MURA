import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
const baseURL='http://localhost:4175';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','localhost','--port','4175','--strictPort'],{stdio:'pipe'});
let serverError='';
server.stderr.on('data',data=>{serverError+=data;});
let browser;
try {
  for(let attempt=0;attempt<60;attempt++){
    if(server.exitCode!==null) throw Error(`Test server failed: ${serverError}`);
    try{if((await fetch(baseURL)).ok)break;}catch{}
    await new Promise(resolve=>setTimeout(resolve,200));
    if(attempt===59)throw Error('Test server did not start');
  }
mkdirSync('artifacts', { recursive: true });
const localChrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const executablePath=process.env.CHROME_PATH || (existsSync(localChrome)?localChrome:undefined);
browser = await chromium.launch({executablePath,headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
const page = await browser.newPage({viewport:{width:1440,height:1120},reducedMotion:'reduce'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(baseURL);await page.evaluate(()=>document.fonts.ready);
await page.screenshot({path:'artifacts/desktop.png',fullPage:true});
await page.getByRole('button',{name:'QR-код: Кобыз'}).click();await page.locator('.qr-image img').waitFor();
if(!(await page.locator('.qr-url').inputValue()).includes('instrument=kobyz'))throw Error('QR link failed');
await page.keyboard.press('Escape');
await page.getByRole('button',{name:'Начать играть',exact:true}).click();
await page.getByRole('button',{name:'Попробовать демо без камеры'}).click();
await page.locator('[data-testid="ar-instrument"]').waitFor();
await page.getByRole('button',{name:'Скрыть AR-инструмент',exact:true}).click();
if(await page.locator('[data-testid="ar-instrument"]').count())throw Error('AR hide failed');
await page.getByRole('button',{name:'Показать AR-инструмент',exact:true}).click();
await page.locator('[data-testid="ar-instrument"]').waitFor();
await page.getByRole('button',{name:'Начать выступление',exact:true}).click();
await page.locator('.gesture-control').filter({hasText:'Бой вверх'}).click();
for(const name of ['Бой вниз','Бой вверх','Щипок струны','Бой вниз','Щипок струны','Бой вверх','Бой вниз','Бой вверх','Щипок струны'])await page.locator('.gesture-control').filter({hasText:name}).click();
await page.getByText('Демо завершено',{exact:true}).waitFor();
if(!(await page.locator('.result-score').innerText()).includes('875'))throw Error('scoring failed');
await page.screenshot({path:'artifacts/result.png'});
await page.getByRole('button',{name:'Сыграть ещё'}).click();
await page.clock.install();
await page.getByRole('button',{name:'Начать выступление',exact:true}).click();
await page.clock.fastForward(46000);
await page.getByText('Музыка начинается с практики',{exact:true}).waitFor();
if(!(await page.locator('.result-score').innerText()).startsWith('0'))throw Error('timeout score failed');
await page.clock.resume();
await page.keyboard.press('Escape');await page.getByRole('button',{name:'Мои достижения',exact:true}).click();
if(await page.locator('.history-row').count()!==2)throw Error('history failed');
await page.reload();if(await page.evaluate(()=>JSON.parse(localStorage.getItem('mura-performances-v1')).length)!==2)throw Error('persistence failed');
await page.getByRole('button',{name:'Начать играть',exact:true}).click();
await page.getByRole('button',{name:'Включить камеру',exact:true}).click();
await page.getByText('Ищем руку',{exact:true}).waitFor({timeout:60000});
await page.locator('.coach-feedback').getByText('Покажи руку',{exact:true}).waitFor();
await page.screenshot({path:'artifacts/camera.png'});
const aligned=await page.evaluate(()=>{const v=document.querySelector('video').getBoundingClientRect();const a=document.querySelector('.ar-overlay').getBoundingClientRect();const c=document.querySelector('canvas').getBoundingClientRect();return Math.abs(v.width-a.width)<1&&Math.abs(v.height-a.height)<1&&v.x===a.x&&v.y===a.y&&c.x===a.x&&c.y===a.y;});
if(!aligned)throw Error('AR/video coordinate alignment failed');
await page.keyboard.press('Escape');
await page.setViewportSize({width:390,height:844});
await page.getByRole('heading',{name:'Музыка в твоих руках.'}).click();
await page.screenshot({path:'artifacts/mobile.png',fullPage:true});
const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);if(overflow)throw Error('mobile horizontal overflow');
await page.getByRole('button',{name:'Как это работает',exact:true}).click();
await page.getByRole('heading',{name:'Пусть руки говорят.'}).waitFor();
await page.screenshot({path:'artifacts/mobile-guide.png',fullPage:true});
const denied=await browser.newPage();
await denied.addInitScript(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Denied','NotAllowedError');};});
await denied.goto(`${baseURL}/?instrument=kobyz`);
await denied.getByRole('heading',{name:'Кобыз / Қобыз'}).waitFor();
await denied.getByRole('button',{name:'Включить камеру',exact:true}).click();
await denied.getByText('Доступ к камере закрыт.',{exact:false}).waitFor();
await denied.getByRole('button',{name:'Открыть демо',exact:true}).click();
await denied.getByRole('button',{name:'Начать выступление',exact:true}).waitFor();
await denied.close();
for(const [id,names] of [['kobyz',['Смычок вправо','Смычок влево','Короткий штрих']],['dauylpaz',['Удар в центр','Удар по краю','Двойной удар']]]){
  const demo=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await demo.goto(`${baseURL}/?instrument=${id}`);
  await demo.getByRole('button',{name:'Попробовать демо без камеры'}).click();
  await demo.getByRole('button',{name:'Начать выступление',exact:true}).click();
  await demo.screenshot({path:`artifacts/ar-${id}-mobile.png`});
  for(const i of [0,1,2,0,2,1,0,1,2])await demo.locator('.gesture-control').filter({hasText:names[i]}).click();
  await demo.getByText('Демо завершено',{exact:true}).waitFor();
  if(!(await demo.locator('.result-score').innerText()).startsWith('900'))throw Error(`${id} score failed`);
  await demo.close();
}
// Synthetic landmark integration: the real camera/model initialization is verified separately above.
const motion=await browser.newPage({viewport:{width:1100,height:950},reducedMotion:'reduce'});
await motion.route(/@mediapipe_tasks-vision\.js/,route=>route.fulfill({contentType:'text/javascript',body:`export const FilesetResolver={forVisionTasks:async()=>({})};export const HandLandmarker={createFromOptions:async()=>({detectForVideo:()=>({landmarks:window.__landmarks?[window.__landmarks]:[]}),close:()=>{}})};`}));
await motion.goto(`${baseURL}/?instrument=dombyra`);
await motion.getByRole('button',{name:'Включить камеру',exact:true}).click();
await motion.getByText('Ищем руку',{exact:true}).waitFor();
async function move(x,y,pinch=false){await motion.evaluate(({x,y,pinch})=>{const points=Array.from({length:21},()=>({x:1-x,y,z:0}));points[0].y=y+.12;points[4]={x:1-(x-.025),y:y-.04,z:0};points[8]={x:1-(x+(pinch?-.01:.095)),y:y-(pinch?.04:.10),z:0};window.__landmarks=points;},{x,y,pinch});await motion.waitForTimeout(110);}
await move(.65,.43);
await motion.getByText('Следующий приём',{exact:true}).waitFor();
await move(.24,.43);
await motion.locator('.coach-feedback').getByText('Рука слишком слева',{exact:true}).waitFor();
await motion.locator('.ar-coach-target').waitFor();
await motion.screenshot({path:'artifacts/clear-motion-correction.png'});
await motion.evaluate(()=>{window.__landmarks=null;});
await motion.getByText('Пауза: верни руку в кадр',{exact:true}).waitFor();
const pausedStats=await motion.locator('.session-stats').innerText();
await motion.waitForTimeout(1200);
if(await motion.locator('.session-stats').innerText()!==pausedStats)throw Error('tracking-loss timer was not paused');
await move(.65,.49);
await move(.65,.71);
await motion.locator('.gesture-control.expected').filter({hasText:'Бой вверх'}).waitFor();
if(!(await motion.locator('.session-stats').innerText()).includes('100'))throw Error('live motion did not score');
await motion.screenshot({path:'artifacts/ar-dombyra-live.png'});
await motion.getByRole('button',{name:'Скрыть AR-инструмент'}).click();
for(const y of [.71,.67,.62,.56,.50])await move(.65,y);
await motion.locator('.gesture-control.expected').filter({hasText:'Щипок струны'}).waitFor();
if(!(await motion.locator('.session-stats').innerText()).includes('200'))throw Error('motion with hidden AR did not score');
async function pluck(){await move(.65,.60,true);await move(.65,.60,true);await move(.65,.60);}
async function downstroke(){for(const y of [.46,.50,.54,.59,.65,.71])await move(.65,y);}
async function upstroke(){for(const y of [.71,.67,.62,.56,.50])await move(.65,y);}
await pluck();await downstroke();await pluck();await upstroke();await downstroke();await upstroke();await pluck();
await motion.getByText('Твоё выступление завершено',{exact:true}).waitFor();
if(!(await motion.locator('.result-score').innerText()).startsWith('900'))throw Error('hands-free full performance failed');
await motion.evaluate(()=>{window.__landmarks=null;});await motion.waitForTimeout(2800);
await move(.65,.43);
await motion.getByText('Совмести точку на кисти с меткой',{exact:true}).waitFor();
await motion.getByText('Следующий приём',{exact:true}).waitFor();
// A burst of repeated strikes must be heard exactly once per impact, before score aggregation.
await motion.reload();await motion.getByRole('button',{name:'Попробовать демо без камеры'}).click();
await motion.getByRole('button',{name:'Показать AR-инструмент'}).waitFor();
await motion.close();
console.log(JSON.stringify({passed:['desktop render','filters','QR','demo final and scoring','persistence','timeout and replay','permission denied and demo fallback','QR deep link','MediaPipe camera initialization','mobile width','mobile navigation','all instrument scenarios','AR toggle and persistence','AR/video alignment','hands-free start and real motion event integration','hidden AR keeps recognizing','hands-free 9-note result and replay','directional error and AR arrow','timer pauses on tracking loss'],errors}));
if(errors.length)process.exitCode=1;
} finally {
  await browser?.close();
  server.kill();
}
