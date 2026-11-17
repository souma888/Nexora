import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { deepAlgorithms } from '../backend/deep-algorithm-definitions.js';
import { networkModels } from '../backend/networks-os.js';
import { cryptoModels } from '../backend/cryptography.js';
import { machineDynamicsModels } from '../backend/machine-dynamics.js';
import { machineDesignModels } from '../backend/machine-design.js';
import { machineMotionModels } from '../backend/machine-motion.js';
import { advancedMaterialModels } from '../backend/advanced-materials.js';
import { disciplineCounts, catalog } from '../backend/catalog.js';
const models = {
  ...networkModels,
  ...cryptoModels,
  ...machineDynamicsModels,
  ...machineDesignModels,
  ...machineMotionModels,
  bearinglife: advancedMaterialModels.bearinglife,
  modal2dof: advancedMaterialModels.modal2dof,
};
const noOverflow = async (page) =>
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
  ).toBeTruthy();
const format = (v) =>
  v === null
    ? '—'
    : v !== 0 && (Math.abs(v) < 0.001 || Math.abs(v) >= 100000)
      ? v.toExponential(2)
      : new Intl.NumberFormat('en', { maximumFractionDigits: 4 }).format(v || 0);
for (const [id, { definition: d }] of Object.entries(models))
  test(`machine/systems: ${id} opens, computes, inspects and matches its API`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`/simulation.html?lab=${id}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#status')).toHaveText('Live results', { timeout: 15000 });
    await expect(page.locator('h1')).toContainText(d.title);
    await expect(page.locator(`a[data-discipline="${d.discipline}"]`)).toHaveAttribute(
      'aria-current',
      'location',
    );
    const input = Object.fromEntries(Object.entries(d.inputs).map(([k, f]) => [k, f.initial])),
      response = await page.request.post('/api/waves', { data: { model: id, input } });
    expect(response.status()).toBe(200);
    const result = await response.json();
    for (const [k, v] of Object.entries(result.summary))
      await expect(page.locator(`#metric-${k}`)).toContainText(format(v));
    await expect(page.locator('#model-visual svg')).toBeVisible();
    const geometry = await page
      .locator('#model-visual svg')
      .evaluate((svg) =>
        [...svg.querySelectorAll('*')]
          .flatMap((node) =>
            ['d', 'points', 'x', 'y', 'cx', 'cy', 'r', 'width', 'height'].map(
              (attr) => node.getAttribute(attr) ?? '',
            ),
          )
          .join(' '),
      );
    expect(geometry).not.toMatch(/NaN|Infinity|undefined|\[object Object\]/);
    await page.locator('#wave-probe').focus();
    await page.keyboard.press('End');
    await expect(page.locator('#wave-probe')).toHaveValue(String(result.series.length - 1));
    if (result.table) await expect(page.locator('#model-table table')).toBeVisible();
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(page.locator('#status')).toHaveText('Live results');
    await noOverflow(page);
    expect(errors).toEqual([]);
  });
for (const [id, d] of Object.entries(deepAlgorithms))
  test(`deep DSA: ${id} replays its real state and matches HTTP`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`/algorithms.html?lab=${id}`);
    await expect(page.locator('#status')).toContainText('Trace ready');
    await expect(page.locator('h1')).toContainText(d.title);
    const response = await page.request.post('/api/algorithms', {
      data: { model: id, input: d.defaults },
    });
    expect(response.status()).toBe(200);
    const r = await response.json();
    await expect(page.locator('#visual svg')).toBeVisible();
    await page.locator('#timeline').focus();
    await page.keyboard.press('End');
    await expect(page.locator('#result-text')).toHaveText(r.result.text);
    await expect(page.locator('#visits')).toHaveText(String(r.stats.visits));
    await expect(page.locator('#state-table')).toBeVisible();
    await page.getByRole('button', { name: 'Previous step', exact: true }).click();
    await expect(page.locator('#result-text')).toContainText('Trace in progress');
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(page.locator('#timeline')).toHaveValue('0');
    await noOverflow(page);
    expect(errors).toEqual([]);
  });
