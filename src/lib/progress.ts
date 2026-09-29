export type Tip = { title: string; action: string; count: number };
export type Performance = { id: string; instrument: string; score: number; notes: number; mistakes: number; date: string; demo: boolean; seconds?: number; wrong?: Record<string, number>; tips?: Tip[] };
const key = 'mura-performances-v1';
export function getProgress(): Performance[] {
  try { const data: unknown = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(data) ? data.filter((p): p is Performance => p && typeof p.id === 'string' && typeof p.instrument === 'string' && typeof p.score === 'number' && typeof p.date === 'string' && typeof p.demo === 'boolean') : []; } catch { return []; }
}
export function savePerformance(p: Performance) { try { localStorage.setItem(key, JSON.stringify([p, ...getProgress()].slice(0, 50))); return true; } catch { return false; } }
/** Best real (camera) performances first; demo runs never enter the table. */
export function topScores(instrument?: string, limit = 5): Performance[] {
  return getProgress().filter(p => !p.demo && p.score > 0 && (!instrument || p.instrument === instrument))
    .sort((a, b) => b.score - a.score || b.date.localeCompare(a.date)).slice(0, limit);
}
