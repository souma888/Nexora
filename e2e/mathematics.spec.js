import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { models } from '../backend/numeric-models.js';
const additions = Object.entries(models).filter(([, m]) =>
  ['mathematics', 'machinelearning'].includes(m.definition.discipline),
);
const format = (v) =>
  v === null
    ? '—'
    : v !== 0 && (Math.abs(v) < 0.001 || Math.abs(v) >= 100000)
      ? v.toExponential(2)
      : new Intl.NumberFormat('en', { maximumFractionDigits: 4 }).format(v || 0);
for (const [id, { definition: d }] of additions)
  test(`math/data: ${id} computes in a worker and matches HTTP`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`/simulation.html?lab=${id}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#status')).toHaveText('Live results', { timeout: 15000 });
    await expect(page.getByRole('heading', { level: 1 })).toContainText(d.title);
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
    await expect(page.locator('#wave-plot')).toBeVisible();
    if (result.visualization) {
      await expect(page.locator('#model-visual svg')).toBeVisible();
      expect(await page.locator('#model-visual').innerHTML()).not.toMatch(/NaN|Infinity|undefined/);
    }
    await page.locator('#wave-probe').focus();
    await page.keyboard.press('End');
    await expect(page.locator('#wave-probe')).toHaveValue(String(result.series.length - 1));
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(page.locator('#status')).toHaveText('Live results');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    ).toBeTruthy();
    expect(errors).toEqual([]);
  });
test('mathematics subject filters compose with search, clear correctly and preserve catalog navigation', async ({
  page,
}) => {
  await page.goto('/#mathematics');
  await expect(page.locator('#catalog-status')).toHaveText('52 experiments available');
  await page.getByLabel('Subject', { exact: true }).selectOption('Linear Algebra');
  await expect(page.locator('#catalog-status')).toHaveText('8 experiments available');
  await page.locator('#lab-search').fill('pivoting stability');
  await expect(page.locator('#catalog-status')).toHaveText('1 experiment available');
  await page.locator('.sim-link:visible').click();
  await expect(page.locator('#status')).toHaveText('Live results');
  await expect(page.locator('h1')).toContainText('LU Decomposition');
  await page.goto('/#machinelearning');
  await expect(page.locator('#catalog-status')).toHaveText('14 experiments available');
  await expect(page.locator('.section-preview')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(page.locator('#catalog-status')).toHaveText('241 experiments available');
});
test('matrix validation, continuous updates, nonlinear training and accessible mathematical views', async ({
  page,
}, testInfo) => {
  await page.goto('/simulation.html?lab=mathtransform');
  await expect(page.locator('#status')).toHaveText('Live results');
  await page.locator('#matrix').fill('[[1,2],[3,4]]');
  await expect(page.locator('#metric-determinant')).toContainText('-2');
  await page.locator('#matrix').fill('[[1,"<script>"],[3,4]]');
  await expect(page.locator('#status')).toHaveAttribute('data-error', 'true');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.locator('#status')).toHaveText('Live results');
  for (const id of [
    'mathlimits',
    'mathgaussian',
    'mathgradient',
    'mathlorenz',
    'mathheat',
    'mllogistic',
    'mlbackprop',
    'mlconvolution',
  ]) {
    await page.goto(`/simulation.html?lab=${id}`);
    await expect(page.locator('#status')).toHaveText('Live results');
    await page.locator('#model-visual').screenshot({ path: testInfo.outputPath(`${id}.png`) });
    const a = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(a.violations).toEqual([]);
  }
  await page.goto('/simulation.html?lab=mlbackprop');
  await expect(page.locator('#metric-accuracy')).toContainText('1');
  await page.locator('#steps').fill('100');
  await expect(page.locator('#status')).toHaveText('Live results');
  await expect(page.locator('#metric-loss')).not.toContainText('0.0011');
});
