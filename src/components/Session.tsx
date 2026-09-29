import { useEffect, useRef, useState } from 'react';
import { Camera, Check, CircleAlert, Eye, EyeOff, Lightbulb, LoaderCircle, Maximize, RotateCcw, ShieldCheck, Trophy, Volume2, VolumeX, X } from 'lucide-react';
import type { HandLandmarker } from '@mediapipe/tasks-vision';
import { distance, getMelody, getProfile, handQuality, palmPoint, selectHand, MotionRecognizer, type Gesture, type Point } from '../lib/gestures';
import { playCue, playNote, stopBow, unlockAudio, updateBow } from '../lib/audio';
import { getProgress, savePerformance, topScores, type Performance, type Tip } from '../lib/progress';
import { InstrumentArt } from './InstrumentArt';
import { ARInstrument } from './ARInstrument';
import { coach, CoachLatch, type CoachHint } from '../lib/coaching';
export type Instrument = { id: string; name: string; kazakh: string; category: string; subtitle: string; description: string; tag: string; color: string };
type Phase = 'intro' | 'ready' | 'playing' | 'done';
type Summary = { record: boolean; rank: number; accuracy: number; seconds: number; bestStreak: number; tips: Tip[]; weak: { name: string; count: number }[]; board: Performance[]; currentId: string };
const buzz = (pattern: number | number[]) => { try { navigator.vibrate?.(pattern); } catch { /* Haptics are optional. */ } };
/** Hand-tracking noise is not technique advice; keep it out of the post-performance review. */
const noise = new Set(['hand-lost', 'ready-lost', 'ready-target', 'reacquired', 'brief-gap', 'jitter', 'setup']);
const connections = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
export function Session({ instrument, close, onComplete, sound, toggleSound }: { instrument: Instrument; close: () => void; onComplete: () => void; sound: boolean; toggleSound: () => void }) {
  const profile=getProfile(instrument.id);const gestures=profile.gestures;const melody=getMelody(instrument.id);
  const [phase,setPhase]=useState<Phase>('intro');
  const [mode,setMode]=useState<'live'|'demo'|null>(null);
  const [loading,setLoading]=useState(false);const [error,setError]=useState('');
  const [guidance,setGuidance]=useState<CoachHint>(()=>coach('setup','Подготовь руку',profile.setup));const [recognized,setRecognized]=useState<Gesture|null>(null);
  const [handPresent,setHandPresent]=useState(false);const [contact,setContact]=useState<Point|null>(null);
  const [trackingRate,setTrackingRate]=useState(0);const [trackingPaused,setTrackingPaused]=useState(false);const [calibrated,setCalibrated]=useState(false);
  const [trace,setTrace]=useState<Point[]>([]);const [readyProgress,setReadyProgress]=useState(0);
  const [index,setIndex]=useState(0);const [mistakes,setMistakes]=useState(0);const [seconds,setSeconds]=useState(45);
  const [flash,setFlash]=useState(false);const [miss,setMiss]=useState(false);const [saved,setSaved]=useState(true);
  const [streak,setStreak]=useState(0);const [pops,setPops]=useState<{id:number;x:number;y:number}[]>([]);const [summary,setSummary]=useState<Summary|null>(null);
  const [showAR,setShowAR]=useState(()=>{try{return localStorage.getItem('mura-show-ar')!=='false';}catch{return true;}});
  const [aspect,setAspect]=useState(4/3);const [viewport,setViewport]=useState({width:0,height:0});
  const stage=useRef<HTMLDivElement>(null);const video=useRef<HTMLVideoElement>(null);const canvas=useRef<HTMLCanvasElement>(null);
  const detector=useRef(new MotionRecognizer(instrument.id));
  const state=useRef({phase,index,mistakes,mode,start:0,finished:0});
  const dwell=useRef<{since:number;anchor:Point|null;replayArmed:boolean;missingSince:number;frames:Point[][]}>({since:0,anchor:null,replayArmed:false,missingSince:0,frames:[]});
  const action=useRef<(g:Gesture,strength?:number)=>void>(()=>{});const finishRef=useRef<()=>void>(()=>{});const beginRef=useRef<()=>void>(()=>{});
  const stats=useRef({wrong:{} as Record<string,number>,tips:new Map<string,Tip>(),streak:0,bestStreak:0,lastTip:''});const lastPoint=useRef<Point|null>(null);const popId=useRef(0);const missTimeout=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const coachLatch=useRef(new CoachLatch());const publish=useRef<(hint:CoachHint,now:number,force?:boolean)=>void>(()=>{});
  publish.current=(hint,now,force=false)=>{
    const shown=coachLatch.current.update(hint,now,force);setGuidance(shown);
    const st=stats.current;
    if(state.current.phase==='playing'&&shown.tone==='warning'&&!noise.has(shown.code)&&shown.code!==st.lastTip){
      const known=st.tips.get(shown.code);st.tips.set(shown.code,{title:shown.title,action:shown.action,count:(known?.count??0)+1});
    }
    st.lastTip=shown.tone==='warning'?shown.code:'';
  };
  function celebrate(){
    const st=stats.current;st.streak++;st.bestStreak=Math.max(st.bestStreak,st.streak);setStreak(st.streak);playCue('good');buzz(12);
    const p=lastPoint.current??{x:.5,y:.42};const id=++popId.current;setPops(list=>[...list.slice(-2),{id,x:p.x,y:p.y}]);setTimeout(()=>setPops(list=>list.filter(x=>x.id!==id)),800);
  }
  function stumble(expectedId:Gesture){
    const st=stats.current;st.wrong[expectedId]=(st.wrong[expectedId]??0)+1;st.streak=0;setStreak(0);playCue('miss');buzz([30,40,30]);
    setMiss(true);clearTimeout(missTimeout.current);missTimeout.current=setTimeout(()=>setMiss(false),320);
  }
  function resetStats(){stats.current={wrong:{},tips:new Map(),streak:0,bestStreak:0,lastTip:''};setStreak(0);setPops([]);setSummary(null);}
  const pause=useRef({since:0,missingSince:0});const flashTimeout=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);const noteTimeout=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  state.current={...state.current,phase,index,mistakes,mode};
  const score=Math.max(0,index*100-mistakes*25);
  function reset() {
    stopBow();detector.current.reset();resetStats();dwell.current={since:0,anchor:null,replayArmed:false,missingSince:0,frames:[]};
    state.current={...state.current,phase:'ready',index:0,mistakes:0};setIndex(0);setMistakes(0);setSeconds(45);setPhase('ready');setRecognized(null);setTrace([]);setReadyProgress(0);coachLatch.current.reset();publish.current(coach('setup','Подготовь руку',profile.setup),performance.now(),true);pause.current={since:0,missingSince:0};setTrackingPaused(false);setCalibrated(false);
  }
  beginRef.current=()=>{
    const s=state.current;s.phase='playing';s.index=0;s.mistakes=0;s.start=Date.now();detector.current.reset();resetStats();playCue('start');detector.current.calibrate(dwell.current.frames);setCalibrated(s.mode==='live');pause.current={since:0,missingSince:0};setTrackingPaused(false);
    setPhase('playing');setIndex(0);setMistakes(0);setSeconds(45);setReadyProgress(0);publish.current(coach('begin',gestures[0].name,gestures[0].instruction),performance.now(),true);
  };
  finishRef.current=()=>{
    const s=state.current;if(s.phase!=='playing')return;
    s.phase='done';s.finished=performance.now();stopBow();setPhase('done');dwell.current={since:0,anchor:null,replayArmed:false,missingSince:0,frames:[]};
    const finalScore=Math.max(0,s.index*100-s.mistakes*25);const st=stats.current;const real=s.mode==='live';
    const previous=getProgress().filter(p=>!p.demo&&p.instrument===instrument.name);
    const tips=[...st.tips.values()].sort((a,b)=>b.count-a.count).slice(0,3);
    const elapsed=Math.min(45,Math.max(1,45-seconds));
    const entry:Performance={id:crypto.randomUUID(),instrument:instrument.name,notes:s.index,mistakes:s.mistakes,score:finalScore,date:new Date().toISOString(),demo:!real,seconds:elapsed,wrong:st.wrong,tips};
    setSaved(savePerformance(entry));onComplete();
    const record=real&&finalScore>0&&finalScore>Math.max(0,...previous.map(p=>p.score));
    playCue(record?'record':'finish');buzz(record?[20,50,20,50,60]:40);
    setSummary({record,rank:real?previous.filter(p=>p.score>finalScore).length+1:0,accuracy:s.index+s.mistakes?Math.round(s.index/(s.index+s.mistakes)*100):0,seconds:elapsed,bestStreak:st.bestStreak,tips,
      weak:Object.entries(st.wrong).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([id,count])=>({name:gestures.find(g=>g.id===id)?.name??id,count})),board:topScores(instrument.name),currentId:entry.id});
  };
  action.current=(g,strength=.7)=>{
    const s=state.current;if(s.phase!=='playing')return;
    if(s.mode==='demo'||instrument.id==='dombyra')playNote(g,instrument.id,strength);
    setRecognized(g);clearTimeout(noteTimeout.current);noteTimeout.current=setTimeout(()=>setRecognized(null),700);
    if(g===melody[s.index]){
      s.index++;setIndex(s.index);celebrate();setFlash(true);clearTimeout(flashTimeout.current);flashTimeout.current=setTimeout(()=>setFlash(false),350);publish.current(coach('success','Получилось! +100', 'Теперь: '+(gestures.find(t=>t.id===melody[s.index])?.name??'выступление завершено')+'.',undefined,'success'),performance.now(),true);
      if(s.index===melody.length)finishRef.current();
    }else{s.mistakes++;setMistakes(s.mistakes);stumble(melody[s.index]);const expected=gestures.find(x=>x.id===melody[s.index])!;const actual=gestures.find(x=>x.id===g)!;publish.current(coach('wrong-'+g,'Получился «'+actual.name+'»','Сейчас нужен «'+expected.name+'». '+expected.instruction,undefined,'warning'),performance.now(),true);}
  };
  useEffect(()=>{if(phase!=='playing')return;const interval=setInterval(()=>{const remaining=Math.max(0,45-Math.floor((Date.now()-state.current.start-(pause.current.since?Date.now()-pause.current.since:0))/1000));setSeconds(remaining);if(!remaining)finishRef.current();},200);return()=>clearInterval(interval);},[phase]);
  useEffect(()=>()=>{clearTimeout(flashTimeout.current);clearTimeout(noteTimeout.current);clearTimeout(missTimeout.current);stopBow();},[]);
  useEffect(()=>{try{localStorage.setItem('mura-show-ar',String(showAR));}catch{/* Optional preference. */}},[showAR]);
  // Phones dim the screen while nobody touches it; keep it awake during a performance.
  useEffect(()=>{
    if(!mode||!('wakeLock' in navigator))return;
    let lock:WakeLockSentinel|undefined;
    const request=async()=>{try{lock=await navigator.wakeLock.request('screen');}catch{/* Optional: denied in low-power mode. */}};
    const onVisible=()=>{if(!document.hidden)void request();};
    void request();document.addEventListener('visibilitychange',onVisible);
    return()=>{document.removeEventListener('visibilitychange',onVisible);void lock?.release();};
  },[mode]);
  useEffect(()=>{
    const el=stage.current;if(!el)return;
    const resize=()=>{const width=Math.min(el.clientWidth,el.clientHeight*aspect);setViewport({width,height:width/aspect});};
    resize();const observer=new ResizeObserver(resize);observer.observe(el);return()=>observer.disconnect();
  },[mode,aspect]);
  useEffect(()=>{
    if(mode!=='live')return;
    let cancelled=false;let stream:MediaStream|undefined;let model:HandLandmarker|undefined;let frame=0;let previousFrame=-1;let lastTime=0;let lastPaint=0;let rateStart=performance.now();let processed=0;let anchor:Point=profile.ready;let videoCallback=false;
    const draw=(points:Point[],valid:boolean)=>{
      const c=canvas.current;const v=video.current;if(!c||!v)return;
      if(c.width!==(v.videoWidth||640))c.width=v.videoWidth||640;if(c.height!==(v.videoHeight||480))c.height=v.videoHeight||480;const ctx=c.getContext('2d');if(!ctx)return;
      ctx.clearRect(0,0,c.width,c.height);ctx.strokeStyle=valid?'#4fcbc1':'#e6ac3c';ctx.fillStyle=valid?'#b8f3ee':'#ffd98f';ctx.lineWidth=2;
      for(const [a,b]of connections){if(!points[a]||!points[b])continue;ctx.beginPath();ctx.moveTo(points[a].x*c.width,points[a].y*c.height);ctx.lineTo(points[b].x*c.width,points[b].y*c.height);ctx.stroke();}
      for(const p of points){if(!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;ctx.beginPath();ctx.arc(p.x*c.width,p.y*c.height,3,0,Math.PI*2);ctx.fill();}
    };
    const loop=()=>{
      if(cancelled)return;
      const now=performance.now();
      const v=video.current;
      if(v&&model&&v.readyState>=2&&v.currentTime!==previousFrame&&now-lastTime>=28){
        previousFrame=v.currentTime;lastTime=now;
        try{
          const all=model.detectForVideo(v,now).landmarks.map(hand=>hand.map(p=>({...p,x:1-p.x})));
          const points=selectHand(all,anchor);const quality=handQuality(points);const s=state.current;
          const center=quality?null:palmPoint(points);if(center)anchor=center;
          const paint=now-lastPaint>=60;processed++;
          if(now-rateStart>1500){setTrackingRate(Math.round(processed*1000/(now-rateStart)));processed=0;rateStart=now;}
          if(paint){lastPaint=now;setHandPresent(!quality);}
          if(s.phase==='playing'){
            if(quality){
              if(!pause.current.missingSince)pause.current.missingSince=Date.now();
              if(!pause.current.since&&Date.now()-pause.current.missingSince>600){pause.current.since=Date.now();setTrackingPaused(true);}
            }else{
              if(pause.current.since){s.start+=Date.now()-pause.current.since;setTrackingPaused(false);}
              pause.current={since:0,missingSince:0};
            }
            const result=detector.current.update(points,now,melody[s.index]);
            if(paint){lastPoint.current=result.point;setContact(result.point);setTrace(result.trace);}
            draw(points,result.inZone&&!quality);
            if(instrument.id==='kobyz')updateBow(result.bowSpeed);
            // Drum audio follows each physical impact immediately; score waits for the double-hit window.
            for(const hit of result.impacts){playNote(hit.gesture,instrument.id,hit.strength);setRecognized(hit.gesture);clearTimeout(noteTimeout.current);noteTimeout.current=setTimeout(()=>setRecognized(null),220);}
            for(const event of result.events)action.current(event.gesture,event.strength);
            if(!result.events.length&&paint)publish.current(result.coach,now);
          }else{
            stopBow();if(paint){setContact(center);setTrace([]);}draw(points,!quality);
            const d=dwell.current;
            if(quality){if(!d.missingSince)d.missingSince=now;if(s.phase==='done'&&now-d.missingSince>350)d.replayArmed=true;}
            else d.missingSince=0;
            const permitted=s.phase==='ready'||(s.phase==='done'&&d.replayArmed&&now-s.finished>2500);
            const onTarget=!!center&&(s.phase==='done'||distance(center,profile.ready)<.115);
            if(permitted&&onTarget){
              if(!d.anchor||distance(center!,d.anchor)>.055){d.anchor=center;d.since=now;d.frames=[];}
              d.frames.push(points);if(d.frames.length>90)d.frames.shift();
              const progress=Math.min(1,(now-d.since)/1000);if(paint)setReadyProgress(progress);
              if(progress>=1){if(s.phase==='done')reset();else beginRef.current();d.anchor=null;d.since=0;}
            }else if(!quality||!d.missingSince||now-d.missingSince>180){d.anchor=null;d.since=0;d.frames=[];if(paint)setReadyProgress(0);}
            if(s.phase==='ready'&&paint)publish.current(quality?coach('ready-lost','Покажи руку',quality,profile.ready,'warning'):onTarget?coach('calibrating','Настраиваюсь под твою руку','Задержи точку на метке ещё на мгновение.',profile.ready):coach('ready-target','Кисть к жёлтой метке','Совмести светящуюся точку с кругом. Нажимать ничего не нужно.',profile.ready),now);
          }
        }catch{stopBow();setError('Не удалось обработать изображение. Перезапусти камеру или открой демо.');stream?.getTracks().forEach(t=>t.stop());return;}
      }
      schedule();
    };
    function schedule(){
      if(cancelled)return;
      if(video.current?.requestVideoFrameCallback){videoCallback=true;frame=video.current.requestVideoFrameCallback(loop);}
      else{videoCallback=false;frame=requestAnimationFrame(loop);}
    }
    async function init(){
      setLoading(true);setError('');
      try{
        if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw new Error('secure');
        stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:640},height:{ideal:480},frameRate:{ideal:60,max:60}}});
        if(cancelled){stream.getTracks().forEach(t=>t.stop());return;}
        if(video.current){video.current.srcObject=stream;await video.current.play();}
        const {FilesetResolver,HandLandmarker}=await import('@mediapipe/tasks-vision');const vision=await FilesetResolver.forVisionTasks('/wasm');if(cancelled)return;
        const options={runningMode:'VIDEO' as const,numHands:2,minHandDetectionConfidence:.5,minHandPresenceConfidence:.45,minTrackingConfidence:.4};
        try{model=await HandLandmarker.createFromOptions(vision,{...options,baseOptions:{modelAssetPath:'/models/hand_landmarker.task',delegate:'GPU'}});}
        catch{if(cancelled)return;model=await HandLandmarker.createFromOptions(vision,{...options,baseOptions:{modelAssetPath:'/models/hand_landmarker.task',delegate:'CPU'}});}
        if(cancelled){model.close();return;}
        setLoading(false);reset();rateStart=performance.now();processed=0;schedule();
      }catch(e){
        stream?.getTracks().forEach(t=>t.stop());if(cancelled)return;setLoading(false);const name=(e as Error).name;
        setError((e as Error).message==='secure'?'Для камеры нужна защищённая ссылка HTTPS или localhost. Открой сайт по HTTPS.':name==='NotAllowedError'?'Доступ к камере закрыт. Разреши камеру в настройках сайта рядом с адресной строкой и попробуй снова.':name==='NotFoundError'?'Камера не найдена. Подключи веб-камеру или открой ссылку на телефоне.':name==='NotReadableError'?'Камера занята другим приложением. Закрой его и попробуй снова.':'Не удалось запустить распознавание. Проверь соединение и доступ к камере, затем попробуй снова.');
      }
    }
    const onVisibility=()=>{if(document.hidden){stopBow();detector.current.reset();if(state.current.phase==='playing'&&!pause.current.since){pause.current.since=Date.now();setTrackingPaused(true);}}};
    document.addEventListener('visibilitychange',onVisibility);void init();
    return()=>{cancelled=true;if(videoCallback)video.current?.cancelVideoFrameCallback(frame);else cancelAnimationFrame(frame);stream?.getTracks().forEach(t=>t.stop());model?.close();stopBow();document.removeEventListener('visibilitychange',onVisibility);};
  },[mode,instrument.id]);
  async function start(demo=false){await unlockAudio().catch(()=>{});setError('');setMode(demo?'demo':'live');if(demo){setLoading(false);reset();}}
  const expected=gestures.find(g=>g.id===melody[index]);
  const status=mode==='demo'?'Демо без камеры':trackingPaused?'Пауза: верни руку в кадр':handPresent?'Кисть в кадре':'Ищем руку';
  const CoachIcon=guidance.tone==='success'?Check:guidance.tone==='warning'?CircleAlert:Lightbulb;
  const coachKind=mode==='demo'?'Демо':guidance.tone==='success'?'Получилось':guidance.tone==='warning'?'Поправь':'Подсказка';
  return <div className="session-sheet" role="dialog" aria-modal="true" aria-labelledby="session-title"><div className="session-inner">
    <div className="session-top">
      <div className="session-title"><h2 id="session-title">{instrument.name}<span> / {instrument.kazakh}</span></h2>{mode&&<span className="pill">{mode==='demo'?'Демо · без камеры':'С камерой'}</span>}</div>
      <div className="session-tools"><button className="icon-button sound-button" aria-pressed={sound} onClick={toggleSound} aria-label={sound?'Выключить звук':'Включить звук'}>{sound?<Volume2 size={19}/>:<VolumeX size={19}/>}</button><button className="icon-button" onClick={close} aria-label="Закрыть"><X size={20}/></button></div>
    </div>
    {!mode?<div className="session-intro">
      <div className={`intro-art ${instrument.color}`}><InstrumentArt type={instrument.id}/></div>
      <div className="intro-content">
        <h3>Почувствуй<br/>{instrument.id==='dombyra'?'движение струн.':instrument.id==='kobyz'?'ход смычка.':'силу ритма.'}</h3>
        <p className="lead">{profile.setup}</p>
        <div className="intro-gestures">{gestures.map(g=><div key={g.id}><span className="technique-symbol">{g.symbol}</span><div><b>{g.name}</b><small>{g.action}</small></div></div>)}</div>
        <p className="intro-challenge">9 приёмов, 45 секунд, до 900 баллов</p>
        <div className="intro-cta">
          <button className="button primary" onClick={()=>void start()}><Camera size={18}/> Включить камеру</button>
          <button className="text-button" onClick={()=>void start(true)}>Попробовать демо без камеры</button>
        </div>
        <p className="privacy-note"><ShieldCheck size={15}/> Видео остаётся на устройстве. Инструмент поверх камеры можно скрыть.</p>
      </div>
    </div>:<div className="session-play">
      <div className="session-main">
        <div className="session-bar">
          <div className="session-stats"><span><b>{seconds}</b> {trackingPaused?'пауза':'сек'}</span><span><b>{index}</b> из 9</span><span><b>{score}</b> баллов</span>{streak>=2&&<span className="streak" key={streak}>Серия ×{streak}</span>}</div>
          <button className={`ar-toggle ${showAR?'is-on':''}`} aria-pressed={showAR} onClick={()=>setShowAR(!showAR)}>{showAR?<EyeOff size={16}/>:<Eye size={16}/>} {showAR?'Скрыть AR-инструмент':'Показать AR-инструмент'}</button>
        </div>
        <div ref={stage} className={`camera-stage motion-stage ${flash?'note-flash':''} ${miss?'note-miss':''}`} style={{aspectRatio:aspect}}>
          <div className="camera-viewport" style={{width:viewport.width||'100%',height:viewport.height||'100%'}}>
            {mode==='live'&&<><video ref={video} muted playsInline autoPlay onLoadedMetadata={e=>{const v=e.currentTarget;setAspect(v.videoWidth/v.videoHeight||4/3);}}/><canvas ref={canvas}/></>}
            {pops.map(p=><span key={p.id} className="score-pop" style={{left:`${p.x*100}%`,top:`${p.y*100}%`}}>+100</span>)}
            {!loading&&!error&&<ARInstrument instrument={instrument.id} visible={showAR} point={contact} trace={trace} active={recognized} target={phase==='playing'||phase==='ready'?guidance.target:undefined} ready={mode==='live'&&phase==='ready'} progress={readyProgress}/>}
          </div>
          {!loading&&!error&&phase!=='done'&&<div className="camera-status"><span className={`live-dot ${handPresent||mode==='demo'?'':'muted'}`}/>{status}</div>}
          {loading&&<div className="stage-overlay"><LoaderCircle className="spin" size={36}/><h3>Готовим твою сцену</h3><p>Запускаем камеру и распознавание движений…</p></div>}
          {error&&<div className="stage-overlay"><Camera size={32}/><h3>Камере нужна помощь</h3><p>{error}</p><button className="button light" onClick={()=>{setMode(null);setPhase('intro');setError('');}}>Попробовать снова</button><button className="text-button light-text" onClick={()=>void start(true)}>Открыть демо</button></div>}
          {!loading&&!error&&phase==='ready'&&(mode==='demo'?<div className="demo-ready"><p>Послушай приёмы и собери мелодию. В демо вместо движений работают кнопки.</p><button className="button light" onClick={()=>beginRef.current()}>Начать выступление</button></div>:<div className="motion-ready-label"><b>Совмести точку на кисти с меткой</b><span>Задержись на секунду — выступление начнётся само</span><div className="ready-meter"><i style={{'--p':readyProgress} as React.CSSProperties}/></div></div>)}
          {phase==='done'&&<div className="stage-overlay result-overlay"><div className="trophy-circle"><Trophy size={30}/></div><span className="muted">{mode==='demo'?'Демо завершено':'Твоё выступление завершено'}</span><h3>{index===9?'Звучит как начало большого пути!':'Музыка начинается с практики'}</h3><div className="result-score">{score}<span> / 900 баллов</span></div><p>{index} из 9 приёмов, ошибок: {mistakes}</p><button className="button light" onClick={reset}><RotateCcw size={16}/> Сыграть ещё</button>{mode==='live'&&<small>Без кнопки: убери руку из кадра, затем покажи и задержи её на секунду</small>}<small>{saved?mode==='demo'?'Демо сохранено отдельно от настоящих выступлений':'Результат сохранён на этом устройстве':'Не удалось сохранить результат: память браузера недоступна'}</small></div>}
        </div>
        <div className="session-footer"><span><Maximize size={14}/> {showAR?'Играй в подсвеченной зоне':'AR скрыт, игровая зона остаётся на месте'}</span><span><ShieldCheck size={14}/> {mode==='live'&&calibrated?'Подстроено под руку · ':''}{mode==='live'&&trackingRate>0?`${trackingRate} кадр/с`:'Видео только на устройстве'}</span></div>
      </div>
      {phase!=='done'&&<aside className="session-side">
        <div className={`gesture-feedback coach-feedback ${guidance.tone==='success'?'success':guidance.tone==='warning'?'coach-warning':''}`} aria-live="polite" aria-atomic="true">
          <span className="coach-icon"><CoachIcon size={20}/></span>
          <div className="coach-text" key={mode==='demo'?'demo':guidance.code}>
            <span className="coach-kind">{coachKind}</span>
            <b>{mode==='demo'?'Пробуем без камеры':guidance.title}</b>
            <span>{mode==='demo'?'Выбирай карточки приёмов. С камерой те же звуки играются движением руки.':guidance.action}</span>
            {mode==='live'&&trackingPaused&&<small>Таймер ждёт — за потерю руки баллы не снимаются.</small>}
          </div>
        </div>
        {phase==='playing'&&<div className="next-gesture"><span className="technique-symbol">{expected?.symbol}</span><div><small>Следующий приём</small><strong>{expected?.name}</strong></div></div>}
        <p className="motion-instruction">{phase==='playing'?expected?.instruction:profile.setup}</p>
        <div className="gesture-controls">{gestures.map(g=><button key={g.id} disabled={mode!=='demo'||phase!=='playing'} className={`gesture-control ${phase==='playing'&&g.id===melody[index]?'expected':''} ${recognized===g.id?'detected':''}`} onClick={()=>action.current(g.id)} title={g.instruction}><span className="technique-symbol">{g.symbol}</span><b>{g.name}</b><small>{g.action}</small>{recognized===g.id&&<Check size={16}/>}</button>)}</div>
        <div className="melody-track" aria-label={`Мелодия: ${index} из 9`}>{melody.map((g,i)=><span key={i} className={i<index?'complete':i===index?'current':''}>{i<index?<Check size={14}/>:gestures.find(x=>x.id===g)?.symbol}</span>)}</div>
      </aside>}
      {phase==='done'&&summary&&<aside className="session-side"><section className="summary" aria-label="Разбор выступления">
        <h3 className="summary-title">{summary.record?'Новый рекорд':mode==='demo'?'Разбор демо':'Разбор выступления'}</h3>
        {summary.rank>0&&!summary.record&&<p className="muted">Это {summary.rank}-й результат на этом инструменте.</p>}
        <div className="summary-stats"><div><b>{summary.accuracy}%</b><span>точность</span></div><div><b>{summary.seconds}</b><span>сек</span></div><div><b>×{summary.bestStreak}</b><span>лучшая серия</span></div></div>
        {summary.tips.length>0?<div className="summary-block"><h4>Что поправить</h4>{summary.tips.map(t=><div className="hint" key={t.title}><Lightbulb size={18}/><b>{t.title}</b><span>{t.action}</span></div>)}</div>
          :<p className="summary-clean">Техника чистая: подсказки не понадобились.</p>}
        {summary.weak.length>0&&<div className="summary-block"><h4>Чаще всего не выходило</h4><ul className="weak-list">{summary.weak.map(w=><li key={w.name}><span>{w.name}</span><b>×{w.count}</b></li>)}</ul></div>}
        {mode==='live'&&summary.board.length>0&&<div className="summary-block"><h4>Твои лучшие</h4><ol className="rank-list">{summary.board.map((p,i)=><li key={p.id} className={`rank-row ${p.id===summary.currentId?'is-current':''}`}><span className="rank-n">{i+1}</span><span>{new Date(p.date).toLocaleDateString('ru-RU',{day:'numeric',month:'short'})}</span><strong>{p.score}</strong></li>)}</ol></div>}
      </section></aside>}
    </div>}
  </div></div>;
}
