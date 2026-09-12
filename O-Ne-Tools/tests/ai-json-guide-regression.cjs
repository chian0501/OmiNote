'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.join(__dirname, '..');
const guideSource = fs.readFileSync(path.join(root, 'ai-json-guide-v1.js'), 'utf8');
const canonicalSource = fs.readFileSync(path.join(root, 'card-canonical-v1.js'), 'utf8');

const context = {
  console, JSON, Blob, URL, Date, Promise, setTimeout, clearTimeout,
  navigator: {},
  document: {
    readyState: 'complete',
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    createElement(tag) {
      return {
        tagName: tag.toUpperCase(), id:'', src:'', className: '', innerHTML: '', textContent: '', value: '', style: {}, children: [], files: [],
        setAttribute() {}, getAttribute(){return null;}, appendChild(child) { this.children.push(child); return child; }, insertBefore() {}, remove() {}, select() {}, addEventListener() {},
        querySelector(selector) {
          if (selector === 'pre') return { textContent:'' };
          return { textContent:'', onclick:null, classList:{toggle(){}} };
        },
        classList: { contains(){return false;}, add(){}, toggle(){} }, click() {}
      };
    },
    head: { appendChild() {} }, body: { appendChild() {}, getAttribute(){return null;} }, execCommand() { return true; }
  }
};
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(canonicalSource, context, { filename: 'card-canonical-v1.js' });
vm.runInContext(guideSource, context, { filename: 'ai-json-guide-v1.js' });

const guide = context.ONEAIJsonGuide;
const canonical = context.ONE_CARD_CANONICAL;
assert(guide, 'AI JSON guide must load');
assert(canonical, 'Canonical adapter must load');
assert.strictEqual(guide.version, '1.4.0');
assert.strictEqual(guide.schema, 'o-ne.card.canonical.v1');
const ids = ['general-card','trigger-card','persistent-card','effect-card','move-card','choice-card','challenge-card','dialogue-card','rating-card','focus-card','explanation-card','thumbnail-frame','settlement-card'];
assert.deepStrictEqual(Object.keys(guide.guides), ids);
for (const id of ids) {
  const item = guide.guides[id];
  assert(item.name && item.file && item.example && Array.isArray(item.values), id + ' guide is incomplete');
  assert(!item.file.startsWith('O-Ne'), id + ' suggested filename must omit O-Ne prefix');
  assert(item.file.endsWith('.card.json'), id + ' must use canonical .card.json suffix');
  const example = guide.example(id);
  assert.strictEqual(example.schema, 'o-ne.card.canonical.v1', id + ' must emit canonical schema');
  assert.strictEqual(example.schema_version, '1.0', id + ' must emit canonical version');
  assert.strictEqual(example.tool_id, id, id + ' tool id mismatch');
  assert.strictEqual(example.meta.status, 'DRAFT', id + ' AI content must remain DRAFT');
  assert.deepStrictEqual(canonical.validate(example), [], id + ' canonical example invalid');
  assert.doesNotThrow(() => canonical.toNative(example), id + ' canonical example must adapt to native');
  const prompt = guide.prompt(id);
  assert(prompt.includes('UTF-8 的 .json 檔'), id + ' prompt must request a JSON file');
  assert(prompt.includes('只輸出「純 JSON 原文」'), id + ' prompt must define raw JSON fallback');
  assert(prompt.includes('不要使用 ```json 程式碼框'), id + ' prompt must reject markdown fences');
  assert(prompt.includes('o-ne.card.canonical.v1'), id + ' prompt must force canonical schema');
  assert(prompt.includes('meta.status 固定 DRAFT'), id + ' prompt must keep AI result draft');
  assert(prompt.includes(item.file), id + ' prompt must include the suggested filename');
  const nativePayload = guide.prepareImport(id, example);
  assert(nativePayload && typeof nativePayload === 'object', id + ' canonical import must produce native payload');
}
assert.strictEqual(guide.example('trigger-card').card.component_id, 'TRIGGER-CARD');
assert.strictEqual(guide.example('persistent-card').card.component_id, 'PERSISTENT-MISSION');
assert.strictEqual(guide.example('move-card').card.component_id, 'NAV-01');
assert.strictEqual(guide.example('choice-card').card.component_id, 'SELECT-CARD');
assert.strictEqual(guide.example('dialogue-card').card.component_id, 'DIALOGUE-CARD');
assert.strictEqual(guide.example('rating-card').card.component_id, 'COL-02');
assert.strictEqual(guide.guides['focus-card'].version, 'V0.6.0');
assert.strictEqual(guide.example('focus-card').assets[0].fit, 'free');
assert.strictEqual(guide.example('focus-card').assets[0].crop.width, 76);
assert.strictEqual(guide.guides['explanation-card'].version, 'V0.4.9');
assert.strictEqual(guide.example('explanation-card').sequence.enabled, true);
assert.strictEqual(guide.example('explanation-card').sequence.steps.length, 3);
assert.strictEqual(guide.example('explanation-card').assets[0].crop.width, 70);
for (const id of ['rating-card','focus-card','explanation-card','thumbnail-frame','settlement-card']) {
  assert.strictEqual(guide.guides[id].image, true, id + ' must warn that image binaries require project ZIP');
  assert(guide.prompt(id).includes('專案 ZIP') || guide.prompt(id).includes('project.zip'), id + ' must mention project ZIP');
}
assert.throws(() => guide.prepareImport('move-card', guide.example('trigger-card')), /其他工具/);
assert(guideSource.includes('給 AI 的 JSON 格式'));
assert(guideSource.includes('複製完整 AI 指令'));
assert(guideSource.includes('複製 JSON 範例'));
assert(guideSource.includes('下載 JSON 範例'));
assert(guideSource.includes('ONEAfterEditDock.place'), 'guide must use shared completion dock');
assert(guideSource.includes('<details><summary>JSON 範例｜需要時再展開'), 'large JSON preview must be closed by default');
assert(!guideSource.includes('<details open>'), 'large JSON preview must not consume initial editor space');
assert(guideSource.includes('ONEEditBackup.__aiJsonGuideWrapped'), 'shared edit-backup tools must accept canonical import');
assert(guideSource.includes('ONEProjectPackage.__aiJsonGuideWrapped'), 'persistent/project-package path must mount the AI guide');
assert(guideSource.includes('__onePersistentCanonicalImport'), 'persistent custom JSON loader must be bridged');
new Function(guideSource);
console.log('PASS: 13 Canonical AI JSON examples, prompt contract, adapter handoff, and import bridge.');
