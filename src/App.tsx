import { useEffect, useRef, useState } from 'react';
import { ArrowRight, AudioLines, CheckCheck, Copy, Download, ExternalLink, Lightbulb, Play, QrCode, ShieldCheck, Volume2, VolumeX, X } from 'lucide-react';
import QRCode from 'qrcode';
import { InstrumentArt } from './components/InstrumentArt';
import { Session, type Instrument } from './components/Session';
import { getProgress } from './lib/progress';
import { playNote, setSound, unlockAudio } from './lib/audio';
import { getProfile } from './lib/gestures';

export const instruments: Instrument[] = [
  { id: 'dombyra', name: 'Домбра', kazakh: 'Домбыра', category: 'Струнные', subtitle: 'Две струны. Тысяча историй.', description: 'Знакомый щипковый звук и голос казахской степи. Начни своё знакомство с музыкой с двух струн.', tag: 'Идеально для начала', color: 'sand' },
  { id: 'kobyz', name: 'Кобыз', kazakh: 'Қобыз', category: 'Струнные', subtitle: 'Голос, связывающий времена.', description: 'Смычковый инструмент с глубоким, протяжным звучанием. Открой для себя его необычный тембр.', tag: 'Глубокое звучание', color: 'sage' },
  { id: 'dauylpaz', name: 'Дауылпаз', kazakh: 'Дауылпаз', category: 'Ударные', subtitle: 'Почувствуй ритм степи.', description: 'Традиционный барабан с мощным, объёмным звуком. Создай свой ритм одним движением руки.', tag: 'Поймай ритм', color: 'rose' },
];

type Page = 'collection' | 'guide' | 'progress' | 'about';
const nav: { id: Page; label: string }[] = [
  { id: 'collection', label: 'Инструменты' },
  { id: 'guide', label: 'Как это работает' },
  { id: 'progress', label: 'Мои достижения' },
  { id: 'about', label: 'О проекте' },
];

