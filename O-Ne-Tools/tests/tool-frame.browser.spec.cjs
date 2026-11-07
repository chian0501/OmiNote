'use strict';
const { test, expect } = require('@playwright/test');
const registry = require('../one-tools-registry-v1.json');

const tools = [
  ['general', 'general-card'], ['trigger', 'trigger-card'], ['persistent', 'persistent-card'], ['effect', 'effect-card'],
  ['move', 'move-card'], ['choice', 'choice-card'], ['challenge', 'challenge-card'], ['dialogue', 'dialogue-card-v135'],
  ['rating', 'rating-card'], ['focus', 'focus-card'], ['thumbnail-frame', 'thumbnail-frame'], ['settlement', 'settlement-card']
];
const ready = registry.tools.filter(tool => tool.status === 'ready' && tool.href);
const multiOutput = { move: '輸出全部 PNG（2 張）', choice: /^輸出全部 PNG（\d+ 張）$/ };
const oldNames = ['專案檔案', 'AI 格式', '使用說明', '回工具入口', '下載專案', '載入專案', '載入 JSON', '輸出透明', '下載透明',
  '輸出欄位 JSON', '輸出設定 JSON', '下載設定 JSON', '下載 JSON', '重設目前內容', '輸出整組', '僅下載目前', '輸出含字 PNG', '下載兩版'];

async function open(page, file) {
  await page.goto(`/O-Ne-Tools/${file}.html`);
  await expect(page.locator('body')).toHaveAttribute('data-one-workspace-ready', '1');
  await expect(page.locator('.one-workspace-switch select')).toBeVisible();
  await expect(page.locator('[data-one-project-quick="download"]')).toBeVisible();
}

for (const [id, file] of tools) {
  const entry = registry.tools.find(tool => tool.id === id);

  test(`${id} uses the shared names and places`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await open(page, file);
    await expect(page.locator('.one-workspace-home')).toHaveText('← 工具入口');
    await expect(page.locator('.one-workspace-header-actions button')).toHaveText(['暫存', '檔案', '？']);
    await expect(page.locator('.one-workspace-switch select option')).toHaveCount(ready.length);
    await expect(page.locator('.one-workspace-switch select option:checked')).toHaveText(entry.name);
    await expect(page.locator('.one-workspace-guide span')).toHaveText(entry.guide.summary);
    await expect(page.locator('.one-workspace-guide a')).toHaveCount(entry.guide.references && entry.guide.references.length ? 1 : 0);

    const outputs = page.locator(id === 'focus' ? '.export-actions .export-button:visible' : '.one-workspace-export-actions button:visible,.one-workspace-export-actions a:visible');
    const names = (await outputs.allInnerTexts()).map(text => text.split('\n')[0].trim());
    if (multiOutput[id]) expect(names[0]).toMatch(multiOutput[id]);
    else if (id === 'focus') {
      const main = await page.locator('.export-button.primary').boundingBox();
      const empty = await page.locator('.export-button.outline').first().boundingBox();
      expect(names).toContain('輸出 PNG');
      expect(main.x).toBeLessThan(empty.x);
    } else expect(names[0]).toBe('輸出 PNG');
    expect(names).toContain('存專案 ZIP');
    expect(names).toContain('開專案 ZIP');

    await page.locator('.one-workspace-header-actions').getByRole('button', { name: '檔案', exact: true }).click();
    await expect(page.locator('.one-workspace-file-tab')).toHaveText(['專案', '暫存紀錄', '批次輸出', 'AI', '說明']);
    await expect(page.locator('.one-workspace-native-files').getByRole('button', { name: '匯出 JSON', exact: true })).toBeVisible();
    await expect(page.locator('.one-workspace-native-files').getByRole('button', { name: '匯入 JSON', exact: true })).toBeVisible();

    // 按鈕、連結與分頁不得留舊名；內文提到「暫存目前內容」也要跟按鈕同名。AI 範例下載是另一個功能。
    const controls = await page.evaluate(() => [...document.querySelectorAll('button,a,[role=tab]')]
      .filter(node => !node.closest('.app-header') && !node.closest('[data-one-ai-json-guide]'))
      .map(node => node.textContent.trim()));
    for (const name of oldNames) expect(controls.filter(text => text.includes(name)), `${id} still says ${name}`).toEqual([]);
    const prose = await page.evaluate(() => [...document.querySelectorAll('.one-edit-backup__note,.one-edit-backup__status,#historyStatus,.note')].map(node => node.textContent).join(''));
    expect(prose).not.toContain('「暫存目前內容」');
    expect(errors).toEqual([]);
  });

  test(`${id} accepts pasted AI JSON`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await open(page, file);
    const toolId = entry.tool_id;
    const payload = await page.evaluate(key => window.ONEAIJsonGuide.example(key), toolId);
    expect(payload).toBeTruthy();
    await page.locator('.one-workspace-header-actions').getByRole('button', { name: '檔案', exact: true }).click();
    await page.getByRole('tab', { name: 'AI', exact: true }).click();
    const box = page.locator('.one-workspace-ai-paste');
    await box.locator('textarea').fill('{ not json');
    await box.getByRole('button', { name: '套用到字卡' }).click();
    await expect(box.locator('[role=status]')).toContainText('JSON 格式錯誤');
    await box.locator('textarea').fill(JSON.stringify(payload));
    await box.getByRole('button', { name: '套用到字卡' }).click();
    await expect(box.locator('[role=status]')).toContainText('成功');
    expect(page.url()).toContain(file);
    expect(errors).toEqual([]);
  });
}

