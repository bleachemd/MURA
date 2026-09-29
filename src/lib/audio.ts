import type { Gesture } from './gestures';
let context: AudioContext | undefined;
let enabled = true;
let bow: { gain: GainNode; oscillator: OscillatorNode; filter: BiquadFilterNode } | undefined;
export function setSound(value: boolean) { enabled=value;if(!value)stopBow(); }
/**
 * Sound is optional and must never gate the camera or the demo. Firefox leaves resume()
 * pending for as long as its autoplay policy still blocks the page, and a blocked or
 * unsupported AudioContext throws on construction; both would otherwise hang the caller.
 */
export function unlockAudio(): Promise<void> {
  // iOS plays Web Audio as "ambient" sound, which the ring/silent switch mutes: a phone on silent heard nothing at all.
  const session=(globalThis.navigator as (Navigator & { audioSession?: { type: string } }) | undefined)?.audioSession;if(session)session.type='playback';
  try { context ??= new AudioContext(); } catch { return Promise.resolve(); }
  if(context.state==='running')return Promise.resolve();
  return Promise.race([context.resume().catch(()=>{}), new Promise<void>(resolve=>{ setTimeout(resolve,400); })]);
}
/**
 * Mobile browsers suspend a running context behind the page's back (iOS "interrupted": camera
 * start, a call, an app switch) and never resume it, so every later note was dropped silently.
 */
function running() {
  if(!enabled || !context)return;
  if(context.state==='running')return context;
  context.resume().catch(()=>{});
}
export function stopBow() {
  if(!bow || !context)return;
  const old=bow;bow=undefined;old.gain.gain.cancelScheduledValues(context.currentTime);old.gain.gain.setTargetAtTime(.0001,context.currentTime,.035);old.oscillator.stop(context.currentTime+.2);
  old.oscillator.onended=()=>{old.oscillator.disconnect();old.filter.disconnect();old.gain.disconnect();};
}
/** The sustained kobyz tone follows actual bow movement, stopping when the hand stops. */
export function updateBow(speed: number) {
  const ctx=speed<.07?undefined:running();
  if(!ctx){stopBow();return;}
  if(!bow) {
    const oscillator=ctx.createOscillator();oscillator.type='sawtooth';oscillator.frequency.value=146.83;
    const filter=ctx.createBiquadFilter();filter.type='lowpass';
    const gain=ctx.createGain();gain.gain.value=.0001;
    oscillator.connect(filter);filter.connect(gain);gain.connect(ctx.destination);oscillator.start();bow={oscillator,filter,gain};
  }
  bow.filter.frequency.setTargetAtTime(700+Math.min(speed,1.4)*700,ctx.currentTime,.07);
  bow.gain.gain.setTargetAtTime(.025+Math.min(speed,1.4)*.05,ctx.currentTime,.035);
}
/** Seven strings tuned to a pentatonic scale: G3 A3 C4 D4 E4 G4 A4. */
const zhetygenTuning=[196,220,261.63,293.66,329.63,392,440];
export function playNote(gesture: Gesture, instrument = 'dombyra', strength=.7) {
  const live=running();if(!live)return;const ctx=live;const now=ctx.currentTime;const volume=.12+Math.min(1,Math.max(0,strength))*.14;
  function pluck(frequency: number,delay: number,level: number) {
    const duration=.95;const length=Math.round(ctx.sampleRate/frequency);const buffer=ctx.createBuffer(1,ctx.sampleRate*duration,ctx.sampleRate);const data=buffer.getChannelData(0);const ring=new Float32Array(length);
    for(let i=0;i<length;i++)ring[i]=Math.random()*2-1;
    for(let i=0;i<data.length;i++){const j=i%length;data[i]=ring[j];ring[j]=.496*(ring[j]+ring[(j+1)%length]);}
    const source=ctx.createBufferSource();source.buffer=buffer;const gain=ctx.createGain();gain.gain.value=volume*level;source.connect(gain);gain.connect(ctx.destination);source.start(now+delay);source.onended=()=>{source.disconnect();gain.disconnect();};
  }
  function drum(frequency: number,delay: number) {
    const at=now+delay;const osc=ctx.createOscillator();osc.frequency.setValueAtTime(frequency,at);osc.frequency.exponentialRampToValueAtTime(frequency*.38,at+.3);
    const gain=ctx.createGain();gain.gain.setValueAtTime(.001,at);gain.gain.exponentialRampToValueAtTime(volume,at+.008);gain.gain.exponentialRampToValueAtTime(.001,at+.65);osc.connect(gain);gain.connect(ctx.destination);osc.start(at);osc.stop(at+.7);osc.onended=()=>{osc.disconnect();gain.disconnect();};
  }
  if(instrument==='dauylpaz'){drum(gesture==='drum-rim'?190:95,0);if(gesture==='drum-double')drum(95,.14);}
  else if(instrument==='kobyz') {
    const duration=gesture==='bow-short'?.23:.85;const osc=ctx.createOscillator();osc.type='sawtooth';osc.frequency.value=146.83;
    const filter=ctx.createBiquadFilter();filter.frequency.value=gesture==='bow-left'?1050:1250;
    const gain=ctx.createGain();gain.gain.setValueAtTime(.001,now);gain.gain.exponentialRampToValueAtTime(volume*.4,now+.05);gain.gain.exponentialRampToValueAtTime(.001,now+duration);
    osc.connect(filter);filter.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(now+duration);osc.onended=()=>{osc.disconnect();filter.disconnect();gain.disconnect();};
  } else if(instrument==='zhetygen')pluck(zhetygenTuning[Number(gesture.slice(7))-1]??293.66,0,1);
  else if(gesture==='pluck')pluck(293.66,0,1);
  else {const notes=gesture==='strum-up'?[220,146.83]:[146.83,220];pluck(notes[0],0,.8);pluck(notes[1],.022,.8);}
}
export type Cue = 'good' | 'miss' | 'start' | 'finish' | 'record';
/** Tiny synthesized interface sounds: a bright ping, a soft low drop, a rising start, a finish arpeggio. */
export function playCue(kind: Cue) {
  const ctx=running();if(!ctx)return;const t0=ctx.currentTime;
  const tone=(frequency:number,at:number,length:number,level:number,type:OscillatorType='sine',slideTo?:number)=>{
    const osc=ctx.createOscillator();osc.type=type;osc.frequency.setValueAtTime(frequency,t0+at);
    if(slideTo)osc.frequency.exponentialRampToValueAtTime(slideTo,t0+at+length);
    const gain=ctx.createGain();gain.gain.setValueAtTime(.0001,t0+at);gain.gain.exponentialRampToValueAtTime(level,t0+at+.012);gain.gain.exponentialRampToValueAtTime(.0001,t0+at+length);
    osc.connect(gain);gain.connect(ctx.destination);osc.start(t0+at);osc.stop(t0+at+length+.02);osc.onended=()=>{osc.disconnect();gain.disconnect();};
  };
  if(kind==='good'){tone(1174.66,0,.16,.035);tone(1567.98,.045,.2,.03);}
  else if(kind==='miss')tone(180,0,.22,.05,'triangle',110);
  else if(kind==='start'){tone(392,0,.14,.05);tone(587.33,.11,.22,.05);}
  else if(kind==='finish'){[392,493.88,587.33,783.99].forEach((f,i)=>tone(f,i*.11,.32,.05));}
  else [392,587.33,783.99,987.77,1174.66].forEach((f,i)=>tone(f,i*.1,.4,.055));
}
