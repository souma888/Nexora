import assert from 'node:assert/strict';
import test from 'node:test';
import { thermofluidModels, effectiveness } from '../backend/thermofluids.js';
import { digitalModels } from '../backend/digital.js';
import { roboticModels } from '../backend/robotics.js';
import { computationalModels, poissonSolution } from '../backend/computational.js';
import { materialScienceModels } from '../backend/material-science.js';
import { validate } from '../backend/contract.js';
import { POST } from '../api/waves.js';
const models = { ...thermofluidModels, ...digitalModels, ...roboticModels, ...computationalModels, ...materialScienceModels };
const defaults = id => Object.fromEntries(Object.entries(models[id].definition.inputs).map(([key,f]) => [key,f.initial]));
const solve = (id, overrides = {}) => models[id].solve({ ...defaults(id), ...overrides });
const near = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual-expected)<=tolerance, `${actual} ≈ ${expected}`);

test('Bernoulli preserves total head and continuity between stations', () => {
  const r=solve('bernoulli'),rows=r.table.rows;
  const h=row=>row[2]+row[3]+row[1]**2/(2*9.81);
  near(h(rows[0]),h(rows[1]));near(rows[1][1]/rows[0][1],4);
  near(r.summary.outlet,127.34036449073);
  assert.ok(solve('bernoulli',{pressure:0,flow:20,outlet:20,rise:10}).warnings.length);
});
test('Venturi flow follows independently calculated geometry and square-root pressure scaling', () => {
  const r=solve('venturi'),double=solve('venturi',{drop:40});near(r.summary.flow,8.88761688475,1e-10);near(double.summary.flow,2*r.summary.flow);
  near(solve('venturi',{coefficient:1}).summary.flow,r.summary.ideal);
});
test('laminar pipe loss matches Hagen–Poiseuille and turbulent friction is bounded', () => {
  const r=solve('pipeloss',{flow:0.1,diameter:100,viscosity:10});
  const expected=128*0.01*20*0.0001/(Math.PI*0.1**4)/1000;near(r.summary.loss,expected);
  const normal=solve('pipeloss').summary;assert.ok(normal.friction>0.02&&normal.friction<0.03);near(normal.power,normal.loss*2);
});
test('wall conduction has equal heat flux in both layers and known interface temperature', () => {
  const r=solve('wall');assert.deepEqual(r.summary,{flux:400,interface:60,resistance:0.2});
  near((100-60)/0.1,(60-20)*0.5/0.05);
});
test('lumped cooling obeys one-time-constant decay and flags high Biot numbers', () => {
  const r=solve('cooling');near(r.summary.tau,450);near(r.series[48].y,20+80/Math.E);
  assert.ok(solve('cooling',{mass:10,h:200,area:0.01,conductivity:10}).warnings.length);
});
test('heat exchangers satisfy energy conservation and both spatial boundary conditions', () => {
  for(const arrangement of ['counter','parallel'])for(const[ch,cc,ua]of [[1000,500,1000],[1000,1000,1000],[5000,100,5000],[100,5000,5000]]){
    const r=solve('exchanger',{arrangement,hotCapacity:ch,coldCapacity:cc,conductance:ua}),s=r.summary;
    near((80-s.hotOutlet)*ch,s.heat*1000,1e-7);near((s.coldOutlet-20)*cc,s.heat*1000,1e-7);
    near(r.series[0].y,80,1e-7);near(r.series.at(-1).y,s.hotOutlet,1e-7);
    near(arrangement==='counter'?r.series.at(-1).reference:r.series[0].reference,20,1e-7);
    near(arrangement==='counter'?r.series[0].reference:r.series.at(-1).reference,s.coldOutlet,1e-7);
  }
  near(effectiveness(1,1,'counter'),0.5);near(effectiveness(1,1,'parallel'),(1-Math.exp(-2))/2);
});
test('ideal-gas paths obey the first law, isothermal work and adiabatic heat limit', () => {
  const r=solve('gasprocess');near(r.summary.work,8.314462618*300*Math.log(2));near(r.summary.heat,r.summary.work);
  const ad=solve('gasprocess',{process:'adiabatic'}).summary;near(ad.heat,0,1e-10);near(ad.finalTemperature,300*2**(-0.4));
  const iso=solve('gasprocess',{process:'isobaric'}).summary;near(iso.finalTemperature,600);near(iso.work,8.314462618*300);
  near(solve('gasprocess',{ratio:1}).summary.work,0);
});
test('Carnot engine and refrigerator preserve heat/work accounting', () => {
  assert.deepEqual(solve('carnot').summary,{efficiency:50,work:500,rejected:500});
  const r=solve('refrigerator').summary;near(r.cop,6.75);near(r.power,2000/6.75);near(r.rejected,2000+r.power);
});
test('logic gates implement all Boolean truth tables including single-input NOT', () => {
  for(const gate of ['AND','OR','XOR','NAND','NOR','XNOR','NOT'])for(const a of [0,1])for(const b of [0,1]){
    const expected={AND:Number(Boolean(a&&b)),OR:Number(Boolean(a||b)),XOR:Number(a!==b),NAND:Number(!(a&&b)),NOR:Number(!(a||b)),XNOR:Number(a===b),NOT:1-a}[gate];
    assert.equal(solve('gates',{gate,a,b}).summary.output,expected);
  }
});
test('all eight full-adder states satisfy arithmetic input = 2*carry + sum', () => {
  for(const a of [0,1])for(const b of [0,1])for(const carry of [0,1]){const s=solve('fulladder',{a,b,carry}).summary;assert.equal(a+b+carry,2*s.carry+s.sum);}
});
test('D, T, and JK flip-flops apply positive-edge transitions independently', () => {
  assert.deepEqual(solve('flipflop').visualization.frames.map(f=>f.q),[0,1,0,1,1,0,0,1,0]);
  assert.deepEqual(solve('flipflop',{kind:'T',data:'1,1,0,1'}).visualization.frames.map(f=>f.q),[0,1,0,0,1]);
  assert.deepEqual(solve('flipflop',{kind:'JK',data:'1,0,1,0',secondary:'0,0,1,1'}).visualization.frames.map(f=>f.q),[0,1,1,0,0]);
});
test('binary counters wrap in both directions and preserve register width', () => {
  assert.deepEqual(solve('counter').summary,{final:4,wraps:1,modulus:16});
  const r=solve('counter',{bits:3,direction:'down',steps:1});assert.equal(r.summary.final,7);assert.equal(r.visualization.frames[1].binary,'111');
  for(const f of r.visualization.frames)assert.equal(f.binary.length,3);
});
test('Moore machine detects overlapping 101 patterns at their ending positions', () => {
  const r=solve('fsm',{sequence:'1,0,1,0,1'});assert.equal(r.summary.detections,2);assert.deepEqual(r.series.filter(p=>p.y).map(p=>p.x),[3,5]);
  assert.equal(solve('fsm',{sequence:'0,0,0'}).summary.detections,0);
});
test('cache traces distinguish hits, conflict replacement, associativity and LRU', () => {
  const r=solve('cache');assert.equal(r.summary.hits,2);assert.equal(r.summary.misses,4);
  assert.equal(solve('cache',{ways:'2'}).summary.hits,3);
  const lru=solve('cache',{sets:'2',ways:'2',addresses:'0,32,0,64,32'});
  assert.deepEqual(lru.table.rows.map(r=>r[5]),['miss','miss','hit','miss','miss']);
  assert.equal(lru.visualization.frames[3].evicted,1);
});
test('forward arm geometry and Jacobian agree with simple analytic poses', () => {
  const r=solve('arm');near(r.summary.x,Math.sqrt(3)/2);near(r.summary.y,1.3);
  const straight=solve('arm',{shoulder:0,elbow:0}).summary;near(straight.x,1.8);near(straight.y,0);near(straight.determinant,0);
});
test('both inverse-kinematics branches reconstruct the target and reject unreachable targets honestly', () => {
  for(const branch of ['up','down']){const r=solve('inversearm',{branch}),tip=r.visualization.frames.at(-1).points[2];near(tip[0],1);near(tip[1],1);near(r.summary.error,0);}
  const bad=solve('inversearm',{x:3,y:3});assert.equal(bad.summary.shoulder,null);assert.equal(bad.summary.elbow,null);assert.ok(bad.warnings.length);
  const origin=solve('inversearm',{first:1,second:1,x:0,y:0});near(origin.summary.error,0);
});
test('four-bar branches satisfy each rigid link length and infeasible closures remain missing', () => {
  for(const branch of ['open','crossed']){const p=solve('fourbar',{branch}).visualization.pose.points;near(Math.hypot(p[1][0],p[1][1]),0.5);near(Math.hypot(p[2][0]-p[1][0],p[2][1]-p[1][1]),1.5);near(Math.hypot(p[2][0]-2,p[2][1]),1.2);}
  const r=solve('fourbar',{ground:2,crank:0.2,coupler:0.5,rocker:0.5});assert.equal(r.summary.rocker,null);assert.ok(r.warnings.length);assert.ok(r.series.every(p=>p.y===null));
});
test('differential drive covers straight motion, in-place rotation and stationary wheels', () => {
  const straight=solve('differential',{left:5,right:5}).summary;near(straight.x,1.25);near(straight.y,0);near(straight.heading,0);
  const turn=solve('differential',{left:-5,right:5}).summary;near(turn.x,0);near(turn.y,0);assert.ok(turn.heading>0);
  const stopped=solve('differential',{left:0,right:0}).summary;near(stopped.x,0);near(stopped.y,0);
});
test('holonomic trajectory error follows the closed-form exponential and RMS integral', () => {
  const r=solve('tracking');near(r.summary.error,Math.exp(-10));near(r.summary.rms,Math.sqrt((1-Math.exp(-20))/20));
  assert.ok(solve('tracking',{gain:2}).summary.error<r.summary.error);
});
test('root methods match known roots and stop with a warning on singular Newton derivatives', () => {
  near(solve('roots').summary.root,1.5213797068,1e-6);
  near(solve('roots',{method:'newton'}).summary.root,1.5213797068,1e-7);
  near(solve('roots',{function:'cosine',lower:0,upper:1}).summary.root,0.7390851332,1e-6);
  const r=solve('roots',{method:'newton',initial:1/Math.sqrt(3)});assert.ok(r.warnings.some(s=>s.includes('derivative')));assert.equal(r.summary.iterations,1);
});
test('Euler/RK4 match amplification factors and show convergence with smaller time steps', () => {
  const r=solve('integration');near(r.series[1].y,0.75);near(r.series[1].other,1-0.25+0.25**2/2-0.25**3/6+0.25**4/24);
  const fine=solve('integration',{step:0.125}).summary;assert.ok(fine.euler<r.summary.euler);assert.ok(fine.rk4<r.summary.rk4/10);
  assert.ok(solve('integration',{rate:4,step:1}).warnings.length);
});
test('interpolation matches all nodes and independent polynomial values', () => {
  for(const method of ['linear','cubic'])for(let i=0;i<4;i++)near(solve('interpolation',{method,query:i}).summary.value,[0,1,0,2][i]);
  near(solve('interpolation').summary.value,0.4375);near(solve('interpolation',{method:'linear'}).summary.value,0.5);
});
test('seeded Monte Carlo is reproducible and uses all samples while bounding cloud size', () => {
  const r=solve('montecarlo');assert.equal(r.summary.inside,791);assert.equal(r.summary.estimate,3.164);
  assert.deepEqual(solve('montecarlo'),r);assert.equal(r.visualization.points.length,400);
  assert.deepEqual(solve('montecarlo',{count:100}).visualization.points,r.visualization.points.slice(0,100));
});
test('tridiagonal mesh solve matches the discrete sine eigenvalue and second-order error', () => {
  const n=12,factor=(Math.PI/n)**2/(4*Math.sin(Math.PI/(2*n))**2);
  poissonSolution(n).forEach((value,i)=>near(value,factor*Math.sin(Math.PI*i/n),1e-12));
  const r=solve('mesh');assert.ok(Math.abs(r.summary.order-2)<0.01);assert.ok(solve('mesh',{intervals:24}).summary.error<r.summary.error/3.9);
});
test('bilinear plasticity, fatigue fit and Kelvin–Voigt recovery have independent reference values', () => {
  const r=solve('plasticity').summary;near(r.stress,267.5);near(r.plastic,0.86625);near(solve('plasticity',{strain:0.001}).summary.plastic,0);
  near(solve('fatigue').summary.strength,251.188643150958);near(solve('fatigue').summary.life,169350.87808430294,1e-7);
  const c=solve('creep').summary;near(c.tau,100);near(c.peak,5*(1-Math.exp(-2)));near(c.final,c.peak*Math.exp(-5));
});
test('thermal restraint signs and composite endpoint/bound properties remain correct', () => {
  near(solve('expansion').summary.elongation,1.2);near(solve('expansion',{restraint:'fixed'}).summary.stress,-240);near(solve('expansion',{restraint:'fixed',change:-100}).summary.stress,240);
  for(const fraction of [0,0.3,0.6,1]){const r=solve('composite',{fraction}).summary;assert.ok(r.longitudinal>=r.transverse-1e-9);if(!fraction)near(r.longitudinal,3);if(fraction===1)near(r.transverse,200);}
});
test('all 30 labs accept valid presets, return discoverable units and finite-or-null data at input bounds', async () => {
  assert.equal(Object.keys(models).length,30);
  for(const[id,model]of Object.entries(models)){
    const d=model.definition;
    for(const preset of Object.values(d.presets??{}))assert.ok(!validate(d,{...defaults(id),...preset}).message,`${id}: preset must validate`);
    const scenarios=[defaults(id),...Object.values(d.presets??{}).map(p=>({...defaults(id),...p}))];
    for(const[key,f]of Object.entries(d.inputs))if(f.type==='number')for(const value of [f.min,f.max])scenarios.push({...defaults(id),[key]:value});
    for(const input of scenarios){const check=validate(d,input);if(check.message)continue;const r=model.solve(check.values);assert.ok(Object.values(r.summary).every(v=>v===null||Number.isFinite(v)),`${id} summary`);assert.ok(r.series.length>1);assert.ok(r.series.every(p=>Object.values(p).every(v=>v===null||Number.isFinite(v))),`${id} series`);}
    const response=await POST(new Request('http://localhost/api/waves',{method:'POST',body:JSON.stringify({model:id,input:defaults(id)})}));assert.equal(response.status,200);const json=await response.json();assert.equal(json.version,'1.0');assert.deepEqual(Object.keys(json.units.summary).sort(),Object.keys(json.summary).sort());
  }
});
test('cross-field constraints and malformed digital lists return specific validation fields', () => {
  for(const[id,override,key]of [['venturi',{throat:100},'throat'],['wall',{cold:100},'cold'],['exchanger',{cold:80},'cold'],['carnot',{cold:500,hot:400},'cold'],['counter',{bits:2,initial:4},'initial'],['flipflop',{kind:'JK',data:'1,0',secondary:'1'},'secondary'],['fsm',{sequence:'1,,0'},'sequence'],['cache',{addresses:'1,4096'},'addresses'],['roots',{lower:2,upper:3},'lower']])assert.equal(validate(models[id].definition,{...defaults(id),...override}).key,key);
});
