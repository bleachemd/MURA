import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Camera, Check, CircleHelp, Eye, EyeOff, LoaderCircle, Maximize, Music2, RotateCcw, ShieldCheck, Timer, Trophy, X } from 'lucide-react';
import type { HandLandmarker } from '@mediapipe/tasks-vision';
import { distance, getMelody, getProfile, handQuality, MotionRecognizer, type Gesture, type Point } from '../lib/gestures';
import { playNote, stopBow, unlockAudio, updateBow } from '../lib/audio';
import { savePerformance } from '../lib/progress';
import { InstrumentArt } from './InstrumentArt';
import { ARInstrument } from './ARInstrument';
export type Instrument = { id: string; name: string; kazakh: string; category: string; subtitle: string; description: string; tag: string; color: string };
type Phase = 'intro' | 'ready' | 'playing' | 'done';
const connections = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
export function Session({ instrument, close, onComplete }: { instrument: Instrument; close: () => void; onComplete: () => void }) {
  const profile=getProfile(instrument.id);const gestures=profile.gestures;const melody=getMelody(instrument.id);
  const [phase,setPhase]=useState<Phase>('intro');
  const [mode,setMode]=useState<'live'|'demo'|null>(null);
  const [loading,setLoading]=useState(false);const [error,setError]=useState('');
  const [hint,setHint]=useState(profile.setup);const [recognized,setRecognized]=useState<Gesture|null>(null);
  const [handPresent,setHandPresent]=useState(false);const [contact,setContact]=useState<Point|null>(null);
  const [trace,setTrace]=useState<Point[]>([]);const [readyProgress,setReadyProgress]=useState(0);
  const [index,setIndex]=useState(0);const [mistakes,setMistakes]=useState(0);const [seconds,setSeconds]=useState(45);
  const [flash,setFlash]=useState(false);const [saved,setSaved]=useState(true);
  const [showAR,setShowAR]=useState(()=>{try{return localStorage.getItem('mura-show-ar')!=='false';}catch{return true;}});
  const [aspect,setAspect]=useState(4/3);const [viewport,setViewport]=useState({width:0,height:0});
  const stage=useRef<HTMLDivElement>(null);const video=useRef<HTMLVideoElement>(null);const canvas=useRef<HTMLCanvasElement>(null);
  const detector=useRef(new MotionRecognizer(instrument.id));
  const state=useRef({phase,index,mistakes,mode,start:0,finished:0});
  const dwell=useRef<{since:number;anchor:Point|null;replayArmed:boolean;missingSince:number}>({since:0,anchor:null,replayArmed:false,missingSince:0});
  const action=useRef<(g:Gesture,strength?:number)=>void>(()=>{});const finishRef=useRef<()=>void>(()=>{});const beginRef=useRef<()=>void>(()=>{});
  const feedbackUntil=useRef(0);const flashTimeout=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);const noteTimeout=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  state.current={...state.current,phase,index,mistakes,mode};
  const score=Math.max(0,index*100-mistakes*25);
  function reset() {
    stopBow();detector.current.reset();dwell.current={since:0,anchor:null,replayArmed:false,missingSince:0};
    state.current={...state.current,phase:'ready',index:0,mistakes:0};setIndex(0);setMistakes(0);setSeconds(45);setPhase('ready');setRecognized(null);setTrace([]);setReadyProgress(0);setHint(profile.setup);feedbackUntil.current=0;
  }
  beginRef.current=()=>{
    const s=state.current;s.phase='playing';s.index=0;s.mistakes=0;s.start=Date.now();detector.current.reset();
    setPhase('playing');setIndex(0);setMistakes(0);setSeconds(45);setReadyProgress(0);setHint(gestures[0].instruction);feedbackUntil.current=0;
  };
  finishRef.current=()=>{
    const s=state.current;if(s.phase!=='playing')return;
    s.phase='done';s.finished=performance.now();stopBow();setPhase('done');dwell.current={since:0,anchor:null,replayArmed:false,missingSince:0};
    setSaved(savePerformance({id:crypto.randomUUID(),instrument:instrument.name,notes:s.index,mistakes:s.mistakes,score:Math.max(0,s.index*100-s.mistakes*25),date:new Date().toISOString(),demo:s.mode==='demo'}));onComplete();
  };
  action.current=(g,strength=.7)=>{
    const s=state.current;if(s.phase!=='playing')return;
    if(s.mode==='demo'||instrument.id!=='kobyz')playNote(g,instrument.id,strength);
    setRecognized(g);clearTimeout(noteTimeout.current);noteTimeout.current=setTimeout(()=>setRecognized(null),700);feedbackUntil.current=performance.now()+800;
    if(g===melody[s.index]){
      s.index++;setIndex(s.index);setFlash(true);clearTimeout(flashTimeout.current);flashTimeout.current=setTimeout(()=>setFlash(false),350);setHint('Точно! Приём прозвучал. Теперь следующее движение.');
      if(s.index===melody.length)finishRef.current();
    }else{s.mistakes++;setMistakes(s.mistakes);setHint(`Сейчас нужен другой приём. ${gestures.find(x=>x.id===melody[s.index])!.instruction}`);}
  };
  useEffect(()=>{if(phase!=='playing')return;const interval=setInterval(()=>{const remaining=Math.max(0,45-Math.floor((Date.now()-state.current.start)/1000));setSeconds(remaining);if(!remaining)finishRef.current();},200);return()=>clearInterval(interval);},[phase]);
  useEffect(()=>()=>{clearTimeout(flashTimeout.current);clearTimeout(noteTimeout.current);stopBow();},[]);
  useEffect(()=>{try{localStorage.setItem('mura-show-ar',String(showAR));}catch{/* Optional preference. */}},[showAR]);
  useEffect(()=>{
    const el=stage.current;if(!el)return;
    const resize=()=>{const width=Math.min(el.clientWidth,el.clientHeight*aspect);setViewport({width,height:width/aspect});};
    resize();const observer=new ResizeObserver(resize);observer.observe(el);return()=>observer.disconnect();
  },[mode,aspect]);
  useEffect(()=>{
    if(mode!=='live')return;
    let cancelled=false;let stream:MediaStream|undefined;let model:HandLandmarker|undefined;let frame=0;let previousFrame=-1;let lastTime=0;
    const draw=(points:Point[],valid:boolean)=>{
      const c=canvas.current;const v=video.current;if(!c||!v)return;
      c.width=v.videoWidth||640;c.height=v.videoHeight||480;const ctx=c.getContext('2d');if(!ctx)return;
      ctx.clearRect(0,0,c.width,c.height);ctx.strokeStyle=valid?'#cdeb94':'#f4bb6b';ctx.fillStyle=valid?'#e4ffbe':'#ffd09b';ctx.lineWidth=2;
      for(const [a,b]of connections){if(!points[a]||!points[b])continue;ctx.beginPath();ctx.moveTo(points[a].x*c.width,points[a].y*c.height);ctx.lineTo(points[b].x*c.width,points[b].y*c.height);ctx.stroke();}
      for(const p of points){ctx.beginPath();ctx.arc(p.x*c.width,p.y*c.height,3,0,Math.PI*2);ctx.fill();}
    };
    const loop=(now:number)=>{
      if(cancelled)return;
      const v=video.current;
      if(v&&model&&v.readyState>=2&&v.currentTime!==previousFrame&&now-lastTime>65){
        previousFrame=v.currentTime;lastTime=now;
        try{
          // Mirror exactly once; detector, skeleton and AR now use the same screen coordinates.
          const points=(model.detectForVideo(v,now).landmarks[0]??[]).map(p=>({...p,x:1-p.x}));
          const s=state.current;const quality=handQuality(points);setHandPresent(!quality);
          if(s.phase==='playing'){
            const result=detector.current.update(points,now,melody[s.index]);setContact(result.point);setTrace(result.trace);draw(points,result.inZone&&!quality);
            if(instrument.id==='kobyz')updateBow(result.bowSpeed);
            if(result.event)action.current(result.event.gesture,result.event.strength);
            else if(now>feedbackUntil.current)setHint(result.hint);
          }else{
            stopBow();setContact(quality?null:points[9]);setTrace([]);draw(points,!quality);
            const d=dwell.current;
            if(s.phase==='done'&&quality){if(!d.missingSince)d.missingSince=now;if(now-d.missingSince>350)d.replayArmed=true;}
            const permitted=s.phase==='ready'||(s.phase==='done'&&d.replayArmed&&now-s.finished>2500);
            const onTarget=!quality&&(s.phase==='done'||distance(points[9],profile.ready)<.105);
            if(permitted&&onTarget){
              if(!d.anchor||distance(points[9],d.anchor)>.045){d.anchor=points[9];d.since=now;}
              const progress=Math.min(1,(now-d.since)/1000);setReadyProgress(progress);
              if(progress>=1){if(s.phase==='done')reset();else beginRef.current();d.anchor=null;d.since=0;}
            }else{d.anchor=null;d.since=0;setReadyProgress(0);}
            if(s.phase==='ready')setHint(quality??(onTarget?'Отлично, задержи кисть на метке на одну секунду.':profile.setup));
          }
        }catch{stopBow();setError('Не удалось обработать изображение. Перезапусти камеру или открой демо.');stream?.getTracks().forEach(t=>t.stop());return;}
      }
      frame=requestAnimationFrame(loop);
    };
    async function init(){
      setLoading(true);setError('');
      try{
        if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw new Error('secure');
        stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:640},height:{ideal:480}}});
        if(cancelled){stream.getTracks().forEach(t=>t.stop());return;}
        if(video.current){video.current.srcObject=stream;await video.current.play();}
        const {FilesetResolver,HandLandmarker}=await import('@mediapipe/tasks-vision');const vision=await FilesetResolver.forVisionTasks('/wasm');if(cancelled)return;
        model=await HandLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:'/models/hand_landmarker.task',delegate:'CPU'},runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:.6,minHandPresenceConfidence:.6,minTrackingConfidence:.6});
        if(cancelled){model.close();return;}
        setLoading(false);reset();frame=requestAnimationFrame(loop);
      }catch(e){
        stream?.getTracks().forEach(t=>t.stop());if(cancelled)return;setLoading(false);const name=(e as Error).name;
        setError((e as Error).message==='secure'?'Для камеры нужна защищённая ссылка HTTPS или localhost. Открой сайт по HTTPS.':name==='NotAllowedError'?'Доступ к камере закрыт. Разреши камеру в настройках сайта рядом с адресной строкой и попробуй снова.':name==='NotFoundError'?'Камера не найдена. Подключи веб-камеру или открой ссылку на телефоне.':name==='NotReadableError'?'Камера занята другим приложением. Закрой его и попробуй снова.':'Не удалось запустить распознавание. Проверь соединение и доступ к камере, затем попробуй снова.');
      }
    }
    const onVisibility=()=>{if(document.hidden){stopBow();detector.current.reset();}};
    document.addEventListener('visibilitychange',onVisibility);void init();
    return()=>{cancelled=true;cancelAnimationFrame(frame);stream?.getTracks().forEach(t=>t.stop());model?.close();stopBow();document.removeEventListener('visibilitychange',onVisibility);};
  },[mode,instrument.id]);
  async function start(demo=false){await unlockAudio().catch(()=>{});setError('');setMode(demo?'demo':'live');if(demo){setLoading(false);reset();}}
  const expected=gestures.find(g=>g.id===melody[index]);
  return <div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)close();}}><section className="session-modal" role="dialog" aria-modal="true" aria-labelledby="session-title">
    <div className="modal-header"><div className="eyebrow"><span className="live-dot"/> ТВОЯ МУЗЫКАЛЬНАЯ СЦЕНА</div><button className="icon-button" onClick={close} aria-label="Закрыть"><X size={21}/></button></div>
    <div className="session-title"><h2 id="session-title">{instrument.name}<span> / {instrument.kazakh}</span></h2><span className="pill">{mode==='demo'?'Демо · без камеры':'Настоящие движения · AR'}</span></div>
    {!mode?<div className="session-intro"><div className={`intro-art ${instrument.color}`}><InstrumentArt type={instrument.id}/><span className="art-caption">НАСЛЕДИЕ, КОТОРОЕ ЗВУЧИТ</span></div><div className="intro-content"><span className="eyebrow">ИГРАЙ, КАК НА ИНСТРУМЕНТЕ</span><h3>Почувствуй<br/>{instrument.id==='dombyra'?'движение струн.':instrument.id==='kobyz'?'ход смычка.':'силу ритма.'}</h3><p>{profile.setup}</p><div className="intro-gestures">{gestures.map(g=><div key={g.id}><span className="technique-symbol">{g.symbol}</span><div><b>{g.name}</b><small>{g.action}</small></div></div>)}</div><p className="intro-challenge">9 приёмов · 45 секунд · до 900 баллов</p><button className="button primary" onClick={()=>void start()}><Camera size={18}/> Включить камеру <ArrowRight size={18}/></button><button className="text-button" onClick={()=>void start(true)}>Попробовать демо без камеры <ArrowRight size={15}/></button><p className="privacy-note"><ShieldCheck size={15}/> Видео остаётся на устройстве. Инструмент поверх камеры можно скрыть.</p></div></div>:<>
      <div className="session-toolbar"><div className="session-stats"><span><Timer size={17}/><b>{seconds}</b> сек</span><span><Music2 size={17}/><b>{index}</b> / 9</span><span><Trophy size={17}/><b>{score}</b> баллов</span></div><button className={`ar-toggle ${showAR?'is-on':''}`} aria-pressed={showAR} onClick={()=>setShowAR(!showAR)}>{showAR?<EyeOff size={15}/>:<Eye size={15}/>} {showAR?'Скрыть AR-инструмент':'Показать AR-инструмент'}</button></div>
      <div ref={stage} className={`camera-stage motion-stage ${flash?'note-flash':''}`}>
        <div className="camera-viewport" style={{width:viewport.width||'100%',height:viewport.height||'100%'}}>
          {mode==='live'&&<><video ref={video} muted playsInline autoPlay onLoadedMetadata={e=>{const v=e.currentTarget;setAspect(v.videoWidth/v.videoHeight||4/3);}}/><canvas ref={canvas}/></>}
          {!loading&&!error&&<ARInstrument instrument={instrument.id} visible={showAR} point={contact} trace={trace} active={recognized} ready={mode==='live'&&phase==='ready'} progress={readyProgress}/>}
        </div>
        {!loading&&!error&&phase!=='done'&&<div className="camera-status"><span className={`live-dot ${handPresent?'':'muted'}`}/>{mode==='demo'?'ДЕМО-РЕЖИМ':handPresent?'КИСТЬ В КАДРЕ':'ИЩЕМ РУКУ'}</div>}
        {loading&&<div className="stage-overlay"><LoaderCircle className="spin" size={36}/><h3>Готовим твою сцену</h3><p>Запускаем камеру и распознавание движений…</p></div>}
        {error&&<div className="stage-overlay"><Camera size={32}/><h3>Камере нужна помощь</h3><p>{error}</p><button className="button light" onClick={()=>{setMode(null);setPhase('intro');setError('');}}>Попробовать снова</button><button className="text-button light-text" onClick={()=>void start(true)}>Открыть демо</button></div>}
        {!loading&&!error&&phase==='ready'&&(mode==='demo'?<div className="demo-ready"><p>Послушай приёмы и собери мелодию.<br/>В демо вместо движений работают кнопки.</p><button className="button light" onClick={()=>beginRef.current()}>Начать выступление <ArrowRight size={16}/></button></div>:<div className="motion-ready-label"><b>Совмести точку на кисти с меткой</b><span>Задержись на секунду — выступление начнётся само</span><div className="ready-meter"><i style={{width:`${readyProgress*100}%`}}/></div></div>)}
        {phase==='playing'&&!error&&<div className="next-gesture"><span className="technique-symbol">{expected?.symbol}</span><div><small>СЛЕДУЮЩИЙ ПРИЁМ</small><strong>{expected?.name}</strong></div><span className="note-count">{index+1}/9</span></div>}
        {phase==='done'&&<div className="stage-overlay result-overlay"><div className="trophy-circle"><Trophy size={34}/></div><span className="eyebrow">{mode==='demo'?'ДЕМО ЗАВЕРШЕНО':'ТВОЁ ВЫСТУПЛЕНИЕ ЗАВЕРШЕНО'}</span><h3>{index===9?'Звучит как начало большого пути!':'Музыка начинается с практики'}</h3><div className="result-score">{score}<span> / 900 баллов</span></div><p>{index} из 9 приёмов · ошибок: {mistakes}</p><button className="button light" onClick={reset}><RotateCcw size={16}/> Сыграть ещё</button>{mode==='live'&&<small>Без кнопки: убери руку из кадра, затем покажи и задержи её на секунду</small>}<small>{saved?mode==='demo'?'Демо сохранено отдельно от настоящих выступлений':'Результат сохранён на этом устройстве':'Не удалось сохранить результат: память браузера недоступна'}</small></div>}
      </div>
      {phase!=='done'&&<><div className={`gesture-feedback ${flash?'success':''}`} aria-live="polite"><CircleHelp size={19}/><span>{mode==='demo'?'Демо: выбирай карточки приёмов. В режиме камеры звучание управляется движением кисти.':hint}</span></div><div className="gesture-controls">{gestures.map(g=><button key={g.id} disabled={mode!=='demo'||phase!=='playing'} className={`gesture-control ${phase==='playing'&&g.id===melody[index]?'expected':''} ${recognized===g.id?'detected':''}`} onClick={()=>action.current(g.id)} title={g.instruction}><span className="gesture-symbol technique-symbol">{g.symbol}</span><b>{g.name}</b><small>{g.action}</small>{recognized===g.id&&<Check size={16}/>}</button>)}</div><p className="motion-instruction">{phase==='playing'?expected?.instruction:profile.setup}</p><div className="melody-track">{melody.map((g,i)=><span key={i} className={i<index?'complete':i===index?'current':''}>{i<index?<Check size={14}/>:gestures.find(x=>x.id===g)?.symbol}</span>)}</div></>}
      <div className="session-footer"><span><Maximize size={14}/> {showAR?'Играй в подсвеченной зоне':'AR скрыт · игровая зона остаётся на месте'}</span><span><ShieldCheck size={14}/> Видео только на твоём устройстве</span></div>
    </>}
  </section></div>;
}