for (const file of ['general-card', 'persistent-card']) {
  test(`${file} shows why pasted JSON was rejected`, async ({ page }) => {
    await open(page, file);
    await page.locator('.one-workspace-header-actions').getByRole('button', { name: '檔案', exact: true }).click();
    await page.getByRole('tab', { name: 'AI', exact: true }).click();
    await page.locator('.one-workspace-ai-paste textarea').fill(JSON.stringify({ schema: 'o-ne.card.canonical.v1', tool_id: 'nobody' }));
    await page.getByRole('button', { name: '套用到字卡' }).click();
    await expect(page.locator('.one-workspace-ai-paste [role=status]')).not.toHaveText('正在套用…');
    await expect(page.locator('.one-workspace-ai-paste [role=status]')).toHaveClass(/is-error/);
  });
}

test('pasted COST JSON changes the general card mode', async ({ page }) => {
  await open(page, 'general-card');
  const payload = await page.evaluate(() => window.ONEAIJsonGuide.example('general-card'));
  payload.card.mode = 'COST';
  payload.card.variant = 'COST';
  payload.content.title = '門票';
  payload.content.subtitle = 'NT$ 100';
  await page.locator('.one-workspace-header-actions').getByRole('button', { name: '檔案', exact: true }).click();
  await page.getByRole('tab', { name: 'AI', exact: true }).click();
  await page.locator('.one-workspace-ai-paste textarea').fill(JSON.stringify(payload));
  await page.getByRole('button', { name: '套用到字卡' }).click();
  await expect(page.locator('#mode')).toHaveValue('COST');
});

test('saved card content never includes the frame controls', async ({ page }) => {
  await open(page, 'trigger-card');
  await page.locator('.one-workspace-save').click();
  await expect(page.locator('.one-workspace-save-feedback')).toContainText('已暫存');
  const fields = await page.evaluate(() => JSON.stringify(window.ONEEditBackup.captureFields()));
  expect(fields).not.toContain('card.html');
  await page.locator('.one-workspace-header-actions').getByRole('button', { name: '檔案', exact: true }).click();
  await page.getByRole('tab', { name: '暫存紀錄', exact: true }).click();
  await page.locator('#one-workspace-files [data-action="restore"]').click();
  await expect(page.locator('#one-workspace-files')).toBeVisible();
  expect(page.url()).toContain('trigger-card');
});

