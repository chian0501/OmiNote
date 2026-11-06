'use strict';
const { test, expect } = require('@playwright/test');
const registry = require('../one-tools-registry-v1.json');

const page_ = '/O-Ne-Tools/index-next.html';
const ready = registry.tools.filter(tool => tool.status === 'ready');

test('every situation opens a real card, and all 13 cards show their sample', async ({ page }) => {
  const failed = [];
  page.on('response', response => { if (response.status() >= 400) failed.push(response.url()); });
  await page.goto(page_);
  await expect(page.locator('html')).toHaveAttribute('data-registry-version', registry.version);
  const items = registry.card_guide.situations.flatMap(group => group.items);
  await expect(page.locator('.row')).toHaveCount(items.length);
  await expect(page.locator('.card')).toHaveCount(ready.length);
  await page.locator('#all').scrollIntoViewIfNeeded();
  for (const image of await page.locator('.card img').all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
  }
  expect(failed).toEqual([]);
});

for (const [label, mode] of [['花多少錢', 'COST'], ['現在在哪', 'HERE'], ['拿到東西', 'GET']]) {
  test(`situation "${label}" opens the general card in ${mode}`, async ({ page }) => {
    await page.goto(page_);
    await page.locator('.row', { hasText: label }).click();
    await expect(page).toHaveURL(/general-card\.html/);
    await expect(page.locator('#mode')).toHaveValue(mode);
  });
}

test('a saved draft survives opening a card through a mode link', async ({ page }) => {
  await page.goto('/O-Ne-Tools/general-card.html');
  await page.locator('#title').fill('保留這段文字');
  await page.keyboard.press('Control+S');
  await expect(page.locator('body')).toBeVisible();
  await page.goto('/O-Ne-Tools/general-card.html?mode=COST');
  await expect(page.locator('#mode')).toHaveValue('COST');
  await page.locator('#mode').selectOption('HERE');
  await expect(page.locator('#title')).toHaveValue('保留這段文字');
});

test('an unknown mode in the address is ignored', async ({ page }) => {
  await page.goto('/O-Ne-Tools/general-card.html?mode=PRICE');
  await page.waitForLoadState('load');
  await expect(page.locator('#mode')).toHaveValue('HERE');
});

test('words people use lead to the right card', async ({ page }) => {
  await page.goto(page_);
  await expect(page.locator('.row').first()).toBeVisible();
  const search = page.locator('#search');
  for (const [word, name] of [['COST', '一般卡 COST'], ['花費', '一般卡 COST'], ['地點', '一般卡 HERE'], ['交通', '移動卡'], ['食物', '評分卡'], ['開箱', '評分卡'], ['總結', '片尾結算'], ['歷史', '說明卡'], ['傳說', '說明卡'], ['提問', '焦點內容卡'], ['吵架', '對話卡'], ['比較', '焦點內容卡']]) {
    await search.fill(word);
    await expect(page.locator('.result strong', { hasText: name }).first(), word).toBeVisible();
  }
  await search.fill('價格');
  await expect(page.locator('.result')).toHaveCount(2);
  await expect(page.locator('#rule')).toContainText('單獨講價錢用一般卡 COST');
  await search.fill('沒有這種卡');
  await expect(page.locator('.empty')).toContainText('沒有對應的字卡');
});

test('a phone sees the situations on the first screen without sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(page_);
  const first = page.locator('.group').first();
  await expect(first).toBeVisible();
  const box = await first.boundingBox();
  expect(box.y).toBeLessThan(844);
  await expect(page.locator('.row').first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('the current homepage is untouched', async ({ page }) => {
  await page.goto('/O-Ne-Tools/index.html');
  await expect(page.locator('h1')).toContainText('今天要做哪張');
});
