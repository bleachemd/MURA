import {CoachLatch,coach} from './coaching';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calibrateHand,getMelody,getProfile,palmPoint as palmCenter,handQuality,selectHand,MotionRecognizer,type Gesture,type Point} from './gestures';
function hand(x:number,y:number,pinch=false):Point[]{
  const p=Array.from({length:21},()=>({x,y,z:0}));p[0]={x,y:y+.12,z:0};
  p[4]={x:x-.025,y:y-.04,z:0};p[8]={x:x+(pinch?-.01:.095),y:y-(pinch?.04:.10),z:0};
  return p;
}
/** A hand lying on a table, fingers pointing up the image; a lifted finger looks shorter to the camera. */
function tableHand(x:number,y:number,lifted=-1):Point[]{
  const p=Array.from({length:21},()=>({x,y,z:0}));p[0]={x,y:y+.15,z:0};
  [5,9,13,17].forEach((b,i)=>{p[b]={x:x-.045+i*.03,y,z:0};p[b+3]={x:x-.045+i*.03,y:y-(i===lifted?.04:.09),z:0};});
  return p;
}
function feed(detector:MotionRecognizer,positions:[number,number][],step=80,start=0){return positions.flatMap(([x,y],i)=>{const r=detector.update(hand(x,y),start+i*step);return r.event?[r.event.gesture]:[];});}
const down:[number,number][]=[[.65,.46],[.65,.50],[.65,.54],[.65,.59],[.65,.65],[.65,.71]];
const drum:[number,number][]=[[.5,.42],[.5,.49],[.5,.56],[.5,.63]];
test('every instrument has its own techniques and nine-note scenario',()=>{
  for(const id of ['dombyra','kobyz','dauylpaz','zhetygen']){const ids=getProfile(id).gestures.map(g=>g.id);assert.equal(new Set(ids).size,ids.length);assert.equal(getProfile(id).id,id);assert.equal(getMelody(id).length,9);assert.ok(getMelody(id).every(g=>ids.includes(g)));}
});
test('no stationary hand or held pinch produces notes',()=>{
  for(const id of ['dombyra','kobyz','dauylpaz','zhetygen'])for(const pinch of [false,true]){const d=new MotionRecognizer(id);for(let t=0;t<3000;t+=80)assert.equal(d.update(hand(.5,.6,pinch),t).event,null);}
});
test('dombra downstroke and immediate reverse upstroke',()=>{
  const d=new MotionRecognizer('dombyra');assert.deepEqual(feed(d,down),['strum-down']);
  assert.deepEqual(feed(d,[[.65,.71],[.65,.67],[.65,.62],[.65,.56],[.65,.50]],80,480),['strum-up']);
});
test('crossing outside the dombra body is not a strum',()=>assert.deepEqual(feed(new MotionRecognizer('dombyra'),down.map(([,y])=>[.25,y])),[]));
test('small jitter around a string is not repeated strumming',()=>assert.deepEqual(feed(new MotionRecognizer('dombyra'),Array.from({length:40},(_,i)=>[.65,.60+Math.sin(i)*.018])),[]));
test('moving along the strings gives a perpendicular-motion correction',()=>{
  const d=new MotionRecognizer('dombyra');d.update(hand(.50,.6),0);const r=d.update(hand(.62,.6),80);assert.equal(r.event,null);assert.match(r.hint,/поперёк/);
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
  const d=new MotionRecognizer('kobyz');d.update(hand(.40,.50),0);const r=d.update(hand(.40,.55),80,'bow-right');assert.equal(r.event,null);assert.equal(r.bowSpeed,0);assert.match(r.hint,/одной высоте/);
});
test('fast but horizontal long bow stroke is accepted',()=>{
  const d=new MotionRecognizer('kobyz');d.update(hand(.26,.56),0);assert.equal(d.update(hand(.49,.56),40).event?.gesture,'bow-right');
});
test('a bow outside its lane is silent and requests repositioning',()=>{
  const d=new MotionRecognizer('kobyz');const r=d.update(hand(.5,.30),0);assert.equal(r.bowSpeed,0);assert.match(r.hint,/дорожке смычка/);
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
test('missing and tiny palms have actionable guidance',()=>{
  assert.match(handQuality([])!,/Покажи кисть/);const p=hand(.5,.5);p[0]={x:.5,y:.51};assert.match(handQuality(p)!,/ближе/);
});
test('clipped fingertips do not discard a visible palm during strumming',()=>{
  const d=new MotionRecognizer('dombyra');d.update(hand(.65,.48),0);const p=hand(.65,.68);p[8].x=1.01;assert.equal(handQuality(p),null);assert.equal(d.update(p,66).event?.gesture,'strum-down');
});
test('reset clears pending doubles and bow/strum history',()=>{
  const d=new MotionRecognizer('dauylpaz');feed(d,drum);d.reset();assert.equal(d.update(hand(.5,.63),720).event,null);
});

test('confirming a single drum hit does not erase the next raised stroke',()=>{
  const d=new MotionRecognizer('dauylpaz');feed(d,drum);
  for(const t of [320,400,480,560])d.update(hand(.5,.48),t);
  assert.equal(d.update(hand(.5,.48),730).event?.gesture,'drum-center');
  d.update(hand(.5,.55),810);d.update(hand(.5,.63),900);
  assert.equal(d.update(hand(.5,.63),1450).event?.gesture,'drum-center');
});

test('fast dombra sweep survives a large one-frame displacement after confirmation',()=>{
  const d=new MotionRecognizer('dombyra');d.update(hand(.65,.42),0);
  assert.equal(d.update(hand(.65,.82),33).event,null);
  assert.equal(d.update(hand(.65,.84),66).event?.gesture,'strum-down');
});
test('an isolated landmark jump and return do not play a note',()=>{
  const d=new MotionRecognizer('dombyra');d.update(hand(.65,.42),0);d.update(hand(.65,.82),33);assert.equal(d.update(hand(.65,.42),66).event,null);
});
test('a fast rebound can produce down and up without the old 180ms lockout',()=>{
  const d=new MotionRecognizer('dombyra');d.update(hand(.65,.49),0);
  assert.equal(d.update(hand(.65,.71),33).event?.gesture,'strum-down');
  assert.equal(d.update(hand(.65,.49),66).event?.gesture,'strum-up');
});
test('a short dip below the strings still counts',()=>{
  const d=new MotionRecognizer('dombyra');d.update(hand(.65,.56),0);assert.equal(d.update(hand(.65,.64),50).event?.gesture,'strum-down');
});
test('a fast drum impact sounds before single/double classification',()=>{
  const d=new MotionRecognizer('dauylpaz');d.update(hand(.5,.49),0);const r=d.update(hand(.5,.69),33);
  assert.equal(r.event,null);assert.equal(r.impacts[0]?.gesture,'drum-center');
  assert.equal(d.update(hand(.5,.69),650).event?.gesture,'drum-center');
});
test('a small drum rebound is enough for two fast impacts',()=>{
  const d=new MotionRecognizer('dauylpaz');d.update(hand(.5,.53),0);d.update(hand(.5,.63),33);d.update(hand(.5,.53),66);
  assert.equal(d.update(hand(.5,.63),99).event?.gesture,'drum-double');
});
test('a motion-supported 100ms tracking gap does not erase a dombra stroke',()=>{
  const d=new MotionRecognizer('dombyra');d.update(hand(.65,.44),0);d.update(hand(.65,.48),33);d.update([],66);
  assert.equal(d.update(hand(.65,.67),132).event?.gesture,'strum-down');
});
test('a motion-supported brief tracking gap preserves a drum stroke',()=>{
  const d=new MotionRecognizer('dauylpaz');d.update(hand(.5,.42),0);d.update(hand(.5,.48),33);d.update([],66);
  assert.equal(d.update(hand(.5,.65),132).impacts[0]?.gesture,'drum-center');
});
test('missing pinch closure cannot be guessed into a pluck',()=>{
  const d=new MotionRecognizer('dombyra');d.update(hand(.65,.6),0);d.update([],33);assert.equal(d.update(hand(.65,.6),100).event,null);
});
test('one-frame pinch and release is recognized at 30fps',()=>{
  const d=new MotionRecognizer('dombyra');d.update(hand(.65,.6),0);d.update(hand(.65,.6,true),33);assert.equal(d.update(hand(.65,.6),66).event?.gesture,'pluck');
});
test('drum hits and strums are stable across sample rates and movement durations',()=>{
  for(const fps of [10,15,24,30,60])for(const duration of [100,250,700])for(const id of ['dombyra','dauylpaz']){
    const d=new MotionRecognizer(id);const step=1000/fps;const events:Gesture[]=[];const impacts:Gesture[]=[];
    for(let t=0;t<duration+800;t+=step){const r=d.update(hand(id==='dombyra'?.65:.5,.48+.23*Math.min(1,t/duration)),t);events.push(...r.events.map(e=>e.gesture));impacts.push(...r.impacts.map(e=>e.gesture));}
    assert.deepEqual(events,[id==='dombyra'?'strum-down':'drum-center'],`${id} ${fps}fps ${duration}ms`);
    if(id==='dauylpaz')assert.deepEqual(impacts,['drum-center']);
  }
});
test('seeded small camera noise does not generate notes or bow audio',()=>{
  for(const id of ['dombyra','kobyz','dauylpaz','zhetygen']){
    const d=new MotionRecognizer(id);let seed=42;
    for(let t=0;t<5000;t+=33){seed=(seed*1664525+1013904223)>>>0;const x=.65+((seed/2**32)-.5)*.006;seed=(seed*1664525+1013904223)>>>0;const y=.6+((seed/2**32)-.5)*.006;const r=d.update(hand(x,y),t);assert.equal(r.events.length,0);assert.equal(r.impacts.length,0);assert.equal(r.bowSpeed,0);}
  }
});
test('start calibration adapts to hand size and ignores invalid frames',()=>{
  const frames=Array.from({length:20},()=>{const p=hand(.65,.43);p[0].y=.51;return p;});const c=calibrateHand([...frames,[]]);assert.ok(Math.abs(c.scale-.08)<.001);
  const d=new MotionRecognizer('dombyra');d.calibrate(frames);d.update(hand(.65,.57),0);assert.equal(d.update(hand(.65,.63),50).event?.gesture,'strum-down');
});
test('hand selection stays near the previously tracked hand when detection order changes',()=>{
  const a=hand(.3,.5),b=hand(.65,.5);assert.equal(selectHand([a,b],{x:.64,y:.5}),b);assert.equal(selectHand([b,a],{x:.64,y:.5}),b);
});
test('corrections point toward the instrument instead of saying unrecognized',()=>{
  const d=new MotionRecognizer('dombyra');const r=d.update(hand(.25,.5),0);assert.match(r.coach.title,/слева/);assert.match(r.coach.action,/вправо/);assert.ok(r.coach.target!.x>.25);
  const drum=new MotionRecognizer('dauylpaz');const center=drum.update(hand(.5,.46),0,'drum-rim');assert.match(center.coach.action,/сбоку/);
});
test('a warning stays readable, and success replaces it immediately',()=>{
  const l=new CoachLatch();const warning=coach('w','Выше','Подними руку',undefined,'warning');const guide=coach('g','Играй','Проведи вниз');
  assert.equal(l.update(warning,0).code,'w');assert.equal(l.update(guide,200).code,'w');assert.equal(l.update(guide,1100).code,'g');
  assert.equal(l.update(coach('ok','Получилось','Следующий приём',undefined,'success'),1150).code,'ok');
});
test('zhetygen: lifting a finger and touching the table plays the string under that fingertip',()=>{
  const d=new MotionRecognizer('zhetygen');const taps=(x:number,finger:number,start:number)=>[tableHand(x,.6),tableHand(x,.6,finger),tableHand(x,.6,finger),tableHand(x,.6)].flatMap((h,i)=>d.update(h,start+i*50).events.map(e=>e.gesture));
  assert.deepEqual(taps(.545,0,0),['string-4']);
  assert.deepEqual(taps(.545,3,200),['string-6']);
  const off=new MotionRecognizer('zhetygen');[tableHand(.17,.6),tableHand(.17,.6,0)].forEach((h,i)=>off.update(h,i*50));const r=off.update(tableHand(.17,.6),100);
  assert.deepEqual(r.events,[]);assert.equal(r.coach.code,'tap-off-strings');
});
test('zhetygen: sliding or turning a resting hand plays nothing',()=>{
  const d=new MotionRecognizer('zhetygen');
  for(let i=0;i<24;i++){const h=tableHand(.25+i*.022,.6),a=i*.03,c=palmCenter(h);assert.deepEqual(d.update(h.map(p=>({x:c.x+(p.x-c.x)*Math.cos(a)-(p.y-c.y)*Math.sin(a),y:c.y+(p.x-c.x)*Math.sin(a)+(p.y-c.y)*Math.cos(a),z:0})),i*50).events,[]);}
});
test('zhetygen: a finger kept raised becomes its new resting pose instead of a stuck lift',()=>{
  const d=new MotionRecognizer('zhetygen');d.update(tableHand(.545,.6),0);
  for(let t=50;t<=1700;t+=50)d.update(tableHand(.545,.6,1),t);
  assert.deepEqual(d.update(tableHand(.545,.6,1),1750).events,[]);
  d.update(tableHand(.545,.6),1800);assert.deepEqual(d.update(tableHand(.545,.6,1),1850).events,[]);
});
