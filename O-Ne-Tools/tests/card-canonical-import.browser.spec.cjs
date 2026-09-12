'use strict';
const { test, expect } = require('@playwright/test');

const tools = [
  ['general-card','general-card.html'],
  ['trigger-card','trigger-card.html'],
  ['persistent-card','persistent-card.html'],
  ['effect-card','effect-card.html'],
  ['move-card','move-card.html'],
  ['choice-card','choice-card.html'],
  ['challenge-card','challenge-card.html'],
  ['dialogue-card','dialogue-card-v135.html'],
  ['rating-card','rating-card.html'],
  ['focus-card','focus-card.html'],
  ['explanation-card','explanation-card.html'],
  ['thumbnail-frame','thumbnail-frame.html'],
  ['settlement-card','settlement-card.html']
];

for (const [toolId, file] of tools) {
  test(toolId + ' accepts Canonical JSON through the real JSON import control', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.goto('/O-Ne-Tools/' + file);
    await expect.poll(() => page.evaluate(() => Boolean(window.ONEAIJsonGuide && window.ONE_CARD_CANONICAL))).toBe(true);

    const payload = await page.evaluate(id => window.ONEAIJsonGuide.example(id), toolId);
    expect(payload.schema).toBe('o-ne.card.canonical.v1');
    expect(payload.tool_id).toBe(toolId);

    await page.evaluate(() => {
      window.__canonicalImportCount = 0;
      const original = window.ONE_CARD_CANONICAL.toNative;
      window.ONE_CARD_CANONICAL.toNative = function (value) {
        window.__canonicalImportCount += 1;
        return original(value);
      };
    });

    let load;
    if (toolId === 'explanation-card') {
      load = page.locator('#quickSaveHost .one-edit-backup [data-action="load"]').first();
      await expect(load, 'explanation-card JSON load control').toBeVisible();
    } else {
      await page.locator('.one-workspace-header-actions').getByRole('button', { name: '專案檔案', exact: true }).click();
      await expect(page.locator('#one-workspace-files')).toBeVisible();
      load = page.locator('.one-workspace-native-files [data-action="load"],.one-workspace-native-files #loadJson').first();
      await expect(load, toolId + ' JSON load control').toBeVisible();
    }

    const chooser = page.waitForEvent('filechooser');
    await load.click();
    await (await chooser).setFiles({
      name: toolId + '-canonical.card.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(payload), 'utf8')
    });

    await expect.poll(() => page.evaluate(() => window.__canonicalImportCount)).toBeGreaterThan(0);
    const failure = page.locator('text=/載入失敗|Canonical JSON 驗證失敗|其他工具/');
    await expect(failure).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
