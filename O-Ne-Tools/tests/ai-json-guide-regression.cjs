'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.join(__dirname, '..');
const guideSource = fs.readFileSync(path.join(root, 'ai-json-guide-v1.js'), 'utf8');
const packageSource = fs.readFileSync(path.join(root, 'project-package-v1.js'), 'utf8');

const context = {
  console, JSON, Blob, URL, Date, setTimeout, clearTimeout,
  navigator: {},
  document: {
    getElementById() { return null; },
    querySelector() { return null; },
    createElement(tag) {
      return {
        tagName: tag.toUpperCase(), className: '', innerHTML: '', textContent: '', value: '', style: {}, children: [],
        setAttribute() {}, appendChild(child) { this.children.push(child); return child; }, insertBefore() {}, remove() {}, select() {},
        querySelector() { return { textContent:'', onclick:null, classList:{toggle(){}} }; },
        classList: { contains(){return false;}, add(){}, toggle(){} }, click() {}
      };
    },
    head: { appendChild() {} }, body: { appendChild() {} }, execCommand() { return true; }
  }
};
context.window = context;
vm.createContext(context);
vm.runInContext(guideSource, context, { filename: 'ai-json-guide-v1.js' });

const guide = context.ONEAIJsonGuide;
assert(guide, 'AI JSON guide must load');
assert.strictEqual(guide.version, '1.3.1');
const ids = ['general-card','trigger-card','persistent-card','effect-card','move-card','choice-card','challenge-card','dialogue-card','rating-card','focus-card','explanation-card','thumbnail-frame','settlement-card'];
assert.deepStrictEqual(Object.keys(guide.guides), ids);
for (const id of ids) {
  const item = guide.guides[id];
  assert(item.name && item.file && item.example && Array.isArray(item.values), id + ' guide is incomplete');
  assert(!item.file.startsWith('O-Ne'), id + ' suggested filename must omit O-Ne prefix');
  assert(item.file.split('-').length >= 3, id + ' suggested filename must use category-title-state pattern');
  assert.doesNotThrow(() => JSON.stringify(item.example));
  const prompt = guide.prompt(id);
  assert(prompt.includes('UTF-8 的 .json 檔'), id + ' prompt must request a JSON file');
  assert(prompt.includes('只輸出「純 JSON 原文」'), id + ' prompt must define raw JSON fallback');
  assert(prompt.includes('不要使用 ```json 程式碼框'), id + ' prompt must reject markdown fences');
  assert(prompt.includes(item.file), id + ' prompt must include the suggested filename');
}
assert.strictEqual(guide.example('trigger-card').component_id, 'TRIGGER-CARD');
assert.strictEqual(guide.example('trigger-card').formal_ref, 'TRIGGER-CARD');
assert.strictEqual(guide.example('persistent-card').component_id, 'PERSISTENT-MISSION');
assert.strictEqual(guide.example('move-card').component_id, 'NAV-01');
assert.strictEqual(guide.example('choice-card').component_id, 'SELECT-CARD');
assert.strictEqual(guide.example('dialogue-card').component_id, 'DIALOGUE-CARD');
assert.strictEqual(guide.example('rating-card').component_id, 'COL-02');
assert.strictEqual(guide.guides['focus-card'].version, 'V0.5.15');
assert.strictEqual(guide.example('focus-card').images.right.fit, 'free');
assert.strictEqual(guide.example('focus-card').images.right.cropWidth, 76);
assert(guide.guides['focus-card'].values.some(value => value.includes('cropX／cropY／cropWidth／cropHeight')));
assert.strictEqual(guide.example('thumbnail-frame').component_id, 'THUMBNAIL-FRAME');
assert.strictEqual(guide.example('settlement-card').component_id, 'QST-03');
assert.strictEqual(guide.example('move-card').segments.length, guide.example('move-card').stations.length - 1);
assert.strictEqual(guide.guides['explanation-card'].version, 'V0.4.8');
assert.strictEqual(guide.example('explanation-card').status, 'READY');
assert.strictEqual(guide.example('explanation-card').data.mode, 'gallery');
assert.strictEqual(guide.example('explanation-card').data.gallery.layout, 'triple');
assert.strictEqual(guide.example('explanation-card').data.gallery.slots.length, 4);
assert.strictEqual(guide.example('explanation-card').data.gallery.slots[0].fit, 'free');
assert.strictEqual(guide.example('explanation-card').data.gallery.slots[0].cropWidth, 70);
assert(guide.guides['explanation-card'].values.some(value => value.includes('single／split／triple／hero-right／hero-bottom／grid')));
assert(guide.guides['explanation-card'].values.some(value => value.includes('cropX／cropY／cropWidth／cropHeight')));
assert(guide.guides['explanation-card'].values.some(value => value.includes('不使用第二層圖片框')));
assert(guide.guides['explanation-card'].values.some(value => value.includes('image.verticalAlign：top／center／bottom')));
assert(guide.guides['explanation-card'].values.some(value => value.includes('cover 仍會自動放大到填滿左欄')));
assert(guide.guides['explanation-card'].values.some(value => value.includes('sequence.visibleCount')));
assert(guide.guides['explanation-card'].values.some(value => value.includes('不改卡片尺寸、左圖框')));
for (const id of ['rating-card','focus-card','explanation-card','thumbnail-frame','settlement-card']) {
  assert.strictEqual(guide.guides[id].image, true, id + ' must warn that image binaries require project ZIP');
  if (id === 'explanation-card') assert(guide.prompt(id).includes('完整專案 ZIP') && guide.prompt(id).includes('.onecard'), id + ' must mention the primary ZIP and compatible .onecard formats');
  else assert(guide.prompt(id).includes('專案 ZIP'), id + ' must mention project ZIP for image handoff');
}
assert(guideSource.includes('給 AI 的 JSON 格式'));
assert(guideSource.includes('複製完整 AI 指令'));
assert(guideSource.includes('複製 JSON 範例'));
assert(guideSource.includes('下載 JSON 範例'));
assert(guideSource.includes('ONEAfterEditDock.place'), 'guide must use the shared collapsed completion dock');
assert(guideSource.includes('<details><summary>JSON 範例｜需要時再展開'), 'large JSON preview must be closed by default');
assert(!guideSource.includes('<details open>'), 'large JSON preview must not consume initial editor space');
assert(guideSource.includes('ONEEditBackup.__aiJsonGuideWrapped'), 'shared edit-backup tools must mount the AI guide');
assert(guideSource.includes('ONEProjectPackage.__aiJsonGuideWrapped'), 'persistent/project-package path must mount the AI guide');
assert(packageSource.includes('ai-json-guide-v1.js?v=1310'), 'project package must synchronously load the cache-busted AI JSON guide');
new Function(guideSource);
console.log('PASS: 13 AI JSON schemas, raw JSON handoff instructions, image ZIP notes, completion-dock placement and syntax.');
