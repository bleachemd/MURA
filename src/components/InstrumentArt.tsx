/**
 * Museum-catalogue line art: one colour (inherited), no gradients, no shadows.
 * Weight carries the hierarchy instead — heavy for the body, hairline for
 * strings, frets and lacing.
 */
export function InstrumentArt({ type = 'dombyra', className = '' }: { type?: string; className?: string }) {
  return <svg className={`instrument-art ${className}`} viewBox="0 0 400 440" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {type === 'dombyra' ? <g transform="rotate(26 200 230)">
      <path d="M188 222C179 250 132 282 131 335C128 386 162 414 201 414C244 414 276 384 270 336C263 286 220 250 211 222Z" strokeWidth="7" />
      <path d="M190 227C180 266 141 290 141 337C139 379 166 402 201 403C237 403 263 380 260 339C255 290 222 268 209 227Z" strokeWidth="2" opacity=".4" />
      <path d="M192 43L186 267L213 267L205 43Z" strokeWidth="5" />
      <path d="M191 44L193 20Q200 9 207 20L208 44Z" strokeWidth="5" />
      <path d="M191 26h-12m27 12h13" strokeWidth="5" />
      {Array.from({ length: 16 }, (_, i) => <path key={i} d={`M190 ${65 + i * 11.5}h19`} strokeWidth={i % 3 === 0 ? 2 : 1.2} opacity=".55" />)}
      <ellipse cx="200" cy="295" rx="9" ry="13" strokeWidth="4" />
      <path d="M185 363h32" strokeWidth="5" />
      <path d="M198 29L197 384M202 29L204 384" strokeWidth="1.4" opacity=".75" />
      <path d="M190 386h22l-4 8h-14Z" strokeWidth="3" />
      <path d="M169 329q-14 10 0 20q14-10 0-20m62 0q-14 10 0 20q14-10 0-20" strokeWidth="1.8" opacity=".5" />
    </g> : type === 'kobyz' ? <g transform="rotate(15 200 220)">
      <path d="M189 47Q174 16 197 14Q220 13 211 45L207 226L227 254Q271 294 252 369Q235 412 203 409Q157 412 144 366Q126 300 170 257L184 226Z" strokeWidth="7" />
      <path d="M168 269Q187 245 201 266Q217 248 234 273L239 321Q198 335 158 318Z" strokeWidth="2.4" opacity=".45" />
      <path d="M154 324Q202 344 245 325Q251 393 202 397Q155 394 154 324Z" strokeWidth="3" />
      <path d="M185 75L183 246M205 69L207 246" strokeWidth="1.6" opacity=".4" />
      <path d="M184 66h-18m42-12h19" strokeWidth="5" />
      <path d="M194 41L190 374M201 41L205 374" strokeWidth="1.6" opacity=".75" />
      <path d="M183 356h31" strokeWidth="5" />
      <path d="M283 107Q312 243 282 388" strokeWidth="6" />
      <path d="M282 107L282 388" strokeWidth="1.4" opacity=".7" />
    </g> : <g transform="translate(0 25) rotate(-12 200 230)">
      <path d="M89 190L113 291Q201 363 289 291L311 190Z" strokeWidth="6" />
      <path d="M92 203L126 287L142 213L174 316L195 222L221 316L251 211L272 294L306 203" strokeWidth="2.4" opacity=".55" />
      <ellipse cx="200" cy="190" rx="113" ry="63" strokeWidth="7" />
      <ellipse cx="200" cy="190" rx="103" ry="53" strokeWidth="1.6" opacity=".45" />
      <path d="M181 181q20-21 39 0q-20 23-39 0m20-19v42m-33-23h65" strokeWidth="2" opacity=".5" />
      {Array.from({ length: 9 }, (_, i) => <circle key={i} cx={97 + i * 26} cy={210 + Math.sin(i / 8 * Math.PI) * 37} r="3.5" strokeWidth="2" />)}
      <path d="M142 116L269 54" strokeWidth="6" />
      <ellipse cx="132" cy="122" rx="25" ry="16" transform="rotate(-25 132 122)" strokeWidth="4" />
    </g>}
  </svg>;
}
