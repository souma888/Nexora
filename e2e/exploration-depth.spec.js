import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { explorationReleaseModels as models } from '../backend/exploration-release.js';
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
const expectMetric = async (page, key, value) => {
  const cell = page.locator(`#metric-${key}`);
  if (value !== null && Math.abs(value) < 1e-10) {
    // V8/browser trig and FFT roundoff can differ below meaningful resolution.
    await expect
      .poll(async () => Number.parseFloat(await cell.textContent()))
      .toBeCloseTo(value, 10);
  } else await expect(cell).toContainText(format(value));
};
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
  test(`exploration: ${id} opens, edits live inputs, inspects, resets and matches HTTP`, async ({
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
    for (const [k, v] of Object.entries(result.summary)) await expectMetric(page, k, v);
    await expect(page.locator('#model-visual svg')).toBeVisible();
    if (Object.hasOwn(m.definition.plot.traces, 'third'))
      await expect(page.locator('#traces .other-trace')).toBeVisible();
    await geometry(page);
    await page.locator('#wave-probe').focus();
    await page.keyboard.press('End');
    await expect(page.locator('#wave-probe')).toHaveValue(String(result.series.length - 1));
    for (const [key, f] of Object.entries(m.definition.inputs)) {
      if (
        !['number', 'enum'].includes(f.type) ||
        (f.visibleWhen && input[f.visibleWhen.key] !== f.visibleWhen.is)
      )
        continue;
      const value =
          f.type === 'enum'
            ? f.options.find((v) => v !== f.initial)
            : f.integer
              ? f.initial < f.max
                ? f.initial + 1
                : f.initial - 1
              : f.initial < f.max
                ? Math.min(
                    f.max,
                    f.initial +
                      (f.initial === 0 ? (f.max - f.min) / 100 : Math.abs(f.initial) * 0.1),
                  )
                : Math.max(f.min, f.initial - Math.abs(f.initial) * 0.1),
        candidate = { ...input, [key]: value },
        check = validate(m.definition, candidate);
      if (!check.values) continue;
      const next = await request.post('/api/waves', { data: { model: id, input: candidate } });
      expect(next.status()).toBe(200);
      const changed = await next.json();
      if (f.type === 'enum') await page.locator(`#${key}`).selectOption(value);
      else await page.locator(`#${key}`).fill(String(value));
      await page.locator(`#${key}`).dispatchEvent('input');
      for (const [k, v] of Object.entries(changed.summary)) await expectMetric(page, k, v);
      await geometry(page);
      break;
    }
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(page.locator('#status')).toHaveText('Live results');
    for (const [k, v] of Object.entries(result.summary)) await expectMetric(page, k, v);
    await noOverflow(page);
    expect(errors).toEqual([]);
  });

test('new subject studios expose live previews, links and correct catalog filters', async ({
  page,
}) => {
  test.setTimeout(90000);
  for (const group of ['optics', 'embedded', 'manufacturing', 'biomedical', 'automotive']) {
    await page.goto('/#' + group);
    await expect(page.locator('#discipline-filter')).toHaveValue(group);
    await expect(page.locator('#catalog-grid .sim-link:visible')).toHaveCount(
      disciplineCounts[group],
    );
    await expect(page.locator('#studio h1')).toBeVisible();
    const preview = page.locator('.section-preview');
    await expect(preview).toBeVisible();
    const slider = preview.locator('input[type="range"]').first();
    await slider.focus();
    await page.keyboard.press('ArrowRight');
    await expect(preview.locator('svg').first()).toBeVisible();
    await expect(preview.locator('.studio-text-link')).toHaveAttribute(
      'href',
      /simulation.html\?lab=/,
    );
    await noOverflow(page);
  }
  for (const id of Object.keys(models)) expect(catalog.some((l) => l.id === id)).toBeTruthy();
});

test('critical regimes and contrasting presets remain inspectable', async ({ page }) => {
  for (const [id, preset, key, value] of [
    ['snell', 'Glass to air, TIR', 'incidence', '60'],
    ['thinlens', 'At focus', 'object', '10'],
    ['ofdm', 'Prefix too short', 'prefix', '2'],
    ['shockrelations', 'Detached request', 'turn', '40'],
    ['rotations', 'Gimbal lock', 'pitch', '90'],
  ]) {
    await open(page, id);
    await page.getByLabel('Experiment preset', { exact: true }).selectOption(preset);
    await expect(page.locator('#' + key)).toHaveValue(value);
    await expect(page.locator('#status')).toHaveText('Live results');
    await geometry(page);
    await noOverflow(page);
  }
  await expect(page.locator('#metric-condition')).toContainText('—');
});

test('editable problem domains reject invalid JSON, cyclic precedences and unstable queues', async ({
  page,
}) => {
  for (const [id, key, value] of [
    ['rrtplanner', 'obstacles', '<img src=x onerror=alert(1)>'],
    ['linebalance', 'precedence', '0>1,1>0'],
    ['jobshopschedule', 'jobs', '[[[4,2]]]'],
    ['mmcqueue', 'arrival', '100'],
    ['mccabethiele', 'reflux', '0.5'],
  ]) {
    await open(page, id);
    await page.locator('#' + key).fill(value);
    await page.locator('#' + key).dispatchEvent('input');
    await expect(page.locator('#' + key)).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#model-visual img')).toHaveCount(0);
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(page.locator('#status')).toHaveText('Live results');
  }
});

test('teaching prediction and notes explain a new solver', async ({ page }) => {
  await open(page, 'lqrtuning');
  await page.getByRole('radio').first().check();
  await expect(page.locator('.prediction-feedback')).toBeVisible();
  await page.locator('.notes summary').click();
  await expect(page.locator('.notes')).toContainText('Riccati');
  await expect(page.locator('.notes')).toContainText('unconstrained');
});

test('worked examples load their stated reference inputs rather than only resetting defaults', async ({
  page,
}) => {
  await open(page, 'keplerorbit');
  await page.locator('.notes summary').click();
  await page.getByRole('button', { name: 'Run worked example', exact: true }).click();
  await expect(page.locator('#axis')).toHaveValue('7000');
  await expect(page.locator('#eccentricity')).toHaveValue('0');
  await expect(page.locator('#status')).toHaveText('Live results');
  await expectMetric(page, 'periapsis', 629);
  await open(page, 'temperaturelinearization');
  await page.locator('.notes summary').click();
  await page.getByRole('button', { name: 'Run worked example', exact: true }).click();
  await expect(page.locator('#sensor')).toHaveValue('pt100');
  await expect(page.locator('#temperature')).toHaveValue('100');
  await expectMetric(page, 'signal', 138.5055);
});

test('representative new diagrams are accessible in both themes', async ({ page }, info) => {
  test.setTimeout(120000);
  for (const theme of ['dark', 'light']) {
    await page.emulateMedia({ colorScheme: theme });
    await page.addInitScript((value) => localStorage.setItem('nexora-theme', value), theme);
    for (const id of [
      'snell',
      'loopmargins',
      'biterror',
      'spectrogram',
      'serialtiming',
      'merchantcircle',
      'keplerorbit',
      'mccabethiele',
      'simplextableau',
      'hodgkinhuxley',
      'pharmacokinetics',
      'rrtplanner',
      'quartercar',
      'ofdm',
    ]) {
      await open(page, id);
      await geometry(page);
      await noOverflow(page);
      const scan = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(scan.violations).toEqual([]);
      await page
        .locator('#model-visual')
        .screenshot({ path: info.outputPath(`${id}-${theme}.png`) });
    }
  }
});
