import { coach, type CoachHint } from './coaching';
/** All coordinates are normalized to the mirrored camera image, as seen by the player. */
export type Point = { x: number; y: number; z?: number };
export type InstrumentId = 'dombyra' | 'kobyz' | 'dauylpaz' | 'zhetygen';
export type Gesture = 'strum-down' | 'strum-up' | 'pluck' | 'bow-right' | 'bow-left' | 'bow-short' | 'drum-center' | 'drum-rim' | 'drum-double' | `string-${1|2|3|4|5|6|7}`;
export type Technique = { id: Gesture; name: string; symbol: string; action: string; instruction: string };
export type InstrumentProfile = { id: InstrumentId; gestures: Technique[]; ready: Point; setup: string };
const profiles: Record<InstrumentId, InstrumentProfile> = {
  dombyra: { id: 'dombyra', ready: { x: .65, y: .43 }, setup: 'Держи кисть над корпусом, как перед боем по струнам. Светящаяся точка на кисти показывает место касания.', gestures: [
    { id: 'strum-down', name: 'Бой вниз', symbol: '↓', action: 'Две струны · вниз', instruction: 'Подними светящуюся точку над струнами. Одним движением опусти её ниже линии.' },
    { id: 'strum-up', name: 'Бой вверх', symbol: '↑', action: 'Две струны · вверх', instruction: 'Начни под струнами. Подними светящуюся точку выше линии.' },
    { id: 'pluck', name: 'Щипок струны', symbol: '⌁', action: 'Одна струна · щипок', instruction: 'У струн соедини большой и указательный пальцы, затем разомкни. Сильно двигать кистью не нужно.' },
  ]},
  kobyz: { id: 'kobyz', ready: { x: .30, y: .56 }, setup: 'Представь, что держишь смычок. Веди кисть горизонтально вдоль подсвеченной дорожки, поперёк струн.', gestures: [
    { id: 'bow-right', name: 'Смычок вправо', symbol: '→', action: 'Протяжный штрих', instruction: 'Проведи кистью вправо по светлой дорожке. Можно быстро; главное — не уходить вверх или вниз.' },
    { id: 'bow-left', name: 'Смычок влево', symbol: '←', action: 'Обратный штрих', instruction: 'Проведи кистью влево по светлой дорожке. Держи руку на той же высоте.' },
    { id: 'bow-short', name: 'Короткий штрих', symbol: '↔', action: 'Отрывистый звук', instruction: 'Сдвинь кисть вбок примерно на ширину ладони и остановись.' },
  ]},
  dauylpaz: { id: 'dauylpaz', ready: { x: .50, y: .39 }, setup: 'Двигай кистью сверху вниз, будто держишь колотушку. Настоящая палочка не нужна: ударяет виртуальный наконечник.', gestures: [
    { id: 'drum-center', name: 'Удар в центр', symbol: '◎', action: 'Глубокий удар', instruction: 'Подними кисть над центральным кругом. Опусти точку ниже линии барабана и верни руку вверх.' },
    { id: 'drum-rim', name: 'Удар по краю', symbol: '◉', action: 'Звонкий удар', instruction: 'Наведи точку на левый или правый край. Ударь вниз, через линию барабана.' },
    { id: 'drum-double', name: 'Двойной удар', symbol: '⇊', action: 'Два удара подряд', instruction: 'Два раза подряд ударь вниз. Между ударами обязательно подними точку выше линии барабана.' },
  ]},
  zhetygen: { id: 'zhetygen', ready: { x: .50, y: .62 }, setup: 'Направь камеру на стол и положи на него руку. Приподними палец и коснись стола над нужной струной — она зазвучит.',
    gestures: ['соль','ля','до','ре','ми','соль','ля'].map((note, i) => ({ id: `string-${i+1}` as Gesture, name: `Струна ${i+1}`, symbol: String(i+1), action: `Нота ${note}`, instruction: `Подними палец над ${i+1}-й струной и коснись стола.` })) },
};
export function getProfile(instrument: string): InstrumentProfile { return profiles[instrument as InstrumentId] ?? profiles.dombyra; }
export function getMelody(instrument: string): Gesture[] { const g = getProfile(instrument).gestures; return (instrument==='zhetygen'?[0,2,4,5,4,2,3,1,0]:[0,1,2,0,2,1,0,1,2]).map(i => g[i].id); }
export const distance = (a: Point, b: Point) => Math.hypot(a.x-b.x, a.y-b.y);
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
const median = (values: number[]) => [...values].sort((a,b)=>a-b)[Math.floor(values.length/2)] ?? 0;
/** Knuckles are more stable than a fingertip or one landmark during fast articulation. */
export function palmPoint(points: Point[]): Point {
  return { x: (points[5].x+2*points[9].x+points[13].x)/4, y: (points[5].y+2*points[9].y+points[13].y)/4 };
}
export function handQuality(points: Point[]): string | null {
  if (points.length!==21 || [0,5,9,13,17].some(i=>!Number.isFinite(points[i]?.x)||!Number.isFinite(points[i]?.y))) return 'Рука не видна. Покажи кисть в кадре и держи её перед собой.';
  if (distance(points[0],points[9])<.035) return 'Рука слишком далеко. Поднеси её ближе к камере.';
  if ([5,9,13].some(i=>points[i].x<0||points[i].x>1||points[i].y<0||points[i].y>1)) return 'Кисть вышла из кадра. Верни её к середине экрана.';
  return null;
}
export function inPlayingZone(id: string, p: Point) {
  if (id==='kobyz') return p.x>=.14&&p.x<=.86&&Math.abs(p.y-.56)<=.14;
  if (id==='dauylpaz') return p.x>=.21&&p.x<=.79&&p.y>=.20&&p.y<=.91;
  if (id==='zhetygen') return p.x>=.10&&p.x<=.90&&p.y>=.35&&p.y<=.98;
  return p.x>=.40&&p.x<=.90&&p.y>=.20&&p.y<=.94;
}
export type MotionEvent = { gesture: Gesture; strength: number };
export type MotionResult = { event: MotionEvent | null; events: MotionEvent[]; impacts: MotionEvent[]; hint: string; coach: CoachHint; inZone: boolean; point: Point | null; trace: Point[]; bowSpeed: number; recovering: boolean };
type Sample = Point & { time: number; scale: number; pinch: number | null; fingers?: Finger[] };
type BowSegment = { from: Sample; end: Sample; direction: number; emitted: boolean; lastMove: number; minY: number; maxY: number };
/**
 * Zhetygen: a fingertip in the palm's own frame (wrist→middle knuckle axis, palm-length units), so moving
 * or turning the whole hand changes nothing. Lifting a finger off the table moves the tip away from its
 * resting place in this frame from any camera angle; touching the table brings it back.
 */
