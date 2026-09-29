import { useEffect, useRef, useState } from 'react';
import { ArrowRight, AudioLines, CheckCheck, Copy, Download, ExternalLink, Lightbulb, Play, QrCode, ShieldCheck, Volume2, VolumeX, X } from 'lucide-react';
import QRCode from 'qrcode';
import { InstrumentArt } from './components/InstrumentArt';
import { Session, type Instrument } from './components/Session';
import { instrumentIds, languages, locales, useI18n } from './i18n';
import { getProgress, topScores } from './lib/progress';
import { playNote, setSound, unlockAudio } from './lib/audio';
import { getProfile } from './lib/gestures';

/** Russian names double as storage keys for saved performances; display text comes from the i18n dictionaries. */
export const instruments: Instrument[] = [
  { id: 'dombyra', name: 'Домбра', kazakh: 'Домбыра', category: 'Струнные', subtitle: 'Две струны. Тысяча историй.', description: 'Знакомый щипковый звук и голос казахской степи. Начни своё знакомство с музыкой с двух струн.', tag: 'Идеально для начала', color: 'sand' },
  { id: 'kobyz', name: 'Кобыз', kazakh: 'Қобыз', category: 'Струнные', subtitle: 'Голос, связывающий времена.', description: 'Смычковый инструмент с глубоким, протяжным звучанием. Открой для себя его необычный тембр.', tag: 'Глубокое звучание', color: 'sage' },
  { id: 'dauylpaz', name: 'Дауылпаз', kazakh: 'Дауылпаз', category: 'Ударные', subtitle: 'Почувствуй ритм степи.', description: 'Традиционный барабан с мощным, объёмным звуком. Создай свой ритм одним движением руки.', tag: 'Поймай ритм', color: 'rose' },
];

type Page = 'collection' | 'guide' | 'progress' | 'about';
const navIds: Page[] = ['collection', 'guide', 'progress', 'about'];

