import { expect, test } from '@playwright/test';
import { thermofluidModels } from '../backend/thermofluids.js';
import { digitalModels } from '../backend/digital.js';
import { computerModels } from '../backend/computer-engineering.js';
import { roboticModels } from '../backend/robotics.js';
import { computationalModels } from '../backend/computational.js';
import { materialScienceModels } from '../backend/material-science.js';
const models = {
  ...thermofluidModels,
  ...digitalModels,
  ...computerModels,
  ...roboticModels,
  ...computationalModels,
  ...materialScienceModels,
};
const counts = { thermofluids: 9, digital: 16, robotics: 5, computational: 5, materials: 5 };
const format = (value) =>
  value === null
    ? '—'
    : value !== 0 && (Math.abs(value) < 0.001 || Math.abs(value) >= 100000)
      ? value.toExponential(2)
      : new Intl.NumberFormat('en', { maximumFractionDigits: 4 }).format(value || 0);
const noOverflow = async (page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize().width,
  );

for (const [id, { definition: d }] of Object.entries(models))
  test(`engineering: ${d.title} opens, runs and agrees with its API`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`/#${d.discipline}`);
    await expect(page.locator('#catalog-status')).toHaveText(
      `${counts[d.discipline]} experiments available`,
    );
    await page.locator(`.sim-link[href="/simulation.html?lab=${id}"]`).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(d.title);
    await expect(page.locator('#status')).toHaveText('Live results');
    await expect(page.locator(`a[data-discipline="${d.discipline}"]`)).toHaveAttribute(
      'aria-current',
      'location',
    );
    const input = Object.fromEntries(Object.entries(d.inputs).map(([key, f]) => [key, f.initial]));
    const response = await page.evaluate(
      async (payload) => {
        const r = await fetch('/api/waves', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        return { status: r.status, body: await r.json() };
      },
      { model: id, input },
    );
    expect(response.status).toBe(200);
    for (const [key, value] of Object.entries(response.body.summary))
      await expect(page.locator(`#metric-${key}`)).toContainText(format(value));
    await expect(page.locator('#wave-plot')).toBeVisible();
    expect(await page.locator('#wave-plot').innerHTML()).not.toMatch(/NaN|Infinity/);
    if (response.body.visualization) await expect(page.locator('#model-visual svg')).toBeVisible();
    if (response.body.table) await expect(page.locator('#model-table table')).toBeVisible();
    await page.locator('#wave-probe').focus();
    await page.keyboard.press('End');
    await expect(page.locator('#wave-readout')).toContainText(d.plot.x);
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(page.locator('#status')).toHaveText('Live results');
    await noOverflow(page);
    expect(errors).toEqual([]);
  });

test('logic bit controls, gate selector and reset work with the keyboard', async ({ page }) => {
  await page.goto('/simulation.html?lab=gates');
  await expect(page.locator('#metric-output')).toHaveText('0 bit');
  const b = page.getByRole('button', { name: 'Toggle Input B' });
  await b.focus();
  await page.keyboard.press('Enter');
  await expect(b).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#metric-output')).toHaveText('1 bit');
  await page.getByLabel('Logic gate', { exact: true }).selectOption('XOR');
  await expect(page.locator('#metric-output')).toHaveText('0 bit');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(b).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByLabel('Logic gate', { exact: true })).toHaveValue('AND');
  await page.goto('/simulation.html?lab=fulladder');
  await page.getByRole('button', { name: 'Toggle Carry in' }).click();
  await expect(page.locator('#metric-sum')).toHaveText('1 bit');
  await expect(page.locator('#metric-carry')).toHaveText('1 bit');
});

