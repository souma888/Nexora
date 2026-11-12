// Small, native illustrations stay crisp in both themes and on every screen.
const line = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
export function subjectArt(kind) {
  const drawings = {
    beam: '<path d="M42 28v44m-8-42 8-5m-8 15 8-5m-8 15 8-5m-8 15 8-5"/><path d="M43 45h208v13H43"/><path d="M80 12v24m-5-6 5 6 5-6m45-18v24m-5-6 5 6 5-6m45-18v24m-5-6 5 6 5-6m45-18v24m-5-6 5 6 5-6" class="art-load"/>',
    circuit: '<circle cx="55" cy="41" r="19"/><path d="M46 41q4-14 9 0t9 0M55 22V12h58v20l-7 5 14 8-14 8 7 5v12H55V60m58-48h90v23m-15 0h30m-30 10h30m-15 0v25h-90"/>',
    motor: '<path d="M100 21h74v42h-74zM87 31h13m-13 22h13m87-12h40M110 63v8h56v-8"/><circle cx="153" cy="42" r="13"/><path d="M151 33l9 9-9 9m-8-9h17"/>',
    feedback: '<path d="M20 30h50m-7-5 7 5-7 5m30-5h33m-7-5 7 5-7 5m66-5h65m-7-5 7 5-7 5M230 30v37H85V44"/><circle cx="85" cy="30" r="14"/><path d="M79 30h12m-6-6v12m-4 5h8"/><rect x="133" y="12" width="57" height="36" rx="4"/><text x="160" y="36" text-anchor="middle">G(s)</text>',
    poles: '<path d="M40 42h220M150 9v66"/><circle cx="105" cy="42" r="25" stroke-dasharray="3 5"/><path d="M94 18l10 10m0-10-10 10m-10 28 10 10m0-10-10 10M150 42Q100 10 56 42" class="art-result"/>',
    tank: '<path d="M92 15v53h104V15m-104 27h104m-73-30V5H60m136 53h43"/><path d="M96 48q12-6 24 0t24 0t24 0t24 0" class="art-result"/>',
    thermal: '<path d="M123 15v35a17 17 0 1 0 20 0V15a10 10 0 0 0-20 0Z"/><path d="M133 30v33m23-40h15m-15 13h10m-10 13h15" class="art-load"/><circle cx="133" cy="64" r="5"/>',
    pendulum: '<path d="M88 64h108M115 55v9m52-9v9"/><rect x="102" y="43" width="78" height="12" rx="3"/><path d="M140 43l29-30"/><circle cx="171" cy="11" r="6"/><path d="M111 18q13-12 28-6m-6-4 6 4-6 5" class="art-result"/>',
    robot: '<path d="M115 70h85l-8-12h-68ZM150 58V41l-31-17 10-12 44 24v22M130 13l47-8 3 12-47 9m45-9 18 10m-4-14 10 8-5 10"/><circle cx="127" cy="19" r="10"/><circle cx="161" cy="41" r="9"/>',
    bars: [29,46,17,39,60,23,51,34].map((h,i)=>`<rect x="${45+i*27}" y="${73-h}" width="16" height="${h}" rx="2" class="${i===4?'art-load':''}"/>`).join(''),
  };
  return `<svg viewBox="0 0 300 82" aria-hidden="true" class="subject-art"><g ${line}>${drawings[kind]??drawings.feedback}</g></svg>`;
}
export function controlArt(id) {
  if(id==='poles')return 'poles';
  return ({motor:'motor',cruise:'motor',tank:'tank',thermal:'thermal',pendulum:'pendulum',bode:'poles',lead:'poles',lag:'poles',locus:'poles',nyquist:'poles',digital:'feedback',windup:'feedback',pid:'feedback',firstorder:'feedback',secondorder:'feedback'})[id];
}
export const robotHero = `<svg viewBox="0 0 520 400" role="img" aria-label="Articulated engineering robot with crimson joints" class="studio-robot">
  <defs><linearGradient id="metal" x2=".9" y2="1"><stop stop-color="#c8d1d0"/><stop offset=".38" stop-color="#6b7979"/><stop offset=".6" stop-color="#d4d9d5"/><stop offset="1" stop-color="#334143"/></linearGradient><linearGradient id="base-metal"><stop stop-color="#283336"/><stop offset=".45" stop-color="#8c9997"/><stop offset="1" stop-color="#182327"/></linearGradient><radialGradient id="floor"><stop stop-color="#416050" stop-opacity=".45"/><stop offset="1" stop-color="#10201a" stop-opacity="0"/></radialGradient></defs>
  <ellipse cx="275" cy="348" rx="235" ry="45" fill="url(#floor)"/><g stroke="#8b9c97" stroke-width=".7" fill="none" opacity=".2"><path d="M20 349h480M55 320h410M100 295h320m-160-20v110m-40-105-80 95m160-95 80 95"/></g>
  <g class="robot-assembly"><path d="M177 329 207 305h126l35 24v18H177Z" fill="url(#base-metal)" stroke="#91a09b"/><ellipse cx="272" cy="310" rx="65" ry="17" fill="#1c292c" stroke="#95a6a2"/><path d="M211 309v-41q60-24 122 0v41q-60 20-122 0" fill="url(#base-metal)" stroke="#778985"/>
  <path d="M245 274 211 171l46-20 47 113Z" fill="url(#metal)" stroke="#b0beb6"/><path d="m251 255-27-77 17-6 35 81" fill="#334143"/>
  <path d="m233 154 77-105 39 29-88 111Z" fill="url(#metal)" stroke="#cad0c8"/><path d="m256 155 64-85 12 10-63 87Z" fill="#263438"/>
  <path d="m330 55 98 63-16 27-103-62Z" fill="url(#metal)" stroke="#b2c0b9"/><path d="m350 82 66 41-5 9-66-42Z" fill="#324144"/>
  ${[[249,269,27],[235,169,30],[326,68,29],[419,131,18]].map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}" fill="#162126" stroke="#b9c5bf" stroke-width="3"/><circle cx="${x}" cy="${y}" r="${r*.7}" fill="#9c1c3b" stroke="#f07688"/><circle cx="${x}" cy="${y}" r="${r*.3}" fill="#202c30" stroke="#b7c5be"/>`).join('')}
  <path d="m429 143 21 17-1 21m-26-30 2 20 15 15m10-26 13 7-1 15" fill="none" stroke="#b1bfb9" stroke-width="8" stroke-linejoin="round"/></g>
  <g fill="#9faeaa" font-family="monospace" font-size="11"><text x="44" y="70">KINEMATICS / 03 DOF</text><text x="320" y="375">MODEL. OBSERVE. UNDERSTAND.</text></g><path d="M43 84h55m-55 0v40" fill="none" stroke="#b82b4a"/>
</svg>`;
