import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { engineeringReleaseModels as models } from '../backend/engineering-release.js';
import { catalog, disciplineCounts } from '../backend/catalog.js';
import { validate } from '../backend/contract.js';
const defaults = (id) =>
  Object.fromEntries(Object.entries(models[id].definition.inputs).map(([k, f]) => [k, f.initial]));
const format = (v) =>
  v === null
    ? '—'
    : v !== 0 && (Math.abs(v) < 0.001 || Math.abs(v) >= 100000)
      ? v.toExponential(2)
      : new Intl.NumberFormat('en', { maximumFractionDigits: 4 }).format(v || 0);
const open = async (page, id) => {
  await page.goto(`/simulation.html?lab=${id}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#status')).toHaveText('Live results', { timeout: 15000 });
};
const noOverflow = async (page) =>
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
  ).toBeTruthy();
const geometry = async (page) => {
  const attrs = await page
    .locator('#model-visual svg')
    .evaluate((svg) =>
      [...svg.querySelectorAll('*')]
        .flatMap((n) =>
          ['d', 'x', 'y', 'cx', 'cy', 'r', 'width', 'height'].map((k) => n.getAttribute(k) ?? ''),
        )
        .join(' '),
    );
  expect(attrs).not.toMatch(/NaN|Infinity|undefined|\[object Object\]/);
};
for (const [id, m] of Object.entries(models))
  test(`engineering depth: ${id} opens, edits live inputs, inspects, resets and matches HTTP`, async ({
    page,
    request,
  }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await open(page, id);
    await expect(page.locator('h1')).toContainText(m.definition.title);
    await expect(page.locator(`a[data-discipline="${m.definition.discipline}"]`)).toHaveAttribute(
      'aria-current',
      'location',
    );
    const input = defaults(id),
      response = await request.post('/api/waves', { data: { model: id, input } });
    expect(response.status()).toBe(200);
    const result = await response.json();
    for (const [k, v] of Object.entries(result.summary))
      await expect(page.locator(`#metric-${k}`)).toContainText(format(v));
    await expect(page.locator('#model-visual svg')).toBeVisible();
    if (Object.hasOwn(m.definition.plot.traces, 'third'))
      await expect(page.locator('#traces .other-trace')).toBeVisible();
    await geometry(page);
    await page.locator('#wave-probe').focus();
    await page.keyboard.press('End');
    await expect(page.locator('#wave-probe')).toHaveValue(String(result.series.length - 1));
    for (const [key, f] of Object.entries(m.definition.inputs)) {
      if (
        f.type !== 'number' ||
        f.integer ||
        (f.visibleWhen && input[f.visibleWhen.key] !== f.visibleWhen.is)
      )
        continue;
      const value =
          f.initial < f.max
            ? Math.min(
                f.max,
                f.initial + (f.initial === 0 ? (f.max - f.min) / 100 : Math.abs(f.initial) * 0.1),
              )
            : Math.max(f.min, f.initial - Math.abs(f.initial) * 0.1),
        candidate = { ...input, [key]: value },
        check = validate(m.definition, candidate);
      if (!check.values) continue;
      const next = await request.post('/api/waves', { data: { model: id, input: candidate } });
      expect(next.status()).toBe(200);
      const changed = await next.json();
      await page.locator(`#${key}`).fill(String(value));
      await page.locator(`#${key}`).dispatchEvent('input');
      for (const [k, v] of Object.entries(changed.summary))
        await expect(page.locator(`#metric-${k}`)).toContainText(format(v));
      await geometry(page);
      break;
    }
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(page.locator('#status')).toHaveText('Live results');
    for (const [k, v] of Object.entries(result.summary))
      await expect(page.locator(`#metric-${k}`)).toContainText(format(v));
    await noOverflow(page);
    expect(errors).toEqual([]);
  });
