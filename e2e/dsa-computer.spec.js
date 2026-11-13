import { expect, test } from '@playwright/test';
const noOverflow = async (page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize().width,
  );
const finish = async (page) => {
  await expect(page.locator('#status')).toContainText('Trace ready');
  await expect(page.locator('#timeline')).toBeEnabled();
  await page.locator('#timeline').focus();
  await page.keyboard.press('End');
};

test('new DSA input bounds, presets, predictions and a backtracking board work together', async ({
  page,
}) => {
  await page.goto('/algorithms.html?lab=slidingwindow');
  await page.getByLabel('Window length', { exact: true }).fill('7');
  await expect(page.locator('#status')).toHaveAttribute('data-error', 'true');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByLabel('Input preset').selectOption('All negative');
  await finish(page);
  await expect(page.locator('#result-text')).toContainText('sum -8');
  await page.goto('/algorithms.html?lab=nqueens');
  await page
    .getByRole('radio', { name: 'Remove the previous queen and try its next column', exact: true })
    .check();
  await page.getByRole('button', { name: 'Next step', exact: true }).click();
  await expect(page.locator('#feedback')).toContainText('Correct.');
  await finish(page);
  await expect(page.locator('#visual text').filter({ hasText: /^Q$/ })).toHaveCount(4);
  await expect(page.locator('#result-text')).toContainText('[1, 3, 0, 2]');
  await page.getByLabel('Board size N', { exact: true }).fill('6');
  await finish(page);
  await expect(page.locator('#visual text').filter({ hasText: /^Q$/ })).toHaveCount(6);
  await noOverflow(page);
});
test('Huffman labels binary edges and subset sum retains the empty-subset boundary', async ({
  page,
}) => {
  await page.goto('/algorithms.html?lab=huffman');
  await finish(page);
  await expect(page.locator('#result-text')).toContainText('224 bits');
  await expect(page.locator('#visual')).toContainText('A:5');
  await page.getByLabel('Symbol frequencies (A, B, …)', { exact: true }).fill('7');
  await finish(page);
  await expect(page.locator('#state-table')).toContainText('7');
  await expect(page.locator('#result-text')).toContainText('7 bits');
  await page.goto('/algorithms.html?lab=subsetsum');
  await page.getByLabel('Input preset').selectOption('Empty subset');
  await finish(page);
  await expect(page.locator('#result-text')).toContainText('indexes [], values []');
  await page.goto('/algorithms.html?lab=matrixchain');
  await page.getByLabel('Compatible matrix dimensions', { exact: true }).fill('2,3');
  await finish(page);
  await expect(page.locator('#result-text')).toHaveText('Minimum cost 0; order A1.');
  await noOverflow(page);
});
test('computer arithmetic microsteps, validation, overflow warnings and reset stay synchronized', async ({
  page,
}) => {
  await page.goto('/simulation.html?lab=booth');
  await expect(page.locator('#model-visual')).toContainText('Initial registers');
  await expect(page.locator('#metric-product')).toHaveText('-15');
  await page.getByRole('button', { name: 'Next microstep', exact: true }).click();
  await expect(page.locator('#wave-probe')).toHaveValue('1');
  await expect(page.locator('#model-visual')).toContainText('subtract M');
  await expect(page.locator('#model-table tr.selected')).toContainText('subtract M');
  await page.getByLabel('Experiment preset').selectOption('Minimum operands');
  await expect(page.locator('#metric-product')).toHaveText('64');
  await page.getByLabel('Signed multiplier Q', { exact: true }).fill('8');
  await expect(page.locator('#status')).toHaveAttribute('data-error', 'true');
  await expect(page.getByRole('button', { name: 'Play preview' })).toBeDisabled();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.locator('#metric-product')).toHaveText('-15');
  await page.goto('/simulation.html?lab=twos');
  await page.getByLabel('Experiment preset').selectOption('Minimum-value overflow');
  await expect(page.locator('#model-warnings')).toContainText('does not fit');
  await expect(page.locator('#metric-overflow')).toHaveText('1 bit');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.locator('#model-warnings')).toBeHidden();
  await noOverflow(page);
});
test('CPU, page and predictor policies can be compared without losing navigation or state', async ({
  page,
}) => {
  await page.goto('/simulation.html?lab=roundrobin');
  await expect(page.locator('#metric-makespan')).toHaveText('9 time units');
  await page.getByLabel('Experiment preset').selectOption('Switching overhead');
  await expect(page.locator('#metric-makespan')).toHaveText('14 time units');
  await page.locator('#wave-probe').focus();
  await page.keyboard.press('End');
  await expect(page.locator('#model-visual')).toContainText('CS');
  await expect(page.locator('a[data-discipline="digital"]')).toHaveAttribute(
    'aria-current',
    'location',
  );
  await page.goto('/simulation.html?lab=paging');
  await expect(page.locator('#metric-faults')).toHaveText('7');
  await page.getByLabel('Replacement policy', { exact: true }).selectOption('LRU');
  await expect(page.locator('#metric-faults')).toHaveText('6');
  await page.goto('/simulation.html?lab=branch');
  await expect(page.locator('#metric-misses')).toHaveText('3');
  await page.getByLabel('Experiment preset').selectOption('One-bit comparison');
  await expect(page.locator('#metric-misses')).toHaveText('3');
  await page.getByLabel('Initial predictor state', { exact: true }).fill('2');
  await expect(page.locator('#status')).toHaveAttribute('data-error', 'true');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.goto('/simulation.html?lab=crc');
  await expect(page.locator('#metric-detected')).toHaveText('0 bit');
  await page.getByLabel('Experiment preset').selectOption('Single-bit corruption');
  await expect(page.locator('#metric-detected')).toHaveText('1 bit');
  await noOverflow(page);
});
test('new computing diagrams retain readable bit words, code trees and backtracking boards', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  for (const [id, image] of [
    ['booth', 'booth-word.png'],
    ['paging', 'page-frames.png'],
  ]) {
    await page.goto(`/simulation.html?lab=${id}`);
    await page.locator('#wave-probe').focus();
    await page.keyboard.press('End');
    await page.locator('#wave-probe').blur();
    await expect(page.locator('#model-visual')).toHaveScreenshot(image, {
      maxDiffPixelRatio: 0.035,
    });
  }
  for (const [id, image] of [
    ['huffman', 'huffman-tree.png'],
    ['nqueens', 'queens-board.png'],
  ]) {
    await page.goto(`/algorithms.html?lab=${id}`);
    await finish(page);
    await page.locator('#timeline').blur();
    await expect(page.locator('#visual')).toHaveScreenshot(image, { maxDiffPixelRatio: 0.035 });
  }
});
