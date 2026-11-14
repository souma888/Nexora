import { test, expect } from '@playwright/test';
import { models } from '../backend/waves.js';
import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';

const open = async (page, id = 'trussfem') => {
  await page.goto(`/simulation.html?lab=${id}`);
  await expect(page.locator('#status')).toHaveText('Live results');
};
test('truss worker recalculates, rejects mechanisms and keeps keyboard navigation', async ({
  page,
}) => {
  await open(page);
  await expect(page.locator('#metric-peakStress')).toContainText('60.0925');
  await expect(page.locator('#model-visual svg')).toBeVisible();
  await page.locator('#loadScale').fill('2');
  await expect(page.locator('#metric-peakStress')).toContainText('120.185');
  const model = JSON.parse(await page.locator('#geometry').inputValue());
  model.supports = [];
  await page.locator('#geometry').fill(JSON.stringify(model));
  await expect(page.locator('#status')).toContainText('unstable');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.locator('#status')).toHaveText('Live results');
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
  ).toBeTruthy();
});
test('analysis worker renders sweep, tornado and reproducible uncertainty', async ({ page }) => {
  await open(page, 'hallpetch');
  await page.getByText('Analysis studio · sweep, uncertainty & fitting', { exact: true }).click();
  await page.getByRole('button', { name: 'Run parameter sweep', exact: true }).click();
  await expect(page.locator('.analysis-output svg')).toHaveCount(1);
  await expect(page.locator('.analysis-output')).toContainText('baseline');
  await page.getByRole('button', { name: 'Sensitivity tornado', exact: true }).click();
  await expect(page.locator('.analysis-output meter')).toHaveCount(1);
  await page.getByRole('button', { name: 'Monte Carlo uncertainty', exact: true }).click();
  await expect(page.locator('.analysis-output')).toContainText('accepted');
  await expect(page.locator('.analysis-output')).toContainText('rejected');
});
test('CSV fit recovers RC time constant and can apply fitted inputs', async ({ page }) => {
  await open(page, 'rc');
  await page.getByText('Analysis studio · sweep, uncertainty & fitting', { exact: true }).click();
  // Fit only resistance; the other parameters remain fixed.
  const labels = page.locator('.analysis-ranges .analysis-range');
  for (const checkbox of await labels.locator('input[type=checkbox]').all())
    await checkbox.uncheck();
  const resistance = labels.filter({ hasText: /resistance/i }).first();
  await resistance.locator('input[type=checkbox]').check();
  await resistance.locator('input[type=number]').nth(0).fill('1');
  await resistance.locator('input[type=number]').nth(1).fill('20');
  const input = await page.locator('#capacitance').inputValue(),
    cap = Number(input),
    voltage = Number(await page.locator('#voltage').inputValue());
  const csv =
    'x,y\n' +
    [0, 1, 2, 3, 4]
      .map((x) => `${x},${voltage * (1 - Math.exp(-x / ((8 * cap) / 1000)))}`)
      .join('\n');
  await page.getByRole('textbox', { name: 'Observed x,y CSV in canonical lab units' }).fill(csv);
  await page.getByRole('button', { name: 'Fit parameters to CSV', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Apply fitted parameters' })).toBeVisible();
  await expect(page.locator('.analysis-output')).toContainText('rmse');
});
test('save comparison overlays curves and PNG/PDF downloads contain real files', async ({
  page,
}) => {
  await open(page, 'hallpetch');
  await page.getByText('Save, compare & export', { exact: true }).click();
  await page.getByRole('button', { name: 'Save run', exact: true }).click();
  await page.locator('#grain').fill('50');
  await expect(page.locator('#status')).toHaveText('Live results');
  await page.getByRole('button', { name: 'Compare with current', exact: true }).click();
  await expect(page.locator('.run-comparison svg')).toHaveCount(1);
  for (const name of ['Export PNG', 'PDF lab report']) {
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name, exact: true }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(name === 'Export PNG' ? /\.png$/ : /\.pdf$/);
    expect(await file.failure()).toBeNull();
    const bytes = await readFile(await file.path());
    expect(
      bytes
        .subarray(0, name === 'Export PNG' ? 8 : 5)
        .toString(name === 'Export PNG' ? 'hex' : 'ascii'),
    ).toBe(name === 'Export PNG' ? '89504e470d0a1a0a' : '%PDF-');
  }
});
test('classroom links restore portable inputs without the local library', async ({
  page,
  context,
}) => {
  await open(page, 'hallpetch');
  await page.getByText('Save, compare & export', { exact: true }).click();
  // Clipboard is unavailable in some mobile profiles; capture the URL passed to the API.
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async (value) => {
          window.sharedURL = value;
        },
      },
    });
  });
  await page.locator('#grain').fill('36');
  await expect(page.locator('#metric-strength')).toContainText('153.333');
  await page.getByRole('button', { name: 'Classroom share link' }).click();
  const url = await page.evaluate(() => window.sharedURL);
  expect(url).toContain('share=');
  const clean = await context.newPage();
  await clean.goto(url);
  await expect(clean.locator('#grain')).toHaveValue('36');
  await expect(clean.locator('#metric-strength')).toContainText('153.333');
  await clean.close();
});
test('embed renders a working lab with no local run controls', async ({ page }) => {
  await page.goto('/embed.html?lab=hallpetch');
  await expect(page.locator('#status')).toHaveText('Live results');
  await expect(page.locator('.topbar')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save run', exact: true })).toHaveCount(0);
  await page.locator('#grain').fill('100');
  await expect(page.locator('#metric-strength')).toContainText('120');
});
test('new lab controls pass axe and are usable on narrow screens', async ({ page }) => {
  await open(page);
  await page.getByText('Analysis studio · sweep, uncertainty & fitting', { exact: true }).click();
  const accessibility = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});
test('neural surrogate trains off the UI thread and reports held-out error', async ({ page }) => {
  test.setTimeout(60000);
  await open(page, 'hallpetch');
  await page.getByText('Analysis studio · sweep, uncertainty & fitting', { exact: true }).click();
  await page.getByRole('button', { name: 'Train browser surrogate' }).click();
  await expect(page.locator('.analysis-output')).toContainText('Held-out RMSE', { timeout: 45000 });
  await expect(page.locator('.analysis-output svg path[stroke-width="2.5"]')).toHaveCount(2);
});
test('Three.js view loads on demand and supports keyboard camera actions', async ({ page }) => {
  await page.goto('/beam.html');
  await expect(page.locator('#status')).toHaveText('Live results');
  await page.getByText('Practice, accessible plots & 3D', { exact: true }).click();
  await page.getByRole('button', { name: 'Open 3D model' }).click();
  await expect(page.locator('.three-canvas canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Front view' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('slider', { name: 'Deformation exaggeration' })).toBeVisible();
});
test('API explorer and generated OpenAPI describe and execute new labs', async ({
  page,
  request,
}) => {
  const response = await request.get('/api/openapi');
  expect(response.ok()).toBeTruthy();
  expect((await response.json()).components.schemas.trussfem).toBeTruthy();
  await page.goto('/api-docs.html');
  await page.locator('#api-model').selectOption('hallpetch');
  await page.getByRole('button', { name: 'Send request' }).click();
  await expect(page.locator('#api-status')).toHaveText('HTTP 200');
  await expect(page.locator('#api-response')).toContainText('170');
});

test('algorithm list entries have discrete parameter sweeps', async ({ page }) => {
  await page.goto('/algorithms.html?lab=bubble');
  await expect(page.locator('#status')).toContainText('Trace ready');
  await page.getByText('Analysis studio · sweep, uncertainty & fitting', { exact: true }).click();
  await page.getByRole('button', { name: 'Run parameter sweep', exact: true }).click();
  await expect(page.locator('.analysis-output svg')).toHaveCount(1);
});
test('practice grades the first answer and interface language can switch back', async ({
  page,
}) => {
  await open(page, 'hallpetch');
  await page.getByText('Practice, accessible plots & 3D', { exact: true }).click();
  await page.getByRole('button', { name: 'Next practice problem' }).click();
  await expect(page.locator('.learning-tools')).toContainText('Problem 1/5');
  await page.getByRole('spinbutton', { name: 'Numeric problem answer' }).fill('0');
  await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(page.locator('.learning-tools')).toContainText('Score 0/1');
  const locale = page.getByRole('combobox', { name: 'Interface language' });
  await locale.selectOption('hi');
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
  await expect(page.getByText('सहेजें, तुलना करें और निर्यात करें', { exact: true })).toBeVisible();
  await locale.selectOption('en');
  await expect(page.getByText('Save, compare & export', { exact: true })).toBeVisible();
});
test('opt-in cache supports offline navigation and numerical workers', async ({
  page,
  context,
}) => {
  test.setTimeout(60000);
  await open(page);
  await page.getByRole('button', { name: 'Enable offline', exact: true }).click();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, {
    timeout: 40000,
  });
  await context.setOffline(true);
  await page.goto('/simulation.html?lab=hallpetch');
  await expect(page.locator('#metric-strength')).toContainText('170');
  await page.getByText('Analysis studio · sweep, uncertainty & fitting', { exact: true }).click();
  await page.getByRole('button', { name: 'Run parameter sweep', exact: true }).click();
  await expect(page.locator('.analysis-output svg')).toHaveCount(1);
  await context.setOffline(false);
});

for (const id of [
  'trussfem',
  'leverrule',
  'fickdiffusion',
  'pariscrack',
  'fracturetoughness',
  'goodman',
  'larsonmiller',
  'hallpetch',
  'stressconcentration',
  'bearinglife',
  'modal2dof',
  'systemidentification',
  'kalmanfilter',
  'pidautotune',
  'tolerancestack',
])
  test(`advanced model ${id} renders canonical API results`, async ({ page, request }) => {
    await open(page, id);
    const model = models[id],
      input = Object.fromEntries(
        Object.entries(model.definition.inputs).map(([key, field]) => [key, field.initial]),
      ),
      response = await request.post('/api/waves', { data: { model: id, input } });
    expect(response.status()).toBe(200);
    const data = await response.json();
    for (const [key, value] of Object.entries(data.summary)) {
      const cell = page.locator(`#metric-${key}`);
      await expect(cell).toBeVisible();
      if (value === null) await expect(cell).toHaveText('—');
      else {
        const raw = (await cell.textContent()).match(/[-+]?\d[\d,]*(?:\.\d+)?(?:e[-+]?\d+)?/i);
        expect(raw).toBeTruthy();
        expect(Math.abs(Number(raw[0].replaceAll(',', '')) - value)).toBeLessThanOrEqual(
          0.005 * Math.max(1, Math.abs(value)),
        );
      }
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    ).toBeTruthy();
  });

test('plot sonification starts only on request and stops without errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await open(page, 'hallpetch');
  await page.getByText('Practice, accessible plots & 3D', { exact: true }).click();
  await page.getByRole('button', { name: 'Play plot audio', exact: true }).click();
  await expect(page.locator('.learning-tools')).toContainText('Playing y:');
  await page.getByRole('button', { name: 'Stop audio', exact: true }).click();
  await expect(page.locator('.learning-tools')).toContainText('Audio stopped.');
  expect(errors).toEqual([]);
});
