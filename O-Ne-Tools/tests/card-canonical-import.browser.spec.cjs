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

    await page.getByRole('button', { name: toolId === 'explanation-card' ? '專案檔案' : '檔案', exact: true }).click();

    let load;
    if (toolId === 'explanation-card') {
      const dialog = page.getByRole('dialog', { name: '專案檔案與本機暫存' });
      await expect(dialog).toBeVisible();
      load = dialog.locator('[data-one-backup-ui] [data-action="load"]').first();
    } else {
      const files = page.locator('#one-workspace-files');
      await expect(files).toBeVisible();
      load = files.locator('.one-workspace-native-files [data-action="load"],.one-workspace-native-files #loadJson').first();
    }
    await expect(load, toolId + ' JSON load control').toBeVisible();

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

test('general-card COST loads when an AI changes only card.mode from the guide example', async ({ page }) => {
  await page.goto('/O-Ne-Tools/general-card.html');
  await expect.poll(() => page.evaluate(() => Boolean(window.ONEAIJsonGuide && window.ONE_CARD_CANONICAL))).toBe(true);
  const payload = await page.evaluate(() => window.ONEAIJsonGuide.example('general-card'));
  expect(payload.card.component_id).toBe('HERE-01');
  payload.card.mode = 'COST';
  payload.card.variant = 'COST';
  payload.content.title = '門票';
  payload.content.subtitle = 'NT$ 100';
  await page.getByRole('button', { name: '檔案', exact: true }).click();
  const load = page.locator('#one-workspace-files .one-workspace-native-files [data-action="load"],#one-workspace-files .one-workspace-native-files #loadJson').first();
  const chooser = page.waitForEvent('filechooser');
  await load.click();
  await (await chooser).setFiles({ name: 'general-cost.card.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(payload), 'utf8') });
  await expect(page.locator('#mode')).toHaveValue('COST');
  await expect(page.locator('#title')).toHaveValue('門票');
});

test('AI assistant applies the general-card mode and refuses an unknown one', async ({ page }) => {
  await page.goto('/O-Ne-Tools/ai-card.html?tool=general');
  const editor = page.frameLocator('#toolFrame');
  await expect(editor.locator('#mode')).toHaveValue('HERE');
  await page.locator('#jsonInput').fill(JSON.stringify({ tool: 'general-card', mode: 'COST', title: '門票', subtitle: 'NT$ 100' }));
  await page.locator('#applyJson').click();
  await expect(page.locator('#applyStatus')).toContainText('已套用');
  await expect(editor.locator('#mode')).toHaveValue('COST');
  await expect(editor.locator('#title')).toHaveValue('門票');
  await page.locator('#jsonInput').fill(JSON.stringify({ tool: 'general-card', mode: 'PRICE', title: '錯誤' }));
  await page.locator('#applyJson').click();
  await expect(page.locator('#applyStatus')).toContainText('無法套用');
  await expect(editor.locator('#mode')).toHaveValue('COST');
  await expect(editor.locator('#title')).toHaveValue('門票');
});
