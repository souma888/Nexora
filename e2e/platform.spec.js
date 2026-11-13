import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
const ready = async (page, url) => {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#status')).toHaveAttribute('data-error', 'false');
};
const noOverflow = async (page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize().width,
  );

test('build a circuit, detect a singular network and restore a valid preset', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page, '/simulation.html?lab=circuitbuilder');
  expect(
    await page
      .locator('.run-tools')
      .evaluate((node) =>
        Boolean(
          node.compareDocumentPosition(document.getElementById('experiment')) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        ),
      ),
  ).toBe(true);
  await expect(page.locator('#metric-peak')).toHaveText('10 V');
  await expect(page.locator('#model-table')).toContainText('R1');
  await page
    .getByLabel('Circuit netlist (Ω, V, A)', { exact: true })
    .fill('I I1 0 1 0.002; R R1 1 0 1000');
  await expect(page.locator('#metric-peak')).toHaveText('2 V');
  const response = await page.request.post('/api/waves', {
    data: { model: 'circuitbuilder', input: { netlist: 'I I1 0 1 0.002; R R1 1 0 1000' } },
  });
  expect(response.status()).toBe(200);
  expect((await response.json()).summary.peak).toBe(2);
  await page.getByLabel('Circuit netlist (Ω, V, A)', { exact: true }).fill('I I1 0 1 1');
  await expect(page.locator('#status')).toContainText('Singular');
  await page.getByLabel('Experiment preset').selectOption('Bridge network');
  await expect(page.locator('#status')).toHaveText('Live results');
  await expect(page.locator('#metric-peak')).toHaveText('12 V');
  await noOverflow(page);
  expect(errors).toEqual([]);
});
test('editable project DAG detects cycles and solves dependencies outside declaration order', async ({
  page,
}) => {
  await ready(page, '/simulation.html?lab=criticalpath');
  await page.getByLabel('Task dependencies (A>C; B>C, or none)', { exact: true }).fill('C>A; A>B');
  await page.getByLabel('Task durations (A–L, 2–12 tasks)', { exact: true }).fill('2,4,3');
  await expect(page.locator('#metric-duration')).toHaveText('9 days');
  await page.getByLabel('Task dependencies (A>C; B>C, or none)', { exact: true }).fill('A>B;B>A');
  await expect(page.locator('#status')).toContainText('cycle');
  await page.getByLabel('Task dependencies (A>C; B>C, or none)', { exact: true }).fill('none');
  await expect(page.locator('#metric-duration')).toHaveText('4 days');
  await noOverflow(page);
});
test('unit changes preserve quantities and presets reset to canonical units', async ({ page }) => {
  await ready(page, '/simulation.html?lab=divider');
  const metric = await page.locator('#metric-loaded').textContent();
  await page
    .getByRole('combobox', { name: 'Unit for Supply voltage', exact: true })
    .selectOption('mV');
  await expect(page.getByLabel('Supply voltage', { exact: true })).toHaveValue('12000');
  await expect(page.locator('#metric-loaded')).toHaveText(metric);
  await page.getByLabel('Supply voltage', { exact: true }).fill('6000');
  await expect(page.locator('#metric-loaded')).toHaveText('2 V');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(
    page.getByRole('combobox', { name: 'Unit for Supply voltage', exact: true }),
  ).toHaveValue('V');
  await expect(page.locator('#metric-loaded')).toHaveText(metric);
  await noOverflow(page);
});
test('save, compare, restore, portable JSON, CSV and the browser library work end to end', async ({
  page,
}) => {
  await ready(page, '/simulation.html?lab=divider');
  await page.getByText('Save, compare & export', { exact: true }).click();
  await page.getByLabel('Run name', { exact: true }).fill('Baseline <safe>');
  await page.getByRole('button', { name: 'Save run', exact: true }).click();
  await expect(page.locator('.run-tools [role=status]')).toContainText('Saved in this browser');
  await page.getByLabel('Supply voltage', { exact: true }).fill('6');
  await expect(page.locator('#metric-loaded')).toHaveText('2 V');
  await page.getByRole('button', { name: 'Compare with current', exact: true }).click();
  await expect(page.locator('.run-comparison')).toContainText('Baseline <safe>');
  await expect(page.locator('.run-comparison')).toContainText('-2');
  await page.getByRole('button', { name: 'Restore saved', exact: true }).click();
  await expect(page.getByLabel('Supply voltage', { exact: true })).toHaveValue('12');
  await expect(page.locator('#metric-loaded')).toHaveText('4 V');
  for (const [name, extension] of [
    ['Export JSON', '.json'],
    ['Export CSV', '.csv'],
  ]) {
    const promise = page.waitForEvent('download');
    await page.getByRole('button', { name, exact: true }).click();
    const download = await promise;
    expect(download.suggestedFilename()).toContain(extension);
    const contents = await readFile(await download.path(), 'utf8');
    if (extension === '.json') {
      const run = JSON.parse(contents);
      expect(run.model).toBe('divider');
      expect(run.input.voltage).toBe(12);
      expect(run.result.summary.loaded).toBe(4);
    } else expect(contents).toContain('"4","V"');
  }
  await page.getByLabel('Import run JSON', { exact: true }).setInputFiles({
    name: 'run.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: 'nexora-run',
        schemaVersion: 1,
        model: 'divider',
        solverVersion: '1.0',
        input: { voltage: 6, r1: 10, r2: 10, load: 10 },
        label: 'Portable',
      }),
    ),
  });
  // An incomplete/imported field map must fail normal model validation, never trust result payloads.
  await expect(page.locator('.run-tools [role=status]')).toContainText('must be between');
  await page.getByRole('link', { name: 'Open saved-run library' }).click();
  await expect(page.locator('#saved-runs')).toContainText('Baseline <safe>');
  await page.locator('#saved-runs a').click();
  await expect(page.locator('#metric-loaded')).toHaveText('4 V');
  await expect(page.locator('.run-tools')).toHaveAttribute('open', '');
  await noOverflow(page);
});
test('portable imports recalculate results, reject versions, and never execute supplied markup', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.__executed = false;
  });
  await ready(page, '/simulation.html?lab=shannon');
  await page.getByText('Save, compare & export', { exact: true }).click();
  const record = {
    format: 'nexora-run',
    schemaVersion: 1,
    model: 'shannon',
    solverVersion: '1.0',
    label: '<img src=x onerror="window.__executed=true">',
    input: { bandwidth: 100, snr: 0 },
    result: { summary: { capacity: 999 } },
  };
  await page.getByLabel('Import run JSON', { exact: true }).setInputFiles({
    name: 'run.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(record)),
  });
  await expect(page.locator('#metric-capacity')).toHaveText('0.1 Mbit/s');
  expect(await page.evaluate(() => window.__executed)).toBe(false);
  await page.getByLabel('Import run JSON', { exact: true }).setInputFiles({
    name: 'run.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...record, solverVersion: '2.0' })),
  });
  await expect(page.locator('.run-tools [role=status]')).toContainText('Solver version differs');
  await page.getByRole('button', { name: 'Save run', exact: true }).click();
  await page.getByRole('link', { name: 'Open saved-run library' }).click();
  expect(await page.locator('#saved-runs img').count()).toBe(0);
  expect(await page.evaluate(() => window.__executed)).toBe(false);
});
test('algorithm URL values are validated and algorithm runs can be saved and restored', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.__executed = false;
  });
  await ready(
    page,
    '/algorithms.html?lab=quick&values=' +
      encodeURIComponent('<img src=x onerror="window.__executed=true">'),
  );
  await expect(page.getByLabel('Array values', { exact: true })).not.toHaveValue(/img/);
  expect(await page.evaluate(() => window.__executed)).toBe(false);
  await page.getByText('Save, compare & export', { exact: true }).click();
  expect(
    await page
      .locator('.run-tools')
      .evaluate((node) =>
        Boolean(
          node.compareDocumentPosition(document.getElementById('algorithm-lab')) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        ),
      ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Save run', exact: true }).click();
  const before = await page.getByLabel('Array values', { exact: true }).inputValue();
  await page.getByLabel('Array values', { exact: true }).fill('3,2,1');
  await expect(page.locator('#status')).toContainText('Trace ready');
  await page.getByRole('button', { name: 'Restore saved', exact: true }).click();
  await expect(page.getByLabel('Array values', { exact: true })).toHaveValue(before);
  await noOverflow(page);
});