test('expanded subject filters and search find every release lab in its original discipline', async ({
  page,
}) => {
  test.setTimeout(60000);
  for (const group of ['materials', 'civil', 'thermofluids', 'electrical', 'electronics']) {
    await page.goto('/#' + group);
    await expect(page.locator('#catalog-status')).toHaveText(
      `${disciplineCounts[group]} experiments available`,
    );
    for (const [id, m] of Object.entries(models))
      if (m.definition.discipline === group) {
        const lab = catalog.find((l) => l.id === id);
        await expect(page.locator(`.sim-link[href="${lab.href}"]`)).toBeVisible();
      }
    await noOverflow(page);
  }
  await page.getByLabel('Subject', { exact: true }).selectOption('Analog circuits');
  await page.locator('#lab-search').fill('555');
  await expect(page.locator('.sim-link:visible')).toHaveCount(1);
  await page.locator('.sim-link:visible').click();
  await expect(page.locator('h1')).toContainText('555 Timer: Astable and Monostable');
});
test('temperature-dependent phase envelope and the original supplied tie line both work', async ({
  page,
}) => {
  await open(page, 'leverrule');
  await expect(page.locator('#metric-beta')).toContainText('0.3333');
  await page.locator('#mode').selectOption('diagram');
  await expect(page.locator('#temperature')).toBeVisible();
  await page.locator('#temperature').fill('800');
  await page.locator('#temperature').dispatchEvent('input');
  await expect(page.locator('#metric-alpha')).toContainText('1');
  await geometry(page);
  await page.locator('#temperature').fill('1600');
  await page.locator('#temperature').dispatchEvent('input');
  await expect(page.locator('#metric-beta')).toContainText('1');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.locator('#mode')).toHaveValue('tie');
  await expect(page.locator('#metric-beta')).toContainText('0.3333');
});
test('Rankine superheat/reheat, semiconductor regions and no-intersection cases respond visibly', async ({
  page,
}) => {
  await open(page, 'rankine');
  await page.locator('#reheat').selectOption('no');
  await expect(page.locator('#metric-quality')).not.toContainText('—');
  await page.locator('#wave-probe').focus();
  await page.keyboard.press('End');
  await geometry(page);
  await open(page, 'pumpcurve');
  await page.locator('#static').fill('100');
  await page.locator('#static').dispatchEvent('input');
  await expect(page.locator('#metric-flow')).toContainText('—');
  await expect(page.locator('#model-warnings')).toContainText('no forward operating point');
  await open(page, 'mosfet');
  await page.locator('#gate').fill('0');
  await page.locator('#gate').dispatchEvent('input');
  await expect(page.locator('#metric-current')).toContainText('0');
  await expect(page.locator('#model-visual')).toContainText('Cutoff');
});
test('contrasting presets load canonical inputs and expose different regimes', async ({ page }) => {
  await open(page, 'rcflexure');
  await page.getByLabel('Experiment preset', { exact: true }).selectOption('Over-reinforced');
  await expect(page.locator('#steel')).toHaveValue('10000');
  await expect(page.locator('#model-table')).toContainText('Over-reinforced');
  await open(page, 'momentdistribution');
  await page
    .getByLabel('Experiment preset', { exact: true })
    .selectOption('Carry-over across two joints');
  await expect(page.locator('#model-table')).toContainText('Distribution sweep 3');
  await open(page, 'laminate');
  await page.getByLabel('Experiment preset', { exact: true }).selectOption('Unsymmetric angle-ply');
  await expect(page.locator('#angles')).toHaveValue('0,45,90');
  await open(page, 'schmitt');
  await page.getByLabel('Experiment preset', { exact: true }).selectOption('Hold inside band');
  await expect(page.locator('#metric-switches')).toContainText('0');
  await open(page, 'timer555');
  await page.getByLabel('Experiment preset', { exact: true }).selectOption('One-shot pulse');
  await expect(page.locator('#metric-frequency')).toContainText('—');
});
test('invalid physical and JSON inputs report errors and reset restores calculation', async ({
  page,
}) => {
  for (const [id, key, value] of [
    ['laminate', 'angles', '<img src=x onerror=alert(1)>'],
    ['lame', 'outer', '50'],
    ['runoff', 'rain', '1,,2'],
    ['transformertests', 'ocpower', '2000'],
    ['schmid', 'u', '3'],
  ]) {
    await open(page, id);
    await page.locator(`#${key}`).fill(value);
    await page.locator(`#${key}`).dispatchEvent('input');
    await expect(page.locator('#status')).not.toHaveText('Live results');
    await expect(page.locator(`#${key}`)).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator(`#${key}`)).toHaveAttribute('aria-errormessage', 'status');
    await expect(page.locator('#model-visual img')).toHaveCount(0);
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(page.locator('#status')).toHaveText('Live results');
    await expect(page.locator(`#${key}`)).not.toHaveAttribute('aria-invalid', 'true');
    await geometry(page);
  }
});
test('timers, draining and hysteresis replay real sampled states', async ({ page }) => {
  for (const id of ['timer555', 'tankdraining', 'schmitt', 'commutation']) {
    await open(page, id);
    await expect(page.getByRole('button', { name: 'Play preview', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Next pose', exact: true }).click();
    await expect(page.locator('#wave-probe')).toHaveValue('1');
    await page.locator('#wave-probe').focus();
    await page.keyboard.press('End');
    await geometry(page);
    await noOverflow(page);
  }
});
test('shared save/compare and CSV export preserve a new model run', async ({ page }) => {
  await open(page, 'rcflexure');
  await page.getByText('Save, compare & export', { exact: true }).click();
  await page.getByRole('button', { name: 'Save run', exact: true }).click();
  await expect(page.locator('.saved-run-tools [role="status"]')).toContainText('Saved');
  await page.locator('#steel').fill('4000');
  await page.locator('#steel').dispatchEvent('input');
  await expect(page.locator('#metric-moment')).not.toContainText('434.6405');
  await page.getByRole('button', { name: 'Compare with current', exact: true }).click();
  await expect(page.locator('.run-comparison svg')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toContain('rcflexure');
  const csv = await readFile(await file.path(), 'utf8');
  expect(csv).toContain('Nominal flexural resistance');
  expect(csv).toContain('kN·m');
});
test('representative diagrams are readable and accessible in light and dark themes', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme });
    await page.addInitScript((value) => localStorage.setItem('nexora-theme', value), theme);
    for (const id of [
      'laminate',
      'ironcarbon',
      'proppedbeam',
      'rankine',
      'consolidation',
      'symmetrical',
      'cmosinverter',
      'schmitt',
      'schmid',
      'kirschhole',
      'commutation',
    ]) {
      await open(page, id);
      const scan = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(scan.violations).toEqual([]);
      await page
        .locator('#model-visual')
        .screenshot({ path: info.outputPath(`${id}-${theme}.png`) });
      await noOverflow(page);
    }
  }
});
