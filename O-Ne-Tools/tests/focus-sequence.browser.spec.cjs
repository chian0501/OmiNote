'use strict';
const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const sequence = require('../focus-card-sequence-v1.js');
const canvasSelector = '.preview-canvas';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function entriesOf(buffer) {
  const entries = {}; let offset = 0;
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    const size = buffer.readUInt32LE(offset + 18), length = buffer.readUInt16LE(offset + 26), extra = buffer.readUInt16LE(offset + 28);
    const name = buffer.subarray(offset + 30, offset + 30 + length).toString('utf8'), start = offset + 30 + length + extra;
    entries[name] = buffer.subarray(start, start + size); offset = start + size;
  }
  return entries;
}
async function artwork(page) { return page.locator(canvasSelector).evaluate(c => c.toDataURL()); }
async function frame(page, n) {
  await page.getByLabel('目前累積幕', { exact: true }).selectOption(String(n));
  await expect(page.getByText('第 ' + n + ' 幕圖片狀態', { exact: true })).toBeVisible();
  await expect.poll(() => page.getByRole('button', { name: '編輯：項目 ' + n, exact: true }).count()).toBe(1);
}
async function screenshot(page, info, name) {
  const target = info.outputPath(name + '.png'); await page.screenshot({ path: target, fullPage: true });
  await info.attach(name, { path: target, contentType: 'image/png' });
}
async function fileMenu(page) {
  await page.locator('.one-workspace-header-actions').getByRole('button', { name: '專案檔案', exact: true }).click();
  await expect(page.locator('#one-workspace-files')).toBeVisible();
}
async function closeFiles(page) { await page.locator('.one-workspace-dialog-head').getByRole('button', { name: '關閉', exact: true }).click(); }
async function download(page, button, info, filename) {
  const pending = page.waitForEvent('download'); await button.click(); const file = await pending;
  const target = info.outputPath(filename); await file.saveAs(target);
  return { target, bytes: await fs.readFile(target), name: file.suggestedFilename() };
}
async function importProject(page, input) {
  const pending = page.waitForEvent('filechooser'); await page.locator('[data-action="import-package"]').click();
  await (await pending).setFiles(input);
  await expect(page.locator('.one-project-package__status')).toContainText(/載入成功|載入失敗/);
}
async function image(page, name, color) {
  const b64 = await page.evaluate(c => { const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = c; ctx.fillRect(0, 0, 640, 360);
    return canvas.toDataURL().split(',')[1]; }, color);
  return { name, mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') };
}
async function open(page, count = 4, mode = 'steps') {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/O-Ne-Tools/focus-card.html');
  await expect(page.locator(canvasSelector)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('body')).toHaveAttribute('data-one-workspace-ready', '1');
  await page.locator('.preview-switch').getByRole('button', { name: '元件', exact: true }).click();
  await page.locator('.mode-tabs').getByRole('button', { name: mode === 'steps' ? '步驟' : '項目', exact: true }).click();
  if (count === 4) await page.getByRole('button', { name: /新增.*(項目|步驟)/ }).click();
  await page.locator('input[placeholder="輸入卡片標題"]').fill('累積圖片驗收');
  const inputs = page.locator('.item-row input:not([type]),.item-row input[type="text"]');
  await expect(inputs).toHaveCount(count);
  for (let i = 0; i < count; i++) await inputs.nth(i).fill('第' + (i + 1) + '項的獨立內容');
  await page.getByLabel('累積出現', { exact: true }).check();
  await expect(page.getByLabel('目前累積幕', { exact: true })).toHaveValue('1');
  return errors;
}
async function fourImages(page) {
  await page.getByRole('button', { name: '4 張｜2×2', exact: true }).click();
  await page.getByRole('button', { name: '圖片在左', exact: true }).click();
  const colors = ['#ed132f','#135bed','#db13ed','#13ed47'], files = [];
  for (let i = 0; i < 4; i++) {
    const file = await image(page, 'source-' + (i + 1) + '.png', colors[i]); files.push(file);
    await page.locator('#one-focus-upload-' + sequence.KEYS[i]).setInputFiles(file);
    await expect(page.locator('.focus-image-thumb img')).toHaveCount(i + 1);
  }
  return files;
}
async function bounds(page, colors) {
  return page.locator(canvasSelector).evaluate((canvas, cs) => {
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    return cs.map(c => { const rgb = c.match(/\w\w/g).map(v => parseInt(v,16)); let x = canvas.width, y = canvas.height, right = -1, bottom = -1, count = 0;
      for (let py = 0; py < canvas.height; py++) for (let px = 0; px < canvas.width; px++) {
        const i = (py * canvas.width + px) * 4;
        if (data[i] === rgb[0] && data[i+1] === rgb[1] && data[i+2] === rgb[2] && data[i+3] === 255) { count++; x = Math.min(x, px); y = Math.min(y, py); right = Math.max(right, px); bottom = Math.max(bottom, py); }
      } return { x, y, right, bottom, count };
    });
  }, colors.map(c => c.replace('#','')));
}

test('focus cumulative text and all PNG frames keep dimensions, order and current frame', async ({ page }, info) => {
  const errors = await open(page);
  const dimensions = await page.locator(canvasSelector).evaluate(c => [c.width,c.height]);
  const outputs = [];
  for (let n = 1; n <= 4; n++) {
    await frame(page,n);
    await expect(page.locator('.one-direct-target[aria-label^="編輯：項目 "]')).toHaveCount(n);
    expect(await page.locator(canvasSelector).evaluate(c => [c.width,c.height])).toEqual(dimensions);
    outputs.push(await artwork(page));
  }
  expect(new Set(outputs).size).toBe(4);
  await frame(page,2); const current = await artwork(page);
  const zip = await download(page,page.getByRole('button',{name:'輸出全部幕 PNG ZIP',exact:true}),info,'all-frames.zip');
  const entries = entriesOf(zip.bytes), names = Object.keys(entries);
  expect(names).toHaveLength(4); expect(names.map(n => n.match(/-(\d\d)\.png$/)[1])).toEqual(['01','02','03','04']);
  for (let i=0;i<4;i++) {
    expect([entries[names[i]].readUInt32BE(16),entries[names[i]].readUInt32BE(20)]).toEqual(dimensions);
    expect(entries[names[i]]).toEqual(Buffer.from(outputs[i].split(',')[1],'base64'));
  }
  expect(await artwork(page)).toBe(current); await expect(page.getByLabel('目前累積幕')).toHaveValue('2');
  await screenshot(page,info,'focus-cumulative-text'); expect(errors).toEqual([]);
});

test('focus 1–4 image layouts, reveal modes and fixed positions match actual pixels', async ({page},info) => {
  const errors = await open(page); await fourImages(page);
  await page.getByLabel('圖片出現方式').selectOption('all'); await page.getByLabel('預設焦點標示').selectOption('none');
  for (const [name,count] of [['單張',1],['上下兩張',2],['並排兩張',2],['3 張｜上 1 下 2',3],['3 張｜左 1 右 2',3],['4 張｜2×2',4]]) {
    await page.getByRole('button',{name,exact:true}).click();
    await expect(page.locator('.one-direct-image-target')).toHaveCount(count);
    await screenshot(page,info,'layout-'+count+'-'+name.replace(/[｜× ]/g,'-'));
  }
  await frame(page,4);
  const positions = await bounds(page,['ed132f','135bed','db13ed','13ed47']);
  expect(positions.every(p => p.count > 100)).toBe(true);
  expect(positions[0].right).toBeLessThan(positions[1].x); expect(positions[0].bottom).toBeLessThan(positions[2].y);
  await page.getByLabel('圖片出現方式').selectOption('accumulate');
  const size = await page.locator(canvasSelector).evaluate(c=>[c.width,c.height]);
  for (let n=1;n<=4;n++) {
    await frame(page,n); await expect(page.locator('.one-direct-image-target')).toHaveCount(n);
    const current = (await bounds(page,['ed132f','135bed','db13ed','13ed47']))[n-1];
    expect(current).toEqual(positions[n-1]); expect(await page.locator(canvasSelector).evaluate(c=>[c.width,c.height])).toEqual(size);
    await screenshot(page,info,'four-images-frame-'+n);
  }
  await page.getByLabel('圖片出現方式').selectOption('single');
  for (let n=1;n<=4;n++) { await frame(page,n); await expect(page.locator('.one-direct-image-target')).toHaveCount(1); }
  expect(errors).toEqual([]);
});

test('focus per-frame overrides, copying, restore automatic and text reordering retain associations', async ({page},info) => {
  const errors = await open(page); await fourImages(page);
  await page.getByLabel('圖片 1這幕狀態').selectOption('hidden'); await page.getByLabel('圖片 3這幕狀態').selectOption('focus');
  await page.getByLabel('圖片 3這幕標示').selectOption('badge');
  await expect(page.getByRole('button',{name:'更換：圖片 3',exact:true})).toBeVisible();
  await frame(page,2); await page.getByRole('button',{name:'複製上一幕',exact:true}).click();
  await expect(page.getByLabel('圖片 1這幕狀態')).toHaveValue('hidden'); await expect(page.getByLabel('圖片 3這幕狀態')).toHaveValue('focus');
  await page.getByRole('button',{name:'本幕恢復自動',exact:true}).click();
  await expect(page.getByLabel('圖片 1這幕狀態')).toHaveValue('auto');
  await frame(page,1);
  // Inspect the native row controls, then reorder through the actual visible move button.
  const row = page.locator('.item-row').first(); await row.getByRole('button',{name:/下移/}).click();
  await expect(page.getByLabel('目前累積幕')).toHaveValue('2'); await expect(page.getByLabel('圖片 3這幕狀態')).toHaveValue('focus');
  const saved = await artwork(page); await page.getByRole('button',{name:'↶ 復原',exact:true}).click();
  await expect(page.getByLabel('目前累積幕')).toHaveValue('1'); await page.getByRole('button',{name:'↷ 重做',exact:true}).click();
  await expect.poll(()=>artwork(page)).toBe(saved);
  await screenshot(page,info,'frame-overrides-reordered'); expect(errors).toEqual([]);
});

test('focus project includes all frames, all originals and crops; ZIP and onecard restore pixel-identically', async ({page},info) => {
  const errors = await open(page), sources = await fourImages(page);
  await page.getByRole('button',{name:'編輯裁切：圖片 3',exact:true}).click();
  const crop = page.getByRole('dialog',{name:/編輯裁切/}); await crop.getByRole('button',{name:'自由裁切',exact:true}).click();
  await crop.getByRole('spinbutton',{name:'左側百分比',exact:true}).fill('20');
  await crop.getByRole('spinbutton',{name:'寬度百分比',exact:true}).fill('60');
  await crop.getByRole('button',{name:/套用|完成/}).click();
  await frame(page,3); await page.getByLabel('圖片 1這幕狀態').selectOption('show'); await page.getByLabel('圖片 3這幕標示').selectOption('badge');
  const saved = await artwork(page); await fileMenu(page);
  const zip = await download(page,page.locator('[data-action="export-package"]'),info,'complete-project.zip');
  expect(zip.name).toMatch(/\.project\.zip$/);
  const entries = entriesOf(zip.bytes), manifest = JSON.parse(entries['project.json']);
  expect(manifest.data.content.steps.sequence.step).toBe(3); expect(manifest.data.images.third.cropWidth).toBe(60);
  expect(manifest.assets).toHaveLength(4); expect(manifest.sequence_export.frames).toHaveLength(4);
  manifest.assets.forEach((a,i)=>expect(hash(entries[a.zip_path])).toBe(hash(sources[i].buffer)));
  await closeFiles(page);
  await page.locator('.image-remove-button').nth(2).click(); await page.getByLabel('圖片 1這幕狀態').selectOption('hidden');
  await fileMenu(page); await importProject(page,zip.target); await closeFiles(page); await expect.poll(()=>artwork(page)).toBe(saved);
  await page.locator('.image-remove-button').nth(3).click();
  await fileMenu(page); await importProject(page,{name:'legacy.onecard',mimeType:'application/octet-stream',buffer:zip.bytes});
  await closeFiles(page); await expect.poll(()=>artwork(page)).toBe(saved);
  await screenshot(page,info,'project-restored-frame-3'); expect(errors).toEqual([]);
});

test('focus bad ZIPs, missing originals and malformed settings never partially replace the current card', async ({page},info) => {
  const errors = await open(page); await fourImages(page); await frame(page,2); const saved = await artwork(page);
  await fileMenu(page); const zip = await download(page,page.locator('[data-action="export-package"]'),info,'valid-project.zip');
  const raw = entriesOf(zip.bytes), project = JSON.parse(raw['project.json']);
  const variants = [];
  const missing = { ...raw }; delete missing[project.assets[0].zip_path]; variants.push(missing);
  const wrong = structuredClone(project); wrong.data.content.steps.sequence.step = 99;
  variants.push({...raw,'project.json':Buffer.from(JSON.stringify(wrong))});
  for (const [i,entries] of variants.entries()) {
    const data = await page.evaluate(async files => {
      const zip = await window.ONEProjectPackage.createZip(files.map(([name,b64])=>({name,data:Uint8Array.from(atob(b64),c=>c.charCodeAt(0))})));
      return Array.from(new Uint8Array(await zip.arrayBuffer()));
    },Object.entries(entries).map(([n,b])=>[n,b.toString('base64')]));
    await importProject(page,{name:'invalid-'+i+'.zip',mimeType:'application/zip',buffer:Buffer.from(data)});
    await expect(page.locator('.one-project-package__status')).toContainText('載入失敗'); expect(await artwork(page)).toBe(saved);
  }
  const corrupt = Buffer.from(zip.bytes); corrupt[80] ^= 1;
  await importProject(page,{name:'corrupt.zip',mimeType:'application/zip',buffer:corrupt});
  await expect(page.locator('.one-project-package__status')).toContainText('載入失敗'); expect(await artwork(page)).toBe(saved);
  await closeFiles(page); expect(errors).toEqual([]);
});

test('focus lightweight JSON carries sequence metadata, while legacy JSON opens with cumulative mode off', async ({page},info) => {
  const errors=await open(page,3,'list'); await frame(page,2); await fileMenu(page);
  const json=await download(page,page.locator('.export-button').filter({hasText:'匯出 JSON'}),info,'settings.json');
  const data=JSON.parse(json.bytes);expect(data.schema).toBe('o-ne.focus-card.ready.v0.6.0');expect(data.content.sequence.step).toBe(2);
  expect(JSON.stringify(data)).not.toContain('data:image/');
  await page.locator('#one-workspace-tab-history').click();
  const picker=page.locator('[data-one-backup-ui] input[type="file"]');
  const legacy={...data,schema:'o-ne.focus-card.ready.v0.5.11',content:{...data.content}};delete legacy.content.sequence;
  await picker.setInputFiles({name:'legacy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});
  await closeFiles(page);await expect(page.getByLabel('累積出現',{exact:true})).not.toBeChecked();
  await expect(page.locator('.one-direct-target[aria-label^="編輯：項目 "]')).toHaveCount(3);expect(errors).toEqual([]);
});

test('focus full-card undo restores removed image, keyboard undo and mobile layout remain usable', async ({page},info) => {
  const errors=await open(page);await fourImages(page);await frame(page,4);const saved=await artwork(page);
  await page.locator('.image-remove-button').nth(3).click();await expect(page.locator('.focus-image-thumb img')).toHaveCount(3);
  await page.getByRole('button',{name:'↶ 復原',exact:true}).click();await expect.poll(()=>artwork(page)).toBe(saved);
  await page.getByLabel('圖片 4這幕狀態').selectOption('hidden');await page.keyboard.press('Control+z');await expect.poll(()=>artwork(page)).toBe(saved);
  for (const width of [1366,1024,390]) {
    await page.setViewportSize({width,height:900});await screenshot(page,info,'focus-sequence-ui-'+width);
    expect(await page.locator('.editor-scroll').evaluate(e=>e.scrollWidth-e.clientWidth)).toBeLessThanOrEqual(1);
    expect(await page.locator('.focus-sequence-toolbar').evaluate(e=>e.scrollWidth-e.clientWidth)).toBeLessThanOrEqual(1);
  }
  expect(errors).toEqual([]);
});