test('clock stepping and cache presets update diagrams, selected rows and final outcomes', async ({
  page,
}) => {
  await page.goto('/simulation.html?lab=flipflop');
  await expect(page.locator('#model-visual')).toContainText('clock 0');
  await page.getByRole('button', { name: 'Next clock edge' }).click();
  await expect(page.locator('#wave-probe')).toHaveValue('1');
  await expect(page.locator('#model-visual')).toContainText('Q 1');
  await expect(page.locator('#model-table tr.selected')).toContainText('1');
  await page.getByRole('button', { name: 'Play preview' }).click();
  await expect(page.getByRole('button', { name: 'Pause preview' })).toBeVisible();
  await page.getByRole('button', { name: 'Pause preview' }).click();
  await page.getByLabel('D / T / J sequence', { exact: true }).fill('1,,0');
  await expect(page.locator('#status')).toHaveAttribute('data-error', 'true');
  await expect(page.getByRole('button', { name: 'Play preview' })).toBeDisabled();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.locator('#wave-probe')).toHaveValue('0');
  await page.goto('/simulation.html?lab=cache');
  await expect(page.locator('#metric-hits')).toHaveText('2');
  await page.getByLabel('Experiment preset').selectOption('Two-way conflict comparison');
  await expect(page.locator('#metric-hits')).toHaveText('3');
  await expect(page.getByLabel('Associativity', { exact: true })).toHaveValue('2');
  await noOverflow(page);
});

test('inverse-kinematics target can be dragged and unreachable targets have explicit warnings', async ({
  page,
}) => {
  await page.goto('/simulation.html?lab=inversearm');
  const handle = page.locator('.robot-target');
  await handle.scrollIntoViewIfNeeded();
  const bounds = await handle.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 12, bounds.y + bounds.height / 2 - 8, {
    steps: 4,
  });
  await page.mouse.up();
  await expect(page.getByLabel('Target x', { exact: true })).not.toHaveValue('1');
  await page.getByLabel('Experiment preset').selectOption('Unreachable target');
  await expect(page.locator('#model-warnings')).toContainText('outside the reachable annulus');
  await expect(page.locator('#metric-shoulder')).toHaveText('—');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.locator('#metric-error')).toHaveText('0 m');
  await expect(page.locator('#model-warnings')).toBeHidden();
  await noOverflow(page);
});

test('numerical and physical presets reveal model limits and clear them on reset', async ({
  page,
}) => {
  await page.goto('/simulation.html?lab=cooling');
  await page
    .getByLabel('Experiment preset')
    .selectOption('High Biot number: inspect model warning');
  await expect(page.locator('#model-warnings')).toContainText('Biot');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.locator('#model-warnings')).toBeHidden();
  await page.goto('/simulation.html?lab=roots');
  await page.getByLabel('Experiment preset').selectOption('Newton zero-derivative warning');
  await expect(page.locator('#model-warnings')).toContainText('derivative');
  await page.getByLabel('Experiment preset').selectOption('Cosine root bracket');
  await expect(page.locator('#metric-root')).toHaveText('0.7391');
  await expect(page.locator('#model-warnings')).toBeHidden();
  await page.goto('/simulation.html?lab=expansion');
  await page.getByLabel('Experiment preset').selectOption('Fully restrained heating');
  await expect(page.locator('#metric-stress')).toHaveText('-240 MPa');
  await expect(page.locator('#metric-elongation')).toHaveText('0 mm');
});

test('Bode has a phase view and numerical integration shows all three traces', async ({ page }) => {
  await page.goto('/simulation.html?lab=bode');
  await expect(page.locator('#model-visual')).toContainText('Bode phase response');
  await page.locator('#wave-probe').focus();
  await page.keyboard.press('End');
  await expect(page.locator('#model-visual')).toContainText('phase at probe');
  await page.goto('/simulation.html?lab=integration');
  await expect(page.locator('#wave-plot polyline')).toHaveCount(3);
  await expect(page.locator('#model-table')).toContainText('RK4');
  await page.getByLabel('Experiment preset').selectOption('Unstable explicit methods');
  await expect(page.locator('#model-warnings')).toContainText('stability');
  await noOverflow(page);
});

test('new section schematics retain a clear visual hierarchy', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  for (const [id, image] of [
    ['exchanger', 'exchanger.png'],
    ['gates', 'logic-gate.png'],
    ['inversearm', 'robot-arm.png'],
  ]) {
    await page.goto(`/simulation.html?lab=${id}`);
    await expect(page.locator('#status')).toHaveText('Live results');
    await expect(page.locator('#model-visual')).toHaveScreenshot(image, {
      maxDiffPixelRatio: 0.035,
    });
  }
});
