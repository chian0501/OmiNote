'use strict';
const { test, expect } = require('@playwright/test');

async function openGallery(page) {
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/O-Ne-Tools/explanation-card.html');
  await expect(page.locator('body')).toHaveClass(/one-workspace-v2/);
  await page.locator('#galleryMode').click();
  await expect(page.locator('#galleryEditor')).toBeVisible();
}
const galleryState = page => page.evaluate(() => window.__ONE_V040__.getState().gallery);
async function sampleImages(page, count) {
  const data = await page.evaluate(count => Array.from({length:count}, (_,i) => {
    const c=document.createElement('canvas');c.width=480;c.height=320;const x=c.getContext('2d');
    x.fillStyle=`hsl(${i*36},70%,45%)`;x.fillRect(0,0,480,320);x.fillStyle='#fff';x.font='bold 100px sans-serif';x.fillText(String(i+1),180,190);
    return c.toDataURL().split(',')[1];
  }),count);
  return data.map((data,i)=>({name:`image-${i+1}.png`,mimeType:'image/png',buffer:Buffer.from(data,'base64')}));
}

test('gallery grows independently to ten, changes layouts, removes and restores slots',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await openGallery(page);
  for(let i=1;i<10;i++)await page.locator('#galleryAddImage').click();
  await expect(page.locator('#gallerySlots .gallery-slot')).toHaveCount(10);
  await expect(page.locator('#galleryAddImage')).toBeDisabled();
  await page.locator('#galleryColumns').selectOption('3');
  expect((await galleryState(page)).count).toBe(10);
  await page.locator('#galleryLayoutsProxy [data-gallery-layout="hero"]').click();
  expect((await galleryState(page)).count).toBe(10);
  await page.locator('[data-gallery-index="9"] .gallery-thumb').click();
  await page.locator('[data-gallery-remove="9"]').click();
  await expect(page.locator('#gallerySlots .gallery-slot')).toHaveCount(9);
  await page.locator('#galleryUndo').click();
  await expect(page.locator('#gallerySlots .gallery-slot')).toHaveCount(10);
  await page.locator('#galleryRedo').click();
  await expect(page.locator('#gallerySlots .gallery-slot')).toHaveCount(9);
  await page.locator('#galleryEditor').screenshot({path:info.outputPath('gallery-nine-controls.png')});
  expect(errors).toEqual([]);
});

test('ten gallery images retain crops, order, divider sizes and PNG through project ZIP',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await openGallery(page);
  const images=await sampleImages(page,10);
  await page.locator('#galleryBatchInput').setInputFiles(images);
  await expect(page.locator('#galleryCount')).toContainText('已放 10 張');
  const stateBefore=await galleryState(page);
  await page.locator('#galleryBatchInput').setInputFiles(images.slice(0,1));
  await expect(page.locator('#toast')).toContainText('未加入任何圖片');
  expect(await galleryState(page)).toEqual(stateBefore);
  await page.locator('#galleryColumns').selectOption('3');
  const divider=page.locator('.gallery-divider.x').first();await expect(divider).toBeVisible();
  const box=await divider.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.down();await page.mouse.move(box.x+box.width/2+35,box.y+box.height/2,{steps:5});await page.mouse.up();
  expect(Object.keys((await galleryState(page)).weights).length).toBeGreaterThan(0);
  await page.locator('[data-gallery-fit="0"]').selectOption('cover');
  await page.locator('[data-gallery-focus-x="0"]').evaluate(el=>{el.value='30';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.locator('#galleryFile0').setInputFiles({...images[0],name:'replacement.png'});
  await expect(page.locator('[data-gallery-index="0"]')).toContainText('replacement.png');
  expect((await galleryState(page)).slots[0].focusX).toBe(30);
  await page.locator('[data-gallery-action="down"][data-index="0"]').click();
  expect((await galleryState(page)).slots[1].name).toBe('replacement.png');
  expect((await galleryState(page)).slots[1].focusX).toBe(30);
  // A click on the actual rendered image must locate its own settings card.
  const hit=await page.locator('#previewCanvas').evaluate(c=>{
    const r=c.getBoundingClientRect();return{x:r.x+r.width*.85,y:r.y+r.height*.55};
  });await page.mouse.click(hit.x,hit.y);
  await expect(page.locator('.gallery-slot.is-selected')).toHaveCount(1);
  const snap=await galleryState(page);
  const pixels=()=>page.locator('#previewCanvas').evaluate(c=>c.toDataURL());
  const before=await pixels();
  await page.getByRole('button',{name:'專案檔案',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'專案檔案與本機暫存'});
  const downloading=page.waitForEvent('download');await dialog.locator('[data-action="export-package"]').click();
  const download=await downloading,zipPath=info.outputPath('gallery-ten.project.zip');await download.saveAs(zipPath);
  await dialog.getByRole('button',{name:'關閉',exact:true}).click();
  await page.locator('.gallery-slot.is-selected [data-gallery-remove]').click();
  await page.getByRole('button',{name:'專案檔案',exact:true}).click();
  await dialog.locator('[data-one-project-package-ui] input[type="file"]').setInputFiles(zipPath);
  await expect(dialog.locator('.one-project-package__status')).toContainText('載入成功');
  await dialog.getByRole('button',{name:'關閉',exact:true}).click();
  await expect.poll(galleryState.bind(null,page)).toEqual(snap);
  await expect.poll(pixels).toBe(before);
  await expect(page.locator('#galleryCount')).toContainText('已放 10 張');
  const pngDownload=page.waitForEvent('download');await page.locator('#exportPng').click();
  const png=await pngDownload;await png.saveAs(info.outputPath('gallery-ten-export.png'));
  await page.screenshot({path:info.outputPath('gallery-ten-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:info.outputPath('gallery-ten-mobile.png'),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test('legacy four-slot files keep hidden images and copy/remove undo is lossless',async({page})=>{
  await openGallery(page);const images=await sampleImages(page,4);
  await page.locator('#galleryBatchInput').setInputFiles(images);
  await expect(page.locator('#galleryCount')).toContainText('已放 4 張');
  await page.evaluate(async()=>{
    const p=window.__ONE_V049__.projectPayload();delete p.data.gallery.count;
    delete p.data.gallery.columns;delete p.data.gallery.weights;p.data.gallery.layout='split';
    p.data.gallery.slots=p.data.gallery.slots.slice(0,4);p.assets.gallery=p.assets.gallery.slice(0,4);
    await window.__ONE_V049__.loadProjectPayload(p);
  });
  await expect(page.locator('#gallerySlots .gallery-slot')).toHaveCount(2);
  await page.locator('#galleryAddImage').click();await page.locator('#galleryAddImage').click();
  await expect(page.locator('#galleryCount')).toContainText('已放 4 張');
  await page.locator('[data-gallery-action="duplicate"][data-index="3"]').click();
  await expect(page.locator('#galleryCount')).toContainText('已放 5 張');
  await page.locator('#galleryUndo').click();await expect(page.locator('#galleryCount')).toContainText('已放 4 張');
  await page.locator('#galleryRedo').click();await expect(page.locator('#galleryCount')).toContainText('已放 5 張');
});

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
