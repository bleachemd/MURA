import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Camera, Check, CircleHelp, Hand, LoaderCircle, Maximize, Music2, RotateCcw, ShieldCheck, Timer, Trophy, X } from 'lucide-react';
import type { HandLandmarker } from '@mediapipe/tasks-vision';
import { classifyHand, gestures, melody, type Gesture, type Point } from '../lib/gestures';
import { playNote, unlockAudio } from '../lib/audio';
import { savePerformance } from '../lib/progress';
import { InstrumentArt } from './InstrumentArt';
export type Instrument = { id: string; name: string; kazakh: string; category: string; subtitle: string; description: string; tag: string; color: string };
type Phase = 'intro' | 'ready' | 'playing' | 'done';
const connections = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
export function Session({ instrument, close, onComplete }: { instrument: Instrument; close: () => void; onComplete: () => void }) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [mode, setMode] = useState<'live' | 'demo' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hint, setHint] = useState('Покажи открытую ладонь, чтобы начать.');
  const [recognized, setRecognized] = useState<Gesture | null>(null);
  const [index, setIndex] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [seconds, setSeconds] = useState(45);
  const [flash, setFlash] = useState(false);
  const [saved, setSaved] = useState(true);
  const video = useRef<HTMLVideoElement>(null); const canvas = useRef<HTMLCanvasElement>(null);
  const state = useRef({ phase, index, mistakes, mode, start: 0, finished: 0 });
  const action = useRef<(g: Gesture) => void>(() => {});
  const finishRef = useRef<() => void>(() => {});
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  state.current = { ...state.current, phase, index, mistakes, mode };
  const score = Math.max(0, index * 100 - mistakes * 25);
  function reset() { state.current = { ...state.current, phase: 'ready', index: 0, mistakes: 0 }; setIndex(0); setMistakes(0); setSeconds(45); setPhase('ready'); setHint('Покажи открытую ладонь и удержи её, чтобы начать.'); }
  finishRef.current = () => {
    const s = state.current; if (s.phase !== 'playing') return;
    s.phase = 'done'; s.finished = performance.now(); setPhase('done');
    setSaved(savePerformance({ id: crypto.randomUUID(), instrument: instrument.name, notes: s.index, mistakes: s.mistakes, score: Math.max(0, s.index * 100 - s.mistakes * 25), date: new Date().toISOString(), demo: s.mode === 'demo' }));
    onComplete();
  };
  action.current = (g) => {
    const s = state.current;
    if (s.phase === 'ready' || s.phase === 'done') {
      if (g !== 'palm' || (s.phase === 'done' && performance.now() - s.finished < 2500)) return;
      s.phase = 'playing'; s.index = 0; s.mistakes = 0; s.start = Date.now(); setPhase('playing'); setIndex(0); setMistakes(0); setSeconds(45); setHint('Поехали! Повтори подсвеченный жест.'); return;
    }
    if (s.phase !== 'playing') return;
    playNote(g, instrument.id);
    if (g === melody[s.index]) {
      s.index++; setIndex(s.index); setFlash(true); clearTimeout(flashTimeout.current); flashTimeout.current = setTimeout(() => setFlash(false), 350);
      setHint('Звучит отлично! Теперь следующий жест.');
      if (s.index === melody.length) finishRef.current();
    } else { s.mistakes++; setMistakes(s.mistakes); setHint(gestures.find(x => x.id === melody[s.index])!.instruction); }
  };
  useEffect(() => {
    if (phase !== 'playing') return;
    const interval = setInterval(() => { const remaining = Math.max(0, 45 - Math.floor((Date.now() - state.current.start) / 1000)); setSeconds(remaining); if (!remaining) finishRef.current(); }, 200);
    return () => clearInterval(interval);
  }, [phase]);
  useEffect(() => () => clearTimeout(flashTimeout.current), []);
  useEffect(() => {
    if (mode !== 'live') return;
    let cancelled = false; let stream: MediaStream | undefined; let model: HandLandmarker | undefined; let frame = 0;
    let previousFrame = -1; let lastTime = 0; let candidate: Gesture | null = null; let candidateSince = 0; let lastAccepted: Gesture | null = null;
    const draw = (points: Point[], valid: boolean) => {
      const c = canvas.current; const v = video.current; if (!c || !v) return;
      c.width = v.videoWidth || 640; c.height = v.videoHeight || 480; const ctx = c.getContext('2d'); if (!ctx) return;
      ctx.clearRect(0, 0, c.width, c.height); ctx.strokeStyle = valid ? '#cdeb94' : '#f4bb6b'; ctx.fillStyle = valid ? '#e4ffbe' : '#ffd09b'; ctx.lineWidth = 3;
      for (const [a,b] of connections) { if (!points[a] || !points[b]) continue; ctx.beginPath(); ctx.moveTo(points[a].x*c.width, points[a].y*c.height); ctx.lineTo(points[b].x*c.width, points[b].y*c.height); ctx.stroke(); }
      for (const p of points) { ctx.beginPath(); ctx.arc(p.x*c.width, p.y*c.height, 4, 0, Math.PI*2); ctx.fill(); }
    };
    const loop = (now: number) => {
      if (cancelled) return;
      const v = video.current;
      if (v && model && v.readyState >= 2 && v.currentTime !== previousFrame && now-lastTime > 65) {
        previousFrame = v.currentTime; lastTime = now;
        try {
          const result = model.detectForVideo(v, now); const points = result.landmarks[0] ?? [];
          const s = state.current; const expected = s.phase === 'playing' ? melody[s.index] : 'palm';
          const classification = classifyHand(points, expected); const g = classification.gesture;
          draw(points, g === expected); setRecognized(g);
          if (s.phase !== 'done') setHint(points.length ? classification.hint : 'Покажи руку целиком перед камерой. Добавь света, если темно.');
          if (g !== candidate) { candidate = g; candidateSince = now; }
          if (!g && now-candidateSince > 350) lastAccepted = null;
          const hold = s.phase === 'playing' ? 320 : 1000;
          if (g && now-candidateSince > hold && (g !== lastAccepted || (s.phase === 'done' && now-s.finished > 3500))) {
            lastAccepted = g; action.current(g);
            // The starting palm must be released before it can play the first note.
          }
        } catch { setError('Не удалось обработать изображение. Перезапусти камеру или открой демо.'); stream?.getTracks().forEach(t => t.stop()); return; }
      }
      frame = requestAnimationFrame(loop);
    };
    async function init() {
      setLoading(true); setError('');
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('secure');
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        if (video.current) { video.current.srcObject = stream; await video.current.play(); }
        const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
        const vision = await FilesetResolver.forVisionTasks('/wasm');
        if (cancelled) return;
        model = await HandLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: '/models/hand_landmarker.task', delegate: 'CPU' }, runningMode: 'VIDEO', numHands: 1, minHandDetectionConfidence: .6, minHandPresenceConfidence: .6, minTrackingConfidence: .6 });
        if (cancelled) { model.close(); return; }
        setLoading(false); reset(); frame = requestAnimationFrame(loop);
      } catch (e) {
        stream?.getTracks().forEach(t => t.stop()); if (cancelled) return;
        setLoading(false);
        const name = (e as Error).name;
        setError((e as Error).message === 'secure' ? 'Для камеры нужна защищённая ссылка HTTPS или localhost. Открой сайт по HTTPS.' : name === 'NotAllowedError' ? 'Доступ к камере закрыт. Разреши камеру в настройках сайта рядом с адресной строкой и попробуй снова.' : name === 'NotFoundError' ? 'Камера не найдена. Подключи веб-камеру или открой ссылку на телефоне.' : name === 'NotReadableError' ? 'Камера занята другим приложением. Закрой его и попробуй снова.' : 'Не удалось запустить распознавание. Проверь соединение и доступ к камере, затем попробуй снова.');
      }
    }
    void init();
    return () => { cancelled = true; cancelAnimationFrame(frame); stream?.getTracks().forEach(t => t.stop()); model?.close(); };
  }, [mode]); // Session is keyed by instrument, resources are released on unmount.
  async function start(demo = false) { await unlockAudio().catch(() => {}); setError(''); setMode(demo ? 'demo' : 'live'); if (demo) { setLoading(false); reset(); } }
  const expected = gestures.find(g => g.id === melody[index]);
  return <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) close(); }}><section className="session-modal" role="dialog" aria-modal="true" aria-labelledby="session-title">
    <div className="modal-header"><div className="eyebrow"><span className="live-dot"/> ТВОЯ МУЗЫКАЛЬНАЯ СЦЕНА</div><button className="icon-button" onClick={close} aria-label="Закрыть"><X size={21}/></button></div>
    <div className="session-title"><h2 id="session-title">{instrument.name}<span> / {instrument.kazakh}</span></h2><span className="pill">{mode === 'demo' ? 'Демо · без камеры' : 'Управление жестами'}</span></div>
    {!mode ? <div className="session-intro"><div className={`intro-art ${instrument.color}`}><InstrumentArt type={instrument.id}/><span className="art-caption">НАСЛЕДИЕ, КОТОРОЕ ЗВУЧИТ</span></div><div className="intro-content"><span className="eyebrow">ТВОЁ ПЕРВОЕ ВЫСТУПЛЕНИЕ</span><h3>Одна рука.<br/>Целая мелодия.</h3><p>Повтори 9 жестов за 45 секунд. Каждый точный жест — новый звук и 100 баллов.</p><div className="intro-gestures">{gestures.map(g=><div key={g.id}><span>{g.symbol}</span><div><b>{g.name}</b><small>{g.action}</small></div></div>)}</div><button className="button primary" onClick={()=>void start()}><Camera size={18}/> Включить камеру <ArrowRight size={18}/></button><button className="text-button" onClick={()=>void start(true)}>Попробовать демо без камеры <ArrowRight size={15}/></button><p className="privacy-note"><ShieldCheck size={15}/> Видео обрабатывается на устройстве и не сохраняется.</p></div></div> : <>
      <div className="session-stats"><span><Timer size={17}/> <b>{seconds}</b> сек</span><span><Music2 size={17}/><b>{index}</b> / 9 нот</span><span><Trophy size={17}/><b>{score}</b> баллов</span></div>
      <div className={`camera-stage ${flash ? 'note-flash' : ''}`}>
        {mode === 'live' && <><video ref={video} muted playsInline autoPlay/><canvas ref={canvas}/></>}
        {mode === 'demo' && <div className="demo-background"><InstrumentArt type={instrument.id}/><span>Демонстрация звуков · камера не используется</span></div>}
        {!loading && !error && phase !== 'done' && <div className="camera-status"><span className={`live-dot ${recognized ? '' : 'muted'}`}/>{mode === 'demo' ? 'ДЕМО-РЕЖИМ' : recognized ? 'РУКА РАСПОЗНАНА' : 'ИЩЕМ РУКУ'}</div>}
        {loading && <div className="stage-overlay"><LoaderCircle className="spin" size={36}/><h3>Готовим твою сцену</h3><p>Запускаем камеру и распознавание жестов…</p></div>}
        {error && <div className="stage-overlay"><Camera size={32}/><h3>Камере нужна помощь</h3><p>{error}</p><button className="button light" onClick={()=>{setMode(null);setPhase('intro');setError('');}}>Попробовать снова</button><button className="text-button light-text" onClick={()=>void start(true)}>Открыть демо</button></div>}
        {!loading && !error && phase === 'ready' && <div className="ready-prompt"><Hand size={42}/><h3>{mode === 'demo' ? 'Почувствуй музыку' : 'Покажи открытую ладонь'}</h3><p>{mode === 'demo' ? 'Нажимай на жесты под сценой, чтобы сыграть мелодию.' : 'Удержи 1 секунду. Затем опусти руку и покажи первый жест.'}</p>{mode === 'demo' && <button className="button light" onClick={()=>action.current('palm')}>Начать выступление <ArrowRight size={16}/></button>}</div>}
        {phase === 'playing' && !error && <div className="next-gesture"><span>{expected?.symbol}</span><div><small>СЛЕДУЮЩИЙ ЖЕСТ</small><strong>{expected?.name}</strong></div><span className="note-count">{index + 1}/9</span></div>}
        {phase === 'done' && <div className="stage-overlay result-overlay"><div className="trophy-circle"><Trophy size={34}/></div><span className="eyebrow">{mode === 'demo' ? 'ДЕМО ЗАВЕРШЕНО' : 'ТВОЁ ВЫСТУПЛЕНИЕ ЗАВЕРШЕНО'}</span><h3>{index === 9 ? 'Звучит как начало большого пути!' : 'Музыка начинается с практики'}</h3><div className="result-score">{score}<span> / 900 баллов</span></div><p>{index} из 9 нот · {mistakes} неточных жестов</p><button className="button light" onClick={reset}><RotateCcw size={16}/> Сыграть ещё</button>{mode === 'live' && <small>Или удержи открытую ладонь для нового выступления</small>}<small>{saved ? mode === 'demo' ? 'Демо сохранено отдельно от настоящих выступлений' : 'Результат сохранён на этом устройстве' : 'Не удалось сохранить результат: память браузера недоступна'}</small></div>}
      </div>
      {phase !== 'done' && <><div className={`gesture-feedback ${recognized && recognized === melody[index] ? 'success' : ''}`} aria-live="polite"><CircleHelp size={19}/><span>{mode === 'demo' ? 'Демо: нажимай на карточку нужного жеста. Для настоящего распознавания включи камеру.' : hint}</span></div><div className="gesture-controls">{gestures.map(g=><button key={g.id} disabled={mode !== 'demo' || phase !== 'playing'} className={`gesture-control ${phase === 'playing' && g.id === melody[index] ? 'expected' : ''} ${recognized === g.id ? 'detected' : ''}`} onClick={()=>action.current(g.id)}><span className="gesture-symbol">{g.symbol}</span><b>{g.name}</b><small>{g.action}</small>{recognized === g.id && <Check size={16}/>}</button>)}</div><div className="melody-track">{melody.map((g,i)=><span key={i} className={i < index ? 'complete' : i === index ? 'current' : ''}>{i<index ? <Check size={14}/> : gestures.find(x=>x.id===g)?.symbol}</span>)}</div></>}
      <div className="session-footer"><span><Maximize size={14}/> Рука целиком в кадре · хорошее освещение</span><span><ShieldCheck size={14}/> Только на твоём устройстве</span></div>
    </>}
  </section></div>;
}
