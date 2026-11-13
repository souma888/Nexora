import { expect, test } from '@playwright/test';
import { studioSections } from '../frontend/public/studio-sections.js';
import { models } from '../backend/waves.js';
const format = (value) =>
  value === null || value === undefined
    ? '—'
    : new Intl.NumberFormat('en', { maximumSignificantDigits: 5 }).format(value);
const noOverflow = async (page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize().width,
  );
for (const [group, c] of Object.entries(studioSections))
  test(`studio section: ${group} has its own working preview and featured entry points`, async ({
    page,
  }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`/#${group}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#studio')).toBeVisible();
    await expect(page.locator('#studio h1')).toHaveCount(1);
    await expect(page.locator('.section-preview')).toBeVisible();
    await expect(page.locator('.studio-paths a')).toHaveCount(3);
    await expect(page.locator(`a[data-discipline="${group}"]`)).toHaveAttribute(
      'aria-current',
      'location',
    );
    if (c.model) {
      const d = models[c.model].definition,
        input = Object.fromEntries(Object.entries(d.inputs).map(([key, f]) => [key, f.initial]));
      const response = await page.request.post('/api/waves', { data: { model: c.model, input } });
      expect(response.status()).toBe(200);
      const result = await response.json();
      const values = Object.keys(d.metrics)
        .slice(0, 3)
        .map(
          (key) =>
            format(result.summary[key]) +
            (d.outputs.summary[key] ? ' ' + d.outputs.summary[key] : ''),
        );
      await expect(page.locator('.section-preview dd')).toHaveText(values);
      const param = c.parameters.find((key) => d.inputs[key].type !== 'enum'),
        slider = page.getByRole('slider', { name: d.inputs[param].label, exact: true });
      await slider.focus();
      await page.keyboard.press('End');
      await expect(slider).toHaveAttribute(
        'aria-valuetext',
        new RegExp(format(d.inputs[param].max).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      );
      await page.locator('.section-preview').getByRole('button', { name: 'Reset preview' }).click();
      await expect(page.locator('.section-preview dd')).toHaveText(values);
      await page.locator('.section-preview .studio-text-link').click();
      await expect(page.locator('#status')).toHaveText('Live results');
      await expect(page.locator('body')).toHaveAttribute('data-workbench', group);
    } else {
      await page
        .locator('.section-preview')
        .getByRole('button', { name: 'Next step', exact: true })
        .click();
      await page.getByRole('slider', { name: 'Preview trace position' }).focus();
      await page.keyboard.press('End');
      await expect(page.locator('.section-preview')).toContainText('Sorted:');
      await page
        .getByRole('combobox', { name: 'Preview input order' })
        .selectOption({ label: 'Reverse order' });
      await page.locator('.section-preview .studio-text-link').click();
      await expect(page.locator('#algorithm-lab')).toBeVisible();
      await expect(page.getByLabel('Array values', { exact: true })).toHaveValue('9,7,6,4,2,1');
    }
    await noOverflow(page);
    expect(errors).toEqual([]);
  });
test('all shared lab templates use the instrument styling in both themes', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  for (const [path, name] of [
    ['/#electronics', 'electronics-studio'],
    ['/beam.html', 'beam-instrument'],
    ['/axial.html', 'axial-instrument'],
    ['/mohr.html', 'mohr-instrument'],
    ['/simulation.html?lab=gates', 'digital-instrument'],
    ['/algorithms.html?lab=quick', 'algorithm-instrument'],
  ]) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready);
    await noOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`${name}.png`) });
  }
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await noOverflow(page);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.discipline-rail')).toBeHidden();
  await expect(page.locator('#visual')).toBeVisible();
});
