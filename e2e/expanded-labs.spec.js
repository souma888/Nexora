import { expect, test } from '@playwright/test';
import { controlModels } from '../backend/control-experiments.js';
import { algorithms } from '../backend/algorithm-definitions.js';

const noOverflow = async (page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize().width,
  );
const monitor = (page) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
};

for (const [id, { definition }] of Object.entries(controlModels)) {
  test(`control: ${definition.title} opens, plots, and agrees with its API`, async ({ page }) => {
    const errors = monitor(page);
    await page.goto('/#control');
    await expect(page.getByRole('status')).toHaveText('15 experiments available');
    await page.locator(`.sim-link[href="/simulation.html?lab=${id}"]`).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(definition.title);
    await expect(page.locator('#status')).toHaveText('Live results');
    await expect(page.locator('[data-discipline="control"]')).toHaveAttribute(
      'aria-current',
      'location',
    );
    await expect(page.locator('#wave-plot')).toBeVisible();
    expect(await page.locator('#wave-plot').innerHTML()).not.toMatch(/NaN|Infinity/);
    const input = Object.fromEntries(
      Object.entries(definition.inputs).map(([key, f]) => [key, f.initial]),
    );
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
    expect(response.body.series.length).toBeGreaterThan(20);
    const format = (n) =>
      n !== 0 && (Math.abs(n) < 0.001 || Math.abs(n) >= 100000)
        ? n.toExponential(2)
        : new Intl.NumberFormat('en', { maximumFractionDigits: 4 }).format(n || 0);
    for (const [key, value] of Object.entries(response.body.summary))
      await expect(page.locator(`#metric-${key}`)).toContainText(format(value));
    await page.locator('#wave-probe').focus();
    await page.keyboard.press('End');
    await expect(page.locator('#wave-readout')).toContainText(definition.plot.x);
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await noOverflow(page);
    expect(errors).toEqual([]);
  });
}

for (const [id, definition] of Object.entries(algorithms)) {
  test(`algorithm: ${definition.title} opens, scrubs, and returns the API result`, async ({
    page,
  }) => {
    const errors = monitor(page);
    await page.goto('/#algorithms');
    await expect(page.getByRole('status')).toHaveText('55 experiments available');
    await page.locator(`.sim-link[href="/algorithms.html?lab=${id}"]`).click();
    await expect(page.locator('#algorithm-lab')).toBeVisible();
    await expect(page.locator('a[data-discipline="algorithms"]')).toHaveAttribute(
      'aria-current',
      'location',
    );
    await expect(page.locator('#status')).toContainText('Trace ready');
    const response = await page.evaluate(
      async (payload) => {
        const r = await fetch('/api/algorithms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        return { status: r.status, body: await r.json() };
      },
      { model: id, input: definition.defaults },
    );
    expect(response.status).toBe(200);
    await page.locator('#timeline').focus();
    await page.keyboard.press('End');
    await expect(page.locator('#result-text')).toHaveText(response.body.result.text);
    await expect(page.locator('#comparisons')).toHaveText(String(response.body.stats.comparisons));
    await expect(page.getByRole('button', { name: 'Next step', exact: true })).toBeDisabled();
    await expect(page.locator('#state-table')).toBeVisible();
    await expect(page.locator('#pseudocode [aria-current="step"]')).toHaveCount(1);
    await page.getByRole('button', { name: 'Previous step', exact: true }).click();
    await expect(page.locator('#result-text')).toContainText('Trace in progress');
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Previous step', exact: true })).toBeDisabled();
    await noOverflow(page);
    expect(errors).toEqual([]);
  });
}

test('algorithm presets, validation, prediction and playback work with the keyboard', async ({
  page,
}) => {
  await page.goto('/algorithms.html?lab=bubble');
  await page.getByLabel('Array values', { exact: true }).fill('1,,2');
  await expect(page.locator('#status')).toHaveAttribute('data-error', 'true');
  await expect(page.getByRole('button', { name: 'Play trace' })).toBeDisabled();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByLabel('Input preset').selectOption('Duplicates & negatives');
  await page.getByRole('radio', { name: 'Already sorted', exact: true }).check();
  await page.getByRole('button', { name: 'Next step', exact: true }).click();
  await expect(page.locator('#feedback')).toContainText('Correct.');
  await page.getByRole('button', { name: 'Play trace', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause trace' })).toBeVisible();
  await page.getByRole('button', { name: 'Pause trace' }).click();
  await page.locator('#timeline').focus();
  await page.keyboard.press('End');
  await expect(page.locator('#result-text')).toHaveText('Sorted: -2, -2, 0, 3, 3, 7.');
  await page.getByRole('button', { name: 'Load worked example' }).click();
  await expect(page.getByLabel('Array values', { exact: true })).toHaveValue('3, 1, 2');
  await page.getByLabel('Algorithm', { exact: true }).selectOption('bellman');
  await expect(page).toHaveURL(/lab=bellman$/);
  await page.getByLabel('Input preset').selectOption('Negative cycle');
  await page.locator('#timeline').focus();
  await page.keyboard.press('End');
  await expect(page.locator('#result-text')).toContainText('negative cycle');
  await noOverflow(page);
});

test('control changes update predictions and reset to the worked example', async ({ page }) => {
  await page.goto('/simulation.html?lab=firstorder');
  await page.getByRole('radio', { name: 'About 63%', exact: true }).check();
  await page.getByLabel('Static gain', { exact: true }).fill('2');
  await expect(page.locator('#metric-final')).toHaveText('1.9865');
  await expect(page.locator('.prediction-feedback')).toContainText('Correct.');
  await page.getByLabel('Plant time constant', { exact: true }).fill('0');
  await expect(page.locator('#status')).toHaveAttribute('data-error', 'true');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.locator('#metric-final')).toHaveText('0.9933');
  await page.getByRole('link', { name: 'Notes', exact: true }).click();
  await expect(page.locator('#model')).toHaveAttribute('open');
  await noOverflow(page);
});

test('algorithm bars, directed paths and item choices keep their visual hierarchy', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  for (const [id, image] of [
    ['bubble', 'sorting-state.png'],
    ['dijkstra', 'shortest-path.png'],
    ['knapsack', 'knapsack-items.png'],
  ]) {
    await page.goto(`/algorithms.html?lab=${id}`);
    await page.locator('#timeline').focus();
    await page.keyboard.press('End');
    await page.locator('#timeline').blur();
    await expect(page.locator('#visual')).toHaveScreenshot(image, { maxDiffPixelRatio: 0.035 });
  }
});
