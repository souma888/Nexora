import {expect,test} from '@playwright/test';
import {communicationModels} from '../backend/communications.js';
import {energyModels} from '../backend/power-energy.js';
import {aerospaceModels} from '../backend/aerospace.js';
import {chemicalModels} from '../backend/chemical-process.js';
import {industrialModels} from '../backend/industrial.js';
const models={...communicationModels,...energyModels,...aerospaceModels,...chemicalModels,...industrialModels};
const format=value=>value===null?'—':value!==0&&(Math.abs(value)<0.001||Math.abs(value)>=100000)?value.toExponential(2):new Intl.NumberFormat('en',{maximumFractionDigits:4}).format(value||0);
const noOverflow=async page=>expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);

for(const[id,{definition:d}]of Object.entries(models))test(`expansion: ${id} is discoverable, interactive and agrees with its API`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`/#${d.discipline}`,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#catalog-status')).toHaveText('6 experiments available');
  await page.locator(`.sim-link[href="/simulation.html?lab=${id}"]`).click();
  await expect(page.locator('#status')).toHaveText('Live results');await expect(page.getByRole('heading',{level:1})).toContainText(d.title);
  await expect(page.locator(`a[data-discipline="${d.discipline}"]`)).toHaveAttribute('aria-current','location');
  const input=Object.fromEntries(Object.entries(d.inputs).map(([key,f])=>[key,f.initial]));
  const response=await page.request.post('/api/waves',{data:{model:id,input}});expect(response.status()).toBe(200);const result=await response.json();
  for(const[key,value]of Object.entries(result.summary))await expect(page.locator(`#metric-${key}`)).toContainText(format(value));
  await expect(page.locator('#wave-plot')).toBeVisible();await expect(page.locator('#model-visual svg')).toBeVisible();
  expect(await page.locator('#model-visual').innerHTML()).not.toMatch(/NaN|Infinity|undefined/);
  if(result.table)await expect(page.locator('#model-table table')).toBeVisible();
  const before=await page.locator('#model-visual').innerHTML();await page.locator('#wave-probe').fill(String(Math.floor(result.series.length/4)));
  await expect(page.locator('#model-visual')).not.toHaveJSProperty('innerHTML',before);
  await page.locator('#wave-probe').focus();await page.keyboard.press('End');
  await expect(page.locator('#wave-probe')).toHaveValue(String(result.series.length-1));
  await expect(page.locator('#model-visual')).not.toHaveJSProperty('innerHTML',before);
  await page.getByRole('button',{name:'Reset',exact:true}).click();await expect(page.locator('#wave-probe')).toHaveValue('0');
  await expect(page.locator('#status')).toHaveText('Live results');await noOverflow(page);expect(errors).toEqual([]);
});

test('expansion presets, invalid physical domains, singular metrics and recovery are clear',async({page})=>{
  for(const[id,preset,warning]of [['amradio','Overmodulated envelope','Overmodulated'],['buckconverter','Discontinuous-conduction warning','continuous-conduction'],['batterydischarge','View past cutoff','empty SOC'],['weibull','Initial hazard singularity','unbounded']]){
    await page.goto(`/simulation.html?lab=${id}`,{waitUntil:'domcontentloaded'});await page.getByLabel('Experiment preset').selectOption(preset);await expect(page.locator('#model-warnings')).toContainText(warning);
    if(id==='weibull')await expect(page.locator('#metric-hazard')).toHaveText('—');
    await page.getByRole('button',{name:'Reset',exact:true}).click();await expect(page.locator('#model-warnings')).toBeHidden();
  }
  await page.goto('/simulation.html?lab=mm1queue',{waitUntil:'domcontentloaded'});await page.getByLabel('Mean arrival rate λ',{exact:true}).fill('6');await expect(page.locator('#status')).toHaveAttribute('data-error','true');
  await page.getByRole('button',{name:'Reset',exact:true}).click();await expect(page.locator('#status')).toHaveText('Live results');
  await page.goto('/simulation.html?lab=criticalpath',{waitUntil:'domcontentloaded'});await page.getByLabel('Task durations A, B, C, D, E, F',{exact:true}).fill('1,2,3');await expect(page.locator('#status')).toContainText('exactly six');
  await page.getByLabel('Experiment preset').selectOption('Two critical branches');await expect(page.locator('#metric-critical')).toHaveText('6');await noOverflow(page);
});

test('new diagrams remain readable in dark and light themes',async({page},testInfo)=>{
  await page.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});
  for(const id of ['qpsk','solarpv','buckconverter','isentropicflow','consecutive','criticalpath']){
    await page.goto(`/simulation.html?lab=${id}`,{waitUntil:'domcontentloaded'});await expect(page.locator('#status')).toHaveText('Live results');await page.evaluate(()=>document.fonts.ready);
    await page.locator('#model-visual').screenshot({path:testInfo.outputPath(`${id}-dark.png`)});await noOverflow(page);
  }
  await page.getByRole('button',{name:'Switch to light theme'}).click();await page.locator('#model-visual').screenshot({path:testInfo.outputPath('project-light.png')});await noOverflow(page);
  await page.emulateMedia({media:'print'});await expect(page.locator('.discipline-rail')).toBeHidden();await expect(page.locator('#model-visual')).toBeVisible();
});
