import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getMelody,getProfile,handQuality,MotionRecognizer,type Gesture,type Point} from './gestures';
function hand(x:number,y:number,pinch=false):Point[]{
  const p=Array.from({length:21},()=>({x,y,z:0}));p[0]={x,y:y+.12,z:0};
  p[4]={x:x-.025,y:y-.04,z:0};p[8]={x:x+(pinch?-.01:.095),y:y-(pinch?.04:.10),z:0};
  return p;
}
function feed(detector:MotionRecognizer,positions:[number,number][],step=80,start=0){return positions.flatMap(([x,y],i)=>{const r=detector.update(hand(x,y),start+i*step);return r.event?[r.event.gesture]:[];});}
const down:[number,number][]=[[.65,.46],[.65,.50],[.65,.54],[.65,.59],[.65,.65],[.65,.71]];
const drum:[number,number][]=[[.5,.42],[.5,.49],[.5,.56],[.5,.63]];
test('every instrument has its own three techniques and nine-note scenario',()=>{
  for(const id of ['dombyra','kobyz','dauylpaz']){const ids=getProfile(id).gestures.map(g=>g.id);assert.equal(new Set(ids).size,3);assert.equal(getMelody(id).length,9);assert.ok(getMelody(id).every(g=>ids.includes(g)));}
});
test('no stationary hand or held pinch produces notes',()=>{
  for(const id of ['dombyra','kobyz','dauylpaz'])for(const pinch of [false,true]){const d=new MotionRecognizer(id);for(let t=0;t<3000;t+=80)assert.equal(d.update(hand(.5,.6,pinch),t).event,null);}
});
test('dombra downstroke and immediate reverse upstroke',()=>{
  const d=new MotionRecognizer('dombyra');assert.deepEqual(feed(d,down),['strum-down']);
  assert.deepEqual(feed(d,[[.65,.71],[.65,.67],[.65,.62],[.65,.56],[.65,.50]],80,480),['strum-up']);
});
test('crossing outside the dombra body is not a strum',()=>assert.deepEqual(feed(new MotionRecognizer('dombyra'),down.map(([,y])=>[.25,y])),[]));
test('small jitter around a string is not repeated strumming',()=>assert.deepEqual(feed(new MotionRecognizer('dombyra'),Array.from({length:40},(_,i)=>[.65,.60+Math.sin(i)*.018])),[]));
test('moving along the strings gives a perpendicular-motion correction',()=>{
  const d=new MotionRecognizer('dombyra');d.update(hand(.50,.6),0);const r=d.update(hand(.62,.6),80);assert.equal(r.event,null);assert.match(r.hint,/поперёк струн/);
});
test('a pinch must close then release at the strings',()=>{
  const d=new MotionRecognizer('dombyra');d.update(hand(.65,.6),0);d.update(hand(.65,.6,true),80);d.update(hand(.65,.6,true),160);assert.equal(d.update(hand(.65,.6),240).event?.gesture,'pluck');
  assert.equal(d.update(hand(.65,.6),320).event,null);
});
test('pinching away from the strings does not pluck',()=>{
  const d=new MotionRecognizer('dombyra');d.update(hand(.65,.35),0);d.update(hand(.65,.35,true),80);assert.equal(d.update(hand(.65,.35),240,'pluck').event,null);
});
test('bow directions are based on visible screen movement',()=>{
  const d=new MotionRecognizer('kobyz');assert.deepEqual(feed(d,[[.26,.56],[.31,.56],[.36,.56],[.41,.56],[.46,.56]]),['bow-right']);
  assert.deepEqual(feed(d,[[.41,.56],[.36,.56],[.31,.56],[.26,.56]],80,400),['bow-left']);
});
test('continuing one long bow stroke does not duplicate the event',()=>assert.deepEqual(feed(new MotionRecognizer('kobyz'),Array.from({length:12},(_,i)=>[.22+i*.05,.56])),['bow-right']));
test('a short bow stroke is recognized after stopping',()=>{
  const d=new MotionRecognizer('kobyz');assert.deepEqual(feed(d,[[.30,.56],[.34,.56],[.38,.56],[.38,.56],[.38,.56],[.38,.56]]),['bow-short']);
});
test('short stroke is recognized at direction reversal',()=>{
  const d=new MotionRecognizer('kobyz');assert.deepEqual(feed(d,[[.3,.56],[.34,.56],[.38,.56],[.34,.56]]),['bow-short']);
});
test('vertical bow motion gives specific height guidance and no note',()=>{
  const d=new MotionRecognizer('kobyz');d.update(hand(.40,.50),0);const r=d.update(hand(.40,.55),80,'bow-right');assert.equal(r.event,null);assert.equal(r.bowSpeed,0);assert.match(r.hint,/по горизонтали/);
});
test('fast uncontrolled long bow swipe is rejected',()=>{
  const d=new MotionRecognizer('kobyz');d.update(hand(.26,.56),0);const r=d.update(hand(.49,.56),80);assert.equal(r.event,null);assert.match(r.hint,/плавнее/);
});
test('a bow outside its lane is silent and requests repositioning',()=>{
  const d=new MotionRecognizer('kobyz');const r=d.update(hand(.5,.30),0);assert.equal(r.bowSpeed,0);assert.match(r.hint,/дорожку смычка/);
});
test('drum center single impact resolves after double-stroke window',()=>{
  const d=new MotionRecognizer('dauylpaz');assert.deepEqual(feed(d,drum),[]);assert.equal(d.update(hand(.5,.63),720).event?.gesture,'drum-center');
});
test('drum rim uses the outer head zone',()=>{
  const d=new MotionRecognizer('dauylpaz');feed(d,drum.map(([,y])=>[.71,y]));assert.equal(d.update(hand(.71,.63),720).event?.gesture,'drum-rim');
});
test('two rebound strokes combine into one double and no delayed extra single',()=>{
  const d=new MotionRecognizer('dauylpaz');feed(d,drum);assert.deepEqual(feed(d,[[.5,.48],[.5,.55],[.5,.64]],80,320),['drum-double']);assert.equal(d.update(hand(.5,.64),950).event,null);
});
test('holding the hand down does not count as a second drum hit',()=>{
  const d=new MotionRecognizer('dauylpaz');feed(d,drum);assert.deepEqual(feed(d,Array.from({length:10},()=>[.5,.63]),80,320),['drum-center']);
});
test('two separated drum impacts stay singles',()=>{
  const d=new MotionRecognizer('dauylpaz');feed(d,drum);assert.equal(d.update(hand(.5,.63),720).event?.gesture,'drum-center');feed(d,drum,80,800);assert.equal(d.update(hand(.5,.63),1600).event?.gesture,'drum-center');
});
test('expected gesture changes guidance but never changes classification',()=>{
  const d=new MotionRecognizer('dombyra');const events:Gesture[]=[];down.forEach(([x,y],i)=>{const r=d.update(hand(x,y),i*80,'pluck');if(r.event)events.push(r.event.gesture);});assert.deepEqual(events,['strum-down']);
});
test('lost tracking and long frame gaps cannot create a crossing',()=>{
  for(const missing of [true,false]){const d=new MotionRecognizer('dombyra');d.update(hand(.65,.45),0);if(missing)d.update([],80);assert.equal(d.update(hand(.65,.68),missing?160:500).event,null);}
});
test('partial and tiny hands have actionable guidance',()=>{
  assert.match(handQuality([])!,/целиком/);const p=hand(.5,.5);p[0]={x:.5,y:.51};assert.match(handQuality(p)!,/ближе/);const clipped=hand(.5,.5);clipped[8].x=.999;assert.match(handQuality(clipped)!,/не обрезались/);
});
test('reset clears pending doubles and bow/strum history',()=>{
  const d=new MotionRecognizer('dauylpaz');feed(d,drum);d.reset();assert.equal(d.update(hand(.5,.63),720).event,null);
});
