import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { disciplineDefinitions } from '../backend/disciplines.js';
import { labManifest } from '../backend/lab-manifest.js';
export async function newLab(id, discipline, root = process.cwd(), dryRun = false) {
  if (!/^[a-z][a-z0-9]{2,39}$/.test(id ?? ''))
    throw new Error('Use a lowercase identifier of 3–40 letters/digits.');
  if (labManifest.some((lab) => lab.id === id))
    throw new Error('That lab identifier already exists.');
  if (!disciplineDefinitions.some((d) => d.id === discipline))
    throw new Error('Choose an existing discipline identifier.');
  const modulePath = resolve(root, 'backend', `${id}.js`),
    testPath = resolve(root, 'tests', `${id}.test.js`),
    registryPath = resolve(root, 'backend/custom-labs.js');
  for (const path of [modulePath, testPath]) {
    try {
      await access(path);
      throw new Error(`Refusing to overwrite ${path}.`);
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }
  const registry = await readFile(registryPath, 'utf8');
  if (!registry.includes('export const customModels = {'))
    throw new Error('Custom registry format changed; register the lab manually.');
  if (dryRun) return [modulePath, testPath, registryPath];
  await mkdir(resolve(root, 'tests'), { recursive: true });
  const module = `import {lab,p,samples} from './lab-kit.js';\nexport const ${id}=lab({id:'${id}',title:'${id}: spring force',discipline:'${discipline}',inputs:{stiffness:p('Stiffness','N/m',1,10000,100),displacement:p('Displacement','m',0,1,.1)},metrics:{force:['Spring force','N']},plot:{x:'Displacement',xUnit:'m',y:'Force',yUnit:'N'},text:['A generated Hooke-law example. Replace its model and teaching notes before release.','If displacement doubles, what happens to force?',['It doubles','It halves','It stays fixed'],'The model is linear.','100 N/m × 0.1 m = 10 N.','F=kx.','Linear ideal spring; no damping, yield or geometric nonlinearity.']},({stiffness,displacement})=>({summary:{force:stiffness*displacement},series:samples(0,displacement,(x)=>({y:stiffness*x}))}));\n`;
  const test = `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport {${id}} from '../backend/${id}.js';\ntest('${id} matches an independent spring reference',()=>{assert.equal(${id}.solve({stiffness:100,displacement:.1}).summary.force,10);});\n`;
  await writeFile(modulePath, module, { flag: 'wx' });
  await writeFile(testPath, test, { flag: 'wx' });
  await writeFile(
    registryPath,
    `import {${id}} from './${id}.js';\n` +
      registry.replace('export const customModels = {', `export const customModels = { ${id},`),
  );
  return [modulePath, testPath, registryPath];
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    const paths = await newLab(
      process.argv[2],
      process.argv[3],
      process.cwd(),
      process.argv.includes('--dry-run'),
    );
    console.log(paths.join('\n'));
    console.log(
      'Replace the reference model, add independent cases, then run npm run format, npm run docs:generate and npm run check.',
    );
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
