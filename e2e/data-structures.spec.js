import { expect, test } from '@playwright/test';
import { runAlgorithm, algorithms } from '../backend/algorithms.js';

const end = async page => { await page.locator('#timeline').focus(); await page.keyboard.press('End'); };
const noOverflow = async page => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);

test('Data Structures & Algorithms uses consistent capitalization in navigation and filters', async ({ page }) => {
  await page.goto('/#algorithms');
  await expect(page.getByRole('navigation', { name: 'Engineering disciplines' }).getByRole('link', { name: 'Data Structures & Algorithms', exact: true })).toHaveAttribute('aria-current', 'location');
  await expect(page.locator('#discipline-filter option:checked')).toHaveText('Data Structures & Algorithms');
  await expect(page.locator('#catalog-status')).toHaveText('45 experiments available');
  await page.getByRole('searchbox').fill('AVL');
  await expect(page.locator('#catalog-status')).toHaveText('1 experiment available');
  await page.getByRole('link', { name: /AVL Tree Rotations/ }).click();
  await expect(page.getByRole('navigation', { name: 'Engineering disciplines' }).getByRole('link', { name: 'Data Structures & Algorithms', exact: true })).toBeVisible();
});

test('structure operation editing validates, preserves overflow events, and resets playback', async ({ page }) => {
  await page.goto('/algorithms.html?lab=circularqueue');
  await page.getByLabel('Input preset').selectOption('Overflow');
  await end(page);
  await expect(page.locator('#result-text')).toHaveText('Remaining front → rear: [2, 4].');
  await expect(page.locator('#state-table')).toContainText('Overflow');
  await page.getByLabel('Operations', { exact: true }).fill('enqueue 1; popwrong');
  await expect(page.locator('#status')).toHaveAttribute('data-error', 'true');
  await expect(page.getByRole('button', { name: 'Play trace' })).toBeDisabled();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByLabel('Buffer capacity')).toHaveValue('4');
  await expect(page.getByRole('button', { name: 'Previous step' })).toBeDisabled();
  await page.getByRole('button', { name: 'Play trace' }).click();
  await expect(page.getByRole('button', { name: 'Pause trace' })).toBeVisible();
  await page.getByRole('button', { name: 'Pause trace' }).click();
  await noOverflow(page);
});

test('AVL playback exposes both halves of a double rotation and supports stepping backward', async ({ page }) => {
  await page.goto('/algorithms.html?lab=avl');
  await page.getByLabel('Input preset').selectOption('Left-right rotation');
  const trace = runAlgorithm('avl', { ...algorithms.avl.defaults, ...algorithms.avl.presets['Left-right rotation'] });
  const index = trace.frames.findIndex(f => /After rotation: subtree root is 20/.test(f.message));
  expect(index).toBeGreaterThan(0);
  await page.locator('#timeline').focus(); await page.keyboard.press('Home');
  for (let i = 0; i < index; i++) await page.keyboard.press('ArrowRight');
  await expect(page.locator('#step-message')).toHaveText(trace.frames[index].message);
  await page.getByRole('button', { name: 'Previous step' }).click();
  await expect(page.locator('#step-message')).toHaveText(trace.frames[index - 1].message);
  await end(page);
  await expect(page.locator('#result-text')).toContainText('in-order [10, 20, 30]; height 2');
  await noOverflow(page);
});

test('range-query controls reject indexes outside the edited array and recompute correctly', async ({ page }) => {
  await page.goto('/algorithms.html?lab=fenwick');
  await page.getByLabel('Array values', { exact: true }).fill('1');
  await expect(page.locator('#status')).toHaveAttribute('data-error', 'true');
  await page.getByLabel('Update index (zero-based)').fill('0');
  await page.getByLabel('Prefix end (inclusive)').fill('0');
  await expect(page.locator('#status')).toHaveAttribute('data-error', 'false');
  await end(page);
  await expect(page.locator('#result-text')).toContainText('Prefix sum through index 0 = 4');
  await page.getByRole('button', { name: 'Load worked example' }).click();
  await end(page);
  await expect(page.locator('#result-text')).toContainText('Prefix sum through index 4 = 18');
});

test('string and matrix labs update from editable inputs and expose readable state', async ({ page }) => {
  await page.goto('/algorithms.html?lab=kmp');
  await page.getByLabel('Text', { exact: true }).fill('AAAAA');
  await page.getByLabel('Pattern', { exact: true }).fill('AAA');
  await expect(page.locator('#status')).toHaveAttribute('data-error', 'false');
  await expect(page.locator('#state-table tbody tr')).toHaveCount(3);
  await end(page);
  await expect(page.locator('#result-text')).toHaveText('Match offsets: [0, 1, 2].');
  await page.getByLabel('Algorithm', { exact: true }).selectOption('editdistance');
  await page.getByLabel('Source string').fill('abc');
  await page.getByLabel('Target string').fill('abc');
  await expect(page.locator('#state-table tbody tr')).toHaveCount(4);
  await end(page);
  await expect(page.locator('#result-text')).toContainText('Edit distance 0');
  await noOverflow(page);
});

test('trees, hash chains and prefix tables retain readable diagrams', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  for (const [id, image] of [['avl', 'avl-tree.png'], ['hashchain', 'collision-chains.png'], ['lcs', 'prefix-table.png']]) {
    await page.goto(`/algorithms.html?lab=${id}`); await end(page); await page.locator('#timeline').blur();
    await expect(page.locator('#visual')).toHaveScreenshot(image, { maxDiffPixelRatio: 0.035 });
  }
});
