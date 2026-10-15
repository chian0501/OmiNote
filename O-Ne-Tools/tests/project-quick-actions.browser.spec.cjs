'use strict';
const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');

const tools = [
  ['一般卡', '/O-Ne-Tools/general-card.html'],
  ['觸發卡', '/O-Ne-Tools/trigger-card.html'],
  ['常駐卡', '/O-Ne-Tools/persistent-card.html'],
  ['效果卡', '/O-Ne-Tools/effect-card.html'],
  ['移動卡', '/O-Ne-Tools/move-card.html'],
  ['選項卡', '/O-Ne-Tools/choice-card.html'],
  ['挑戰卡', '/O-Ne-Tools/challenge-card.html'],
  ['對話卡', '/O-Ne-Tools/dialogue-card-v135.html'],
  ['評分卡', '/O-Ne-Tools/rating-card.html'],
  ['焦點內容卡', '/O-Ne-Tools/focus-card.html'],
  ['說明卡', '/O-Ne-Tools/explanation-card.html'],
  ['縮圖品牌框', '/O-Ne-Tools/thumbnail-frame.html'],
  ['片尾結算卡', '/O-Ne-Tools/settlement-card.html']
];

const outputSelector = [
  '#exportPng', '#exportSequenceAll', '#downloadSet', '#download', '#downloadPng',
  '#downloadWhite', '#downloadOrange', '#downloadBoth', '.export-button.primary'
].join(',');

for (const [name, url] of tools) {
  test(`${name} JSON／專案 ZIP 與 PNG 放在同一輸出列`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    const importJson = page.locator('[data-one-json-quick="import"]');
    const exportJson = page.locator('[data-one-json-quick="export"]');
    const downloadProject = page.locator('[data-one-project-quick="download"]');
    const uploadProject = page.locator('[data-one-project-quick="upload"]');
    await expect(importJson).toBeVisible();
    await expect(exportJson).toBeVisible();
    await expect(downloadProject).toBeVisible();
    await expect(uploadProject).toBeVisible();
    await expect(importJson).toHaveText('載入 JSON');
    await expect(exportJson).toHaveText('導出 JSON');
    await expect(downloadProject).toHaveText('導出專案 ZIP');
    await expect(uploadProject).toHaveText('載入專案 ZIP');
    const sameRow = downloadProject.locator('..');
    await expect(sameRow.locator('[data-one-json-quick="import"]')).toHaveCount(1);
    await expect(sameRow.locator('[data-one-json-quick="export"]')).toHaveCount(1);
    await expect(sameRow.locator('[data-one-project-quick="upload"]')).toHaveCount(1);
    expect(await sameRow.locator(outputSelector).count()).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
}

test('一般卡底部 JSON 直出直入，專案仍使用 project.zip', async ({ page }, info) => {
  await page.goto('/O-Ne-Tools/general-card.html');

  const jsonDownloading = page.waitForEvent('download');
  await page.locator('[data-one-json-quick="export"]').click();
  const jsonDownload = await jsonDownloading;
  expect(jsonDownload.suggestedFilename()).toMatch(/\.json$/i);
  const jsonTarget = info.outputPath('general-quick.json');
  await jsonDownload.saveAs(jsonTarget);
  expect((await fs.stat(jsonTarget)).size).toBeGreaterThan(20);

  const jsonChoosing = page.waitForEvent('filechooser');
  await page.locator('[data-one-json-quick="import"]').click();
  const jsonChooser = await jsonChoosing;
  await jsonChooser.setFiles(jsonTarget);
  await expect(page.locator('.one-edit-backup__status')).toContainText('JSON 載入成功');

  const downloading = page.waitForEvent('download');
  await page.locator('[data-one-project-quick="download"]').click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/\.zip$/i);
  const target = info.outputPath('general-quick.project.zip');
  await download.saveAs(target);
  expect((await fs.stat(target)).size).toBeGreaterThan(100);

  const choosing = page.waitForEvent('filechooser');
  await page.locator('[data-one-project-quick="upload"]').click();
  const chooser = await choosing;
  await chooser.setFiles(target);
  await expect(page.locator('.one-project-package__status')).toContainText(/載入成功|設定已還原/);
});

test('說明卡底部下載專案直接輸出完整 project.zip', async ({ page }, info) => {
  await page.goto('/O-Ne-Tools/explanation-card.html');
  await expect(page.locator('#exportPng')).toBeVisible();
  const row = page.locator('#exportPng').locator('..');
  await expect(row.locator('[data-one-project-quick="download"]')).toBeVisible();
  await expect(row.locator('[data-one-project-quick="upload"]')).toBeVisible();
  const downloading = page.waitForEvent('download');
  await row.locator('[data-one-project-quick="download"]').click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/\.zip$/i);
  const target = info.outputPath('explanation-quick.project.zip');
  await download.saveAs(target);
  expect((await fs.stat(target)).size).toBeGreaterThan(100);
});