/** Ram's-horn (koshkar-muiz) motif, the one ornament the whole interface borrows. */
function Mark({ size = 22 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true"><path d="M50 8v84M50 24C4-6 2 46 36 40C42 8-8 6 22 50M50 24C96-6 98 46 64 40C58 8 108 6 78 50M50 76C4 106 2 54 36 60C42 92-8 94 22 50M50 76C96 106 98 54 64 60C58 92 108 94 78 50" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

const mistakeExamples = [{ who: 'dombyra', n: 1 }, { who: 'kobyz', n: 2 }, { who: 'dauylpaz', n: 3 }];

export default function App() {
  const { t, lang, setLang } = useI18n();
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
  const [boardFilter, setBoardFilter] = useState('all');
  const previewTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const previewEnd = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dialogRef = useRef<HTMLDivElement>(null);
  const realProgress = progress.filter(p => !p.demo);
  const best = Math.max(0, ...realProgress.map(p => p.score));
  const board = boardFilter === 'all' ? topScores(undefined, 10) : topScores(instruments.find(i => i.id === boardFilter)?.name, 10);
  const url = qr ? `${location.origin}${location.pathname}?instrument=${qr.id}` : '';
  const name = (id: string) => t(`inst.${id}.name`);
  const nameOf = (stored: string) => { const id = instrumentIds[stored]; return id ? name(id) : stored; };

  useEffect(() => { setSound(sound); }, [sound]);

  useEffect(() => {
    if (!qr) return;
    let active = true;
    setQrImage(''); setQrError(''); setCopied(false);
    QRCode.toDataURL(url, { width: 520, margin: 2, color: { dark: '#141110', light: '#ffffff' } })
      .then(image => { if (active) setQrImage(image); })
      .catch(() => { if (active) setQrError('qrm.err'); });
    return () => { active = false; };
  }, [qr, url]);

  useEffect(() => {
    if (!session && !qr) return;
    const previous = document.activeElement as HTMLElement;
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
    return () => { document.removeEventListener('keydown', handler); previous?.focus(); };
  }, [session, qr]);

  useEffect(() => () => { clearTimeout(previewTimer.current); clearTimeout(previewEnd.current); clearTimeout(copyTimer.current); }, []);

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
      .catch(() => setQrError('qrm.copyErr'));
  }

  return <div className="app">
    <a className="brand" href="#" onClick={e => { e.preventDefault(); setPage('collection'); }} aria-label={t('brand.aria')}>
      <Mark /><span className="brand-word">MURA</span>
    </a>
    <nav className="app-nav" aria-label={t('nav.aria')}>
      {navIds.map(id => <button key={id} aria-current={page === id ? 'page' : undefined} onClick={() => setPage(id)}>{t(`nav.${id}`)}</button>)}
    </nav>
    <div className="app-tools">
      <div className="lang-switch" role="group" aria-label={t('lang.aria')}>
        {languages.map(l => <button key={l.id} aria-pressed={lang === l.id} lang={l.id} title={l.name} onClick={() => setLang(l.id)}>{l.label}</button>)}
      </div>
      <button className="icon-button sound-button" aria-pressed={sound} onClick={() => updateSound(!sound)} aria-label={sound ? t('sound.off') : t('sound.on')} title={sound ? t('sound.off') : t('sound.on')}>
        {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
      </button>
    </div>

    <main className="app-main">
      {/* The shelf is the app's home: three exhibits, one screen, no scroll. */}
      {page === 'collection' && <div className="shelf">
        <div className="shelf-row">
          {instruments.map((i, n) => <article className="shelf-item" key={i.id}>
            <div className="shelf-head">
              <span className="label">{String(n + 1).padStart(2, '0')}</span>
              <button className="qr-button" onClick={() => setQr(i)} aria-label={t('card.qr', { name: name(i.id) })} title={t('card.qrTitle')}><QrCode size={17} /></button>
            </div>
            <div className="shelf-art"><InstrumentArt type={i.id} /></div>
            <div className="shelf-main">
              <div className="shelf-body">
                <h2 className="shelf-name">{name(i.id)}</h2>
                <span className="shelf-kz">{t(`inst.${i.id}.alt`)}</span>
                <span className="label shelf-label">{t(`inst.${i.id}.sub`)}</span>
              </div>
              <div className="shelf-actions">
                <button className="button primary play-instrument" onClick={() => setSession(i)}>{t('card.play')}</button>
                <button className={`listen-button ${preview === i.id ? 'is-playing' : ''}`} disabled={!sound} onClick={() => void listen(i)} aria-label={t('card.listen', { name: name(i.id) })} title={sound ? t('card.listenTitle') : t('card.listenOff')}>
                  {preview === i.id ? <AudioLines size={18} /> : <Play size={16} fill="currentColor" />}
                </button>
              </div>
            </div>
          </article>)}
        </div>
        <div className="shelf-note label">
          <span><ShieldCheck size={14} /> {t('hero.privacy')}</span>
          <span>{t('s.challenge')}</span>
        </div>
      </div>}

      {page === 'guide' && <div className="view"><div className="view-inner">
        <div className="view-head">
          <span className="label">{t('nav.guide')}</span>
          <h1 className="display">{t('guide.title')}</h1>
          <p className="lead">{t('guide.lead')}</p>
        </div>
        <div className="section">
          <div className="tabs" role="group" aria-label={t('guide.tabs')}>
            {instruments.map(i => <button key={i.id} aria-pressed={guideInstrument === i.id} onClick={() => setGuideInstrument(i.id)}>{name(i.id)}</button>)}
          </div>
          <div className="guide-grid">
            {guideGestures.map(g => <article key={g.id} className="guide-card"><span className="technique-symbol">{g.symbol}</span><h3>{t(`g.${g.id}.name`)}</h3><span className="pill">{t(`g.${g.id}.action`)}</span><p>{t(`g.${g.id}.instruction`)}</p></article>)}
          </div>
        </div>
        {/* The twist lives here, one tap from the session, not on a marketing page. */}
        <div className="twist">
          <div className="prose">
            <h2 className="display">{t('mistake.title')}</h2>
            <p>{t('mistake.body')}</p>
            <blockquote>{t('guide.quote')}</blockquote>
            <p>{t('guide.p2')}</p>
          </div>
          <div className="hint-stack">
            {mistakeExamples.map(h => <div className="hint" key={h.who}><Lightbulb size={18} /><b>{t(`mistake.ex${h.n}.t`)}</b><span>{name(h.who)}. {t(`mistake.ex${h.n}.d`)}</span></div>)}
          </div>
        </div>
        <div className="two-col">
          <section className="prose">
            <h2 className="display">{t('guide.h1')}</h2>
            <p>{t('guide.p1')}</p>
          </section>
          <section className="prose">
            <h2 className="display">{t('guide.h2')}</h2>
            <p>{t('guide.p3')}</p>
            <p>{t('guide.p4')}</p>
            <button className="text-button" onClick={() => setPage('progress')}>{t('guide.link')} <ArrowRight size={15} /></button>
          </section>
        </div>
      </div></div>}

      {page === 'progress' && <div className="view"><div className="view-inner">
        <div className="view-head">
          <span className="label">{t('nav.progress')}</span>
          <h1 className="display">{t('progress.title')}</h1>
        </div>
        <div className="stats">
          <article className="stat"><strong>{best}</strong><span>{t('stat.best')}</span></article>
          <article className="stat"><strong>{realProgress.length}</strong><span>{t('stat.count')}</span></article>
          <article className="stat"><strong>{new Set(realProgress.map(p => p.instrument)).size}<small> / 3</small></strong><span>{t('stat.open')}</span></article>
        </div>
        <section className="leaderboard">
          <h2 className="display">{t('board.title')}</h2>
          <div className="tabs" role="group" aria-label={t('board.aria')}>
            <button aria-pressed={boardFilter === 'all'} onClick={() => setBoardFilter('all')}>{t('board.all')}</button>
            {instruments.map(i => <button key={i.id} aria-pressed={boardFilter === i.id} onClick={() => setBoardFilter(i.id)}>{name(i.id)}</button>)}
          </div>
          {board.length
            ? <ol className="rank-list rank-list-page">{board.map((p, i) => <li className="rank-row" key={p.id}><span className="rank-n">{String(i + 1).padStart(2, '0')}</span><span><b>{nameOf(p.instrument)}</b><small>{t('board.row', { d: new Date(p.date).toLocaleDateString(locales[lang], { day: 'numeric', month: 'long' }), n: p.notes })}</small></span><strong>{p.score}</strong></li>)}</ol>
            : <p className="muted">{t('board.empty')}</p>}
        </section>
        {progress.length
          ? <section className="history-list"><h2 className="display">{t('hist.title')}</h2>
            <div>{progress.map(p => <div className="history-row" key={p.id}>
              <div><b>{nameOf(p.instrument)}</b><small>{new Date(p.date).toLocaleString(locales[lang], { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}, {p.demo ? t('hist.demo') : t('hist.camera')}</small></div>
              <span>{t('hist.moves', { n: p.notes })}</span>
              <strong>{p.score} <small>{t('hist.points')}</small></strong>
            </div>)}</div>
          </section>
          : <section className="empty-state"><h2 className="display">{t('empty.title')}</h2><p className="lead">{t('empty.text')}</p><button className="button primary" onClick={() => setPage('collection')}>{t('empty.cta')} <ArrowRight size={16} /></button></section>}
        <p className="storage-note"><ShieldCheck size={14} /> {t('storage.note')}</p>
      </div></div>}

      {page === 'about' && <div className="view"><div className="view-inner">
        <div className="view-head">
          <span className="label">{t('nav.about')}</span>
          <h1 className="display">{t('about.title')}</h1>
          <p className="lead">{t('about.lead')}</p>
        </div>
        <div className="two-col">
          <section className="prose">
            <h2 className="display">{t('about.h1')}</h2>
            <div>{instruments.map(i => <div className="about-instrument" key={i.id}><b>{name(i.id)} <span className="kz">{t(`inst.${i.id}.alt`)}</span></b><p>{t(`inst.${i.id}.desc`)}</p></div>)}</div>
          </section>
          <section className="prose">
            <h2 className="display">{t('about.h2')}</h2>
            <p>{t('about.p1')}</p>
            <p>{t('about.p2')}</p>
            <a className="text-button" href="https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js" target="_blank" rel="noreferrer">{t('about.link')} <ExternalLink size={14} /></a>
          </section>
        </div>
      </div></div>}
    </main>

    {(session || qr) && <div ref={dialogRef}>
      {session && <Session key={session.id} instrument={session} close={() => { setSession(null); if (location.search) history.replaceState(null, '', location.pathname); }} onComplete={() => setProgress(getProgress())} sound={sound} toggleSound={() => updateSound(s => !s)} />}
      {qr && <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setQr(null); }}>
        <section className="qr-modal" role="dialog" aria-modal="true" aria-labelledby="qr-title">
          <div className="modal-header"><span className="label">{t('qrm.label')}</span><button className="icon-button" aria-label={t('qrm.close')} onClick={() => setQr(null)}><X size={18} /></button></div>
          <h2 id="qr-title">{t('qrm.title', { name: name(qr.id) })}</h2>
          <div className="qr-image">{qrImage ? <img src={qrImage} alt={t('qrm.alt', { name: name(qr.id) })} /> : <p>{qrError ? t(qrError) : t('qrm.creating')}</p>}</div>
          {['localhost', '127.0.0.1'].includes(location.hostname) && <p className="qr-local-note">{t('qrm.local')}</p>}
          <div className="qr-actions">
            <button className="button primary" onClick={copyLink}>{copied ? <CheckCheck size={16} /> : <Copy size={16} />} {copied ? t('qrm.copied') : t('qrm.copy')}</button>
            {qrImage && <a className="button secondary" href={qrImage} download={`mura-${qr.id}-qr.png`}><Download size={16} /> {t('qrm.download')}</a>}
          </div>
          {qrError && qrImage && <p role="status" className="muted">{t(qrError)}</p>}
          <input className="qr-url" value={url} readOnly aria-label={t('qrm.url')} onFocus={e => e.target.select()} />
        </section>
      </div>}
    </div>}
  </div>;
}
