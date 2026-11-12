import { controlModels } from '../../backend/control-experiments.js';
import { robotHero, subjectArt } from './studio-art.js';
export function initStudio() {
  const section=document.createElement('section');section.id='studio';section.setAttribute('aria-label','Featured engineering experiments');
  document.querySelector('.catalog-intro').before(section);
  section.innerHTML=`<header class="studio-hero"><div class="studio-copy"><p class="studio-eyebrow">NEXORA / THE EXPERIMENT STUDIO</p><h1>Ideas into<br>experiments<span>.</span></h1><p class="studio-description">Understand it by changing it. Explore real engineering models, tune a system, and follow the mathematics behind every result.</p><a class="studio-primary" href="#catalog-filters">Explore the experiments <span aria-hidden="true">↗</span></a><div class="studio-facts"><span><strong>129</strong> experiments</span><span><strong>12</strong> disciplines</span><span>Open source. Always curious.</span></div></div><div class="studio-artwork">${robotHero}</div></header>
  <div class="studio-feature"><div class="feature-intro"><p class="studio-eyebrow">ON THE BENCH / LIVE EXPERIMENT</p><h2>A small change.<br>A different response.</h2><p>Move the damping control. See the overshoot disappear as a second-order system approaches critical damping.</p><a href="/simulation.html?lab=secondorder" class="studio-text-link">Open the full workbench ↗</a><p class="feature-model">Unit step · zero initial conditions<br>G(s) = ωn² / (s² + 2ζωn s + ωn²)</p></div>
  <section class="live-console" aria-label="Live second-order experiment"><div class="console-heading"><span><i></i> RESPONSE ANALYZER</span><span>SYS / 002</span></div><div class="console-body"><div class="console-screen"><svg id="featured-response" viewBox="0 0 600 240" role="img" aria-label="Live second-order step response"></svg><div class="console-legend"><span>— Output</span><span>┄ Unit setpoint</span><span>Time / seconds</span></div></div><div class="console-controls"><label for="featured-damping">Damping ratio <output id="damping-value">0.30</output></label><input id="featured-damping" type="range" min="0" max="2" step="0.01" value="0.3"><label for="featured-frequency">Natural frequency <output id="frequency-value">2.0 rad/s</output></label><input id="featured-frequency" type="range" min="0.5" max="5" step="0.1" value="2"><button type="button" class="quiet" id="featured-reset">Reset preview</button><p id="featured-regime">Underdamped</p></div></div><dl class="console-metrics"><div><dt>Peak in view</dt><dd id="featured-peak"></dd></div><div><dt>Overshoot in view</dt><dd id="featured-overshoot"></dd></div><div><dt>View duration</dt><dd id="featured-duration"></dd></div></dl></section></div>
  <div class="studio-paths"><a href="/#civil">${subjectArt('beam')}<span>01 / STRUCTURES</span><strong>Find the load path.</strong><small>Explore structural mechanics ↗</small></a><a href="/simulation.html?lab=pid">${subjectArt('feedback')}<span>02 / FEEDBACK</span><strong>Tune the behavior.</strong><small>Tune a controller ↗</small></a><a href="/algorithms.html?lab=quick">${subjectArt('bars')}<span>03 / COMPUTATION</span><strong>See the next step.</strong><small>Trace an algorithm ↗</small></a></div>`;
  section.querySelectorAll('output').forEach(output=>{const value=document.createElement('span');value.id=output.id;value.className='console-value';value.textContent=output.textContent;value.setAttribute('aria-hidden','true');output.replaceWith(value);});
  const homePaths=section.querySelector('.studio-paths').innerHTML;
  const damping=section.querySelector('#featured-damping'),frequency=section.querySelector('#featured-frequency');
  damping.setAttribute('aria-label','Damping ratio');frequency.setAttribute('aria-label','Natural frequency in radians per second');
  function update(){
    const d=Number(damping.value),w=Number(frequency.value),result=controlModels.secondorder.solve({damping:d,frequency:w}),duration=result.series.at(-1).x;
    const sx=x=>46+x/duration*530,sy=y=>211-y/2.1*184;
    const grid=Array.from({length:5},(_,i)=>{const y=i*.5;return `<path d="M46 ${sy(y)}H576"/><text x="34" y="${sy(y)+4}" text-anchor="end">${y.toFixed(1)}</text>`;}).join('')+Array.from({length:5},(_,i)=>{const t=duration*i/4,x=sx(t);return `<path d="M${x} 22V211"/><text x="${x}" y="234" text-anchor="middle">${t.toFixed(1)}</text>`;}).join('');
    section.querySelector('#featured-response').innerHTML=`<g class="console-grid">${grid}</g><path d="M46 ${sy(1)}H576" class="console-target"/><path class="console-curve" d="${result.series.map((p,i)=>`${i?'L':'M'}${sx(p.x).toFixed(2)} ${sy(p.y).toFixed(2)}`).join(' ')}"/>`;
    section.querySelector('#damping-value').textContent=d.toFixed(2);section.querySelector('#frequency-value').textContent=`${w.toFixed(1)} rad/s`;
    damping.setAttribute('aria-valuetext',d.toFixed(2));frequency.setAttribute('aria-valuetext',`${w.toFixed(1)} radians per second`);
    section.querySelector('.studio-text-link').href=`/simulation.html?lab=secondorder&damping=${d}&frequency=${w}`;
    section.querySelector('#featured-regime').textContent=d===0?'Undamped · continuous oscillation':d<1?'Underdamped · oscillatory response':d===1?'Critically damped · no overshoot':'Overdamped · slow approach';
    section.querySelector('#featured-peak').textContent=result.summary.peak.toFixed(3);
    section.querySelector('#featured-overshoot').textContent=`${Math.max(0,(result.summary.peak-1)*100).toFixed(1)}%`;
    section.querySelector('#featured-duration').textContent=`${duration.toFixed(1)} s`;
  }
  damping.addEventListener('input',update);frequency.addEventListener('input',update);section.querySelector('#featured-reset').addEventListener('click',()=>{damping.value='0.3';frequency.value='2';update();});update();
  return group=>{
    const show=!group||group==='control';section.hidden=!show;document.querySelector('.catalog-intro').hidden=show;
    document.body.dataset.catalogView=group==='control'?'control':!group?'studio':'discipline';
    const control=group==='control';section.querySelector('h1').innerHTML=control?'Find your<br>system’s rhythm<span>.</span>':'Ideas into<br>experiments<span>.</span>';
    section.querySelector('.studio-eyebrow').textContent=control?'NEXORA / CONTROL SYSTEMS':'NEXORA / THE EXPERIMENT STUDIO';
    section.querySelector('.studio-description').textContent=control?'From a first response to a finely tuned loop. Explore feedback, stability, and the systems that turn a command into motion.':'Understand it by changing it. Explore real engineering models, tune a system, and follow the mathematics behind every result.';
    section.querySelector('.studio-paths').innerHTML=control?`<a href="/simulation.html?lab=pid">${subjectArt('feedback')}<span>01 / CONTROLLER DESIGN</span><strong>Balance P, I and D.</strong><small>Tune a controller ↗</small></a><a href="/simulation.html?lab=motor">${subjectArt('motor')}<span>02 / REAL SYSTEMS</span><strong>Put feedback in motion.</strong><small>Drive a motor ↗</small></a><a href="/simulation.html?lab=bode">${subjectArt('poles')}<span>03 / FREQUENCY DOMAIN</span><strong>Look beyond time.</strong><small>Read the frequency response ↗</small></a>`:section.querySelector('.studio-paths').innerHTML;
    if(!control)section.querySelector('.studio-paths').innerHTML=homePaths;
  };
}
