'use strict';
// Homepage UX on the exact candidate. This test is purposely scoped to
// navigation, search, local recent state and layout, not native card renderers.
const {test,expect}=require('@playwright/test');
const registry=require('../one-tools-registry-v1.json');
const ready=registry.tools.filter(t=>t.status==='ready'&&t.href);

async function openHub(page){
  await page.goto('/O-Ne-Tools/index.html');
  await expect(page.locator('#statNum')).toHaveText(ready.length+' 個');
  await expect(page.locator('#grid .card')).toHaveCount(ready.length);
}
async function capture(page,info,name){
  const file=info.outputPath(name+'.png');
  await page.screenshot({path:file,fullPage:true,animations:'disabled'});
  await info.attach(name,{path:file,contentType:'image/png'});
}
async function noOverflow(page,label){
  const bounds=await page.evaluate(()=>{
    const root=document.documentElement;
    const viewport=document.documentElement.clientWidth;
    const oversized=[...document.querySelectorAll('.hero,.start-steps,.toolbar,.search,.search-clear,#grid,.card,.action,.recent,.recent-link')].filter(el=>{
      const r=el.getBoundingClientRect();
      return r.width>1 && (r.left < -1 || r.right > viewport + 1);
    }).slice(0,8).map(el=>({selector:el.className,rect:el.getBoundingClientRect().toJSON()}));
    return {viewport,documentWidth:root.scrollWidth,oversized};
  });
  expect(bounds.documentWidth,label+' document must not overflow horizontally').toBeLessThanOrEqual(bounds.viewport+1);
  expect(bounds.oversized,label+' interactive elements must remain onscreen').toEqual([]);
}

test('Maker Hub renders all 13 ready cards without planned placeholders',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await openHub(page);
  await expect(page.locator('#grid .card.ready')).toHaveCount(ready.length);
  await expect(page.locator('#grid .card.candidate')).toHaveCount(0);
  const actual=await page.locator('.card-title-row .title').allTextContents();
  expect(actual).toEqual(ready.map(t=>t.name));
  for(const card of ready){
    const link=page.locator('.card[data-tool-id="'+card.id+'"] .action.direct');
    await expect(link).toHaveAttribute('href',card.href);
    await expect(link).toBeVisible();
  }
  await expect(page.locator('html')).toHaveAttribute('data-registry-version',registry.version);
  await capture(page,info,'maker-hub-default-1366');
  expect(errors).toEqual([]);
});

test('Maker Hub search filters, Ctrl+K, slash, Escape, reset and grouped cards',async({page},info)=>{
  await openHub(page);
  const search=page.locator('#search'),cards=page.locator('#grid .card');
  await page.keyboard.press('Control+k');await expect(search).toBeFocused();
  await search.fill('評分');
  await expect(cards.filter({hasText:'評分卡'})).toHaveCount(1);
  await expect(cards).toHaveCount(1);
  await expect(page.locator('#resultsSummary')).toContainText('1 款');
  await capture(page,info,'maker-hub-search');
  await search.press('Escape');
  await expect(search).toBeEmpty(); await expect(cards).toHaveCount(ready.length);
  await page.locator('h1').click(); await page.keyboard.press('/');
  await expect(search).toBeFocused();
  await search.fill('完全不存在的卡片名稱zz');
  await expect(cards).toHaveCount(0);
  await expect(page.locator('.empty')).toContainText('沒有找到符合');
  await page.locator('#clearSearch').click();
  await expect(cards).toHaveCount(ready.length);
  const move=page.getByRole('button',{name:'路線／導航',exact:true});
  await move.click(); await expect(move).toHaveAttribute('aria-pressed','true');
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toHaveAttribute('data-tool-id','move');
  await capture(page,info,'maker-hub-filtered-navigation');
  await page.getByRole('button',{name:'全部',exact:true}).click();
  await expect(cards).toHaveCount(ready.length);
});

test('Maker Hub recent list tracks visits only locally and retains clickable destinations',async({page},info)=>{
  await openHub(page);
  await expect(page.locator('#recentSection')).toBeHidden();
  await page.locator('.card[data-tool-id="general"] .action.direct').click();
  await expect(page.locator('body')).toHaveAttribute('data-one-card-workspace','general');
  await page.goBack();await expect(page.locator('#recentSection')).toBeVisible();
  await expect(page.locator('.recent-link').first()).toContainText('一般卡');
  await page.locator('.card[data-tool-id="rating"] .action.direct').click();
  await expect(page.locator('body')).toHaveAttribute('data-one-card-workspace','rating');
  await page.goBack();await expect(page.locator('#recentSection')).toBeVisible();
  await expect(page.locator('.recent-link').first()).toContainText('評分卡');
  await expect(page.locator('.recent-link')).toHaveCount(2);
  await page.reload();await expect(page.locator('#recentSection')).toBeVisible();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('one-maker-recent-v1')));
  expect(saved.slice(0,2)).toEqual(['rating','general']);
  await capture(page,info,'maker-hub-recent-1366');
  await page.locator('.recent-link').first().click();
  await expect(page.locator('body')).toHaveAttribute('data-one-card-workspace','rating');
});

for(const width of [1920,1366,390]){
  test('Maker Hub responsive layout '+width+'px',async({page},info)=>{
    await page.setViewportSize({width,height:width===390?844:900});
    await openHub(page);
    await noOverflow(page,''+width+'px');
    const title=page.getByRole('heading',{name:/今天要做哪張/});
    await expect(title).toBeVisible();
    await expect(page.locator('#search')).toBeVisible();
    await expect(page.locator('#clearSearch')).toBeVisible();
    await capture(page,info,'maker-hub-'+width+'px');
    if(width===390){
      const first=page.locator('.card.ready').first();
      const a=first.locator('.action.direct');
      const b=await a.boundingBox(); expect(b.width).toBeGreaterThanOrEqual(115);
      expect(b.height).toBeGreaterThanOrEqual(44);
    }
  });
}
