import { disciplineCounts } from '../backend/catalog.js';
import { disciplineDefinitions } from '../backend/disciplines.js';
import { expect, test } from '@playwright/test';
const noOverflow = async (page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize().width,
  );
test('studio live preview matches the API and carries parameters into the full control lab', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Ideas into');
  const slider = page.getByRole('slider', { name: 'Damping ratio', exact: true });
  await slider.focus();
  await page.keyboard.press('End');
  await expect(page.locator('#damping-value')).toHaveText('2.00');
  await expect(page.locator('#featured-regime')).toContainText('Overdamped');
  await expect(page.locator('#featured-overshoot')).toHaveText('0.0%');
  const result = await page.request.post('/api/waves', {
    data: { model: 'secondorder', input: { damping: 2, frequency: 2 } },
  });
  expect(result.status()).toBe(200);
  await expect(page.locator('#featured-peak')).toHaveText(
    (await result.json()).summary.peak.toFixed(3),
  );
  await page.getByRole('link', { name: 'Open the full workbench' }).click();
  await expect(page.getByLabel('Damping ratio', { exact: true })).toHaveValue('2');
  await expect(page.getByRole('slider', { name: 'Adjust Damping ratio' })).toHaveAttribute(
    'aria-valuetext',
    '2',
  );
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByLabel('Damping ratio', { exact: true })).toHaveValue('0.3');
  await expect(page.getByRole('slider', { name: 'Adjust Damping ratio' })).toHaveAttribute(
    'aria-valuetext',
    '0.3',
  );
  await page.getByRole('slider', { name: 'Adjust Damping ratio' }).focus();
  await page.keyboard.press('End');
  await expect(page.getByLabel('Damping ratio', { exact: true })).toHaveValue('2');
  await noOverflow(page);
  expect(errors).toEqual([]);
});
test('Control Systems has its own studio, meaningful previews, and catalog navigation', async ({
  page,
}) => {
  await page.goto('/#control');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Find your');
  await expect(page.locator('#catalog-status')).toHaveText(
    `${disciplineCounts.control} experiments available`,
  );
  await expect(page.locator('.studio-paths a')).toHaveCount(3);
  await expect(page.locator('.sim-link:not([hidden]) .subject-art')).toHaveCount(15);
  await page.getByRole('button', { name: 'Reset preview' }).click();
  await expect(page.locator('#damping-value')).toHaveText('0.30');
  await page.getByRole('searchbox').fill('motor');
  await expect(page.locator('#studio')).toBeHidden();
  await expect(page.locator('#catalog-status')).toHaveText('1 experiment available');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.locator('#studio')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Ideas into');
  await expect(
    page.getByRole('navigation', { name: 'Engineering disciplines' }).locator('.nav-icon'),
  ).toHaveCount(disciplineDefinitions.length + 1);
  await noOverflow(page);
});
test('studio desktop/mobile themes and control instrument view stay readable', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  for (const [path, name] of [
    ['/', 'studio-home'],
    ['/#control', 'studio-controls'],
    ['/simulation.html?lab=secondorder', 'control-instrument'],
  ]) {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    await noOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: false });
  }
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await noOverflow(page);
  await expect(page.locator('#status')).toHaveText('Live results');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.discipline-rail')).toBeHidden();
  await expect(page.locator('#wave-plot')).toBeVisible();
});
