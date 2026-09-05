'use strict';
// Real Chromium tests. Screenshots still require human/agent visual inspection;
// an all-green workflow alone is not an approval to merge or deploy.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const registry = require('../one-tools-registry-v1.json');
const cards = registry.tools.filter(tool => tool.href && tool.id !== 'explanation');
const PNG = Buffer.from('89504e470d0a1a0a', 'hex');
const mainCanvas = '.preview-wrap canvas,.stage canvas,.preview-canvas';

function cardURL(card, baseline = false) {
  const file = card.id === 'dialogue' ? 'dialogue-card-v135.html' : card.href.replace(/^\.\//, '').split('?')[0];
  return (baseline ? '/baseline' : '') + '/O-Ne-Tools/' + file;
}
async function openCard(page, card, baseline = false) {
  await page.goto(cardURL(card, baseline));
  await expect(page.locator(mainCanvas).first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  if (!baseline) {
    await expect(page.locator('body')).toHaveAttribute('data-one-workspace-ready', '1');
    await expect(page.locator('.one-workspace-save-host button')).toBeVisible();
    await expect(page.locator('[data-one-batch-render-ui]')).toHaveCount(1);
  }
  // Wait for font/image-triggered renderers without changing the native canvas.
  let previous;
  await expect.poll(async () => {
    const current = await artwork(page);
    const stable = current === previous;
    previous = current;
    return stable;
  }, { intervals: [300, 400, 600] }).toBe(true);
}
async function artwork(page) {
  const url = await page.locator(mainCanvas).first().evaluate(c => c.toDataURL('image/png'));
  return crypto.createHash('sha256').update(url).digest('hex');
}
async function screenshot(page, info, name) {
  const target = info.outputPath(name + '.png');
  await page.screenshot({ path: target, fullPage: true, animations: 'disabled' });
  await info.attach(name, { path: target, contentType: 'image/png' });
}
async function files(page, tab = 'project') {
  await page.locator('.one-workspace-header-actions').getByRole('button', { name: '專案檔案', exact: true }).click();
  if (tab !== 'project') await page.locator('#one-workspace-tab-' + tab).click();
  await expect(page.locator('#one-workspace-files')).toBeVisible();
}
async function closeFiles(page) {
  await page.locator('.one-workspace-dialog-head').getByRole('button', { name: '關閉' }).click();
}
async function expandEditor(page) {
  const folds = page.locator('.one-workspace-editor details');
  for (let i = 0; i < await folds.count(); i++) {
    if (await folds.nth(i).getAttribute('open') === null) await folds.nth(i).locator(':scope > summary').click();
  }
}
async function download(page, button, info, name, extension) {
  const pending = page.waitForEvent('download');
  await button.click();
  const result = await pending;
  expect(result.suggestedFilename().toLowerCase()).toMatch(new RegExp('\\.' + extension + '$'));
  expect(await result.failure()).toBeNull();
  const target = info.outputPath(name + '.' + extension);
  await result.saveAs(target);
  const bytes = await fs.readFile(target);
  expect(bytes.length).toBeGreaterThan(30);
  return { target, bytes };
}
async function upload(page, button, target) {
  const pending = page.waitForEvent('filechooser');
  await button.click();
  await (await pending).setFiles(target);
}
function zipEntries(bytes) {
  const entries = {};
  let offset = 0;
  while (offset + 30 <= bytes.length && bytes.readUInt32LE(offset) === 0x04034b50) {
    expect(bytes.readUInt16LE(offset + 8), 'native ZIP stores uncompressed entries').toBe(0);
    const size = bytes.readUInt32LE(offset + 18);
    const start = offset + 30;
    const nameEnd = start + bytes.readUInt16LE(offset + 26);
    const dataStart = nameEnd + bytes.readUInt16LE(offset + 28);
    const dataEnd = dataStart + size;
    expect(dataEnd).toBeLessThanOrEqual(bytes.length);
    entries[bytes.subarray(start, nameEnd).toString('utf8')] = bytes.subarray(dataStart, dataEnd);
    offset = dataEnd;
  }
  expect(Object.keys(entries).length).toBeGreaterThan(0);
  return entries;
}
function assertPNG(bytes) {
  expect(bytes.subarray(0, 8)).toEqual(PNG);
  expect(bytes.readUInt32BE(16)).toBeGreaterThan(0);
  expect(bytes.readUInt32BE(20)).toBeGreaterThan(0);
}
async function changeContent(page, card) {
  if (card.id === 'focus') {
    await page.locator('.mode-tabs button').nth(1).click();
    const rows = page.locator('.item-row');
    const before = await rows.count();
    await page.locator('.add-item').click();
    await expect(rows).toHaveCount(before + 1);
    await rows.last().locator('input,textarea').first().fill('驗收新增項目');
  } else {
    await expandEditor(page);
    const fields = { general: 'title', effect: 'titleText', dialogue: 'dialogue', challenge: 'prefix', 'thumbnail-frame': 'cornerText' };
    if (card.id === 'thumbnail-frame') await page.locator('[data-corner-content="text"]').click();
    const field = fields[card.id] ? page.locator('#' + fields[card.id]) :
      page.locator('.one-workspace-editor input[type="text"],.one-workspace-editor input:not([type]),.one-workspace-editor textarea').first();
    await field.fill('驗收測試');
  }
}

for (const card of cards) {
  for (const width of [1920, 1366, 390]) {
    test(`${card.id} layout and keyboard ${width}px`, async ({ page, context }, info) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await openCard(page, card);
      await screenshot(page, info, `${card.id}-${width}-workspace`);
      const geometry = await page.evaluate(() => {
        const selectors = ['html', 'body', '#root', '.one-workspace-app', '.one-workspace-layout', '.one-workspace-editor', '.one-workspace-preview', '.editor-scroll'];
        return { viewport: { width: innerWidth, height: innerHeight }, elements: selectors.flatMap(selector => {
          const e = document.querySelector(selector);
          if (!e) return [];
          const r = e.getBoundingClientRect(), c = getComputedStyle(e);
          return [{ selector, top: r.top, bottom: r.bottom, height: r.height, scrollHeight: e.scrollHeight,
            cssHeight: c.height, minHeight: c.minHeight, maxHeight: c.maxHeight, gridRows: c.gridTemplateRows, overflow: c.overflow }];
        }) };
      });
      await info.attach('layout-geometry', { body: JSON.stringify(geometry, null, 2), contentType: 'application/json' });
      const contentBottom = Math.max(geometry.viewport.height, ...geometry.elements.filter(e => ['.one-workspace-editor', '.one-workspace-preview'].includes(e.selector)).map(e => e.bottom));
      expect.soft(geometry.elements.find(e => e.selector === 'html').scrollHeight, 'no large blank area below the editor and preview').toBeLessThanOrEqual(contentBottom + 40);
      if (card.id === 'focus') {
        const editor = geometry.elements.find(e => e.selector === '.one-workspace-editor');
        expect.soft(editor.scrollHeight, 'upload inputs must not create a second outer scrollbar').toBeLessThanOrEqual(editor.height + 1);
      }
      const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
      expect(dimensions.document, 'no document-level horizontal overflow').toBeLessThanOrEqual(dimensions.viewport + 1);
      await expect(page.locator('.one-workspace-header')).toHaveCount(1);
      await expect(page.locator('.one-workspace-dialog')).toHaveCount(1);
      if (width === 1366) {
        const base = await context.newPage();
        await openCard(base, card, true);
        expect(await artwork(page), 'unchanged approved renderer pixels').toBe(await artwork(base));
        await base.close();
      }
      const toggle = page.locator('.one-workspace-modebar > button');
      await toggle.click();
      await expect(page.locator('.one-workspace-editor')).toBeHidden();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await toggle.click();
      await expect(page.locator('.one-workspace-editor')).toBeVisible();
      await expandEditor(page);
      const scroller = page.locator(card.id === 'focus' ? '.editor-scroll' : '.one-workspace-editor');
      const scrollSize = await scroller.evaluate(e => ({ client: e.clientHeight, scroll: e.scrollHeight }));
      if (scrollSize.scroll > scrollSize.client + 5) {
        await scroller.hover();
        await page.mouse.wheel(0, 1200);
        await expect.poll(() => scroller.evaluate(e => e.scrollTop)).toBeGreaterThan(0);
      }
      if (card.id !== 'focus') {
        await page.locator('.one-workspace-zoom button[value="actual"]').click();
        const stage = page.locator('.one-workspace-stage');
        const size = await stage.evaluate(e => ({ x: e.scrollWidth - e.clientWidth, y: e.scrollHeight - e.clientHeight }));
        await stage.hover();
        if (size.x > 5) { await page.mouse.wheel(900, 0); await expect.poll(() => stage.evaluate(e => e.scrollLeft)).toBeGreaterThan(0); }
        if (size.y > 5) { await page.mouse.wheel(0, 900); await expect.poll(() => stage.evaluate(e => e.scrollTop)).toBeGreaterThan(0); }
        await page.locator('.one-workspace-zoom button[value="fit"]').click();
        const fit = await page.locator(mainCanvas).first().boundingBox();
        const area = await stage.boundingBox();
        expect(fit.width).toBeLessThanOrEqual(area.width);
        expect(fit.height).toBeLessThanOrEqual(area.height);
      } else {
        await page.locator('.preview-switch').getByRole('button', { name: '元件', exact: true }).click();
        await expect(page.locator(mainCanvas)).not.toHaveAttribute('width', '1920');
        await screenshot(page, info, `${card.id}-${width}-component`);
        const swatches = page.locator('.color-swatches button');
        const editorBox = await page.locator('.one-workspace-editor').boundingBox();
        for (let i = 0; i < await swatches.count(); i++) {
          if (!await swatches.nth(i).isVisible()) continue;
          const box = await swatches.nth(i).boundingBox();
          expect(box.width, 'color labels have usable width in the narrow sidebar').toBeGreaterThanOrEqual(60);
          expect(box.x).toBeGreaterThanOrEqual(editorBox.x);
          expect(box.x + box.width).toBeLessThanOrEqual(editorBox.x + editorBox.width);
        }
        if (await page.locator('.color-swatches').first().isVisible()) {
          await page.locator('.color-swatches').first().scrollIntoViewIfNeeded();
          await screenshot(page, info, `${card.id}-${width}-color-controls`);
        }
        await page.locator('.preview-switch').getByRole('button', { name: '全畫布', exact: true }).click();
        await expect(page.locator(mainCanvas)).toHaveAttribute('width', '1920');
      }
      await files(page);
      await screenshot(page, info, `${card.id}-${width}-project`);
      const project = page.locator('#one-workspace-tab-project');
      await project.focus();
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('#one-workspace-tab-history')).toBeFocused();
      await page.keyboard.press('End');
      await expect(page.locator('#one-workspace-tab-help')).toHaveAttribute('aria-selected', 'true');
      await page.keyboard.press('Home');
      await expect(project).toBeFocused();
      for (let i = 0; i < 18; i++) {
        await page.keyboard.press('Tab');
        expect(await page.evaluate(() => document.querySelector('dialog').contains(document.activeElement)), 'focus stays inside modal').toBe(true);
      }
      for (let i = 0; i < 18; i++) {
        await page.keyboard.press('Shift+Tab');
        expect(await page.evaluate(() => document.querySelector('dialog').contains(document.activeElement)), 'reverse focus stays inside modal').toBe(true);
      }
      await page.keyboard.press('Escape');
      await expect(page.locator('dialog')).toBeHidden();
      await expect(page.locator('.one-workspace-header-actions').getByRole('button', { name: '專案檔案', exact: true })).toBeFocused();
      expect(errors, 'uncaught runtime errors').toEqual([]);
    });
  }

  test(`${card.id} editing, JSON, ZIP, PNG and batch downloads`, async ({ page }, info) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await openCard(page, card);
    const initial = await artwork(page);
    await files(page);
    const jsonButton = card.id === 'focus' ? page.getByRole('button', { name: '輸出設定 JSON', exact: true }) :
      page.locator('.one-workspace-native-files #jsonBtn,.one-workspace-native-files #downloadJson');
    const json = await download(page, jsonButton, info, 'native-settings', 'json');
    expect(JSON.parse(json.bytes.toString())).toBeTruthy();
    await closeFiles(page);
    await changeContent(page, card);
    await expect.poll(() => artwork(page)).not.toBe(initial);
    await screenshot(page, info, `${card.id}-edited`);
    await files(page);
    await upload(page, page.locator('.one-workspace-native-files [data-action="load"],.one-workspace-native-files #loadJson'), json.target);
    await expect.poll(() => artwork(page), { timeout: 20000 }).toBe(initial);
    await closeFiles(page);
    await page.locator('.one-workspace-save-host button').click();
    await changeContent(page, card);
    await expect.poll(() => artwork(page)).not.toBe(initial);
    await files(page, 'history');
    await page.locator('[data-one-backup-ui] [data-action="restore"],#restoreHistory').click();
    await expect.poll(() => artwork(page)).toBe(initial);
    await closeFiles(page);
    // Real file upload, not an injected renderer/image mock.
    if (card.id === 'thumbnail-frame') {
      const imagePath = path.resolve(__dirname, '../assets/settlement-cats-v010.png');
      await page.locator('#fileInput').setInputFiles(imagePath);
      await expect(page.locator('#fileName')).toContainText('settlement-cats-v010.png');
      await expect.poll(() => artwork(page)).not.toBe(initial);
    }
    const saved = await artwork(page);
    const png = await download(page, page.locator('.one-workspace-export-button,.export-actions .export-button.primary').first(), info, 'exported-card', 'png');
    assertPNG(png.bytes);
    await files(page);
    const project = await download(page, page.locator('[data-action="export-package"]'), info, 'native-project', 'zip');
    const entries = zipEntries(project.bytes);
    const projectName = Object.keys(entries).find(name => name.endsWith('.json') && !name.includes('/'));
    expect(projectName).toBeTruthy();
    const manifest = JSON.parse(entries[projectName]);
    expect(manifest.tool_id).toBe(card.id === 'thumbnail-frame' ? card.id : card.id + '-card');
    if (card.id === 'thumbnail-frame') expect(manifest.assets.length).toBeGreaterThan(0);
    await closeFiles(page);
    await changeContent(page, card);
    if (card.id === 'thumbnail-frame') await page.locator('#removeImage').click();
    await files(page);
    await upload(page, page.locator('[data-action="import-package"]'), project.target);
    await expect(page.locator('.one-project-package__status')).toContainText('專案包載入成功');
    await expect(page.locator('.one-project-package__status')).not.toHaveClass(/error/);
    await expect.poll(() => artwork(page), { timeout: 20000 }).toBe(saved);
    await page.locator('#one-workspace-tab-batch').click();
    await upload(page, page.locator('[data-one-batch-render-ui] [data-action="select"]'), project.target);
    const run = page.locator('[data-one-batch-render-ui] [data-action="run"]');
    await expect(run).toBeEnabled();
    const batch = await download(page, run, info, 'batch-pngs', 'zip');
    const outputs = Object.entries(zipEntries(batch.bytes));
    expect(outputs).toHaveLength(1);
    expect(outputs[0][0]).toMatch(/\.png$/i);
    assertPNG(outputs[0][1]);
    // Native refreshList restores the ready-count status after completion.
    // The per-file result and actual downloaded PNG ZIP prove completion.
    await expect(page.locator('.one-batch-render__item')).toHaveCount(1);
    await expect(page.locator('.one-batch-render__item')).toContainText('已輸出');
    await expect(page.locator('.one-batch-render__item')).not.toHaveClass(/error/);
    await expect(page.locator('.one-batch-render__status')).not.toHaveClass(/error/);
    await screenshot(page, info, `${card.id}-batch-complete`);
    expect(errors).toEqual([]);
  });
}
