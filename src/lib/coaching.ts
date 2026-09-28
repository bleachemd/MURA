import type { Point } from './gestures';
export type CoachHint = { code: string; title: string; action: string; tone: 'guide' | 'warning' | 'success'; target?: Point };
export function coach(code: string, title: string, action: string, target?: Point, tone: CoachHint['tone'] = 'guide'): CoachHint {
  return { code, title, action, target, tone };
}
/** Keep corrections readable instead of replacing the sentence on every video frame. */
export class CoachLatch {
  private shown: CoachHint | null = null;
  private shownAt = 0;
  private candidate = '';
  private candidateAt = 0;
  reset() { this.shown = null; this.candidate = ''; this.shownAt = 0; }
  update(next: CoachHint, now: number, force = false): CoachHint {
    if (!this.shown || force || next.tone === 'success') {
      this.shown = next; this.shownAt = now; this.candidate = ''; return next;
    }
    if (next.code === this.shown.code) { this.shown = next; this.candidate = ''; return next; }
    if (this.candidate !== next.code) { this.candidate = next.code; this.candidateAt = now; }
    const hold = this.shown.tone === 'guide' ? 200 : this.shown.tone === 'success' ? 650 : 1050;
    if (now - this.shownAt >= hold && now - this.candidateAt >= 140) {
      this.shown = next; this.shownAt = now; this.candidate = '';
    }
    return this.shown;
  }
}