test('switching cards goes straight when nothing is unsaved', async ({ page }) => {
  await open(page, 'general-card');
  await expect(page.locator('.one-workspace-save-feedback')).not.toContainText('尚未暫存');
  await page.locator('.one-workspace-switch select').selectOption({ label: '常駐卡' });
  await expect(page).toHaveURL(/persistent-card\.html/);
});

test('switching cards asks first when there are unsaved edits', async ({ page }) => {
  await open(page, 'general-card');
  await page.locator('#title').fill('還沒暫存');
  await expect(page.locator('.one-workspace-save-feedback')).toContainText('尚未暫存');
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('.one-workspace-switch select').selectOption({ label: '常駐卡' });
  await expect(page).toHaveURL(/general-card\.html/);
  await expect(page.locator('.one-workspace-switch select option:checked')).toHaveText('一般卡');
  await expect(page.locator('#title')).toHaveValue('還沒暫存');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('.one-workspace-switch select').selectOption({ label: '常駐卡' });
  await expect(page).toHaveURL(/persistent-card\.html/);
});

test('opening a card from a mode link is not an unsaved edit', async ({ page }) => {
  await page.goto('/O-Ne-Tools/general-card.html?mode=COST');
  await expect(page.locator('.one-workspace-switch select')).toBeVisible();
  await expect(page.locator('#mode')).toHaveValue('COST');
  await expect(page.locator('.one-workspace-save-feedback')).not.toContainText('尚未暫存');
  await page.locator('.one-workspace-switch select').selectOption({ label: '常駐卡' });
  await expect(page).toHaveURL(/persistent-card.html/);
});

test('changing the mode by hand after a mode link still counts as an edit', async ({ page }) => {
  await page.goto('/O-Ne-Tools/general-card.html?mode=COST');
  await expect(page.locator('#mode')).toHaveValue('COST');
  await page.locator('#mode').selectOption('GET');
  await expect(page.locator('.one-workspace-save-feedback')).toContainText('尚未暫存');
});

test('choosing a card in the switcher does not mark the card as edited', async ({ page }) => {
  await open(page, 'general-card');
  await page.locator('.one-workspace-switch select').evaluate(select => select.dispatchEvent(new Event('input', { bubbles: true })));
  await expect(page.locator('.one-workspace-save-feedback')).not.toContainText('尚未暫存');
});

test('the explanation card uses the shared names and tabs', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const entry = registry.tools.find(tool => tool.id === 'explanation');
  await page.goto('/O-Ne-Tools/explanation-card.html');
  await expect(page.locator('.one-workspace-switch select')).toBeVisible();
  await expect(page.locator('.back-link')).toHaveText('← 工具入口');
  await expect(page.locator('.one-project-actions button')).toHaveText(['暫存', '檔案', '內容清單', '？']);
  await expect(page.locator('.one-workspace-switch select option:checked')).toHaveText(entry.name);
  await expect(page.locator('.one-workspace-guide span')).toHaveText(entry.guide.summary);
  await expect(page.locator('#exportPng')).toHaveText('輸出 PNG');
  await expect(page.locator('[data-one-project-quick="download"]')).toHaveText('存專案 ZIP');
  await expect(page.locator('[data-one-project-quick="upload"]')).toHaveText('開專案 ZIP');
  await page.getByRole('button', { name: '檔案', exact: true }).click();
  const dialog = page.locator('#oneProjectDialog');
  await expect(dialog.getByRole('tab')).toHaveText(['專案', '暫存紀錄', '批次輸出', 'AI', '說明']);
  await expect(dialog.locator('[data-one-project-package-ui]')).toBeVisible();
  await expect(dialog.locator('[data-one-backup-ui]')).toBeHidden();
  await dialog.getByRole('tab', { name: '暫存紀錄', exact: true }).click();
  await expect(dialog.locator('[data-one-backup-ui]')).toBeVisible();
  await expect(dialog.locator('[data-one-backup-ui] [data-action="load"]')).toHaveText('匯入 JSON');
  await dialog.getByRole('tab', { name: '批次輸出', exact: true }).click();
  await expect(dialog.locator('[data-one-batch-render-ui]')).toBeVisible();
  await dialog.getByRole('tab', { name: 'AI', exact: true }).click();
  await expect(dialog.locator('[data-one-ai-json-guide]')).toBeVisible();
  const payload = await page.evaluate(() => window.ONEAIJsonGuide.example('explanation-card'));
  await dialog.locator('.one-workspace-ai-paste textarea').fill(JSON.stringify(payload));
  await dialog.getByRole('button', { name: '套用到字卡' }).click();
  await expect(dialog.locator('.one-workspace-ai-feedback')).toContainText('成功');
  await dialog.getByRole('tab', { name: '說明', exact: true }).click();
  await expect(dialog.locator('.one-frame-help')).toBeVisible();
  await dialog.getByRole('button', { name: '關閉', exact: true }).click();
  await page.getByRole('button', { name: '使用說明' }).or(page.locator('.one-project-actions button').last()).first().click();
  await expect(dialog.locator('.one-frame-help')).toBeVisible();
  expect(errors).toEqual([]);
});

