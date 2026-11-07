'use strict';
const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');

async function open(page) {
  await page.goto('/O-Ne-Tools/persistent-card.html');
  await expect(page.locator('.one-persistent-sequence')).toHaveCount(1);
  await page.locator('.one-persistent-sequence > summary').click();
}
async function fill(page) {
  const panel = page.locator('.one-persistent-sequence');
  await panel.getByLabel('任務名稱').fill('情報收集');
  await panel.getByRole('button', { name: '＋ 新增條件' }).click();
  await panel.getByRole('button', { name: '＋ 新增條件' }).click();
  await panel.getByLabel('條件 1', { exact: true }).fill('觀察商品');
  await panel.getByLabel('條件 2', { exact: true }).fill('打聽情報');
  await panel.getByLabel('條件 3', { exact: true }).fill('牙膏改名');
  await panel.getByLabel('條件 2 結果').selectOption('FAIL');
  return panel;
}

test('a failed condition moves on and does not raise the count', async ({ page }) => {
  await open(page);
  const frames = await page.evaluate(() => window.ONEPersistentSequence.buildFrames('情報收集', [
    { text: '觀察商品', result: 'DONE' }, { text: '打聽情報', result: 'FAIL' }, { text: '牙膏改名', result: 'DONE' }
  ]));
  expect(frames.map(frame => [frame.state, frame.task, frame.progress])).toEqual([
    ['MISSION', '情報收集 0/3｜觀察商品', '0/1'],
    ['DONE', '情報收集 1/3｜觀察商品', '1/1'],
    ['MISSION', '情報收集 1/3｜打聽情報', '0/1'],
    ['FAIL', '情報收集 1/3｜打聽情報', '0/1'],
    ['MISSION', '情報收集 1/3｜牙膏改名', '0/1'],
    ['DONE', '情報收集 2/3｜牙膏改名', '1/1']
  ]);
});

test('every frame comes out in one ZIP and the card is left as it was', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await open(page);
  const before = await page.locator('#previewCanvas,.one-workspace-canvas').first().evaluate(c => c.toDataURL());
  const task = await page.locator('#task').inputValue();
  const panel = await fill(page);
  const output = panel.getByRole('button', { name: '輸出全部 PNG（6 張）' });
  await expect(output).toBeEnabled();
  const pending = page.waitForEvent('download');
  await output.click();
  const file = await pending;
  expect(file.suggestedFilename()).toBe('O-Ne_常駐卡_情報收集.zip');
  const target = info.outputPath('sequence.zip');
  await file.saveAs(target);
  await expect(panel.getByRole('status')).toHaveText('已輸出 6 張。');
  const bytes = Array.from(await fs.readFile(target));
  const names = await page.evaluate(async data => {
    const entries = await window.ONEProjectPackage.__test.readZip(new File([new Uint8Array(data)], 'a.zip'));
    return Object.keys(entries).map(name => [name, Array.from(entries[name].slice(1, 4))]);
  }, bytes);
  expect(names.map(entry => entry[0])).toEqual([
    '01_觀察商品_進行中.png', '01_觀察商品_達成.png', '02_打聽情報_進行中.png',
    '02_打聽情報_失敗.png', '03_牙膏改名_進行中.png', '03_牙膏改名_達成.png'
  ]);
  for (const entry of names) expect(String.fromCharCode(...entry[1])).toBe('PNG');
  await expect(page.locator('#task')).toHaveValue(task);
  await expect(page.locator('#state')).toHaveValue('MISSION');
  expect(await page.locator('.one-workspace-canvas').first().evaluate(c => c.toDataURL())).toBe(before);
  expect(errors).toEqual([]);
});

test('text that does not fit stops the export and says which frame', async ({ page }) => {
  await open(page);
  const panel = page.locator('.one-persistent-sequence');
  await panel.getByLabel('任務名稱').fill('超長任務名稱'.repeat(8));
  await panel.getByLabel('條件 1', { exact: true }).fill('這個條件的文字也非常非常長'.repeat(4));
  await panel.getByRole('button', { name: /^輸出全部 PNG/ }).click();
  await expect(panel.getByRole('status')).toContainText('第 1 張文字太長');
  await expect(page.locator('#state')).toHaveValue('MISSION');
});

test('the output stays off until there is a task and a condition', async ({ page }) => {
  await open(page);
  const output = page.locator('.one-persistent-sequence').getByRole('button', { name: /^輸出全部 PNG/ });
  await expect(output).toBeDisabled();
  await page.locator('.one-persistent-sequence').getByLabel('任務名稱').fill('情報收集');
  await expect(output).toBeDisabled();
});

test('conditions come back after a reload and are not card content', async ({ page }) => {
  await open(page);
  const panel = await fill(page);
  await expect(page.locator('.one-workspace-save-feedback')).not.toContainText('尚未暫存');
  const fields = await page.evaluate(() => JSON.stringify(window.currentSnapshot()));
  expect(fields).not.toContain('打聽情報');
  await page.reload();
  await page.locator('.one-persistent-sequence > summary').click();
  await expect(panel.getByLabel('條件 2', { exact: true })).toHaveValue('打聽情報');
  await expect(panel.getByLabel('條件 2 結果')).toHaveValue('FAIL');
});

test('other cards do not get the panel', async ({ page }) => {
  await page.goto('/O-Ne-Tools/trigger-card.html');
  await expect(page.locator('body')).toHaveAttribute('data-one-workspace-ready', '1');
  await expect(page.locator('.one-persistent-sequence')).toHaveCount(0);
});