type Finger = { tip: Point; offset: Point };
export function fingerPose(points: Point[]): Finger[] {
  const s=distance(points[0],points[9]);const ux=(points[9].x-points[0].x)/s,uy=(points[9].y-points[0].y)/s;
  return [5,9,13,17].map(base=>{const tip=points[base+3];const dx=tip.x-points[base].x,dy=tip.y-points[base].y;return {tip,offset:{x:(dx*ux+dy*uy)/s,y:(dy*ux-dx*uy)/s}};});
}
// ponytail: fixed thresholds in palm units, tuned on synthetic hands only — adjust on a real table and camera.
const LIFT=.22, CONTACT=.10;
/** Seven strings across the table, string 1 on the left. */
export const stringX=(n: number)=>.2+(n-1)*.1;
const stringAt=(tip: Point)=>{const i=Math.round((tip.x-.2)*10);return i>=0&&i<7&&tip.y>=.3&&tip.y<=.97?i+1:0;};
export type Calibration = { scale: number; noise: number; rest?: Point[] };
export function calibrateHand(frames: Point[][]): Calibration {
  const usable=frames.filter(p=>!handQuality(p));
  if(usable.length<5)return {scale:.12,noise:.002};
  const centers=usable.map(palmPoint);const poses=usable.map(fingerPose);
  return {scale:clamp(median(usable.map(p=>distance(p[0],p[9]))),.06,.23),noise:clamp(median(centers.slice(1).map((p,i)=>distance(p,centers[i]))),.001,.012),
    rest:poses[0].map((_,i)=>({x:median(poses.map(f=>f[i].offset.x)),y:median(poses.map(f=>f[i].offset.y))}))};
}
export function selectHand(hands: Point[][], anchor: Point): Point[] {
  return hands.filter(p=>p.length===21).sort((a,b)=>distance(palmPoint(a),anchor)-distance(palmPoint(b),anchor))[0] ?? [];
}
/** Temporal rules: interpolate crossings, bridge only supported short gaps, never invent missing poses. */
export class MotionRecognizer {
  readonly profile: InstrumentProfile;
  private previous: Sample | null = null;
  private beforePrevious: Sample | null = null;
  private history: Sample[] = [];
  private above: Sample | null = null;
  private below: Sample | null = null;
  private pinch: Sample | null = null;
  private bow: BowSegment | null = null;
  private pendingJump: Sample | null = null;
  private missing = false;
  private drumPending: { gesture: Gesture; time: number; strength: number } | null = null;
  private lastEvent = -Infinity;
  private calibration: Calibration = { scale:.12, noise:.002 };
  /** Resting fingertip offsets belong to the hand, not to one movement, so reset() keeps them. */
  private rest: Point[] | null = null;
  private lifted: ({ time: number; peak: number } | null)[] = [null,null,null,null];
  constructor(instrument: string) { this.profile=getProfile(instrument); }
  calibrate(frames: Point[][]) { this.calibration=calibrateHand(frames);this.rest=this.calibration.rest??this.rest; }
  reset() {
    this.previous=null;this.beforePrevious=null;this.history=[];this.above=null;this.below=null;this.pinch=null;this.bow=null;this.pendingJump=null;this.missing=false;this.drumPending=null;this.lastEvent=-Infinity;this.lifted=[null,null,null,null];
  }
  private resetPath() { const pending=this.drumPending;const last=this.lastEvent;this.reset();this.drumPending=pending;this.lastEvent=last; }
  private base(expected?: Gesture): MotionResult {
    const t=this.profile.gestures.find(g=>g.id===expected)??this.profile.gestures[0];
    const message=coach('start-'+t.id,t.name,t.instruction);
    return {event:null,events:[],impacts:[],hint:message.action,coach:message,inZone:false,point:null,trace:[],bowSpeed:0,recovering:false};
  }
  private setTip(r: MotionResult, c: CoachHint) { r.coach=c;r.hint=`${c.title} ${c.action}`; }
  private emit(r: MotionResult, event: MotionEvent, now: number) {
    r.event??=event;r.events.push(event);this.lastEvent=now;
    this.setTip(r,coach('recognized-'+event.gesture,'Получилось!',`${this.profile.gestures.find(t=>t.id===event.gesture)?.name} — звук сыгран.`,undefined,'success'));
  }
  private flushDrum(r: MotionResult, now: number) {
    if(this.drumPending&&now-this.drumPending.time>500){this.emit(r,{gesture:this.drumPending.gesture,strength:this.drumPending.strength},now);this.drumPending=null;}
  }
  update(points: Point[], now: number, expected?: Gesture): MotionResult {
    const r=this.base(expected);this.flushDrum(r,now);
    const quality=handQuality(points);
    if(quality){
      this.missing=true;this.pendingJump=null;
      if(this.previous&&now-this.previous.time<=180){r.recovering=true;this.setTip(r,coach('brief-gap','Камера догоняет движение','Продолжай: короткий пропуск кадра не сбрасывает приём.'));}
      else{this.resetPath();this.setTip(r,coach('hand-lost','Не вижу кисть',quality+' Если рука смазывается, добавь света перед собой.',this.profile.ready,'warning'));}
      return r;
    }
    const center=palmPoint(points);const scale=distance(points[0],points[9]);
    const tips=[points[4],points[8]];
    const pinch=tips.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>.005&&p.x<.995&&p.y>.005&&p.y<.995)?distance(tips[0],tips[1])/scale:null;
    const p: Sample={...center,time:now,scale,pinch,fingers:this.profile.id==='zhetygen'?fingerPose(points):undefined};r.point=p;r.inZone=inPlayingZone(this.profile.id,p);
    const prev=this.previous;
    if(prev){
      if(now<=prev.time)return r;
      const gap=now-prev.time;
      const sizeRatio=scale/prev.scale;
      if(gap>350||sizeRatio<.55||sizeRatio>1.8){this.resetPath();}
      else if(this.missing){
        const before=this.beforePrevious;const dx=p.x-prev.x,dy=p.y-prev.y;
        const vx=before?(prev.x-before.x)/Math.max(16,prev.time-before.time):0;
        const vy=before?(prev.y-before.y)/Math.max(16,prev.time-before.time):0;
        const aligned=dx*vx+dy*vy>0&&Math.hypot(vx,vy)>.00015;
        const travel=distance(p,prev);
        if(gap>180||(!aligned&&travel>.035)||travel>Math.max(.13,Math.hypot(vx,vy)*gap*2.4+.05)){
          this.resetPath();this.setTip(r,coach('reacquired','Рука снова видна','Начни движение ещё раз от жёлтой метки.',this.profile.ready));
        }
        this.missing=false;
      }
    }
    // A large single-frame jump must be supported by the following frame. This preserves fast
    // gestures while rejecting a detector glitch that immediately jumps back to its old position.
    if(this.pendingJump&&this.previous){
      const jump=this.pendingJump;this.pendingJump=null;
      const continued=(p.x-jump.x)*(jump.x-this.previous.x)+(p.y-jump.y)*(jump.y-this.previous.y)>=-.003;
      const supported=now-jump.time<=180&&(distance(p,jump)<.09||continued);
      if(supported&&distance(p,this.previous)>.06){this.advance(jump,r,expected);}
      else if(distance(p,this.previous)<.065){this.setTip(r,coach('jitter','Изображение дёрнулось','Продолжай движение. Этот скачок не засчитан.'));}
      else{this.resetPath();}
    }
    if(this.previous&&distance(p,this.previous)>.28&&now-this.previous.time<160){
      this.pendingJump=p;r.recovering=true;r.trace=this.history;
      return r;
    }
    this.advance(p,r,expected);
    if(r.events.length){const e=r.events[r.events.length-1];this.setTip(r,coach('recognized-'+e.gesture,'Получилось!',`${this.profile.gestures.find(t=>t.id===e.gesture)?.name} — звук сыгран.`,undefined,'success'));}
    return r;
  }
  private reposition(p: Point): CoachHint {
    const [left,right,y,noun]=({dombyra:[.43,.87,.52,'струнам'],kobyz:[.17,.83,.56,'дорожке смычка'],dauylpaz:[.23,.77,.52,'барабану'],zhetygen:[.16,.84,.62,'струнам жетыгена']} as const)[this.profile.id];
    if(p.x<left)return coach('move-right','Рука слишком слева',`Сдвинь кисть вправо, к ${noun}.`,{x:left+.06,y},'warning');
    if(p.x>right)return coach('move-left','Рука слишком справа',`Сдвинь кисть влево, к ${noun}.`,{x:right-.06,y},'warning');
    return coach(p.y<y?'move-down':'move-up',p.y<y?'Рука слишком высоко':'Рука слишком низко',p.y<y?`Опусти кисть к ${noun}.`:`Подними кисть к ${noun}.`,{x:clamp(p.x,left+.03,right-.03),y},'warning');
  }
  private advance(p: Sample,r: MotionResult,expected?: Gesture) {
    const prev=this.previous;const id=this.profile.id;const zone=inPlayingZone(id,p);
    r.point=p;r.inZone=zone;
    this.history=this.history.filter(s=>p.time-s.time<550);this.history.push(p);r.trace=this.history;
    const noise=Math.max(.003,this.calibration.noise*2.4);
    const amplitude=clamp(this.calibration.scale*.52,Math.max(.045,noise*5),.09);
    const margin=clamp(noise*2,.018,.033);
    const dt=prev?Math.max(.012,(p.time-prev.time)/1000):.033;
    const dx=prev?p.x-prev.x:0,dy=prev?p.y-prev.y:0;
    const speed=Math.hypot(dx,dy)/dt;const strength=clamp(speed/1.3,.3,1);
    if(!zone)this.setTip(r,this.reposition(p));
    if(id==='dombyra'){
      const stringX=(x:number)=>x>=.40&&x<=.90;
      if(zone&&Math.abs(p.y-.6)<.14&&p.pinch!==null&&p.pinch<.43&&!this.pinch)this.pinch=p;
      if(this.pinch&&(p.time-this.pinch.time>1800||distance(p,this.pinch)>.13||!zone))this.pinch=null;
      if(this.pinch&&p.pinch!==null&&p.pinch>.72){
        if(p.time-this.pinch.time>=12&&Math.abs(p.y-.6)<.14&&p.time-this.lastEvent>75)this.emit(r,{gesture:'pluck',strength:.65},p.time);
        this.pinch=null;
      }
      if(prev&&!this.pinch&&!r.events.length&&p.time-this.lastEvent>=25){
        const direction=p.y>prev.y?1:-1;const start=direction>0?this.above:this.below;
        if(start&&p.time-start.time<1600&&direction*(p.y-.6)>=margin&&direction*(p.y-start.y)>=amplitude&&Math.abs(p.x-start.x)<Math.abs(p.y-start.y)*1.9){
          const t=(.6-start.y)/(p.y-start.y);const crossingX=start.x+(p.x-start.x)*t;
          if(t>=0&&t<=1&&stringX(crossingX)){
            this.emit(r,{gesture:direction>0?'strum-down':'strum-up',strength},p.time);this.above=null;this.below=null;
          }
        }
      }
      if(stringX(p.x)&&p.y>=.15&&p.y<=.96&&!this.pinch){
        if(p.y<.6-margin)this.above=p;
        if(p.y>.6+margin)this.below=p;
      }
      if(zone&&!r.events.length){
        if(expected==='pluck'){
          if(Math.abs(p.y-.6)>.14)this.setTip(r,coach('pluck-position','Щипок нужен у струн','Перемести точку к жёлтой метке. Затем соедини и разомкни два пальца.',{x:clamp(p.x,.47,.83),y:.6},'warning'));
          else if(p.pinch===null)this.setTip(r,coach('pluck-fingers-hidden','Не вижу кончики пальцев','Покажи большой и указательный пальцы целиком.',{x:.65,y:.6},'warning'));
          else if(this.pinch)this.setTip(r,coach('release-pinch','Пальцы соединились','Теперь разомкни большой и указательный пальцы — отпусти струну.'));
          else this.setTip(r,coach('close-pinch','Соедини два пальца','Коснись большим пальцем указательного, затем разомкни их.'));
        }else if(Math.abs(dx)>Math.abs(dy)*2&&Math.abs(dx)>noise){
          this.setTip(r,coach('strum-sideways','Рука идёт вдоль струн','Проведи её поперёк: '+(expected==='strum-up'?'снизу вверх.':'сверху вниз.'),{x:p.x,y:expected==='strum-up'?.49:.71},'warning'));
        }else{
          const up=expected==='strum-up';const armed=up?this.below:this.above;
          const target={x:clamp(p.x,.47,.83),y:up?(armed?.48:.71):(armed?.72:.48)};
          this.setTip(r,coach(up?(armed?'finish-up':'prepare-up'):(armed?'finish-down':'prepare-down'),armed?(up?'Ещё немного вверх':'Ещё немного вниз'):(up?'Начни под струнами':'Начни над струнами'),armed?'Переведи светящуюся точку за линию струн.':'Подведи точку к жёлтой метке, затем проведи через струны.',target));
        }
      }
    }else if(id==='kobyz'){
      const long=clamp(this.calibration.scale*1.3,.12,.20);const short=clamp(long*.28,noise*4,.055);const reversal=Math.max(.013,noise*2.2);
      if(!zone){this.bow=null;r.bowSpeed=0;}
      else if(prev){
        if(!this.bow)this.bow={from:prev,end:prev,direction:0,emitted:false,lastMove:prev.time,minY:prev.y,maxY:prev.y};
        let b=this.bow;
        if(!b.direction&&Math.abs(p.x-b.from.x)>noise*2)b.direction=Math.sign(p.x-b.from.x);
        if(b.direction&&b.direction*(p.x-b.end.x)<-reversal){
          const travel=Math.abs(b.end.x-b.from.x);
          if(!b.emitted&&travel>=short&&travel<long&&b.maxY-b.minY<.11)this.emit(r,{gesture:'bow-short',strength},p.time);
          b={from:b.end,end:b.end,direction:-b.direction,emitted:false,lastMove:p.time,minY:b.end.y,maxY:b.end.y};this.bow=b;
        }
        b.minY=Math.min(b.minY,p.y);b.maxY=Math.max(b.maxY,p.y);
        if(b.direction*(p.x-b.end.x)>noise*.6){b.end=p;b.lastMove=p.time;}
        const travel=Math.abs(b.end.x-b.from.x);const drift=b.maxY-b.minY;
        if(drift>.10||Math.abs(p.y-b.from.y)>.035&&Math.abs(p.y-b.from.y)>travel*1.25){
          this.bow=null;r.bowSpeed=0;this.setTip(r,coach('bow-height','Смычок ушёл по диагонали','Держи руку на одной высоте. Веди её вбок по светлой дорожке.',{x:p.x,y:.56},'warning'));
        }else{
          if(!b.emitted&&travel>=long){this.emit(r,{gesture:b.direction>0?'bow-right':'bow-left',strength},p.time);b.emitted=true;}
          const moving=b.direction!==0&&travel>noise*2&&p.time-b.lastMove<110;r.bowSpeed=moving?Math.max(.09,Math.abs(dx)/dt):0;
          if(p.time-b.lastMove>140){
            if(!b.emitted&&travel>=short&&travel<long)this.emit(r,{gesture:'bow-short',strength:.5},p.time);
            this.bow=null;
          }
          if(!r.events.length&&expected==='bow-short')this.setTip(r,coach('short-bow','Небольшой штрих — и стоп','Сдвинь руку вбок совсем немного. Затем остановись или поверни обратно.',{x:clamp(p.x+(p.x>.65?-.07:.07),.18,.82),y:.56}));
          else if(!r.events.length){const right=expected!=='bow-left';this.setTip(r,coach(right?'bow-right':'bow-left',right?'Веди руку вправо':'Веди руку влево','Не останавливайся до жёлтой метки. Высоту руки сохраняй.',{x:clamp(p.x+(right?long:-long),.17,.83),y:.56}));}
        }
      }
    }else if(id==='zhetygen'){
      r.trace=[];const fingers=p.fingers!;const rest=this.rest??=fingers.map(f=>f.offset);let press:{finger:number;peak:number}|null=null;
      for(const [i,f] of fingers.entries()){
        const lift=distance(f.offset,rest[i]);const up=this.lifted[i];
        if(up){
          up.peak=Math.max(up.peak,lift);
          if(lift<CONTACT){if(!press||up.peak>press.peak)press={finger:i,peak:up.peak};this.lifted[i]=null;}
          // A finger that never comes back has a new resting pose rather than a very long lift.
          else if(p.time-up.time>1500){rest[i]=f.offset;this.lifted[i]=null;}
        }else if(lift>LIFT)this.lifted[i]={time:p.time,peak:lift};
        else if(lift<CONTACT)rest[i]={x:rest[i].x+(f.offset.x-rest[i].x)*.08,y:rest[i].y+(f.offset.y-rest[i].y)*.08};
      }
      const raised=this.lifted.findIndex(Boolean);r.point=fingers[raised<0?0:raised].tip;
      const want=Number(expected?.slice(7))||0;const target=want?{x:stringX(want),y:.62}:undefined;
      if(press){
        const n=stringAt(fingers[press.finger].tip);r.point=fingers[press.finger].tip;
        if(!n)this.setTip(r,coach('tap-off-strings','Касание мимо струн','Касайся стола внутри подсвеченной рамки.',target,'warning'));
        else if(p.time-this.lastEvent>60)this.emit(r,{gesture:`string-${n}` as Gesture,strength:clamp(press.peak/.6,.35,1)},p.time);
      }else if(zone){
        if(raised>=0)this.setTip(r,coach('tap-press','Теперь коснись стола','Опусти палец на струну.',target));
        else if(target&&!fingers.some(f=>Math.abs(f.tip.x-target.x)<.06))this.setTip(r,coach('tap-to-string',`Нужна ${this.profile.gestures[want-1].name.toLowerCase()}`,'Поднеси палец к жёлтой метке и коснись стола.',target,'warning'));
        else this.setTip(r,coach('tap-lift','Подними палец','Затем коснись стола над струной — она зазвучит.',target));
      }
    }else{
      if(p.x>=.21&&p.x<=.79&&p.y<.6-Math.max(.045,amplitude*.75))this.above=p;
      const start=this.above;
      if(prev&&start&&p.y>=.608&&p.y-start.y>=amplitude&&p.time-start.time<1600&&dy>0&&Math.abs(p.x-start.x)<Math.max(.18,(p.y-start.y)*1.4)){
        const t=(.6-start.y)/(p.y-start.y);const x=start.x+(p.x-start.x)*t;
        if(x>=.21&&x<=.79){
          const gesture:Gesture=Math.abs(x-.5)<=.115?'drum-center':'drum-rim';
          const impactTime=start.time+(p.time-start.time)*t;
          r.impacts.push({gesture,strength});
          if(this.drumPending&&impactTime-this.drumPending.time<=500&&impactTime-this.drumPending.time>=25){this.emit(r,{gesture:'drum-double',strength},p.time);this.drumPending=null;}
          else this.drumPending={gesture,time:impactTime,strength};
          this.above=null;
        }
      }
      if(zone&&!r.events.length){
        const x=expected==='drum-rim'?(p.x>.5?.70:.30):.50;
        if(expected==='drum-rim'&&Math.abs(p.x-.5)<.13)this.setTip(r,coach('drum-to-rim','Сейчас нужен край','Сдвинь кисть к жёлтой метке сбоку. Затем ударь вниз.',{x,y:.47},'warning'));
        else if(expected==='drum-center'&&Math.abs(p.x-.5)>.14)this.setTip(r,coach('drum-to-center','Сейчас нужен центр','Передвинь кисть над центральным кругом и ударь вниз.',{x:.5,y:.47},'warning'));
        else if(this.drumPending&&expected==='drum-double')this.setTip(r,coach('second-hit','Первый удар есть!','Подними руку и сразу ударь ещё раз.',{x:p.x,y:p.y>.55?.48:.68}));
        else if(!this.above)this.setTip(r,coach('raise-beater','Подними руку для замаха','Верни точку выше линии барабана, к жёлтой метке.',{x,y:.47}));
        else this.setTip(r,coach('hit-drum','Теперь ударь вниз','Опусти светящуюся точку ниже линии барабана.',{x,y:.69}));
      }
    }
    this.beforePrevious=prev;this.previous=p;
  }
}
