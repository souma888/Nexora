import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function expectNoHorizontalOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize().width,
  );
}

test('catalog filters, searches, and opens the beam lab with the keyboard', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  await page.getByLabel('Discipline', { exact: true }).selectOption('mechanical');
  await page.getByRole('searchbox').fill('mohr');
  await expect(page.getByRole('status')).toHaveText('1 experiment available');
  await expect(page.getByRole('link', { name: /Mohr’s Circle/ })).toBeVisible();
  await page.getByRole('searchbox').fill('xyz');
  await expect(page.getByRole('status')).toContainText('No matching experiments');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  const beam = page.getByRole('link', { name: /Beam Analysis/ });
  await beam.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/beam\.html$/);
  await expectNoHorizontalOverflow(page);
});

test('beam responds live, preserves units, probes the charts, and exports', async ({ page }) => {
  await page.route('**/api/**', route => route.abort());
  await page.goto('/beam.html');
  await expect(page.locator('#peak-moment')).toHaveText('36 kN·m');
  await page.getByText('8×', { exact: true }).click();
  await page.locator('#span').fill('12');
  await expect(page.locator('#peak-deflection')).toHaveText('-54 mm');
  await expect(page.locator('.prediction-feedback')).toContainText('Correct.');
  await page.getByLabel('Length units').selectOption('ft');
  await page.getByLabel('Load units').selectOption('us');
  expect(Number(await page.locator('#span').inputValue())).toBeCloseTo(39.3701);
  await expect(page.locator('#peak-deflection')).toHaveText('-54 mm');
  await expect(page.locator('#plot .beam-curve')).toHaveCount(4);
  await expect(page.locator('#plot .track-peak').last()).toContainText('13.5 mrad');
  await page.locator('#probe').focus();
  await page.keyboard.press('End');
  await expect(page.locator('#probe-values')).toContainText('x = 12 m');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export CSV/ }).click();
  const download = await downloadPromise;
  expect(await readFile(await download.path(), 'utf8')).toMatch(/^position_m,.*slope_mrad\n/);
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.locator('#peak-deflection')).toHaveText('-6.75 mm');
  await expectNoHorizontalOverflow(page);
});

test('axial preset and Mohr rotation use the solver results', async ({ page }) => {
  await page.goto('/axial.html');
  await expect(page.locator('#displacement')).toHaveText('1 mm');
  await page.getByLabel('Material preset').selectOption('69');
  await expect(page.locator('#modulus')).toHaveValue('69');
  await expect(page.locator('#displacement')).toHaveText('2.8986 mm');
  await page.getByLabel('Force units').selectOption('lbf');
  expect(Number(await page.locator('#force').inputValue())).toBeCloseTo(11240.4472);
  await expect(page.locator('#displacement')).toHaveText('2.8986 mm');
  await expectNoHorizontalOverflow(page);
  await page.goto('/mohr.html');
  await expect(page.locator('#principalMax')).toHaveText('100 MPa');
  const angle = page.getByLabel('Rotate element');
  await angle.focus();
  await page.keyboard.press('ArrowRight');
  await expect(angle).not.toHaveValue('0');
  await page.getByRole('button', { name: 'Show principal orientation' }).click();
  await expect(page.locator('#rotated-stress')).toContainText('τx′y′ 0 MPa');
  const handle = page.locator('[data-mohr-handle]');
  await handle.scrollIntoViewIfNeeded();
  const dot = await handle.boundingBox();
  await page.mouse.move(dot.x + dot.width / 2, dot.y + dot.height / 2);
  await page.mouse.down();
  await page.mouse.move(dot.x - 24, dot.y - 23, { steps: 4 });
  await page.mouse.up();
  await expect(page.locator('#rotated-stress')).not.toContainText('τx′y′ 0 MPa');
  await expectNoHorizontalOverflow(page);
});

test('electrical, electronics, and signals labs open from the catalog and run', async ({ page }) => {
  const labs = [
    ['electrical', 'Loaded Voltage Divider', 'loaded', '4 V'],
    ['electrical', 'RC Charging', 'tau', '1,000 ms'],
    ['electronics', 'Diode Half-Wave Rectifier', 'peak', '4.3 V'],
    ['electronics', 'Inverting Op-Amp', 'output', '-5 V'],
    ['signals', 'Sampling & Aliasing', 'alias', '4 Hz'],
    ['signals', 'Moving Average Filter', 'delay', '1.5 samples'],
  ];
  for (const [discipline, name, metric, expected] of labs) {
    await page.goto('/');
    await page.getByLabel('Discipline', { exact: true }).selectOption(discipline);
    await expect(page.getByRole('status')).toHaveText('2 experiments available');
    await page.getByRole('link', { name: new RegExp(name) }).click();
    await expect(page.locator(`#metric-${metric}`)).toHaveText(expected);
    await expect(page.locator('#wave-plot')).toBeVisible();
    await expect(page.locator('#wave-plot polyline').last()).toHaveAttribute('points', /\d,\d/);
    await expectNoHorizontalOverflow(page);
    if (metric === 'alias') {
      await page.getByLabel('Sample rate', { exact: true }).fill('20');
      await expect(page.locator('#metric-alias')).toHaveText('8 Hz');
      await page.getByRole('button', { name: 'Reset' }).click();
      await expect(page.locator('#metric-alias')).toHaveText('4 Hz');
    }
  }
});

test('catalog thumbnail, persistent theme, and print layout', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveText('9 experiments available');
  await expect(page.getByRole('link', { name: /Axial Stress/ })).toHaveCount(1);
  const thumbnail = page.getByRole('link', { name: /Beam Analysis/ }).locator('.thumb');
  await expect(thumbnail).toHaveScreenshot('beam-thumbnail.png', { maxDiffPixelRatio: 0.035 });
  await page.goto('/beam.html');
  await expect(page.locator('#plot .beam-curve')).toHaveCount(4);
  await expect(page.locator('.beam-charts')).toHaveScreenshot('beam-charts.png', { maxDiffPixelRatio: 0.055 });
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await page.goto('/beam.html');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('navigation', { name: 'Lab sections' })).toBeHidden();
  await expect(page.locator('#plot')).toBeVisible();
});
