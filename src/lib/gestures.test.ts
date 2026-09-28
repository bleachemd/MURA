import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyHand, type Gesture, type Point } from './gestures';
function hand(gesture: Gesture): Point[] {
  const points = Array.from({length:21},()=>({x:.5,y:.6,z:0}));
  points[0] = {x:.5,y:.8,z:0};
  [5,9,13,17].forEach((base,i)=>{
    const x=.36+i*.09; const open=gesture==='palm'||(gesture==='peace'&&i<2);
    points[base]={x,y:.59,z:0};points[base+1]={x,y:.45,z:0};points[base+2]={x,y:open?.36:.52,z:0};points[base+3]={x,y:open?.25:.64,z:0};
  });
  return points;
}
for(const g of ['palm','peace','fist'] as const) test(`recognizes ${g} and mirrored hand`,()=>{
  assert.equal(classifyHand(hand(g)).gesture,g);
  assert.equal(classifyHand(hand(g).map(p=>({...p,x:1-p.x}))).gesture,g);
});
test('no hand gives actionable guidance',()=>assert.match(classifyHand([]).hint,/целиком/));
test('small hand requests moving closer',()=>{const p=hand('palm').map(p=>({...p,x:.5+(p.x-.5)*.2,y:.5+(p.y-.5)*.2}));assert.equal(classifyHand(p).gesture,null);assert.match(classifyHand(p).hint,/ближе/);});
test('clipped hand requests repositioning',()=>{const p=hand('palm');p[8].x=.99;assert.match(classifyHand(p).hint,/центр/);assert.equal(classifyHand(p).gesture,null);});
test('sideways palm requests rotation',()=>{const p=hand('palm');p[17].x=p[5].x+.01;assert.match(classifyHand(p).hint,/Поверни/);});
test('incorrect gesture names the specific finger',()=>assert.match(classifyHand(hand('palm'),'peace').hint,/Согни безымянный палец/));
test('partly bent finger is not accepted as a full gesture',()=>{const p=hand('palm');p[8].y=.4;assert.equal(classifyHand(p,'palm').gesture,null);assert.match(classifyHand(p,'palm').hint,/Выпрями указательный/);});