test('the explanation card keeps its sequence output names when steps are on', async ({ page }) => {
  await page.goto('/O-Ne-Tools/explanation-card.html');
  await expect(page.locator('.one-workspace-switch select')).toBeVisible();
  await page.getByRole('button', { name: '＋ 新增項目', exact: true }).click();
  await page.locator('#oneOverlayDone').click();
  await page.locator('#sequenceEnabled').check();
  await expect(page.locator('#exportPng')).toHaveText('只輸出目前畫面');
  await expect(page.locator('#exportSequenceAll')).toHaveText(/^輸出全部 PNG（\d+ 張）$/);
});

test('editing the explanation card makes the switcher ask first', async ({ page }) => {
  await page.goto('/O-Ne-Tools/explanation-card.html');
  await expect(page.locator('.one-workspace-switch select')).toBeVisible();
  await page.getByRole('button', { name: '＋ 新增項目', exact: true }).click();
  await page.locator('#oneOverlayDone').click();
  await page.locator('#sequenceEnabled').check();
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('.one-workspace-switch select').selectOption({ label: '一般卡' });
  await expect(page).toHaveURL(/explanation-card\.html/);
});

for (const [link, file] of [['general-card.html?open=ai', 'general'], ['dialogue-card.html?v=141&open=ai', 'dialogue'], ['focus-card.html?open=ai', 'focus']]) {
  test(`${file} opens on the AI tab from a link`, async ({ page }) => {
    await page.goto('/O-Ne-Tools/' + link);
    await expect(page.locator('#one-workspace-files')).toBeVisible();
    await expect(page.locator('#one-workspace-tab-ai')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.one-workspace-ai-paste textarea')).toBeVisible();
  });
}

test('the explanation card opens on the AI tab from a link', async ({ page }) => {
  await page.goto('/O-Ne-Tools/explanation-card.html?open=ai');
  await expect(page.locator('#oneProjectDialog')).toBeVisible();
  await expect(page.locator('#oneProjectDialog .one-workspace-ai-paste textarea')).toBeVisible();
});

test('the old AI assistant address reaches the AI tab', async ({ page }) => {
  await page.goto('/O-Ne-Tools/ai-card.html?tool=general&v=12');
  await expect(page).toHaveURL(/general-card\.html\?open=ai/);
  await expect(page.locator('.one-workspace-ai-paste textarea')).toBeVisible();
  await page.goto('/O-Ne-Tools/ai-card.html');
  await expect(page.locator('h1')).toContainText('這段你想告訴觀眾');
});

test('every homepage card links to its AI tab', async ({ page }) => {
  await page.goto('/O-Ne-Tools/index.html');
  await expect(page.locator('a:has-text("AI 助手")')).toHaveCount(ready.length);
  await expect(page.locator('a[href*="ai-card"]')).toHaveCount(0);
});

for (const [file, select, values] of [
  ['trigger-card', 'state', ['EVENT', 'DONE', 'FAIL']],
  ['persistent-card', 'state', ['MISSION', 'DONE', 'FAIL']],
  ['effect-card', 'stateText', ['BUFF', 'DEBUFF']],
  ['move-card', 'previewState', ['white', 'orange']]
]) {
  test(`${file} picks its state with buttons`, async ({ page }) => {
    await open(page, file);
    const buttons = page.locator('.one-workspace-segments button');
    await expect(buttons).toHaveCount(values.length);
    const artwork = () => page.locator('.one-workspace-canvas').first().evaluate(c => c.toDataURL());
    const before = await artwork();
    await buttons.nth(1).click();
    await expect(page.locator('#' + select)).toHaveValue(values[1]);
    await expect(buttons.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(buttons.nth(0)).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(artwork).not.toBe(before);
    await expect(page.locator('.one-workspace-save-feedback')).toContainText('尚未暫存');
  });
}

test('a saved state shows on the buttons after a reload', async ({ page }) => {
  await open(page, 'persistent-card');
  await page.locator('.one-workspace-segments button').nth(2).click();
  await page.locator('.one-workspace-save').click();
  await expect(page.locator('.one-workspace-save-feedback')).toContainText('已暫存');
  await page.reload();
  await expect(page.locator('#state')).toHaveValue('FAIL');
  await expect(page.locator('.one-workspace-segments button').nth(2)).toHaveAttribute('aria-pressed', 'true');
});

test('a card with four or more modes keeps its dropdown', async ({ page }) => {
  await open(page, 'general-card');
  await expect(page.locator('.one-workspace-segments')).toHaveCount(0);
  await expect(page.locator('#mode')).toBeVisible();
  await expect(page.locator('#mode')).not.toHaveClass(/one-workspace-segment-source/);
});

test('rows use the same add and delete names', async ({ page }) => {
  await open(page, 'move-card');
  await expect(page.locator('#addStation')).toHaveText('＋ 新增站點');
  await open(page, 'rating-card');
  await expect(page.locator('.remove-rating').first()).toHaveText('刪除');
  await page.locator('#addRating').dispatchEvent('click');
  await expect(page.locator('.remove-rating').last()).toHaveText('刪除');
  await open(page, 'settlement-card');
  await expect(page.locator('.row-remove').first()).toHaveText('刪除');
  await page.locator('#addRow').dispatchEvent('click');
  await expect(page.locator('.row-remove').last()).toHaveText('刪除');
});

test('the tool still works when the card list cannot load', async ({ page }) => {
  await page.route('**/one-tools-registry-v1.json*', route => route.abort());
  await page.goto('/O-Ne-Tools/general-card.html');
  await expect(page.locator('body')).toHaveAttribute('data-one-workspace-ready', '1');
  await expect(page.locator('.one-workspace-switch')).toBeHidden();
  await expect(page.locator('.one-workspace-guide')).toBeHidden();
  await expect(page.locator('#download')).toHaveText('輸出 PNG');
});

test('the output button keeps its name after a tool changes its text', async ({ page }) => {
  await open(page, 'choice-card');
  await page.locator('#addOption').click();
  await expect(page.locator('#downloadSet')).toHaveText(/^輸出全部 PNG（\d+ 張）$/);
});

test('the focus sequence button counts its frames', async ({ page }) => {
  await open(page, 'focus-card');
  await page.getByRole('button', { name: '項目', exact: true }).first().click();
  await page.locator('.focus-sequence-toggle input').check();
  const frames = await page.locator('.focus-sequence-navigation select option').count();
  await expect(page.locator('.focus-sequence-toolbar > button').filter({ hasText: '輸出全部' })).toHaveText(`輸出全部 PNG（${frames} 張）`);
});

test('phone header stays inside the screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, 'general-card');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});
