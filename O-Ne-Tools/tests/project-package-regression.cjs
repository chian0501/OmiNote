'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.join(__dirname, '..');
const helperSource = fs.readFileSync(path.join(root, 'project-package-v1.js'), 'utf8');
const backupSource = fs.readFileSync(path.join(root, 'edit-backup-v1.js'), 'utf8');

const context = {
  console,
  TextEncoder,
  TextDecoder,
  Uint8Array,
  Uint32Array,
  ArrayBuffer,
  DataView,
  Blob,
  URL,
  Date,
  JSON,
  Math,
  RegExp,
  Promise,
  setTimeout,
  clearTimeout
};
context.window = context;
context.document = {
  querySelector() { return null; },
  querySelectorAll() { return []; },
  getElementById() { return null; },
  createElement() { return { setAttribute() {}, querySelector() { return null; }, classList: { toggle() {} }, appendChild() {} }; },
  head: { appendChild() {} },
  body: { appendChild() {} }
};
context.CSS = { escape(value) { return String(value); } };
context.HTMLAnchorElement = function HTMLAnchorElement() {};
context.HTMLAnchorElement.prototype.click = function click() {};
vm.createContext(context);
vm.runInContext(helperSource, context, { filename: 'project-package-v1.js' });

const helper = context.ONEProjectPackage;
assert(helper, 'project package helper must load');
assert.strictEqual(helper.version, '1.3.0');
assert.strictEqual(helper.schema, 'o-ne.project-package.v1');
assert.strictEqual(helper.__test.cleanPart('道頓堀/觀光船:晚班'), '道頓堀 觀光船 晚班');
assert.strictEqual(helper.__test.toolName('focus-card'), '焦點卡');
assert.strictEqual(helper.__test.toolName('explanation-card'), '說明卡');
assert.strictEqual(helper.__test.variantSuffix('O-Ne_NAV-01_MOVE_WHITE.png'), '_WHITE');
assert.strictEqual(helper.__test.variantSuffix('O-Ne_data.json'), '');
assert.strictEqual(helper.__test.buildBaseName('focus-card', '道頓堀觀光船', '步驟-含字'), '焦點卡-道頓堀觀光船-步驟-含字');
assert.strictEqual(helper.__test.buildBaseName('explanation-card', '旅行重點', '標準'), '說明卡-旅行重點-標準');
assert.strictEqual(helper.__test.statusFromSnapshot('trigger-card', { fields:{ state:{ value:'DONE' } } }, ''), '成功');
assert.strictEqual(helper.__test.statusFromSnapshot('persistent-card', { state:'FAIL' }, ''), '失敗');
assert.strictEqual(helper.__test.statusFromSnapshot('effect-card', { current:'cute', state:'BUFF' }, ''), '可愛');
assert.strictEqual(helper.__test.statusFromSnapshot('move-card', { previewState:'orange' }, 'O-Ne_NAV-01_MOVE_WHITE.png'), '白色');
assert.strictEqual(helper.__test.statusFromSnapshot('general-card', { currentMode:'CUSTOM', drafts:{ CUSTOM:{ label:'攻略' } } }, ''), '攻略');
assert.strictEqual(helper.__test.statusFromSnapshot('choice-card', { options:[{ text:'搭 HARUKA', bright:false }, { text:'搭南海電鐵', bright:true }] }, ''), '高亮-搭南海電鐵');
assert.strictEqual(helper.__test.statusFromSnapshot('challenge-card', { mode:'accept', selected:'yes' }, ''), '接受-YES');
assert.strictEqual(helper.__test.statusFromSnapshot('dialogue-card', { left:{ character:'Omi', expression:'疑惑' }, right:{ character:'NieTe', expression:'無奈' } }, ''), 'Omi疑惑-涅特無奈');
assert.strictEqual(helper.__test.statusFromSnapshot('rating-card', { ratings:[{ type:'score', value:'4.0' }, { type:'score', value:'5.0' }] }, ''), '評分4.5');
assert.strictEqual(helper.__test.statusFromSnapshot('focus-card', { mode:'steps', label:{ enabled:true, text:'HERE' } }, 'O-NE_focus-card_steps_text_READY.png'), 'HERE-步驟-含字');
assert.strictEqual(helper.__test.statusFromSnapshot('thumbnail-frame', {}, 'O-Ne_縮圖品牌框_含底圖_1920x1080.png'), '含底圖');
assert.strictEqual(helper.__test.statusFromSnapshot('settlement-card', { fields:{ leftMode:'question' } }, ''), '提問');
assert.strictEqual(helper.__test.assetKey({ id: 'heroImage', getAttribute() { return null; }, closest() { return null; } }, 0), 'id:heroImage');
assert.strictEqual(helper.__test.assetKey({ id: '', getAttribute(name) { return name === 'name' ? 'backgroundImage' : null; }, closest() { return null; } }, 0), 'name:backgroundImage');
const focusRightInput = {
  id: '',
  getAttribute() { return null; },
  closest(selector) {
    if (selector === '.image-slot') return { querySelector() { return { textContent: '右側圖片' }; } };
    return null;
  }
};
assert.strictEqual(helper.__test.assetKey(focusRightInput, 0), 'slot:右側圖片', 'dynamic focus image slot must have a stable semantic key');
assert.strictEqual(helper.__test.assetKey({ id: '', getAttribute() { return null; }, closest() { return null; } }, 3), 'index:3');
assert(helperSource.indexOf('instance.config.apply(clone(project.data));') < helperSource.indexOf('var restored = 0;'), 'project settings must be applied before dynamic image inputs are restored');

