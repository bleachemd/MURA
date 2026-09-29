import { useId } from 'react';
import { getProfile, type Gesture, type Point } from '../lib/gestures';
type Props = { instrument: string; visible: boolean; point: Point | null; trace: Point[]; active: Gesture | null; ready: boolean; progress: number; target?: Point };
/** Camera-aligned 2D AR: geometry and detector share the same mirrored normalized frame. */
export function ARInstrument({instrument,visible,point,trace,active,ready,progress,target}: Props) {
  const id=useId().replace(/:/g,'');const start=getProfile(instrument).ready;
  const lit=!!active;const ink=lit?'#7ff0e6':'#f2e9d6';
  return <svg className={`ar-overlay ${lit?'ar-sounding':''}`} viewBox="0 0 1000 750" preserveAspectRatio="none" aria-hidden="true">
    <defs><marker id={`${id}arrow`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0 0L6 3L0 6Z" fill="#e6ac3c"/></marker><linearGradient id={`${id}wood`}><stop stopColor="#513823"/><stop offset=".45" stopColor="#c69755"/><stop offset=".78" stopColor="#dcb36b"/><stop offset="1" stopColor="#724724"/></linearGradient><linearGradient id={`${id}skin`} x2="0" y2="1"><stop stopColor="#eddaad"/><stop offset="1" stopColor="#b9a479"/></linearGradient><filter id={`${id}glow`}><feGaussianBlur stdDeviation="4"/></filter></defs>
    {visible && <g className="ar-instrument-body" data-testid="ar-instrument" opacity=".8">
      {instrument==='dombyra' ? <>
        <path d="M442 427C488 418 533 329 667 314C773 302 850 363 850 449C850 536 774 602 667 587C533 572 488 482 442 474Z" fill={`url(#${id}wood)`} stroke="#edd5a3" strokeWidth="3"/>
        <path d="M482 447C524 418 563 347 674 336C764 327 828 379 828 449C828 522 764 571 674 565C563 554 524 485 482 458Z" fill={`url(#${id}skin)`} stroke="#8d6139" strokeWidth="4"/>
        <path d="M101 430L550 432L550 470L101 466Z" fill={`url(#${id}wood)`} stroke="#ecd0a0" strokeWidth="2"/>
        <path d="M69 425H107V470H69Z" fill="#ab824c" stroke="#e6c58e" strokeWidth="3"/>
        <path d="M75 425V407M93 470V490" stroke="#d8b078" strokeWidth="8" strokeLinecap="round"/>
        {Array.from({length:13},(_,i)=><path key={i} d={`M${130+i*28} 432v36`} stroke="#efd8aa" strokeWidth="2"/>)}
        <ellipse cx="635" cy="450" rx="19" ry="26" fill="#463622"/><path d="M770 418V485" stroke="#634322" strokeWidth="8"/>
        {[444,456].map(y=><path key={y} className="ar-string" d={`M82 ${y}H790`} stroke={ink} strokeWidth={lit?4:2}/>)}
        <path d="M574 523q18-22 36 0q-18 22-36 0M703 523q18-22 36 0q-18 22-36 0" stroke="#9d7946" strokeWidth="3" fill="none"/>
      </> : instrument==='kobyz' ? <>
        <path d="M483 150Q455 109 487 90Q527 83 523 126L518 442Q588 469 594 574Q596 684 501 696Q407 679 404 583Q404 479 482 442Z" fill={`url(#${id}wood)`} stroke="#deb980" strokeWidth="3"/>
        <path d="M445 503Q467 467 500 492Q533 466 556 505L565 579Q500 602 433 579Z" fill="#392d22"/>
        <path d="M433 580Q500 603 565 580Q570 666 501 676Q432 666 433 580Z" fill={`url(#${id}skin)`}/>
        <path d="M484 190H464M518 170H538" stroke="#d2a56a" strokeWidth="8" strokeLinecap="round"/>
        <path className="ar-string" d="M494 125V645M507 125V645" stroke={ink} strokeWidth={lit?4:2}/><path d="M477 632H526" stroke="#654629" strokeWidth="7"/>
        <g transform={`translate(${((point?.x??.5)-.5)*350} 0)`} className="ar-bow"><path d="M200 393Q502 365 805 393" stroke="#cf9d5e" strokeWidth="9" fill="none"/><path d="M200 393L805 427" stroke="#f1e5c6" strokeWidth="4"/><path d="M742 413L810 419" stroke="#5b3c22" strokeWidth="12" strokeLinecap="round"/></g>
      </> : <>
        <path d="M231 455L272 632Q500 751 728 632L769 455Z" fill={`url(#${id}wood)`} stroke="#d4b783" strokeWidth="4"/>
        <path d="M248 492L300 632L340 534L395 674L450 551L507 687L566 551L618 673L664 533L710 627L752 491" stroke="#e0c796" strokeWidth="7" fill="none"/>
        <ellipse cx="500" cy="459" rx="268" ry="88" fill={`url(#${id}skin)`} stroke="#714e30" strokeWidth="12"/><ellipse cx="500" cy="459" rx="253" ry="75" fill="none" stroke="#f3e0b6" strokeWidth="4"/>
        <path d="M472 459q28-29 56 0q-28 29-56 0M500 430v58" stroke="#a58854" strokeWidth="3" fill="none"/>
        {point && <g className="ar-mallet"><path d={`M${point.x*1000+48} ${point.y*750-102}L${point.x*1000} ${point.y*750}`} stroke="#dcaa69" strokeWidth="11" strokeLinecap="round"/><ellipse cx={point.x*1000} cy={point.y*750} rx="24" ry="16" fill="#efe2c4" stroke="#ae8d58" strokeWidth="3"/></g>}
      </>}
    </g>}
    <g className="ar-guides" fill="none" stroke={ink} strokeWidth="2">
      {instrument==='dombyra' ? <><rect x="430" y="298" width="440" height="305" rx="35" strokeDasharray="8 11" opacity=".25"/><path d="M450 450H850" strokeWidth="3" strokeDasharray={visible?'0':'10 8'}/><path d="M710 370v150m-14-132 14-18 14 18m-28 114 14 18 14-18" opacity=".7"/><text x="430" y="640">Струны: проведи поперёк</text></> : instrument==='kobyz' ? <><rect x="140" y="315" width="720" height="210" rx="28" strokeDasharray="10 10" opacity=".6"/><path d="M200 420H800M220 403l-20 17 20 17m560-34 20 17-20 17" opacity=".65"/><text x="175" y="530">Смычок: держи одну высоту</text></> : <><path d="M230 450H770" strokeDasharray="10 8"/><ellipse cx="500" cy="455" rx="110" ry="38" strokeWidth={active==='drum-center'?5:2}/><path d="M253 450q15-46 100-62m394 62q-15-46-100-62" strokeWidth={active==='drum-rim'?6:3}/><text x="468" y="521">Центр</text><text x="253" y="361">Край</text><text x="691" y="361">Край</text></>}
    </g>
    {target && !ready && !lit && <g className="ar-coach-target"><circle cx={target.x*1000} cy={target.y*750} r="27" fill="#e6ac3c26" stroke="#e6ac3c" strokeWidth="3" strokeDasharray="6 5"/><circle cx={target.x*1000} cy={target.y*750} r="5" fill="#e6ac3c"/>{point&&Math.hypot(point.x-target.x,point.y-target.y)>.06&&<path d={`M${point.x*1000} ${point.y*750}L${(point.x+(target.x-point.x)*.76)*1000} ${(point.y+(target.y-point.y)*.76)*750}`} stroke="#e6ac3c" strokeWidth="3" strokeDasharray="7 5" markerEnd={`url(#${id}arrow)`}/>}</g>}
    {trace.length>1 && <polyline points={trace.map(p=>`${p.x*1000},${p.y*750}`).join(' ')} fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity=".55"/>}
    {point && <g><circle cx={point.x*1000} cy={point.y*750} r={lit?29:18} fill={ink} opacity=".15"/><circle cx={point.x*1000} cy={point.y*750} r="7" fill={ink} stroke="#fff" strokeWidth="2"/></g>}
    {ready && <g className="ar-start-target" transform={`translate(${start.x*1000} ${start.y*750})`}><circle r="46" fill="#0b1620cc" stroke="#f2e9d6" strokeWidth="2" strokeDasharray="7 8"/><circle r="38" fill="none" stroke="#e6ac3c" strokeWidth="6" strokeDasharray={`${progress*239} 239`} transform="rotate(-90)"/><path d="M-12 0H12M0-12V12" stroke="#f2e9d6" strokeWidth="2"/><text y="-61" textAnchor="middle">Кисть сюда, на секунду</text></g>}
    {lit && point && <circle className="ar-ripple" cx={point.x*1000} cy={point.y*750} r="45" fill="none" stroke="#7ff0e6" strokeWidth="3"/>}
  </svg>;
}
