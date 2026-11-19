import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { builderModels } from '../backend/builder-labs.js';
const open = async (page, id) => {
  await page.goto(`/simulation.html?lab=${id}`);
  await expect(page.locator('#status')).toHaveText('Live results', { timeout: 20000 });
};
for (const [id, m] of Object.entries(builderModels))
  test(`${id}: worker, editor, HTTP and accessible inspection`, async ({ page, request }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    // Audit settled colors, rather than interpolated colors during a theme transition.
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await open(page, id);
    await expect(page.getByRole('region', { name: 'Interactive project editor' })).toBeVisible();
    const input = Object.fromEntries(
      Object.entries(m.definition.inputs).map(([k, f]) => [k, f.initial]),
    );
    const response = await request.post('/api/waves', { data: { model: id, input } });
    expect(response.status()).toBe(200);
    const result = await response.json();
    for (const [key, value] of Object.entries(result.summary)) {
      const actual = await page.locator(`#metric-${key}`).textContent();
      expect(Number.parseFloat(actual.replaceAll(',', ''))).toBeCloseTo(
        value,
        Math.abs(value) > 100 ? 0 : 2,
      );
    }
    await page.getByRole('button', { name: 'Inspect result', exact: true }).click();
    await expect(page.locator('#model-visual svg')).toBeVisible();
    await page.screenshot({
      path: `tmp/builders/${id}-${test.info().project.name}.png`,
      fullPage: true,
    });
    expect(await page.locator('#model-visual svg').innerHTML()).not.toMatch(
      /NaN|Infinity|undefined/,
    );
    await page.getByRole('button', { name: 'Design', exact: true }).click();
    const violations = (await new AxeBuilder({ page }).include('.builder-editor').analyze())
      .violations;
    expect(violations).toEqual([]);
    await page.emulateMedia({ colorScheme: 'light' });
    expect(
      (await new AxeBuilder({ page }).include('.builder-editor').analyze()).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    ).toBeTruthy();
    expect(errors).toEqual([]);
  });
test('mesh refinement preserves editable restraints and transfers mesh to heat analysis', async ({
  page,
}) => {
  await open(page, 'fem2d');
  await page.getByLabel('Supports 1 uy: m or null', { exact: true }).fill('0');
  await page.getByLabel('Supports 1 uy: m or null', { exact: true }).press('Tab');
  await expect(page.locator('#status')).toHaveText('Live results');
  await page.getByRole('button', { name: 'Refine triangles', exact: true }).click();
  await expect(page.getByLabel('Nodes 8 x (m)', { exact: true })).toBeVisible();
  await expect(page.locator('#status')).toHaveText('Live results');
  await page.getByRole('button', { name: 'Heat', exact: true }).click();
  await expect(page.locator('#status')).toHaveText('Live results');
  await expect(page.getByLabel('Nodes 8 x (m)', { exact: true })).toBeVisible();
});
test('circuit fields change nonlinear device models without editing JSON', async ({ page }) => {
  await open(page, 'spicetransient');
  await page.locator('#lab-preset').selectOption({ label: 'MOS switch' });
  await expect(page.getByLabel('Components 3 threshold', { exact: true })).toBeVisible();
  await page.getByLabel('Components 3 threshold', { exact: true }).fill('1.5');
  await page.getByLabel('Components 3 threshold', { exact: true }).press('Tab');
  await expect(page.locator('#status')).toHaveText('Live results');
  await expect(page.locator('#metric-final')).not.toContainText('1.0902');
});
test('canvas connection and keyboard positioning persist in the control project', async ({
  page,
}) => {
  await open(page, 'controlbuilder');
  await page.getByRole('button', { name: 'Delete Wires 0', exact: true }).click();
  await page.getByRole('button', { name: 'Connect blocks', exact: true }).click();
  await page.locator('.builder-canvas [data-item="0"]').click();
  await page.locator('.builder-canvas [data-item="1"]').click();
  await expect(page.locator('#status')).toHaveText('Live results');
  await page.getByRole('button', { name: 'Connect blocks', exact: true }).click();
  await page.locator('.builder-canvas [data-item="0"]').click();
  await page.locator('.builder-canvas').press('ArrowRight');
  await expect(page.getByLabel('Blocks 0 x', { exact: true })).not.toHaveValue('40');
});
test('arbitrary graph edge editing updates distances and export is portable', async ({ page }) => {
  await open(page, 'dsastudio');
  await page.getByLabel('Edges 0 weight', { exact: true }).fill('1');
  await page.getByLabel('Edges 0 weight', { exact: true }).press('Tab');
  await expect(page.locator('#status')).toHaveText('Live results');
  await expect(page.locator('#model-table')).toContainText('[0,1,1,2,6,5,7,8]');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export project JSON', exact: true }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('nexora-dsastudio.json');
});
test('control actuator limit changes the compiled feedback response', async ({ page }) => {
  await open(page, 'controlbuilder');
  await page.getByLabel('Blocks 3 max', { exact: true }).fill('0.3');
  await page.getByLabel('Blocks 3 max', { exact: true }).press('Tab');
  await expect(page.locator('#metric-final')).toContainText('0.2999');
});
test('driven four-bar closes constraints through a full replay', async ({ page }) => {
  await open(page, 'mechanismbuilder');
  await page.locator('#lab-preset').selectOption({ label: 'Driven four-bar' });
  await expect(page.locator('#metric-dofs')).toHaveText('0 1');
  await page.getByRole('button', { name: 'Inspect result', exact: true }).click();
  await page.locator('#wave-probe').fill(await page.locator('#wave-probe').getAttribute('max'));
  await page.locator('#wave-probe').dispatchEvent('input');
  await expect(page.locator('#model-visual svg')).toBeVisible();
});
test('custom array tracing stops at a breakpoint and benchmarks in the worker', async ({
  page,
}) => {
  await open(page, 'dsastudio');
  await page.locator('[name="algorithm"]').selectOption('merge');
  await page.getByLabel('Array values (JSON)', { exact: true }).fill('[9,-3,8,1,1]');
  await page.getByLabel('Array values (JSON)', { exact: true }).press('Tab');
  await expect(page.locator('#status')).toHaveText('Live results');
  const line = page.locator('.builder-replay ol button').nth(1);
  await line.click();
  await expect(line).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Play to breakpoint', exact: true }).click();
  await expect(page.locator('.builder-replay [role="status"]')).toContainText('Paused on line 2');
  await expect(page.locator('.builder-replay li[aria-current="step"]')).toContainText('Compare');
  await page.getByRole('button', { name: 'Measure empirical scaling', exact: true }).click();
  await expect(page.locator('.builder-replay table tbody tr')).toHaveCount(5, { timeout: 20000 });
  await expect(
    page.getByRole('img', { name: 'Measured median runtime versus input size' }),
  ).toBeVisible();
});
test('existing algorithm pages support pseudocode breakpoints and link to custom inputs', async ({
  page,
}) => {
  await page.goto('/algorithms.html?lab=bubble');
  await expect(page.locator('#status')).toContainText('Trace ready');
  await page.locator('#pseudocode button').nth(1).click();
  await page.locator('#play').click();
  await expect(page.locator('#pseudocode li[aria-current="step"]')).toContainText(
    await page.locator('#pseudocode button').nth(1).textContent(),
  );
  await expect(page.locator('#play')).toHaveText('Play trace');
  await page
    .getByRole('link', { name: 'Build custom graphs, arrays and measure scaling ↗' })
    .click();
  await expect(page.locator('#status')).toHaveText('Live results');
});