(async () => {
  const zip = await helper.__test.makeZip([
    { name: '焦點卡_道頓堀.json', data: '{"ok":true}' },
    { name: 'assets/route.png', data: new Uint8Array([137, 80, 78, 71]) }
  ]);
  assert(zip instanceof Blob, 'makeZip must return a Blob');
  const entries = await helper.__test.readZip(zip);
  assert.strictEqual(new TextDecoder().decode(entries['焦點卡_道頓堀.json']), '{"ok":true}');
  assert.deepStrictEqual(Array.from(entries['assets/route.png']), [137, 80, 78, 71]);

  assert(backupSource.includes('project-package-v1.js?v=1300'), 'shared backup must synchronously bridge to the cache-busted project package helper');
  assert(backupSource.includes("version: '1.3.0'"), 'shared backup must expose the current UI-shell version');

  const sharedEditors = [
    'general-card.html', 'trigger-card.html', 'effect-card.html', 'move-card.html', 'choice-card.html',
    'challenge-card.html', 'dialogue-card-v135.html', 'rating-card.html', 'focus-card.html', 'explanation-card.html',
    'thumbnail-frame.html', 'settlement-card.html'
  ];
  for (const file of sharedEditors) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    const backupVersion = file === 'explanation-card.html' ? 'edit-backup-v1.js?v=1219' : file === 'focus-card.html' ? 'edit-backup-v1.js?v=1215' : 'edit-backup-v1.js?v=121';
    assert(html.includes(backupVersion), file + ' must still load the shared backup bridge');
  }

  const persistent = fs.readFileSync(path.join(root, 'persistent-card.html'), 'utf8');
  assert(persistent.includes('project-package-v1.js?v=1300'), 'persistent card must load project package helper directly');
  assert(persistent.includes("id:'persistent-card'"), 'persistent card must mount its project package adapter');
  assert(persistent.includes('getTitle:snapshot=>snapshot&&snapshot.task'), 'persistent filename title must use task text');

  new Function(helperSource);
  new Function(backupSource);
  console.log('PASS: category-title-state filenames, state inference, stable image keys, dynamic-image restore order, ZIP round trip, shared bridge, persistent adapter and syntax.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
