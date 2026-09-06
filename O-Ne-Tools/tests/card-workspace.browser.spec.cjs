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
async function ratingLayout(page, mode) {
  const parts = mode.split('-');
  await page.locator('[data-placement="' + (parts[1] || mode) + '"]').click();
  if (!['both', 'none'].includes(mode)) await page.locator('[data-arrangement="' + (parts[1] ? parts[0] : 'single') + '"]').click();
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

const directFields = {
  general: ['主標題', '#title'], trigger: ['主標題', '#title'], persistent: ['任務文字', '#task'],
  effect: ['主標題', '#titleText'], move: ['主標題', '#title'], choice: ['主標題', '#title'],
  challenge: ['開頭文字', '#prefix'], dialogue: ['對話內容', '#dialogue'], rating: ['店家／商品名稱', '#storeName'],
  focus: ['主標題', 'input[placeholder="輸入卡片標題"]'], 'thumbnail-frame': ['角標文字', '#cornerText'], settlement: ['篇章標題', '#chapterTitle']
};

async function patternedImage(page, name, colors) {
  return { name, mimeType: 'image/png', buffer: Buffer.from(await page.evaluate(colors => {
    const c=document.createElement('canvas');c.width=400;c.height=200;const ctx=c.getContext('2d');
    colors.forEach((color,i)=>{ctx.fillStyle=color;ctx.fillRect(i*200,0,200,200);});return c.toDataURL().split(',')[1];
  }, colors), 'base64') };
}
async function colorBounds(page, colors) {
  return page.locator(mainCanvas).first().evaluate((c, colors) => {
    const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    return colors.map(rgb=>{let x=c.width,y=c.height,right=-1,bottom=-1,count=0;
      for(let i=0;i<pixels.length;i+=4)if(pixels[i]===rgb[0]&&pixels[i+1]===rgb[1]&&pixels[i+2]===rgb[2]&&pixels[i+3]===255){const px=i/4%c.width,py=Math.floor(i/4/c.width);x=Math.min(x,px);y=Math.min(y,py);right=Math.max(right,px);bottom=Math.max(bottom,py);count++;}
      return{x,y,right,bottom,count,w:right-x+1,h:bottom-y+1};});
  }, colors);
}
async function cropHalf(page, opener, info, name, right = false) {
  await opener.click();const dialog=page.getByRole('dialog',{name:/編輯裁切/});await expect(dialog).toBeVisible();
  await dialog.getByRole('button',{name:'自由裁切',exact:true}).click();
  await dialog.getByRole('spinbutton',{name:'寬度百分比',exact:true}).fill('50');
  if(right)await dialog.getByRole('spinbutton',{name:'左側百分比',exact:true}).fill('50');
  await screenshot(page,info,name);await dialog.getByRole('button',{name:'套用裁切',exact:true}).click();await expect(dialog).toHaveCount(0);
}

test('focus grouped images, compact controls, independent crop and source ZIP restore', async ({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await openCard(page,cards.find(c=>c.id==='focus'));
  await screenshot(page,info,'focus-clean-sidebar');
  await page.locator('.preview-switch').getByRole('button',{name:'元件',exact:true}).click();
  await page.getByRole('button',{name:'上下兩張',exact:true}).click();
  const first=await patternedImage(page,'first-two-colors.png',['#ff00ff','#00ff00']);
  const second=await patternedImage(page,'second-two-colors.png',['#0000ff','#ffff00']);
  await page.getByLabel('上傳：上方圖片',{exact:true}).setInputFiles(first);
  await page.getByLabel('上傳：下方圖片',{exact:true}).setInputFiles(second);
  await expect(page.locator('.focus-image-thumb img')).toHaveCount(2);
  await cropHalf(page,page.getByRole('button',{name:'編輯裁切：上方圖片',exact:true}),info,'focus-image-crop-dialog');
  await cropHalf(page,page.getByRole('button',{name:'編輯裁切：下方圖片',exact:true}),info,'focus-second-crop',true);
  await expect.poll(async()=>{const b=await colorBounds(page,[[255,0,255],[255,255,0],[0,255,0],[0,0,255]]);return b[0].count>100&&b[1].count>100&&b[2].count===0&&b[3].count===0;}).toBe(true);
  for(const arrangement of ['上下兩張','並排兩張'])for(const side of ['圖片在左','圖片在右']){
    await page.getByRole('button',{name:arrangement,exact:true}).click();await page.getByRole('button',{name:side,exact:true}).click();
    await expect.poll(async()=>{const [a,b]=await colorBounds(page,[[255,0,255],[255,255,0]]);return a.count>100&&b.count>100&&(arrangement==='上下兩張'?a.bottom<b.y:a.right<b.x)&&Math.abs(a.w/a.h-1)<.02&&Math.abs(b.w/b.h-1)<.02;}).toBe(true);
    await screenshot(page,info,'focus-'+arrangement+'-'+side);
  }
  const bodyField=page.locator('.one-workspace-editor textarea').first(),originalBody=await bodyField.inputValue();
  await bodyField.fill('這段較長的內容用來確認圖片放右邊時，文字換行與卡片高度一致。'.repeat(4));
  await expect.poll(async()=>{const text=await page.getByRole('button',{name:'編輯：一般內文',exact:true}).boundingBox(),canvas=await page.locator(mainCanvas).first().boundingBox();return text&&canvas&&text.y+text.height<=canvas.y+canvas.height;}).toBe(true);
  await screenshot(page,info,'focus-pair-long-content');await bodyField.fill(originalBody);
  const saved=await artwork(page);
  await page.getByRole('button',{name:'編輯裁切：第一張圖片',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:/編輯裁切/});await dialog.getByRole('button',{name:'完整圖片',exact:true}).click();
  await page.keyboard.press('Escape');await expect.poll(()=>artwork(page)).toBe(saved);
  await files(page);const zip=await download(page,page.locator('[data-action="export-package"]'),info,'focus-grouped-crops','zip');
  const entries=zipEntries(zip.bytes),manifest=JSON.parse(entries[Object.keys(entries).find(n=>n.endsWith('.json')&&!n.includes('/'))]);expect(manifest.assets).toHaveLength(2);
  await closeFiles(page);await page.locator('.image-remove-button').nth(0).click();await page.locator('.image-remove-button').nth(1).click();
  await files(page);await upload(page,page.locator('[data-action="import-package"]'),zip.target);await closeFiles(page);await expect.poll(()=>artwork(page)).toBe(saved);
  await expandEditor(page);await page.getByRole('switch',{name:'加入標籤',exact:true}).click();await page.locator('.label-text-controls select').selectOption('COST');
  await page.locator('.label-color-block').getByRole('button',{name:/挑戰紅/}).click();
  await expect.poll(()=>page.locator(mainCanvas).first().evaluate(c=>Array.from(c.getContext('2d').getImageData(3,Math.round(c.height/2),1,1).data).slice(0,3))).toEqual([253,69,55]);
  for(const width of [1366,390]){await page.setViewportSize({width,height:900});await screenshot(page,info,'focus-grouped-'+width);expect(await page.locator('.editor-scroll').evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);}
  expect(errors).toEqual([]);
});

test('rating parallel images, individual crop, keyboard selection, transparent PNG and ZIP',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await openCard(page,cards.find(c=>c.id==='rating'));
  const background=page.locator('.one-workspace-fold').filter({has:page.locator('#bgAsset')});await expect(background).not.toHaveAttribute('open','');
  await ratingLayout(page,'pair-right');
  const selected=await page.locator('[data-placement="right"]').evaluate(e=>getComputedStyle(e).backgroundColor),unselected=await page.locator('[data-placement="left"]').evaluate(e=>getComputedStyle(e).backgroundColor);expect(selected).not.toBe(unselected);
  await page.locator('#leftProductUpload').setInputFiles(await patternedImage(page,'first.png',['#ff00ff','#00ff00']));
  await page.locator('#rightProductUpload').setInputFiles(await patternedImage(page,'second.png',['#0000ff','#ffff00']));
  await cropHalf(page,page.locator('#cropLeftProduct'),info,'rating-first-crop');
  await cropHalf(page,page.getByRole('button',{name:'裁切：第二張圖片',exact:true}),info,'rating-second-crop',true);
  for(const mode of ['pair-right','pair-left','stack-left','stack-right']){
    await ratingLayout(page,mode);
    await expect.poll(async()=>{const [a,b,g,blue]=await colorBounds(page,[[255,0,255],[255,255,0],[0,255,0],[0,0,255]]);return a.count>100&&b.count>100&&!g.count&&!blue.count&&(mode.startsWith('pair')?a.right<b.x:a.bottom<b.y);}).toBe(true);
    await expect(page.locator('#download')).toBeEnabled();await screenshot(page,info,'rating-cropped-'+mode);
  }
  const saved=await artwork(page);await page.locator('#cropLeftProduct').click();const dialog=page.getByRole('dialog',{name:/編輯裁切/});
  const cropCanvas=dialog.locator('canvas');await cropCanvas.focus();await page.keyboard.press('ArrowRight');await expect(dialog.getByRole('spinbutton',{name:'左側百分比',exact:true})).toHaveValue('1');
  const box=await cropCanvas.boundingBox();await page.mouse.move(box.x+box.width*.25,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.35,box.y+box.height*.5);await page.mouse.up();
  expect(Number(await dialog.getByRole('spinbutton',{name:'左側百分比',exact:true}).inputValue())).toBeGreaterThan(5);
  await dialog.getByRole('button',{name:'取消',exact:true}).click();await expect.poll(()=>artwork(page)).toBe(saved);
  const png=await download(page,page.locator('#download'),info,'rating-cropped-transparent','png');assertPNG(png.bytes);
  await files(page);const json=await download(page,page.locator('#jsonBtn'),info,'rating-crop-settings','json');const payload=JSON.parse(json.bytes);expect(payload.image_adjustments.left_product.crop.cropWidth).toBe(50);expect(payload.image_adjustments.right_product.crop.cropX).toBe(50);
  const zip=await download(page,page.locator('[data-action="export-package"]'),info,'rating-crop-project','zip');await page.locator('#reset').click();await upload(page,page.locator('[data-action="import-package"]'),zip.target);await closeFiles(page);await expect.poll(()=>artwork(page)).toBe(saved);
  await page.setViewportSize({width:390,height:844});await page.locator('#cropRightProduct').click();await screenshot(page,info,'rating-crop-mobile');
  expect(await page.locator('.one-image-dialog').evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);expect(errors).toEqual([]);
});

test('rating inline text sizes preserve individual values, cancellation and project settings',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await openCard(page,cards.find(c=>c.id==='rating'));
  const title=page.getByRole('button',{name:'編輯：店家／商品名稱',exact:true});await title.click();
  const input=page.getByRole('textbox',{name:'直接編輯：店家／商品名稱',exact:true});await input.fill('百味軒');await page.getByRole('spinbutton',{name:'文字大小',exact:true}).fill('68');
  await screenshot(page,info,'rating-inline-text-size');await page.locator('.one-direct-editor').getByRole('button',{name:'完成',exact:true}).click();
  const formatted=await artwork(page);await title.click();await input.fill('取消');await page.getByRole('spinbutton',{name:'文字大小',exact:true}).fill('30');await input.focus();await page.keyboard.press('Escape');await expect.poll(()=>artwork(page)).toBe(formatted);
  await page.locator('.one-direct-target[data-field-key^="rating-label-"]').first().click();await page.getByRole('spinbutton',{name:'文字大小',exact:true}).fill('32');await page.locator('.one-direct-editor').getByRole('button',{name:'完成',exact:true}).click();
  await expect(page.locator('#download')).toBeEnabled();const saved=await artwork(page);
  await files(page);const json=await download(page,page.locator('#jsonBtn'),info,'rating-font-sizes','json');const payload=JSON.parse(json.bytes);expect(payload.text_styles.storeName.size).toBe(68);expect(payload.ratings[0].text_styles.label.size).toBe(32);
  await closeFiles(page);await title.click();await page.getByRole('spinbutton',{name:'文字大小',exact:true}).fill('40');await page.locator('.one-direct-editor').getByRole('button',{name:'完成',exact:true}).click();
  await files(page);await upload(page,page.locator('.one-workspace-native-files [data-action="load"]'),json.target);await closeFiles(page);await expect.poll(()=>artwork(page)).toBe(saved);
  await page.locator('.one-workspace-save-host button').click();await page.reload();await expect.poll(()=>artwork(page)).toBe(saved);
  await page.setViewportSize({width:390,height:844});await title.click();await screenshot(page,info,'rating-inline-font-mobile');const toolbar=await page.locator('.one-direct-editor-head').boundingBox();expect(toolbar.x).toBeGreaterThanOrEqual(0);expect(toolbar.x+toolbar.width).toBeLessThanOrEqual(390);expect(errors).toEqual([]);
});

