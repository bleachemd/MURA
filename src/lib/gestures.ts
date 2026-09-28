/** All coordinates are normalized to the mirrored camera image, as seen by the player. */
export type Point = { x: number; y: number; z?: number };
export type InstrumentId = 'dombyra' | 'kobyz' | 'dauylpaz';
export type Gesture = 'strum-down' | 'strum-up' | 'pluck' | 'bow-right' | 'bow-left' | 'bow-short' | 'drum-center' | 'drum-rim' | 'drum-double';
export type Technique = { id: Gesture; name: string; symbol: string; action: string; instruction: string };
export type InstrumentProfile = { id: InstrumentId; gestures: Technique[]; ready: Point; setup: string };
const profiles: Record<InstrumentId, InstrumentProfile> = {
  dombyra: { id: 'dombyra', ready: { x: .65, y: .43 }, setup: 'Держи кисть над корпусом, как перед боем по струнам. Светящаяся точка на кисти показывает место касания.', gestures: [
    { id: 'strum-down', name: 'Бой вниз', symbol: '↓', action: 'Две струны · вниз', instruction: 'Проведи кистью сверху вниз поперёк двух струн. Начни выше светлой линии и закончи ниже неё.' },
    { id: 'strum-up', name: 'Бой вверх', symbol: '↑', action: 'Две струны · вверх', instruction: 'Проведи кистью снизу вверх поперёк струн. Пересеки светлую линию над корпусом.' },
    { id: 'pluck', name: 'Щипок струны', symbol: '⌁', action: 'Одна струна · щипок', instruction: 'У струн сблизь большой и указательный пальцы, затем разомкни их, словно отпускаешь струну. Кисть держи почти на месте.' },
  ]},
  kobyz: { id: 'kobyz', ready: { x: .30, y: .56 }, setup: 'Представь, что держишь смычок. Веди кисть горизонтально вдоль подсвеченной дорожки, поперёк струн.', gestures: [
    { id: 'bow-right', name: 'Смычок вправо', symbol: '→', action: 'Протяжный штрих', instruction: 'Веди кисть плавно вправо вдоль дорожки смычка — примерно на треть её длины. Не поднимай руку.' },
    { id: 'bow-left', name: 'Смычок влево', symbol: '←', action: 'Обратный штрих', instruction: 'Веди кисть плавно влево вдоль дорожки смычка — примерно на треть её длины. Сохраняй высоту.' },
    { id: 'bow-short', name: 'Короткий штрих', symbol: '↔', action: 'Отрывистый звук', instruction: 'Сделай небольшой горизонтальный штрих на 5–15% ширины кадра и остановись либо смени направление.' },
  ]},
  dauylpaz: { id: 'dauylpaz', ready: { x: .50, y: .39 }, setup: 'Двигай кистью сверху вниз, будто держишь колотушку. Настоящая палочка не нужна: ударяет виртуальный наконечник.', gestures: [
    { id: 'drum-center', name: 'Удар в центр', symbol: '◎', action: 'Глубокий удар', instruction: 'Подними кисть над барабаном и опусти её к центральной метке. После удара отведи руку вверх.' },
    { id: 'drum-rim', name: 'Удар по краю', symbol: '◉', action: 'Звонкий удар', instruction: 'Смести кисть к левому или правому краю барабана и ударь сверху вниз по внешней зоне.' },
    { id: 'drum-double', name: 'Двойной удар', symbol: '⇊', action: 'Два удара подряд', instruction: 'Дважды ударь сверху вниз с промежутком до 0,4 секунды. Между ударами подними кисть выше поверхности.' },
  ]},
};
export function getProfile(instrument: string): InstrumentProfile { return profiles[instrument as InstrumentId] ?? profiles.dombyra; }
export function getMelody(instrument: string): Gesture[] { const g = getProfile(instrument).gestures; return [0,1,2,0,2,1,0,1,2].map(i => g[i].id); }
export const distance = (a: Point, b: Point) => Math.hypot(a.x-b.x,a.y-b.y);
export function handQuality(points: Point[]): string | null {
  if (points.length !== 21 || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return 'Покажи руку целиком перед камерой. Добавь света, если темно.';
  if (distance(points[0],points[9]) < .045) return 'Поднеси руку ближе: кисть слишком маленькая в кадре.';
  if (points.some(p => p.x < .01 || p.x > .99 || p.y < .01 || p.y > .99)) return 'Перемести руку в центр кадра, чтобы кисть и пальцы не обрезались.';
  return null;
}
export function inPlayingZone(id: string, p: Point) {
  if (id === 'kobyz') return p.x >= .17 && p.x <= .83 && Math.abs(p.y-.56) <= .11;
  if (id === 'dauylpaz') return p.x >= .23 && p.x <= .77 && p.y >= .25 && p.y <= .83;
  return p.x >= .43 && p.x <= .87 && p.y >= .27 && p.y <= .86;
}
export type MotionEvent = { gesture: Gesture; strength: number };
export type MotionResult = { event: MotionEvent | null; hint: string; inZone: boolean; point: Point | null; trace: Point[]; bowSpeed: number };
type Sample = Point & { time: number };
type BowSegment = { from: Sample; to: Sample; direction: number; emitted: boolean; lastMove: number; minY: number; maxY: number };
/** Temporal detector. A shape alone never produces a note. Expected gesture only changes guidance. */
export class MotionRecognizer {
  private previous: Sample | null = null;
  private history: Sample[] = [];
  private above: Sample | null = null;
  private below: Sample | null = null;
  private pinch: Sample | null = null;
  private bow: BowSegment | null = null;
  private drumPending: { gesture: Gesture; time: number; strength: number } | null = null;
  private lastEvent = -Infinity;
  readonly profile: InstrumentProfile;
  constructor(instrument: string) { this.profile = getProfile(instrument); }
  reset() { this.previous=null;this.history=[];this.above=null;this.below=null;this.pinch=null;this.bow=null;this.drumPending=null;this.lastEvent=-Infinity; }
  update(points: Point[], now: number, expected?: Gesture): MotionResult {
    const technique = this.profile.gestures.find(g => g.id === expected) ?? this.profile.gestures[0];
    const result: MotionResult = { event: null, hint: technique.instruction, inZone: false, point: null, trace: [], bowSpeed: 0 };
    // A confirmed single impact waits briefly so that a second impact can form a double stroke.
    if (this.drumPending && now-this.drumPending.time > 400) {
      result.event = { gesture: this.drumPending.gesture, strength: this.drumPending.strength }; this.drumPending=null;
    }
    const quality = handQuality(points);
    if (quality) {
      const pending=this.drumPending; this.reset(); this.drumPending=pending;
      result.hint=quality; return result;
    }
    const raw = points[9];
    if (this.previous && (now-this.previous.time>250 || distance(raw,this.previous)>.30)) {
      const pending=this.drumPending;this.reset();this.drumPending=pending;
    }
    const p: Sample = { x: raw.x, y: raw.y, time: now };
    result.point=p;result.inZone=inPlayingZone(this.profile.id,p);
    if (!result.inZone) {
      const pending=this.drumPending;this.reset();this.drumPending=pending;
      result.hint=this.profile.id==='kobyz' ? 'Верни кисть на дорожку смычка. Веди её горизонтально на высоте струн.' : this.profile.id==='dauylpaz' ? 'Перемести кисть над барабаном: сейчас колотушка проходит мимо его поверхности.' : 'Перемести кисть над корпусом домбры, к двум подсвеченным струнам.';
      return result;
    }
    const prev=this.previous;
    this.history=this.history.filter(s=>now-s.time<650);this.history.push(p);
    result.trace=this.history.map(s=>({x:s.x,y:s.y}));
    if (prev) {
      const dt=Math.max(.016,(now-prev.time)/1000);const dx=p.x-prev.x;const dy=p.y-prev.y;
      const speed=Math.hypot(dx,dy)/dt;
      const strength=Math.min(1,Math.max(.3,speed/1.3));
      if (this.profile.id==='dombyra') {
        const pinchRatio=distance(points[4],points[8])/distance(points[0],points[9]);
        if (pinchRatio < .35 && !this.pinch && Math.abs(p.y-.60)<.11) this.pinch=p;
        if (this.pinch && (now-this.pinch.time>1000 || distance(p,this.pinch)>.09)) this.pinch=null;
        if (this.pinch && pinchRatio>.65) {
          if (now-this.pinch.time>=70 && Math.abs(p.y-.60)<.11 && now-this.lastEvent>180) result.event={gesture:'pluck',strength:.65};
          this.pinch=null;
        }
        if (!this.pinch && !result.event && now-this.lastEvent>180) {
          if (this.above && p.y>.625 && now-this.above.time<750 && p.y-this.above.y>=.09 && Math.abs(p.x-this.above.x)<(p.y-this.above.y)*1.4) result.event={gesture:'strum-down',strength};
          else if (this.below && p.y<.575 && now-this.below.time<750 && this.below.y-p.y>=.09 && Math.abs(p.x-this.below.x)<(this.below.y-p.y)*1.4) result.event={gesture:'strum-up',strength};
        }
        if (Math.abs(dx)>Math.abs(dy)*2 && speed>.2 && expected!=='pluck') result.hint='Двигай кисть поперёк струн — вверх или вниз, а не вдоль грифа.';
        else if (expected==='pluck' && Math.abs(p.y-.6)>.11) result.hint='Поднеси большой и указательный пальцы к линии струн, затем сделай щипок.';
        if (p.y<.55 && !this.pinch) this.above=p;
        if (p.y>.65 && !this.pinch) this.below=p;
      } else if (this.profile.id==='kobyz') {
        const horizontal=Math.abs(dx)/dt;
        result.bowSpeed = Math.abs(dy)<Math.abs(dx)*.9 ? horizontal : 0;
        if (Math.abs(dy)>.025 && Math.abs(dy)>Math.abs(dx)) {
          this.bow=null;result.bowSpeed=0;result.hint='Не поднимай смычок: веди кисть по горизонтали вдоль светлой дорожки.';
        } else if (Math.abs(dx)>.004) {
          const direction=Math.sign(dx);
          if (!this.bow || this.bow.direction!==direction) {
            const b=this.bow;
            if(b && !b.emitted && Math.abs(b.to.x-b.from.x)>=.05 && Math.abs(b.to.x-b.from.x)<.18 && b.to.time-b.from.time>=70 && b.to.time-b.from.time<=650 && b.maxY-b.minY<.07) result.event={gesture:'bow-short',strength};
            this.bow={from:prev,to:p,direction,emitted:false,lastMove:now,minY:Math.min(prev.y,p.y),maxY:Math.max(prev.y,p.y)};
          } else {
            const b=this.bow;b.to=p;b.lastMove=now;b.minY=Math.min(b.minY,p.y);b.maxY=Math.max(b.maxY,p.y);
          }
          const b=this.bow;const travel=Math.abs(p.x-b.from.x);const duration=now-b.from.time;
          if(b.maxY-b.minY>=.07) { b.emitted=true;result.bowSpeed=0;result.hint='Сохрани высоту смычка: рука уходит вверх или вниз от дорожки.'; }
          else if(!b.emitted && travel>=.18) {
            if(duration>=180) { result.event ??= {gesture:direction>0?'bow-right':'bow-left',strength};b.emitted=true; }
            else {b.emitted=true;result.hint='Веди смычок плавнее: длинный штрих должен длиться хотя бы 0,2 секунды.';}
          }
        } else if (this.bow && now-this.bow.lastMove>160) {
          const b=this.bow;const travel=Math.abs(b.to.x-b.from.x);const duration=b.to.time-b.from.time;
          if(!b.emitted && travel>=.05 && travel<.18 && duration>=70 && duration<=650 && b.maxY-b.minY<.07) result.event={gesture:'bow-short',strength:.5};
          this.bow=null;
        }
      } else {
        if(p.y<.51) this.above=p;
        if(this.above && p.y>=.60 && p.y-this.above.y>=.09 && now-this.above.time<700 && Math.abs(p.x-this.above.x)<.16 && dy/dt>.18) {
          const gesture: Gesture=Math.abs(p.x-.5)<=.11?'drum-center':'drum-rim';
          if(this.drumPending && now-this.drumPending.time<=400) {result.event={gesture:'drum-double',strength};this.drumPending=null;}
          else this.drumPending={gesture,time:now,strength};
          this.above=null;
          result.hint='Подними кисть для следующего удара. Для двойного — сразу повтори движение.';
        } else if(p.y>.60 && !this.above && !this.drumPending) result.hint='Подними кисть выше поверхности барабана, затем ударь сверху вниз.';
        else if(Math.abs(dx)>Math.abs(dy)*2 && speed>.2) result.hint='Ударь сверху вниз: движение вдоль поверхности барабана не создаёт удар.';
      }
    } else {
      if(p.y<.55) this.above=p;
      if(p.y>.65) this.below=p;
    }
    this.previous=p;
    if(result.event) {this.lastEvent=now;this.above=null;this.below=null;result.hint=`${this.profile.gestures.find(g=>g.id===result.event!.gesture)?.name}. Движение распознано!`;}
    return result;
  }
}
