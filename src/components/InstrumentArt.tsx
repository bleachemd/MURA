import { useId } from 'react';
export function InstrumentArt({ type = 'dombyra', className = '' }: { type?: string; className?: string }) {
  const id = useId().replace(/:/g, '');
  return <svg className={`instrument-art ${className}`} viewBox="0 0 400 440" aria-hidden="true"><defs>
    <linearGradient id={`${id}wood`} x1="0" x2="1"><stop stopColor="#704020"/><stop offset=".2" stopColor="#bc8545"/><stop offset=".48" stopColor="#e2bb76"/><stop offset=".8" stopColor="#b47a39"/><stop offset="1" stopColor="#69401f"/></linearGradient>
    <linearGradient id={`${id}face`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#efcf93"/><stop offset=".5" stopColor="#d4a663"/><stop offset="1" stopColor="#b78039"/></linearGradient>
    <linearGradient id={`${id}skin`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#f2deb0"/><stop offset="1" stopColor="#b29a67"/></linearGradient>
    <filter id={`${id}shadow`} x="-80%" y="-50%" width="260%" height="240%"><feDropShadow dx="10" dy="17" stdDeviation="12" floodColor="#14291c" floodOpacity=".24"/></filter>
    <pattern id={`${id}grain`} width="12" height="160" patternUnits="userSpaceOnUse"><path d="M2 0Q-1 60 3 160M8 0Q14 90 8 160" fill="none" stroke="#5c361b" strokeOpacity=".12" strokeWidth=".7"/></pattern>
  </defs>
  {type === 'dombyra' ? <g transform="rotate(26 200 230)" filter={`url(#${id}shadow)`}>
    <path d="M188 222C179 250 132 282 131 335C128 386 162 414 201 414C244 414 276 384 270 336C263 286 220 250 211 222Z" fill={`url(#${id}wood)`}/>
    <path d="M190 227C180 266 141 290 141 337C139 379 166 402 201 403C237 403 263 380 260 339C255 290 222 268 209 227Z" fill={`url(#${id}face)`} stroke="#68411e" strokeWidth="2"/>
    <path d="M190 227C180 266 141 290 141 337C139 379 166 402 201 403C237 403 263 380 260 339C255 290 222 268 209 227Z" fill={`url(#${id}grain)`}/>
    <path d="M192 43L186 267L213 267L205 43Z" fill={`url(#${id}wood)`} stroke="#59361f" strokeWidth="2"/>
    <path d="M191 44L193 20Q200 9 207 20L208 44Z" fill="#8e5b2d" stroke="#513922" strokeWidth="2"/>
    <path d="M191 26h-12m27 12h13" stroke="#583b29" strokeWidth="6" strokeLinecap="round"/>
    {Array.from({length:16},(_,i)=><path key={i} d={`M190 ${65+i*11.5}h19`} stroke="#f3dcaf" strokeWidth={i%3===0 ? 2 : 1.2}/>)}
    <ellipse cx="200" cy="295" rx="9" ry="13" fill="#493621" stroke="#8a5a2d" strokeWidth="3"/>
    <path d="M185 363h32" stroke="#5d3b25" strokeWidth="6"/>
    <path d="M198 29L197 384M202 29L204 384" stroke="#f9eac6" strokeWidth="1.2"/>
    <path d="M190 386h22l-4 8h-14Z" fill="#684726"/>
    <path d="M169 329q-14 10 0 20q14-10 0-20m62 0q-14 10 0 20q14-10 0-20" fill="none" stroke="#825528" strokeWidth="1.8"/>
  </g> : type === 'zhetygen' ? <g transform="rotate(-28 200 225)" filter={`url(#${id}shadow)`}>
    <path d="M150 30Q200 14 250 30L264 404Q200 424 136 404Z" fill={`url(#${id}wood)`} stroke="#5f3b1f" strokeWidth="3"/>
    <path d="M160 44Q200 32 240 44L252 392Q200 408 148 392Z" fill={`url(#${id}face)`} stroke="#6d4526" strokeWidth="2"/>
    <path d="M160 44Q200 32 240 44L252 392Q200 408 148 392Z" fill={`url(#${id}grain)`}/>
    <path d="M160 58h80M150 378h100" stroke="#5d3b25" strokeWidth="5"/>
    {Array.from({length:7},(_,i)=><path key={i} d={`M${170+i*10} 58L${162+i*12.5} 378`} stroke="#f9eac6" strokeWidth="1.3"/>)}
    {Array.from({length:7},(_,i)=>{const y=330-i*36;return <ellipse key={`a${i}`} cx={170+i*10+(y-58)/320*(i*2.5-8)} cy={y} rx="5.5" ry="4" fill="#efe0bd" stroke="#7a5230" strokeWidth="1.5"/>;})}
  </g> : type === 'kobyz' ? <g transform="rotate(15 200 220)" filter={`url(#${id}shadow)`}>
    <path d="M189 47Q174 16 197 14Q220 13 211 45L207 226L227 254Q271 294 252 369Q235 412 203 409Q157 412 144 366Q126 300 170 257L184 226Z" fill={`url(#${id}wood)`} stroke="#644027" strokeWidth="3"/>
    <path d="M185 75L183 246M205 69L207 246" stroke="#634025" strokeWidth="3"/>
    <path d="M168 269Q187 245 201 266Q217 248 234 273L239 321Q198 335 158 318Z" fill="#513922"/>
    <path d="M154 324Q202 344 245 325Q251 393 202 397Q155 394 154 324Z" fill={`url(#${id}skin)`} stroke="#916c40" strokeWidth="2"/>
    <path d="M194 41L190 374M201 41L205 374" stroke="#eee2c1" strokeWidth="2"/>
    <path d="M184 66h-18m42-12h19" stroke="#61391f" strokeWidth="7" strokeLinecap="round"/><path d="M183 356h31" stroke="#6e4828" strokeWidth="6"/>
    <path d="M283 107Q312 243 282 388" fill="none" stroke="#694121" strokeWidth="8"/><path d="M282 107L282 388" stroke="#e5d6ab" strokeWidth="2"/>
  </g> : <g transform="translate(0 25) rotate(-12 200 230)" filter={`url(#${id}shadow)`}>
    <path d="M89 190L113 291Q201 363 289 291L311 190Z" fill={`url(#${id}wood)`} stroke="#614021" strokeWidth="3"/>
    <path d="M92 203L126 287L142 213L174 316L195 222L221 316L251 211L272 294L306 203" fill="none" stroke="#dbbc80" strokeWidth="5"/>
    <ellipse cx="200" cy="190" rx="113" ry="63" fill={`url(#${id}skin)`} stroke="#6c4728" strokeWidth="9"/>
    <ellipse cx="200" cy="190" rx="103" ry="53" fill="none" stroke="#f4dfb1" strokeWidth="3"/>
    <path d="M181 181q20-21 39 0q-20 23-39 0m20-19v42m-33-23h65" fill="none" stroke="#957445" strokeWidth="2" opacity=".6"/>
    {Array.from({length:9},(_,i)=> <circle key={i} cx={97+i*26} cy={210+Math.sin(i/8*Math.PI)*37} r="3.5" fill="#503c23"/>)}
    <path d="M142 116L269 54" stroke="#9e703a" strokeWidth="10" strokeLinecap="round"/><ellipse cx="132" cy="122" rx="25" ry="16" transform="rotate(-25 132 122)" fill="#e4d2a9"/>
  </g>}
  </svg>;
}