test('focus inline formatting, COST alignment, composition and project restore', async ({ page }, info) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await openCard(page, cards.find(c => c.id === 'focus'));
  await page.locator('.preview-switch').getByRole('button', { name: '元件', exact: true }).click();
  await expandEditor(page);
  await page.getByRole('switch', { name: '加入標籤', exact: true }).click();
  await page.locator('.label-text-controls select').selectOption('COST');
  await page.getByRole('button', { name: '標題前方', exact: true }).click();
  const title = page.getByRole('button', { name: '編輯：主標題', exact: true });
  const tag = page.getByRole('button', { name: '編輯：標籤文字', exact: true });
  await expect(tag).toBeVisible();
  await expect.poll(async () => {
    const a = await title.boundingBox(), b = await tag.boundingBox();
    return a && b ? Math.abs(a.y + a.height / 2 - b.y - b.height / 2) : 999;
  }).toBeLessThan(8);
  await title.click();
  const input = page.getByRole('textbox', { name: '直接編輯：主標題', exact: true });
  await expect(input).toHaveAttribute('contenteditable', 'plaintext-only');
  await input.fill('焦點卡直接改字');
  await page.getByRole('spinbutton', { name: '標題字級', exact: true }).fill('64');
  await page.getByRole('button', { name: '字色：淺色字', exact: true }).click();
  await expect.poll(() => input.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeCloseTo(64 * 882 / 1240, 1);
  const editingBox = await input.boundingBox(), toolBox = await page.locator('.one-direct-editor-head').boundingBox();
  expect(toolBox.y + toolBox.height).toBeLessThanOrEqual(editingBox.y);
  expect(editingBox.height).toBeLessThan(70);
  await screenshot(page, info, 'focus-inline-formatting');
  await page.locator('.one-direct-editor').getByRole('button', { name: '完成', exact: true }).click();
  await expect(page.locator('input[placeholder="輸入卡片標題"]')).toHaveValue('焦點卡直接改字');
  const formatted = await artwork(page);
  await title.click(); await input.fill('取消格式');
  await page.getByRole('spinbutton', { name: '標題字級', exact: true }).fill('40');
  await page.getByRole('button', { name: '字色：高亮黃', exact: true }).click();
  await input.focus(); await page.keyboard.press('Escape');
  await expect.poll(() => artwork(page)).toBe(formatted);
  await title.click(); await input.dispatchEvent('compositionstart'); await input.fill('中文組字');
  await expect(page.locator('input[placeholder="輸入卡片標題"]')).toHaveValue('焦點卡直接改字');
  await input.dispatchEvent('compositionend');
  await expect(page.locator('input[placeholder="輸入卡片標題"]')).toHaveValue('中文組字');
  await page.keyboard.press('Escape'); await expect.poll(() => artwork(page)).toBe(formatted);
  await title.click(); await input.fill('選取強調');
  await input.evaluate(el => { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
  await page.getByRole('button', { name: '強調選字', exact: true }).click();
  await expect(page.locator('input[placeholder="輸入卡片標題"]')).toHaveValue('【選取強調】');
  await page.locator('.one-direct-editor').getByRole('button', { name: '完成', exact: true }).click();
  await expect(title).toBeVisible();
  for (const mode of ['項目', '步驟', '一般內文']) {
    await page.locator('.mode-tabs').getByRole('button', { name: mode, exact: true }).click();
    const name = mode === '一般內文' ? '一般內文' : '項目 1';
    await page.getByRole('button', { name: '編輯：' + name, exact: true }).click();
    const editor = page.getByRole('textbox', { name: '直接編輯：' + name, exact: true });
    await editor.fill(mode + '直接編輯內容');
    await page.getByRole('spinbutton', { name: '內文／項目字級', exact: true }).fill('38');
    await page.locator('.one-direct-editor').getByRole('button', { name: '完成', exact: true }).click();
  }
  const saved = await artwork(page);
  await files(page);
  const json = await download(page, page.locator('.one-workspace-native-files').getByRole('button', { name: '輸出設定 JSON', exact: true }), info, 'focus-inline-settings', 'json');
  const payload = JSON.parse(json.bytes); expect(payload.label.text).toBe('COST'); expect(payload.style.titleSize).toBe(64); expect(payload.style.contentSize).toBe(38);
  await closeFiles(page); await title.click(); await input.fill('載入前變更');
  await page.locator('.one-direct-editor').getByRole('button', { name: '完成', exact: true }).click();
  await files(page); await upload(page, page.locator('.one-workspace-native-files [data-action="load"]'), json.target); await closeFiles(page);
  await expect.poll(() => artwork(page)).toBe(saved);
  await page.locator('.one-workspace-save-host button').click(); await page.reload();
  await expect.poll(() => artwork(page)).toBe(saved);
  await screenshot(page, info, 'focus-COST-aligned');
  await page.setViewportSize({ width: 390, height: 844 });
  await title.click(); await screenshot(page, info, 'focus-inline-mobile');
  const toolbar = await page.locator('.one-direct-editor-head').boundingBox(); expect(toolbar.x).toBeGreaterThanOrEqual(0); expect(toolbar.x + toolbar.width).toBeLessThanOrEqual(390);
  expect(errors).toEqual([]);
});

test('rating stacked images use independent sources and survive JSON, ZIP and layout changes', async ({ page }, info) => {
  page.on('dialog', dialog => dialog.accept());
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await openCard(page, cards.find(c => c.id === 'rating'));
  await ratingLayout(page, 'stack-right');
  const top = page.getByRole('button', { name: '更換：上方圖片', exact: true });
  const bottom = page.getByRole('button', { name: '更換：下方圖片', exact: true });
  for (const [button, name, color, w, h] of [[top, 'top-landscape.png', '#29a6a7', 160, 90], [bottom, 'bottom-portrait.png', '#ffbe37', 80, 120]]) {
    const buffer = Buffer.from(await page.evaluate(({ color, w, h }) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d'); ctx.fillStyle = color; ctx.fillRect(0, 0, w, h); return c.toDataURL().split(',')[1]; }, { color, w, h }), 'base64');
    await upload(page, button, { name, mimeType: 'image/png', buffer });
  }
  await expect(page.locator('#leftProductName')).toHaveText('top-landscape.png'); await expect(page.locator('#rightProductName')).toHaveText('bottom-portrait.png');
  for (const mode of ['stack-right', 'stack-left']) {
    await ratingLayout(page, mode);
    for (const width of ['1856', '1500']) {
      if(await page.locator('#ratingLayoutSize').getAttribute('open')===null)await page.locator('#ratingLayoutSize > summary').click();
      await page.locator('#layoutWidth').fill(width); await page.locator('#layoutWidth').dispatchEvent('input');
      await expect.poll(async () => { const a = await top.boundingBox(), b = await bottom.boundingBox(); return a && b && a.y + a.height <= b.y && Math.abs(a.x + a.width / 2 - b.x - b.width / 2) < 2; }).toBe(true);
      await expect.poll(async () => { const b = await top.boundingBox(); return b ? b.width / b.height : 0; }).toBeCloseTo(160 / 90, 2);
      const pixels = await page.evaluate(() => { const l = panelLayout(), ctx = document.querySelector('#c').getContext('2d'); return { panelWidth: l.panelWidth, top: Array.from(ctx.getImageData(l.leftImage.x + l.leftImage.w / 2, l.leftImage.y + l.leftImage.h / 2, 1, 1).data), bottom: Array.from(ctx.getImageData(l.rightImage.x + l.rightImage.w / 2, l.rightImage.y + l.rightImage.h / 2, 1, 1).data) }; });
      expect(pixels.panelWidth).toBeGreaterThanOrEqual(880); expect(pixels.top).toEqual([41, 166, 167, 255]); expect(pixels.bottom).toEqual([255, 190, 55, 255]);
    }
    await screenshot(page, info, 'rating-' + mode);
  }
  await page.locator('#leftProductVisible').uncheck(); await expect(top).toHaveCount(0); await expect(bottom).toBeVisible();
  await page.locator('#leftProductVisible').check(); await expect(top).toBeVisible();
  await ratingLayout(page, 'both'); await ratingLayout(page, 'stack-right');
  if(await page.locator('#ratingLayoutSize').getAttribute('open')===null)await page.locator('#ratingLayoutSize > summary').click();
  await page.locator('#layoutWidth').fill('1856'); await page.locator('#layoutWidth').dispatchEvent('input');
  const saved = await artwork(page);
  await files(page);
  const json = await download(page, page.locator('#jsonBtn'), info, 'rating-stacked-settings', 'json');
  expect(JSON.parse(json.bytes).image_adjustments.product.arrangement).toBe('vertical');
  const zip = await download(page, page.locator('[data-action="export-package"]'), info, 'rating-stacked-project', 'zip');
  const entries = zipEntries(zip.bytes); const manifest = JSON.parse(entries[Object.keys(entries).find(name => name.endsWith('.json') && !name.includes('/'))]); expect(manifest.assets).toHaveLength(2);
  await page.locator('#reset').click(); await upload(page, page.locator('[data-action="import-package"]'), zip.target);
  await expect(page.locator('.one-project-package__status')).toContainText('專案包載入成功'); await closeFiles(page);
  await expect.poll(() => artwork(page)).toBe(saved); await expect(top).toBeVisible(); await expect(bottom).toBeVisible();
  await ratingLayout(page, 'left'); await files(page); await upload(page, page.locator('.one-workspace-native-files [data-action="load"]'), json.target); await closeFiles(page);
  await expect.poll(() => artwork(page)).toBe(saved);
  for (const width of [1366, 390]) { await page.setViewportSize({ width, height: 844 }); await screenshot(page, info, 'rating-stacked-' + width); }
  expect(errors).toEqual([]);
});
for (const card of cards) {
  test(`${card.id} direct canvas text editing and cancel`, async ({ page }, info) => {
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await openCard(page, card);
    if (card.id === 'thumbnail-frame') { await expandEditor(page); await page.locator('[data-corner-content="text"]').click(); }
    if (card.id === 'focus') await page.locator('.preview-switch').getByRole('button', { name: '元件', exact: true }).click();
    const [label, field] = directFields[card.id];
    const source = page.locator(field), original = await source.inputValue(), before = await artwork(page);
    const target = page.getByRole('button', { name: '編輯：' + label, exact: true });
    await expect(target).toBeVisible();
    await target.click();
    const input = page.getByRole('textbox', { name: '直接編輯：' + label, exact: true });
    await input.fill('直接改字');
    await expect(source).toHaveValue('直接改字');
    await expect.poll(() => artwork(page)).not.toBe(before);
    await screenshot(page, info, `${card.id}-direct-edit`);
    await page.locator('.one-direct-editor').getByRole('button', { name: '完成', exact: true }).click();
    await expect(page.locator('.one-direct-editor')).toHaveCount(0);
    const edited = await artwork(page);
    await target.focus(); await page.keyboard.press('Enter');
    await input.fill('取消測試'); await page.keyboard.press('Escape');
    await expect(source).toHaveValue('直接改字');
    await expect.poll(() => artwork(page)).toBe(edited);
    await target.click(); await input.fill(original);
    await page.locator('.one-direct-editor').getByRole('button', { name: '完成', exact: true }).click();
    await expect.poll(() => artwork(page)).toBe(before);
    if (card.id === 'general') {
      await target.click();
      await input.dispatchEvent('compositionstart');
      await input.fill('輸入法組字');
      await expect(source).toHaveValue(original);
      await input.dispatchEvent('compositionend');
      await expect(source).toHaveValue('輸入法組字');
      await page.keyboard.press('Escape');
      await expect(source).toHaveValue(original);
    }
    if (card.id === 'trigger') {
      for (const [label, id] of [['副標題', 'subtitle'], ['進度', 'progress']]) {
        const native = page.locator('#' + id), previous = await native.inputValue();
        await page.getByRole('button', { name: '編輯：' + label, exact: true }).click();
        await page.locator('.one-direct-input').fill(id === 'progress' ? '1/2' : '觸發卡副標');
        await expect(native).toHaveValue(id === 'progress' ? '1/2' : '觸發卡副標');
        await page.keyboard.press('Escape');
        await expect(native).toHaveValue(previous);
      }
    }
    expect(errors).toEqual([]);
  });
}

test('choice complete set contains all-dim plus one bright per option and preserves edits', async ({ page }, info) => {
  await openCard(page, cards.find(c => c.id === 'choice'));
  await page.locator('#optionList [data-action="toggle"][data-index="0"]').click();
  await page.locator('#optionList [data-action="toggle"][data-index="2"]').click();
  const before = await artwork(page), toggles = await page.locator('#optionList [data-action="toggle"]').allTextContents();
  await page.locator('.one-workspace-save-host button').click();
  const history = await page.evaluate(() => JSON.stringify(localStorage));
  const output = await download(page, page.locator('#downloadSet'), info, 'choice-complete-set', 'zip');
  const entries = Object.entries(zipEntries(output.bytes)).sort(([a], [b]) => a.localeCompare(b));
  expect(entries).toHaveLength(toggles.length + 1);
  expect(await artwork(page)).toBe(before);
  expect(await page.locator('#optionList [data-action="toggle"]').allTextContents()).toEqual(toggles);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(history);
  await expect(page.locator('#status')).toContainText('已輸出 6 張');
  await screenshot(page, info, 'choice-complete-set');
  const hashes = new Set();
  for (let step = 0; step < entries.length; step++) {
    const [name, bytes] = entries[step]; assertPNG(bytes);
    expect(name).toContain(String(step).padStart(2, '0'));
    expect(bytes.readUInt32BE(16)).toBe(882); expect(bytes.readUInt32BE(20)).toBe(678);
    await page.locator('#allDim').click();
    if (step) await page.locator(`#optionList [data-action="toggle"][data-index="${step - 1}"]`).click();
    const native = await page.locator(mainCanvas).first().evaluate(c => c.toDataURL('image/png').split(',')[1]);
    expect(bytes.equals(Buffer.from(native, 'base64')), 'bundle frame equals the corresponding native manual state').toBe(true);
    hashes.add(crypto.createHash('sha256').update(bytes).digest('hex'));
  }
  expect(hashes.size).toBe(6);
});

test('choice duplicate option labels edit the clicked row only', async ({ page }, info) => {
  await openCard(page, cards.find(c => c.id === 'choice'));
  for (let i = 0; i < 3; i++) await page.locator(`#optionList input[data-index="${i}"]`).fill('相同選項');
  await page.getByRole('button', { name: '編輯：選項 2', exact: true }).click();
  await page.getByRole('textbox', { name: '直接編輯：選項 2', exact: true }).fill('只改第二項');
  await page.locator('.one-direct-editor').getByRole('button', { name: '完成', exact: true }).click();
  await expect(page.locator('#optionList input[data-index="0"]')).toHaveValue('相同選項');
  await expect(page.locator('#optionList input[data-index="1"]')).toHaveValue('只改第二項');
  await expect(page.locator('#optionList input[data-index="2"]')).toHaveValue('相同選項');
  await screenshot(page, info, 'choice-direct-option');
});

test('rating settings fit the narrow sidebar and numeric scores edit on canvas', async ({ page }, info) => {
  await openCard(page, cards.find(c => c.id === 'rating')); await expandEditor(page);
  const row = page.locator('.rating-editor').first(); await row.scrollIntoViewIfNeeded();
  const name = await row.locator('input[data-field="label"]').boundingBox(), score = await row.locator('input[data-field="value"]').boundingBox();
  expect(name.width).toBeGreaterThanOrEqual(200); expect(score.width).toBeGreaterThanOrEqual(70);
  await screenshot(page, info, 'rating-sidebar-fields');
  const scoreId = await row.locator('input[data-field="value"]').getAttribute('id');
  await page.locator(`.one-direct-target[data-field-key="${scoreId}"]`).click();
  await page.locator('.one-direct-input').fill('3.2');
  await page.locator('.one-direct-editor').getByRole('button', { name: '完成', exact: true }).click();
  await expect(page.locator('#' + scoreId)).toHaveValue('3.2');
  await row.locator('select[data-field="type"]').selectOption('text');
  const result = row.locator('input[data-field="value"]');
  expect((await result.boundingBox()).width).toBeGreaterThanOrEqual(200);
  await page.locator(`.one-direct-target[data-field-key="${scoreId}"]`).click();
  await page.locator('.one-direct-input').fill('值得再訪');
  await page.locator('.one-direct-editor').getByRole('button', { name: '完成', exact: true }).click();
  await expect(result).toHaveValue('值得再訪');
  await screenshot(page, info, 'rating-text-result');
});

for (const width of [1920, 1366, 390]) {
  test(`explanation preview never enlarges native pixels ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto('/O-Ne-Tools/explanation-card.html');
    const canvas = page.locator('#previewCanvas'); await expect(canvas).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect.poll(() => canvas.evaluate(c => c.getBoundingClientRect().width / c.width)).toBeLessThanOrEqual(1.001);
    await screenshot(page, info, `explanation-${width}-preview`);
  });
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
      if (card.id === 'rating') {
        const groups = page.locator('.one-workspace-editor > .one-workspace-fold');
        await expect(groups).toHaveCount(5);
        for (let i = 0; i < 3; i++) await expect(groups.nth(i)).not.toHaveAttribute('open');
        await expect(groups.nth(3)).toHaveAttribute('open');
        await expect(groups.nth(4)).not.toHaveAttribute('open');
        await expect(page.locator('#ratingLayoutSize')).not.toHaveAttribute('open');
        await expect(page.locator('#ratingLayoutSize #layoutWidth')).toHaveCount(1);
        await expect(groups.nth(0).locator('#tagSize')).toHaveCount(1);
        await expect(page.locator('#ratingLayoutSize #tagSize')).toHaveCount(0);
        await expect(groups.locator(':scope > summary')).toHaveText(['標籤與店家標題', '評分項目', '價格與心得', '影像', '背景（選用）']);
      }
      if (card.id === 'dialogue') {
        const left = await page.locator('#leftCharacter').boundingBox(), right = await page.locator('#rightCharacter').boundingBox();
        expect(left.width).toBeGreaterThanOrEqual(120); expect(right.width).toBeGreaterThanOrEqual(120);
        expect(Math.abs(left.y - right.y)).toBeLessThanOrEqual(1);
        expect(right.x).toBeGreaterThanOrEqual(left.x + left.width);
        expect((await page.locator('.one-workspace-stage').boundingBox()).height).toBeLessThanOrEqual(220);
        await page.getByRole('button', { name: '交換左右角色', exact: true }).click();
        await expect(page.locator('#leftCharacter')).toHaveValue('NieTe');
        await expect(page.locator('#rightCharacter')).toHaveValue('Omi');
        await page.getByRole('button', { name: '交換左右角色', exact: true }).click();
      }
      const originalScale = await page.locator(mainCanvas).first().evaluate(c => ({ width: c.getBoundingClientRect().width / c.width, height: c.getBoundingClientRect().height / c.height }));
      expect(originalScale.width, 'default preview never enlarges the native canvas').toBeLessThanOrEqual(1.001);
      expect(originalScale.height).toBeLessThanOrEqual(1.001);
      if (await page.locator('.one-workspace-mode').count()) {
        await expect(page.locator('.one-workspace-editor .one-workspace-mode select').first()).toBeVisible();
        await expect(page.locator('.one-workspace-modebar select')).toHaveCount(0);
      }
      if(width>=1366){
        const footer=await page.locator('.one-workspace-export,.one-workspace-preview .export-bar').last().boundingBox();
        expect(footer.y+footer.height,'export actions fit inside the desktop viewport').toBeLessThanOrEqual(900);
      }
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
        if (['rating', 'settlement'].includes(card.id)) {
          await expandEditor(base);
          await base.locator('#bgVisible').uncheck();
        }
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
    const png = await download(page, page.locator('.one-workspace-export-button:not(#downloadSet),.export-actions .export-button.primary').first(), info, 'exported-card', 'png');
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

for (const id of ['rating', 'settlement']) {
  test(`${id} transparent default, reset, PNG and saved background compatibility`, async ({ page, context }, info) => {
    page.on('dialog', dialog => dialog.accept());
    const card = cards.find(c => c.id === id);
    await openCard(page, card);
    await expect(page.locator('#bgVisible')).not.toBeChecked();
    const initial = await artwork(page);
    const png = await download(page, page.locator('.one-workspace-export-button').first(), info, id + '-transparent', 'png');
    assertPNG(png.bytes);
    const alpha = await page.evaluate(async data => {
      const image = new Image(); image.src = 'data:image/png;base64,' + data; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
      return ctx.getImageData(2, 2, 1, 1).data[3];
    }, png.bytes.toString('base64'));
    expect(alpha, 'exported PNG has actual alpha transparency outside the card').toBe(0);
    await expandEditor(page); await page.locator('#bgVisible').check();
    const base = await context.newPage(); await openCard(base, card, true);
    await expandEditor(base); await base.locator('#bgVisible').check();
    const withBackground = await artwork(base);
    expect(await artwork(page), 'enabling the background preserves the approved artwork').toBe(withBackground);
    await files(base);
    const oldJSON = await download(base, base.locator('.one-workspace-native-files #jsonBtn,.one-workspace-native-files #downloadJson'), info, id + '-previous-version', 'json');
    await base.close();
    await page.locator('#bgVisible').uncheck();
    await files(page);
    await upload(page, page.locator('.one-workspace-native-files [data-action="load"],.one-workspace-native-files #loadJson'), oldJSON.target);
    await expect(page.locator('#bgVisible')).toBeChecked();
    await expect.poll(() => artwork(page)).toBe(withBackground);
    await closeFiles(page); await page.locator('.one-workspace-save-host button').click();
    await page.reload(); await expect(page.locator('.one-workspace-save-host button')).toBeVisible();
    await expect(page.locator('#bgVisible')).toBeChecked();
    await expect.poll(() => artwork(page)).toBe(withBackground);
    await files(page); await page.locator('.one-workspace-native-files #reset').click(); await closeFiles(page);
    await expect(page.locator('#bgVisible')).not.toBeChecked();
    await expect.poll(() => artwork(page)).toBe(initial);
    await screenshot(page, info, id + '-transparent-reset');
  });
}

test('rating click-to-replace images preserve sides, proportions and project roundtrip', async ({ page }, info) => {
  page.on('dialog', dialog => dialog.accept());
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await openCard(page, cards.find(c => c.id === 'rating'));
  const fixture = async (name, width, height, color) => ({ name, mimeType: 'image/png', buffer: Buffer.from(await page.evaluate(({ width, height, color }) => {
    const c = document.createElement('canvas'); c.width = width; c.height = height;
    const ctx = c.getContext('2d'); ctx.fillStyle = color; ctx.fillRect(0, 0, width, height);
    return c.toDataURL('image/png').split(',')[1];
  }, { width, height, color }), 'base64') });
  const wide = await fixture('right-wide.png', 160, 80, '#28a6a7');
  const tall = await fixture('left-tall.png', 80, 160, '#ffbe37');
  const right = page.getByRole('button', { name: '更換：右側圖片', exact: true });
  const left = page.getByRole('button', { name: '更換：左側圖片', exact: true });
  await expect(right).toBeVisible(); await expect(left).toHaveCount(0);
  await page.evaluate(() => { window.rightUploadChanges = 0; document.querySelector('#rightProductUpload').addEventListener('change', () => window.rightUploadChanges++); });
  const pending = page.waitForEvent('filechooser'); await right.focus(); await page.keyboard.press('Enter');
  await (await pending).setFiles(wide);
  await expect(page.locator('#rightProductName')).toHaveText('right-wide.png');
  await upload(page, right, wide);
  await expect.poll(() => page.evaluate(() => window.rightUploadChanges)).toBe(2);
  await expect.poll(async () => { const box = await right.boundingBox(); return box ? box.width / box.height : 0; }).toBeCloseTo(2, 2);
  const rightSource = await page.locator('#rightProductPreview').getAttribute('src');
  await ratingLayout(page, 'both'); await upload(page, left, tall);
  await expect(page.locator('#leftProductName')).toHaveText('left-tall.png');
  await expect(page.locator('#rightProductPreview')).toHaveAttribute('src', rightSource);
  await expect.poll(async () => { const box = await left.boundingBox(); return box ? box.width / box.height : 0; }).toBeCloseTo(.5, 2);
  await screenshot(page, info, 'rating-replaced-dual-images');
  for (const position of ['left', 'right', 'none', 'both']) {
    await ratingLayout(page, position);
    await expect(left).toHaveCount(['left', 'both'].includes(position) ? 1 : 0);
    await expect(right).toHaveCount(['right', 'both'].includes(position) ? 1 : 0);
  }
  await page.locator('#leftProductVisible').uncheck(); await expect(left).toHaveCount(0);
  await page.locator('#leftProductVisible').check(); await expect(left).toHaveCount(1);
  await page.locator('.one-workspace-zoom button[value="actual"]').click();
  await expect.poll(async () => { const box = await right.boundingBox(); return box ? box.width / box.height : 0; }).toBeCloseTo(2, 2);
  await page.locator('.one-workspace-zoom button[value="fit"]').click();
  const saved = await artwork(page);
  await files(page);
  const project = await download(page, page.locator('[data-action="export-package"]'), info, 'rating-dual-image-project', 'zip');
  const entries = zipEntries(project.bytes);
  const manifest = JSON.parse(entries[Object.keys(entries).find(name => name.endsWith('.json') && !name.includes('/'))]);
  expect(manifest.assets).toHaveLength(2);
  await page.locator('.one-workspace-native-files #reset').click();
  await upload(page, page.locator('[data-action="import-package"]'), project.target);
  await expect(page.locator('.one-project-package__status')).toContainText('專案包載入成功');
  await expect.poll(() => artwork(page)).toBe(saved); await closeFiles(page);
  await expect(left).toHaveCount(1); await expect(right).toHaveCount(1);
  await expect(page.locator('#bgVisible')).not.toBeChecked();
  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot(page, info, 'rating-replaced-images-mobile');
  expect(errors).toEqual([]);
});

// Audit fixes: test observable results, including cancelled destructive actions.
test('move orange survives typing and the two-state ZIP preserves the selected preview', async ({page}, info) => {
  await openCard(page, cards.find(c=>c.id==='move'));
  const white=await artwork(page);
  await page.locator('#previewState').selectOption('orange');
  await expect.poll(()=>artwork(page)).not.toBe(white);
  const orange=await artwork(page);
  const title=await page.locator('#title').inputValue();
  await page.locator('#title').fill('驗收交通路線');
  await page.locator('#title').fill(title);
  await expect.poll(()=>artwork(page)).toBe(orange);
  const zip=await download(page,page.locator('#downloadBoth'),info,'move-both-states','zip');
  const entries=zipEntries(zip.bytes),names=Object.keys(entries);expect(names).toHaveLength(2);
  names.forEach(name=>assertPNG(entries[name]));
  expect(entries[names[0]].equals(entries[names[1]])).toBe(false);
  await expect(page.locator('#previewState')).toHaveValue('orange');expect(await artwork(page)).toBe(orange);
  await screenshot(page,info,'move-orange-zip-complete');
  for(let i=0;i<2;i++)await page.locator('#removeStation').click();
  await expect(page.locator('#removeStation')).toBeDisabled();
  for(let i=0;i<6;i++)await page.locator('#addStation').click();
  await expect(page.locator('#addStation')).toBeDisabled();
});

for(const id of ['general','persistent','focus','rating'])test(`${id} keyboard save restores content after reload`, async({page},info)=>{
  const card=cards.find(c=>c.id===id);await openCard(page,card);await changeContent(page,card);
  await page.keyboard.press('Control+s');
  await expect(page.locator('.one-workspace-save-feedback')).toContainText(/暫存/);
  const saved=await artwork(page);await page.reload();
  await expect.poll(()=>artwork(page)).toBe(saved);
  await screenshot(page,info,id+'-saved-feedback');
});

for(const id of ['general','persistent'])test(`${id} file errors stay visible and cancel protects unsaved content`,async({page},info)=>{
  const card=cards.find(c=>c.id===id);await openCard(page,card);await changeContent(page,card);
  const current=await artwork(page);await files(page);
  await upload(page,page.locator('.one-workspace-native-files [data-action="load"],.one-workspace-native-files #loadJson'),{name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{broken')});
  await expect(page.locator('.one-workspace-project-feedback')).toBeVisible();
  await expect(page.locator('.one-workspace-project-feedback')).toContainText(/失敗|錯誤|無法/);
  expect(await artwork(page)).toBe(current);
  if(id==='general'){
    page.once('dialog',d=>d.dismiss());await page.locator('#reset').click();expect(await artwork(page)).toBe(current);
    await closeFiles(page);await page.keyboard.press('Control+s');await files(page,'history');
    page.once('dialog',d=>d.dismiss());await page.locator('[data-action="clear"]').click();
    await expect(page.locator('[data-action="restore"]')).toBeEnabled();await closeFiles(page);await files(page);
  }
  await screenshot(page,info,id+'-file-error-visible');
});

test('explanation direct edit, keyboard save, order limits and project round trip',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto('/O-Ne-Tools/explanation-card.html');
  await expect(page.locator('body')).toHaveClass(/one-workspace-v2/);
  await expect(page.locator('.title-line .badge')).toHaveText('READY');
  await page.evaluate(()=>document.fonts.ready);
  await expect(page.locator('#oneNoteReveal')).toBeHidden();
  await expect(page.locator('[data-order-action="up"]')).toBeDisabled();
  await expect(page.locator('[data-order-action="down"]')).toBeDisabled();
  await expect(page.locator('[data-order-action="del"]')).toBeDisabled();
  await page.locator('#oneOverlayOutline [data-overlay-block]').first().click();
  await page.locator('#wordPage .rich[data-kind="title"]').fill('全工具驗收');
  await page.keyboard.press('Control+s');
  await expect(page.locator('#oneSaveStatus')).toContainText(/暫存/);
  await expect(page.locator('#wordPage')).not.toHaveClass(/one-overlay-page/);
  await page.reload();await expect(page.locator('#oneOverlayOutline')).toContainText('全工具驗收');
  await page.getByRole('button',{name:'＋新增一項',exact:true}).click();
  await page.locator('#oneOverlayDone').click();
  await expect(page.locator('[data-order-action="up"]').first()).toBeDisabled();
  await expect(page.locator('[data-order-action="down"]').last()).toBeDisabled();
  await expect(page.locator('[data-order-action="up"]').last()).toBeEnabled();
  await page.locator('#sequenceEnabled').check();
  await expect(page.locator('#exportSequenceAll')).toHaveAttribute('aria-label','輸出全部 2 幕 PNG ZIP');
  const canvas=page.locator('#previewCanvas');
  const pixels=()=>canvas.evaluate(c=>c.toDataURL());
  const before=await pixels();
  await page.getByRole('button',{name:'專案檔案',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'專案檔案與本機暫存'});
  await expect(dialog).toBeVisible();
  const zip=await download(page,dialog.locator('[data-action="export-package"]'),info,'explanation-editable-project','zip');
  expect(Object.keys(zipEntries(zip.bytes)).some(n=>n.endsWith('.json'))).toBe(true);
  await page.locator('#resetAll').click();
  await upload(page,dialog.locator('[data-action="import-package"]'),zip.target);
  await dialog.getByRole('button',{name:'關閉',exact:true}).click();
  await expect.poll(pixels).toBe(before);
  await expect(page.locator('#exportSequenceAll')).toHaveAttribute('aria-label','輸出全部 2 幕 PNG ZIP');
  const png=await download(page,page.locator('#exportPng'),info,'explanation-restored-frame','png');assertPNG(png.bytes);
  await screenshot(page,info,'explanation-audit-desktop');
  await page.setViewportSize({width:390,height:844});await screenshot(page,info,'explanation-audit-mobile');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});
