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
assert.strictEqual(helper.version, '1.0.1');
assert.strictEqual(helper.schema, 'o-ne.project-package.v1');
assert.strictEqual(helper.__test.cleanPart('道頓堀/觀光船:晚班'), '道頓堀 觀光船 晚班');
assert.strictEqual(helper.__test.toolName('focus-card'), '焦點卡');
assert.strictEqual(helper.__test.variantSuffix('O-Ne_NAV-01_MOVE_WHITE.png'), '_WHITE');
assert.strictEqual(helper.__test.variantSuffix('O-Ne_data.json'), '');
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

  assert(backupSource.includes('project-package-v1.js?v=100'), 'shared backup must synchronously bridge to project package helper');
  assert(backupSource.includes("version: '1.2.0'"), 'existing shared backup public version must stay compatible');

  const sharedEditors = [
    'general-card.html', 'trigger-card.html', 'effect-card.html', 'move-card.html', 'choice-card.html',
    'challenge-card.html', 'dialogue-card-v135.html', 'rating-card.html', 'focus-card.html',
    'thumbnail-frame.html', 'settlement-card.html'
  ];
  for (const file of sharedEditors) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    assert(html.includes('edit-backup-v1.js?v=120'), file + ' must still load the shared backup bridge');
  }

  const persistent = fs.readFileSync(path.join(root, 'persistent-card.html'), 'utf8');
  assert(persistent.includes('project-package-v1.js?v=100'), 'persistent card must load project package helper directly');
  assert(persistent.includes("id:'persistent-card'"), 'persistent card must mount its project package adapter');
  assert(persistent.includes('getTitle:snapshot=>snapshot&&snapshot.task'), 'persistent filename title must use task text');

  new Function(helperSource);
  new Function(backupSource);
  console.log('PASS: smart filenames, stable image keys, dynamic-image restore order, ZIP round trip, shared bridge, persistent adapter and syntax.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