/** Ram's-horn (koshkar-muiz) motif, the one ornament the whole interface borrows. */
function Mark({ size = 30 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true"><path d="M50 8v84M50 24C4-6 2 46 36 40C42 8-8 6 22 50M50 24C96-6 98 46 64 40C58 8 108 6 78 50M50 76C4 106 2 54 36 60C42 92-8 94 22 50M50 76C96 106 98 54 64 60C58 92 108 94 78 50" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

const mistakeExamples = [
  { who: 'Домбра', title: 'Рука идёт вдоль струн', tip: 'Проведи её поперёк: сверху вниз.' },
  { who: 'Кобыз', title: 'Смычок ушёл по диагонали', tip: 'Держи руку на одной высоте и веди вбок по дорожке.' },
  { who: 'Дауылпаз', title: 'Сейчас нужен край', tip: 'Сдвинь кисть к метке сбоку, затем ударь вниз.' },
];

export default function App() {
  const [page, setPage] = useState<Page>('collection');
  const [guideInstrument, setGuideInstrument] = useState('dombyra');
  const guideGestures = getProfile(guideInstrument).gestures;
  const [session, setSession] = useState<Instrument | null>(() => instruments.find(i => i.id === new URLSearchParams(location.search).get('instrument')) ?? null);
  const [qr, setQr] = useState<Instrument | null>(null);
  const [qrImage, setQrImage] = useState('');
  const [qrError, setQrError] = useState('');
  const [copied, setCopied] = useState(false);
  const [sound, updateSound] = useState(true);
  const [progress, setProgress] = useState(getProgress);
  const [preview, setPreview] = useState<string | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const previewEnd = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dialogRef = useRef<HTMLDivElement>(null);
  const realProgress = progress.filter(p => !p.demo);
  const best = Math.max(0, ...realProgress.map(p => p.score));
  const url = qr ? `${location.origin}${location.pathname}?instrument=${qr.id}` : '';

  useEffect(() => { setSound(sound); }, [sound]);

  useEffect(() => {
    if (!qr) return;
    let active = true;
    setQrImage(''); setQrError(''); setCopied(false);
    QRCode.toDataURL(url, { width: 520, margin: 2, color: { dark: '#0b1620', light: '#ffffff' } })
      .then(image => { if (active) setQrImage(image); })
      .catch(() => { if (active) setQrError('Не удалось создать QR-код. Скопируй ссылку ниже.'); });
    return () => { active = false; };
  }, [qr, url]);

  useEffect(() => {
    if (!session && !qr) return;
    const previous = document.activeElement as HTMLElement;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector<HTMLElement>('button')?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSession(null); setQr(null); }
      if (e.key === 'Tab') {
        const elements = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input') ?? []);
        const first = elements[0]; const last = elements.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', handler);
    return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', handler); previous?.focus(); };
  }, [session, qr]);

  useEffect(() => () => { clearTimeout(previewTimer.current); clearTimeout(previewEnd.current); clearTimeout(copyTimer.current); }, []);

  function navigate(p: Page) { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  async function listen(i: Instrument) {
    clearTimeout(previewTimer.current); clearTimeout(previewEnd.current);
    if (preview === i.id) { setPreview(null); return; }
    await unlockAudio().catch(() => {});
    setPreview(i.id);
    playNote(getProfile(i.id).gestures[0].id, i.id);
    previewTimer.current = setTimeout(() => playNote(getProfile(i.id).gestures[1].id, i.id), 450);
    previewEnd.current = setTimeout(() => setPreview(null), 1800);
  }

  function copyLink() {
    void navigator.clipboard.writeText(url)
      .then(() => { setCopied(true); clearTimeout(copyTimer.current); copyTimer.current = setTimeout(() => setCopied(false), 2500); })
      .catch(() => setQrError('Не удалось скопировать. Выдели ссылку ниже вручную.'));
  }

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); navigate('collection'); }} aria-label="MURA — на главную">
        <Mark /><span className="brand-word">MURA</span>
      </a>
      <nav className="main-nav" aria-label="Разделы">
        {nav.map(item => <button key={item.id} aria-current={page === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}>{item.label}</button>)}
      </nav>
      <div className="topbar-actions">
        <button className="icon-button sound-button" aria-pressed={sound} onClick={() => updateSound(!sound)} aria-label={sound ? 'Выключить звук' : 'Включить звук'} title={sound ? 'Выключить звук' : 'Включить звук'}>
          {sound ? <Volume2 size={19} /> : <VolumeX size={19} />}
        </button>
      </div>
    </header>

    <main className="page-content">
      {page === 'collection' && <>
        <section className="hero">
          <div className="hero-head">
            <h1 className="display">Музыка в твоих руках.</h1>
            <div className="hero-aside">
              <p className="lead">Встань перед камерой и играй на казахских инструментах жестами. Ничего устанавливать не нужно.</p>
              <button className="button primary" onClick={() => setSession(instruments[0])}>Начать играть <ArrowRight size={18} /></button>
              <p className="hero-privacy"><ShieldCheck size={16} /> Видео остаётся на твоём устройстве</p>
            </div>
          </div>
          <div className="arches">
            {instruments.map((i, n) => <article className={`instrument-card arch ${i.color}`} key={i.id} style={{ '--i': n } as React.CSSProperties}>
              <div className="arch-tools">
                <button className="qr-button" onClick={() => setQr(i)} aria-label={`QR-код: ${i.name}`} title="Открыть на телефоне"><QrCode size={18} /></button>
              </div>
              <div className="arch-art"><InstrumentArt type={i.id} /></div>
              <div className="arch-body">
                <h3 className="arch-name">{i.name}</h3>
                <span className="arch-kz">{i.kazakh}</span>
                <p className="arch-line">{i.subtitle}</p>
                <div className="arch-actions">
                  <button className="button primary play-instrument" onClick={() => setSession(i)}>Играть</button>
                  <button className={`listen-button ${preview === i.id ? 'is-playing' : ''}`} disabled={!sound} onClick={() => void listen(i)} aria-label={`Послушать: ${i.name}`} title={sound ? 'Послушать звук' : 'Сначала включи звук'}>
                    {preview === i.id ? <AudioLines size={18} /> : <Play size={16} fill="currentColor" />}
                  </button>
                </div>
              </div>
            </article>)}
          </div>
        </section>

        <section className="section">
          <div className="section-head"><h2 className="display">От жеста до мелодии</h2></div>
          <ol className="steps" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <li className="step"><span className="step-n">1</span><h3>Выбери инструмент</h3><p>Домбра, кобыз или дауылпаз. У каждого свой набор движений.</p></li>
            <li className="step"><span className="step-n">2</span><h3>Включи камеру</h3><p>Покажи кисть и задержи её на метке на секунду. Приложение подстроится под твою руку.</p></li>
            <li className="step"><span className="step-n">3</span><h3>Играй руками</h3><p>Девять приёмов за сорок пять секунд. В конце получишь счёт и рекорд.</p></li>
          </ol>
        </section>

        <section className="section">
          <div className="mistake">
            <div className="prose">
              <h2 className="display">Ошибся? Подскажем, что поправить</h2>
              <p>Приложение не просто говорит «не распознано». Оно видит, где рука и куда она идёт, и называет одно конкретное действие. Подсказка появляется прямо на экране, а метка показывает, куда двигать кисть.</p>
              <button className="text-button" onClick={() => navigate('guide')}>Как это устроено <ArrowRight size={16} /></button>
            </div>
            <div className="hint-stack">
              {mistakeExamples.map(h => <div className="hint" key={h.who}><Lightbulb size={20} /><b>{h.title}</b><span>{h.who}. {h.tip}</span></div>)}
            </div>
          </div>
        </section>

        <section className="section qr-banner">
          <h2 className="display">Увидел в музее? Оживи на телефоне.</h2>
          <button className="button secondary" onClick={() => setQr(instruments[0])}><QrCode size={18} /> Попробовать QR</button>
        </section>
      </>}

      {page === 'guide' && <>
        <div className="page-heading"><h1 className="display">Пусть руки говорят.</h1><p className="lead">Не условные знаки, а движения, которыми извлекают звук. Покажи камере одну играющую руку целиком.</p></div>
        <div className="tabs" role="group" aria-label="Приёмы инструмента">
          {instruments.map(i => <button key={i.id} aria-pressed={guideInstrument === i.id} onClick={() => setGuideInstrument(i.id)}>{i.name}</button>)}
        </div>
        <div className="guide-grid">
          {guideGestures.map(g => <article key={g.id} className="guide-card"><span className="technique-symbol">{g.symbol}</span><h3>{g.name}</h3><span className="pill">{g.action}</span><p>{g.instruction}</p></article>)}
        </div>
        <div className="section two-col">
          <section className="prose">
            <h2 className="display">Ошибаться — часть музыки</h2>
            <p>Приложение проверяет не позу, а траекторию: попала ли кисть на струны, сохраняет ли смычок высоту, поднимается ли рука между ударами. Если движение неточное, подсказка скажет, куда вести руку, а метка и стрелка покажут это на камере.</p>
            <blockquote>Рука слишком слева. Сдвинь кисть вправо, к струнам.</blockquote>
            <p>Бирюзовые точки — кисть в игровой зоне, золотые — её нужно переместить. Неподвижная рука звука не создаёт.</p>
          </section>
          <section className="prose">
            <h2 className="display">Твоя первая мелодия</h2>
            <p>Повтори девять приёмов за 45 секунд. Если камера потеряет руку, таймер подождёт. За каждый нужный приём — 100 баллов, за другой уверенно распознанный — минус 25. За неполное движение штрафа нет: сначала следуй подсказке.</p>
            <p>Рекорды хранятся на этом устройстве. Чтобы сыграть ещё раз без кнопки, убери руку из кадра, затем покажи и задержи её на метке.</p>
            <button className="text-button" onClick={() => navigate('progress')}>К моим достижениям <ArrowRight size={16} /></button>
          </section>
        </div>
      </>}

      {page === 'progress' && <>
        <div className="page-heading"><h1 className="display">Твоя музыкальная история.</h1><p className="lead">Маленькие открытия, которые остаются с тобой.</p></div>
        <div className="stats">
          <article className="stat"><strong>{best}</strong><span>Личный рекорд</span></article>
          <article className="stat"><strong>{realProgress.length}</strong><span>Выступлений с камерой</span></article>
          <article className="stat"><strong>{new Set(realProgress.map(p => p.instrument)).size}<small> / 3</small></strong><span>Инструментов открыто</span></article>
        </div>
        {progress.length
          ? <section className="history-list"><h2 className="display" style={{ marginBottom: 16 }}>Последние выступления</h2>
            {progress.map(p => <div className="history-row" key={p.id}>
              <div><b>{p.instrument}</b><small>{new Date(p.date).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}, {p.demo ? 'демо' : 'камера'}</small></div>
              <span className="muted">{p.notes}/9 приёмов</span>
              <strong>{p.score} <small>баллов</small></strong>
            </div>)}
          </section>
          : <section className="empty-state"><h2 className="display">Твоя первая нота ещё впереди</h2><p className="lead">Выбери инструмент и сыграй короткую мелодию. Здесь появится твой первый результат.</p><button className="button primary" onClick={() => navigate('collection')}>Выбрать инструмент <ArrowRight size={17} /></button></section>}
        <p className="storage-note"><ShieldCheck size={15} /> Результаты хранятся только в этом браузере. Демо не учитывается в рекордах.</p>
      </>}

      {page === 'about' && <>
        <div className="page-heading"><h1 className="display">Прошлое звучит по-новому.</h1><p className="lead">MURA (мұра — «наследие») — учебный интерактивный музей казахских инструментов. Сканируешь QR-код у экспоната, показываешь жест — и слышишь звук.</p></div>
        <div className="two-col">
          <section className="prose">
            <h2 className="display">Три инструмента, три характера</h2>
            <div>{instruments.map(i => <div className="about-instrument" key={i.id}><b>{i.name} <span className="kz">{i.kazakh}</span></b><p>{i.description}</p></div>)}</div>
          </section>
          <section className="prose">
            <h2 className="display">Как оживает музыка</h2>
            <p>MediaPipe находит 21 точку кисти прямо в браузере. Собственные правила анализируют историю движения: пересечение струн, направление и длину хода смычка, сближение пальцев при щипке и интервалы между ударами.</p>
            <p>Звук синтезируется в Web Audio. Это художественная интерпретация, а не запись музейных оригиналов. Видео не записывается и не отправляется на сервер.</p>
            <a className="text-button" href="https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js" target="_blank" rel="noreferrer">О технологии распознавания <ExternalLink size={14} /></a>
          </section>
        </div>
      </>}

      <footer className="page-footer"><span>© {new Date().getFullYear()} MURA</span><span>Традиции встречают технологии</span></footer>
    </main>

    {(session || qr) && <div ref={dialogRef}>
      {session && <Session key={session.id} instrument={session} close={() => { setSession(null); if (location.search) history.replaceState(null, '', location.pathname); }} onComplete={() => setProgress(getProgress())} />}
      {qr && <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setQr(null); }}>
        <section className="qr-modal" role="dialog" aria-modal="true" aria-labelledby="qr-title">
          <div className="modal-header"><span className="muted">Открой на телефоне</span><button className="icon-button" aria-label="Закрыть QR-код" onClick={() => setQr(null)}><X size={20} /></button></div>
          <h2 id="qr-title">{qr.name}. Наведи камеру на код.</h2>
          <div className="qr-image">{qrImage ? <img src={qrImage} alt={`QR-код ссылки на инструмент ${qr.name}`} /> : <p>{qrError || 'Создаём QR-код…'}</p>}</div>
          {['localhost', '127.0.0.1'].includes(location.hostname) && <p className="qr-local-note">Сейчас ссылка локальная. Для телефона размести приложение по HTTPS — QR-коды обновятся сами.</p>}
          <div className="qr-actions">
            <button className="button primary" onClick={copyLink}>{copied ? <CheckCheck size={16} /> : <Copy size={16} />} {copied ? 'Ссылка скопирована' : 'Скопировать ссылку'}</button>
            {qrImage && <a className="button secondary" href={qrImage} download={`mura-${qr.id}-qr.png`}><Download size={16} /> Скачать QR</a>}
          </div>
          {qrError && <p role="status" className="muted">{qrError}</p>}
          <input className="qr-url" value={url} readOnly aria-label="Ссылка на инструмент" onFocus={e => e.target.select()} />
        </section>
      </div>}
    </div>}
  </div>;
}
