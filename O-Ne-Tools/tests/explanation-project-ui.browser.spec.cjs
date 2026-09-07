'use strict';
const { test, expect } = require('@playwright/test');

test('explanation project dialog keeps project.zip primary and .onecard legacy after late UI reordering', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.goto('/O-Ne-Tools/explanation-card.html?v=0491&build=per-step-project-package-ready-v1&ui=131');
  await expect(page.locator('body')).toHaveClass(/one-workspace-v2/);
  await page.getByRole('button', { name: '專案檔案', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: '專案檔案與本機暫存' });
  const pkg = dialog.locator('[data-one-project-package-ui]');
  const legacy = pkg.locator('[data-one-explanation-file-group="legacy"]');
  const advanced = pkg.locator('[data-one-explanation-file-group="advanced"]');
  const aiGuide = dialog.locator('[data-one-ai-json-guide="explanation-card"]');

  await expect(dialog).toBeVisible();
  await expect(pkg.locator('.one-project-package__title')).toHaveText('完整 project.zip｜推薦');
  await expect(pkg.locator('.one-project-package__note')).toContainText('1 組只需保存 1 個 project.zip');
  await expect(pkg.locator('[data-action="export-package"]')).toHaveText('下載完整 project.zip');
  await expect(pkg.locator('[data-action="import-package"]')).toHaveText('載入完整 project.zip');

  await expect(legacy.locator('.one-explanation-file-group__title')).toHaveText('舊版相容');
  await expect(legacy.locator('.one-explanation-file-group__note')).toContainText('新專案請改用上方 project.zip');
  await expect(legacy.locator('#exportProject')).toHaveText('下載舊版 .onecard（相容）');
  await expect(legacy.locator('#importProjectBtn')).toHaveText('載入舊版 .onecard');

  await expect(advanced.locator('.one-explanation-file-group__title')).toHaveText('進階／備份');
  await expect(advanced.locator('#exportJson')).toHaveText('僅設定 JSON');
  await expect(advanced.locator('#resetAll')).toHaveText('重設目前內容');

  await expect(aiGuide.locator('.one-ai-json-guide__file')).toContainText('完整專案 ZIP（推薦；舊 .onecard 僅相容）');
  await expect(aiGuide.locator('.one-ai-json-guide__rules')).toContainText('1 組內容 = 1 個 project.zip');
  await expect(aiGuide.locator('.one-ai-json-guide__rules')).toContainText('新專案不要以 .onecard 作主要交付');
  await expect(aiGuide.locator('.one-ai-json-guide__rules')).not.toContainText('完整專案 ZIP 與 .onecard 都會內嵌');

  // The portable core schedules a late organizeFiles() pass at about 300 ms.
  // Recheck after it, covering the exact regression reported from the live page.
  await page.waitForTimeout(700);
  await expect(pkg.locator('.one-project-package__title')).toHaveText('完整 project.zip｜推薦');
  await expect(pkg.locator('[data-action="export-package"]')).toHaveText('下載完整 project.zip');
  await expect(pkg.locator('[data-action="import-package"]')).toHaveText('載入完整 project.zip');
  await expect(legacy.locator('#exportProject')).toHaveText('下載舊版 .onecard（相容）');
  await expect(legacy.locator('#importProjectBtn')).toHaveText('載入舊版 .onecard');

  await dialog.screenshot({ path: testInfo.outputPath('explanation-project-ui.png') });
  expect(errors).toEqual([]);
});
