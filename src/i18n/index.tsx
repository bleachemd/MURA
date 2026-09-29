import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CoachHint } from '../lib/coaching';
import { en } from './en';
import { kk } from './kk';
import { ru } from './ru';

export type Lang = 'ru' | 'en' | 'kk';
export type Vars = Record<string, string | number>;
export type T = (key: string, vars?: Vars) => string;

export const languages: { id: Lang; label: string; name: string }[] = [
  { id: 'ru', label: 'RU', name: 'Русский' },
  { id: 'en', label: 'EN', name: 'English' },
  { id: 'kk', label: 'ҚАЗ', name: 'Қазақша' },
];
const dictionaries: Record<Lang, Record<string, string>> = { ru, en, kk };
const storageKey = 'mura-lang';
export const locales: Record<Lang, string> = { ru: 'ru-RU', en: 'en-GB', kk: 'kk-KZ' };
/** Performances are stored under their Russian name; this maps it back to an instrument id. */
export const instrumentIds: Record<string, string> = { 'Домбра': 'dombyra', 'Кобыз': 'kobyz', 'Дауылпаз': 'dauylpaz', 'Жетыген': 'zhetygen' };

function detect(): Lang {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === 'ru' || saved === 'en' || saved === 'kk') return saved;
  } catch { /* Storage can be blocked. */ }
  const browser = (navigator.language || 'ru').toLowerCase();
  return browser.startsWith('kk') ? 'kk' : browser.startsWith('en') ? 'en' : 'ru';
}

export function translate(lang: Lang, key: string, vars?: Vars): string {
  const text = dictionaries[lang][key] ?? ru[key] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? `{${name}}`)) : text;
}
export const hasKey = (lang: Lang, key: string) => key in dictionaries[lang];

const I18nContext = createContext<{ lang: Lang; setLang: (lang: Lang) => void; t: T }>({ lang: 'ru', setLang: () => {}, t: (key, vars) => translate('ru', key, vars) });
export const useI18n = () => useContext(I18nContext);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detect);
  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try { localStorage.setItem(storageKey, next); } catch { /* Optional preference. */ }
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = translate(lang, 'meta.title');
  }, [lang]);
  const t = useCallback<T>((key, vars) => translate(lang, key, vars), [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

type HintContext = { instrument: string; nextId?: string };
/**
 * The recognizer emits Russian coach text plus a stable `code`. Other languages are rendered from
 * the code, so the recognition module stays untouched and Russian shows exactly what it emits.
 */
export function localizeHint(lang: Lang, hint: CoachHint, ctx: HintContext): { title: string; action: string } {
  if (lang === 'ru') return { title: hint.title, action: hint.action };
  const t: T = (key, vars) => translate(lang, key, vars);
  const g = (id: string | undefined, field: string) => (id ? t(`g.${id}.${field}`) : '');
  const noun = t(`noun.${ctx.instrument}`);
  const code = hint.code;
  if (code.startsWith('start-')) { const id = code.slice(6); return { title: g(id, 'name'), action: g(id, 'instruction') }; }
  if (code.startsWith('recognized-')) return { title: t('c.recognized.t'), action: t('c.recognized.a', { name: g(code.slice(11), 'name') }) };
  if (code.startsWith('wrong-')) {
    return { title: t('c.wrong.t', { actual: g(code.slice(6), 'name') }), action: t('c.wrong.a', { expected: g(ctx.nextId, 'name'), instruction: g(ctx.nextId, 'instruction') }) };
  }
  const quality = () => t(hint.action.includes('слишком далеко') ? 'c.q.2' : hint.action.includes('вышла из кадра') ? 'c.q.3' : 'c.q.1');
  switch (code) {
    case 'setup': return { title: t('c.setup.t'), action: t(`setup.${ctx.instrument}`) };
    case 'begin': return { title: g(ctx.nextId, 'name'), action: g(ctx.nextId, 'instruction') };
    case 'success': return { title: t('c.success.t'), action: ctx.nextId ? t('c.success.a', { name: g(ctx.nextId, 'name') }) : capitalize(t('c.success.done')) };
    case 'hand-lost': return { title: t('c.hand-lost.t'), action: quality() + t('c.hand-lost.suffix') };
    case 'ready-lost': return { title: t('c.ready-lost.t'), action: quality() };
    case 'strum-sideways': return { title: t('c.strum-sideways.t'), action: t(hint.action.includes('снизу') ? 'c.strum-sideways.up' : 'c.strum-sideways.down') };
  }
  if (hasKey(lang, `c.${code}.t`)) { const vars = { noun, name: g(ctx.nextId, 'name') }; return { title: t(`c.${code}.t`, vars), action: t(`c.${code}.a`, vars) }; }
  return { title: hint.title, action: hint.action };
}
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