test('new catalog sections and subjects expose every release lab once', async ({ page }) => {
  for (const group of ['networks', 'cryptography', 'algorithms', 'mechanical']) {
    await page.goto('/#' + group);
    await expect(page.locator('#catalog-status')).toHaveText(
      `${disciplineCounts[group]} experiments available`,
    );
    for (const id of [...Object.keys(models), ...Object.keys(deepAlgorithms)]) {
      const entry = catalog.find((lab) => lab.id === id);
      if (entry.groups.includes(group))
        await expect(page.locator(`.sim-link[href="${entry.href}"]`)).toBeVisible();
    }
    if (group === 'mechanical') {
      await page.getByLabel('Subject', { exact: true }).selectOption('Machine design');
      await page.locator('#lab-search').fill('bearing');
      await expect(page.locator('.sim-link:visible')).toHaveCount(2);
    }
  }
});
test('deep graphs and trees reject bad inputs, recover, and preserve real red/black states', async ({
  page,
}) => {
  await page.goto('/algorithms.html?lab=redblack');
  await expect(page.locator('#status')).toContainText('Trace ready');
  await page.locator('#timeline').fill('1');
  await expect(page.locator('#visual circle[fill="var(--brand)"]')).not.toHaveCount(0);
  await page.locator('#algo-values').fill('1,,2');
  await expect(page.locator('#status')).toHaveAttribute('data-error', 'true');
  await expect(page.getByRole('button', { name: 'Play trace', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.locator('#status')).toContainText('Trace ready');
  await page.goto('/algorithms.html?lab=maxflow');
  await page.locator('#algo-matrix').fill('[[0,"<svg>"],[0,0]]');
  await expect(page.locator('#status')).toHaveAttribute('data-error', 'true');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.locator('#status')).toContainText('Trace ready');
  await page.locator('#algo-method').fill('0');
  await expect(page.locator('#status')).toContainText('Trace ready');
  await page.locator('#timeline').focus();
  await page.keyboard.press('End');
  await expect(page.locator('#result-text')).toContainText('Maximum flow 23');
});
test('singular mechanical cases and system validation are visible and recover after reset', async ({
  page,
}) => {
  for (const [id, field, value, warning] of [
    ['slidercrank', 'rod', '50', null],
    ['rsa', 'p', '9', null],
    ['hashavalanche', 'bit', '511', null],
    ['rollingincline', 'friction', '0', 'insufficient'],
    ['boltpreload', 'external', '100', 'separated'],
  ]) {
    await page.goto(`/simulation.html?lab=${id}`);
    await expect(page.locator('#status')).toHaveText('Live results');
    await page.locator('#' + field).fill(value);
    if (warning)
      await expect(page.locator('#model-warnings')).toContainText(new RegExp(warning, 'i'));
    else await expect(page.locator('#status')).toHaveAttribute('data-error', 'true');
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(page.locator('#status')).toHaveText('Live results');
  }
  await page.goto('/simulation.html?lab=forcedvibration');
  await page.locator('#damping').fill('0');
  await page.locator('#ratio').fill('1');
  await expect(page.locator('#metric-amplitude')).toHaveText('—');
  await expect(page.locator('#model-warnings')).toContainText('no finite');
  await page.goto('/simulation.html?lab=slidercrank');
  await expect(page.locator('#wave-probe')).toHaveValue('60');
  await page.locator('#angle').fill('90');
  await expect(page.locator('#wave-probe')).toHaveValue('90');
  await page.getByRole('button', { name: 'Next pose', exact: true }).click();
  await expect(page.locator('#wave-probe')).toHaveValue('91');
});
test('new numerical run save/compare and algorithm JSON export preserve editable inputs', async ({
  page,
}) => {
  await page.goto('/simulation.html?lab=boltpreload');
  await expect(page.locator('#status')).toHaveText('Live results');
  await page.getByText('Save, compare & export', { exact: true }).click();
  await page.getByRole('button', { name: 'Save run', exact: true }).click();
  await page.locator('#external').fill('40');
  await expect(page.locator('#metric-boltforce')).toContainText('40');
  await page.getByRole('button', { name: 'Compare with current', exact: true }).click();
  await expect(page.locator('.run-comparison')).toContainText('10');
  await page.goto('/algorithms.html?lab=hungarian');
  await expect(page.locator('#status')).toContainText('Trace ready');
  await page.getByText('Save, compare & export', { exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  const download = await pending,
    record = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(record.model).toBe('hungarian');
  expect(record.input.matrix).toBe(deepAlgorithms.hungarian.defaults.matrix);
});
test('mechanisms, bit displays and algorithm diagrams are accessible and readable in both themes', async ({
  page,
}, testInfo) => {
  for (const path of [
    'simulation.html?lab=slidercrank',
    'simulation.html?lab=cidr',
    'simulation.html?lab=virtualmemory',
    'simulation.html?lab=camfollower',
    'simulation.html?lab=hashavalanche',
    'algorithms.html?lab=redblack',
    'algorithms.html?lab=convexhull',
    'algorithms.html?lab=btree',
  ]) {
    await page.goto('/' + path);
    await expect(page.locator('#status')).toContainText(
      path.startsWith('algorithms') ? 'Trace ready' : 'Live results',
    );
    const failures = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(failures.violations).toEqual([]);
    const visual = page.locator(path.startsWith('algorithms') ? '#visual' : '#model-visual');
    await visual.screenshot({ path: testInfo.outputPath(path.split('=')[1] + '-light.png') });
    await noOverflow(page);
  }
  await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
  await page.locator('#visual').screenshot({ path: testInfo.outputPath('btree-dark.png') });
});
