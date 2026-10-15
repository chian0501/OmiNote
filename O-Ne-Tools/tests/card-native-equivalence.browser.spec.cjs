'use strict';
// Pixel-equivalence against SAME main commit: independent of the older
// artwork-approval snapshot. This does not authorize a new artwork baseline.
const {test,expect} = require('@playwright/test');
const crypto = require('node:crypto');
const cards = [
  ['一般卡','general-card.html'],
  ['觸發卡','trigger-card.html'],
  ['常駐卡','persistent-card.html'],
  ['效果卡','effect-card.html'],
  ['移動卡','move-card.html'],
  ['選項卡','choice-card.html'],
  ['挑戰卡','challenge-card.html'],
  ['對話卡','dialogue-card-v135.html'],
  ['評分卡','rating-card.html'],
  ['焦點內容卡','focus-card.html'],
  ['說明卡','explanation-card.html'],
  ['縮圖品牌框','thumbnail-frame.html'],
  ['片尾結算卡','settlement-card.html']
];
const selector='.preview-wrap canvas,.stage canvas,.preview-canvas';

async function fingerprint(page,url) {
  await page.goto(url);
  const canvas=page.locator(selector).first();
  await expect(canvas).toBeVisible();
  await page.evaluate(()=>document.fonts.ready);
  let previous='';
  await expect.poll(async()=>{
    const data=await canvas.evaluate(c=>c.toDataURL('image/png'));
    const current=crypto.createHash('sha256').update(data).digest('hex');
    const stable=current===previous;
    previous=current;
    return stable;
  },{intervals:[300,400,600],timeout:15000}).toBe(true);
  return canvas.evaluate(c=>({width:c.width,height:c.height,
    data:c.toDataURL('image/png')}));
}

for(const [name,file] of cards) {
  test(name+' unchanged native Canvas pixels versus CURRENT main',async({browser})=>{
    const main=await browser.newPage();
    const candidate=await browser.newPage();
    try {
      const before=await fingerprint(main,'/main/O-Ne-Tools/'+file);
      const after=await fingerprint(candidate,'/O-Ne-Tools/'+file);
      expect([after.width,after.height],name+' canvas geometry').toEqual([before.width,before.height]);
      expect(
        crypto.createHash('sha256').update(after.data).digest('hex'),
        name+' source-main artwork pixels must match exactly'
      ).toBe(crypto.createHash('sha256').update(before.data).digest('hex'));
    } finally {await main.close();await candidate.close();}
  });
}
