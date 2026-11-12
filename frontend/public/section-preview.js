import { models } from '../../backend/waves.js';
import { runAlgorithm } from '../../backend/algorithms.js';
import { renderModelVisual } from './model-visuals.js';
import { validate } from '../../backend/contract.js';
const el=(tag,content,className)=>{const n=document.createElement(tag);if(content!==undefined)n.textContent=content;if(className)n.className=className;return n;};
const format=value=>value===null||value===undefined?'—':typeof value==='number'?new Intl.NumberFormat('en',{maximumSignificantDigits:5}).format(value):String(value);

export function createSectionPreview(){
  const host=el('div',undefined,'studio-feature section-preview');host.hidden=true;
  const copy=el('div',undefined,'feature-intro'),eyebrow=el('p','ON THE BENCH / LIVE EXPERIMENT','studio-eyebrow'),title=el('h2'),description=el('p'),link=el('a','Open the full workbench ↗','studio-text-link');copy.append(eyebrow,title,description,link);
  const console=el('section',undefined,'live-console'),heading=el('div',undefined,'console-heading'),name=el('span'),kind=el('span','LIVE MODEL');heading.append(name,kind);
  const body=el('div',undefined,'console-body'),screen=el('div',undefined,'console-screen'),visual=el('div',undefined,'preview-model'),plot=document.createElementNS('http://www.w3.org/2000/svg','svg');plot.setAttribute('viewBox','0 0 600 240');plot.setAttribute('role','img');const axes=el('p',undefined,'console-legend'),controls=el('div',undefined,'console-controls'),metrics=el('dl',undefined,'console-metrics'),notice=el('p',undefined,'preview-notice');notice.setAttribute('aria-live','polite');
  screen.append(visual,plot,axes);body.append(screen,controls);console.append(heading,body,metrics,notice);host.append(copy,console);
  let current;
  function chart(d,data){
    const points=data.series,keys=Object.keys(d.plot.traces),xs=points.map(p=>p.x).filter(Number.isFinite),ys=points.flatMap(p=>keys.map(k=>p[k]).filter(Number.isFinite)),xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(0,...ys),ymax=Math.max(0,...ys);
    const x=v=>52+(v-xmin)/(xmax-xmin||1)*520,y=v=>210-(v-ymin)/(ymax-ymin||1)*180;
    const grid=Array.from({length:5},(_,i)=>{const vy=ymin+(ymax-ymin)*i/4,vx=xmin+(xmax-xmin)*i/4;return `<path d="M52 ${y(vy)}H572M${x(vx)} 25V210"/><text x="44" y="${y(vy)+4}" text-anchor="end">${format(vy)}</text><text x="${x(vx)}" y="232" text-anchor="middle">${format(vx)}</text>`;}).join('');
    plot.innerHTML=`<g class="console-grid">${grid}</g>`+keys.map((key,j)=>{if(key==='sample'||key==='locus')return points.filter(p=>Number.isFinite(p[key])).map(p=>`<circle cx="${x(p.x)}" cy="${y(p[key])}" r="3" fill="var(--load)"/>`).join('');let pen=false;const commands=points.map((p,i)=>{if(!Number.isFinite(p[key])){pen=false;return '';}const previous=points[i-1];const start=pen&&d.plot.step&&Number.isFinite(previous?.[key])?`L${x(p.x)} ${y(previous[key])} `:'';const s=`${start}${pen?'L':'M'}${x(p.x)} ${y(p[key])}`;pen=true;return s;}).join(' ');return `<path class="preview-trace trace-${j}" d="${commands}"/>`;}).join('');
    plot.setAttribute('aria-label',`${d.title}: ${d.plot.y} against ${d.plot.x}`);axes.replaceChildren(...keys.map(key=>el('span',d.plot.traces[key])),el('span',`${d.plot.x}${d.outputs.series.x?' / '+d.outputs.series.x:''}`));
  }
  function physics(config){
    const model=models[config.model],d=model.definition,defaults=Object.fromEntries(Object.entries(d.inputs).map(([key,f])=>[key,f.initial])),input={...defaults};
    title.textContent=d.title;name.textContent=d.title.toUpperCase();console.setAttribute('aria-label',`Live ${d.title} experiment`);controls.replaceChildren();
    const fields=new Map();
    for(const key of config.parameters){const f=d.inputs[key],label=el('label',f.label),value=el('span',undefined,'console-value');label.htmlFor=`preview-${key}`;value.setAttribute('aria-hidden','true');label.append(value);let field;
      if(f.type==='enum'){field=el('select');for(const option of f.options){const n=el('option',f.labels?.[option]??option);n.value=option;field.append(n);}field.value=input[key];}
      else{field=el('input');field.type='range';field.min='0';field.max=f.integer?String(f.max-f.min):'200';field.step='1';field.value=String((input[key]-f.min)/(f.max-f.min)*Number(field.max));}
      field.id=`preview-${key}`;field.setAttribute('aria-label',f.label);fields.set(key,{field,value});field.addEventListener('input',()=>{input[key]=f.type==='enum'?field.value:Number((f.min+(f.max-f.min)*Number(field.value)/Number(field.max)).toPrecision(12));render();});controls.append(label,field);
    }
    const reset=el('button','Reset preview','quiet');reset.type='button';reset.addEventListener('click',()=>{Object.assign(input,defaults);for(const[key,{field}]of fields){const f=d.inputs[key];field.value=f.type==='enum'?input[key]:String((input[key]-f.min)/(f.max-f.min)*Number(field.max));}render();});controls.append(reset);
    function render(){
      const checked=validate(d,input);if(!checked.values){notice.textContent=checked.message;return;}const data=model.solve(checked.values);
      for(const[key,{field,value}]of fields){const f=d.inputs[key];value.textContent=(f.labels?.[input[key]]??format(input[key]))+(f.unit?' '+f.unit:'');field.setAttribute('aria-valuetext',value.textContent);}
      chart(d,data);visual.hidden=!data.visualization;if(data.visualization)renderModelVisual(visual,d,data,Math.max(0,data.series.length-1));
      metrics.replaceChildren(...Object.entries(d.metrics).slice(0,3).map(([key,label])=>{const cell=el('div');cell.append(el('dt',label),el('dd',`${format(data.summary[key])}${d.outputs.summary[key]?' '+d.outputs.summary[key]:''}`));return cell;}));
      notice.textContent=data.warnings?.join(' ')??'';
      const query=new URLSearchParams({lab:config.model});for(const key of config.parameters)query.set(key,String(input[key]));link.href=`/simulation.html?${query}`;
    }
    render();
  }
  function algorithm(){
    title.textContent='Quick Sort, one decision at a time.';name.textContent='ALGORITHM TRACE / QUICK SORT';console.setAttribute('aria-label','Live Quick Sort experiment');visual.hidden=true;controls.replaceChildren();let trace,step=0;
    const preset=el('select');preset.id='preview-order';preset.setAttribute('aria-label','Preview input order');for(const[label,value]of [['Mixed values','7,2,9,4,1,6'],['Already sorted','1,2,4,6,7,9'],['Reverse order','9,7,6,4,2,1']]){const option=el('option',label);option.value=value;preset.append(option);}
    const scrub=el('input');scrub.type='range';scrub.min='0';scrub.step='1';scrub.id='preview-step';scrub.setAttribute('aria-label','Preview trace position');const next=el('button','Next step','quiet'),reset=el('button','Reset preview','quiet');next.type=reset.type='button';
    controls.append(el('label','Input order'),preset,el('label','Trace position'),scrub,next,reset);
    function render(){const frame=trace.frames[step],a=frame.array;plot.setAttribute('aria-label',frame.message);plot.innerHTML=a.map((v,i)=>{const h=v/10*150,x=65+i*80,color=frame.active?.includes(i)?'var(--load)':step===trace.frames.length-1?'var(--result)':'var(--muted)';return `<rect x="${x}" y="${195-h}" width="48" height="${h}" rx="3" fill="${color}"/><text x="${x+24}" y="220" text-anchor="middle">${v}</text>`;}).join('');scrub.max=String(trace.frames.length-1);scrub.value=String(step);scrub.setAttribute('aria-valuetext',`${step+1} of ${trace.frames.length}`);next.disabled=step===trace.frames.length-1;axes.textContent=frame.message;metrics.replaceChildren(...[['Step',`${step+1} / ${trace.frames.length}`],['Comparisons',frame.stats.comparisons],['Writes',frame.stats.writes]].map(([label,v])=>{const cell=el('div');cell.append(el('dt',label),el('dd',String(v)));return cell;}));notice.textContent='';link.href='/algorithms.html?lab=quick&values='+encodeURIComponent(preset.value);}
    function load(){trace=runAlgorithm('quick',{values:preset.value});step=0;render();}preset.addEventListener('change',load);scrub.addEventListener('input',()=>{step=Number(scrub.value);render();});next.addEventListener('click',()=>{step=Math.min(step+1,trace.frames.length-1);render();});reset.addEventListener('click',()=>{preset.selectedIndex=0;load();});load();
  }
  return{host,show(group,config){host.hidden=!config;if(!config)return;if(current===group)return;current=group;description.textContent=config.prompt;config.model?physics(config):algorithm();}};
}
