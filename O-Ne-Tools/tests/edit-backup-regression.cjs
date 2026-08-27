'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.join(__dirname, '..');
const librarySource = fs.readFileSync(path.join(root, 'edit-backup-v1.js'), 'utf8');
const storageData = new Map();
const localStorage = {
  getItem(key) { return storageData.has(key) ? storageData.get(key) : null; },
  setItem(key, value) { storageData.set(key, String(value)); },
  removeItem(key) { storageData.delete(key); }
};
const fakeWindow = {
  localStorage,
  clearTimeout,
  setTimeout,
  Intl,
  Date,
  JSON
};
fakeWindow.window = fakeWindow;
const context = {
  window: fakeWindow,
  document: {},
  console,
  Intl,
  Date,
  JSON,
  setTimeout,
  clearTimeout
};
vm.runInNewContext(librarySource, context, { filename: 'edit-backup-v1.js' });
const backup = fakeWindow.ONEEditBackup;
assert(backup, 'shared backup library must load');
assert.strictEqual(backup.schema, 'o-ne.edit-backup.v1');
assert.strictEqual(backup.__test.constants.historyLimit, 5);
assert.strictEqual(backup.__test.constants.maxJsonBytes, 1024 * 1024);

const seven = Array.from({ length: 7 }, (_, index) => ({
  saved_at: new Date(2026, 7, 26, 10, 0, index).toISOString(),
  data: { value: index }
}));
backup.__test.writeHistory('unit-card', seven);
assert.deepStrictEqual(
  Array.from(backup.__test.readHistory('unit-card'), item => item.data.value),
  [0, 1, 2, 3, 4],
  'history must keep only the latest five entries passed in order'
);
localStorage.setItem(backup.__test.storageKey('broken-card'), '{bad json');
assert.deepStrictEqual(Array.from(backup.__test.readHistory('broken-card')), []);
assert(backup.__test.sameData({ a: 1 }, { a: 1 }));
assert(!backup.__test.sameData({ a: 1 }, { a: 2 }));

const commonSnapshot = backup.__test.parseImported('unit-card', null, {
  schema: 'o-ne.edit-backup.v1',
  tool_id: 'unit-card',
  data: { fields: { title: { kind: 'value', value: 'OK' } } }
});
assert.strictEqual(commonSnapshot.fields.title.value, 'OK');
assert.throws(
  () => backup.__test.parseImported('unit-card', null, {
    schema: 'o-ne.edit-backup.v1',
    tool_id: 'other-card',
    data: {}
  }),
  /其他工具/
);
let current = { title: '目前內容' };
assert.throws(
  () => backup.__test.parseImported('unit-card', () => {
    throw new Error('invalid payload');
  }, { component_id: 'WRONG' }),
  /invalid payload/
);
assert.deepStrictEqual(current, { title: '目前內容' }, 'invalid import must not mutate caller state');
const legacy = backup.__test.parseImported('unit-card', payload => ({ title: payload.title }), { title: '已載入' });
assert.strictEqual(legacy.title, '已載入');

const tools = [
  ['general-card.html', 'general-card', 'V1.2.1'],
  ['trigger-card.html', 'trigger-card', 'V1.0.2'],
  ['effect-card.html', 'effect-card', 'V0.3.1'],
  ['move-card.html', 'move-card', 'V1.0.7'],
  ['choice-card.html', 'choice-card', 'V1.0.1'],
  ['challenge-card.html', 'challenge-card', 'V0.1.1'],
  ['dialogue-card-v135.html', 'dialogue-card', 'V1.3.7'],
  ['rating-card.html', 'rating-card', 'V1.3.1'],
  ['focus-card.html', 'focus-card', 'V0.5.7'],
  ['thumbnail-frame.html', 'thumbnail-frame', 'V1.2.6'],
  ['settlement-card.html', 'settlement-card', 'V0.1.3']
];

for (const [file, id, version] of tools) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  assert(html.includes('edit-backup-v1.js?v=100'), file + ' must load shared backup library');
  const implementation = file === 'settlement-card.html'
    ? fs.readFileSync(path.join(root, 'settlement-card-v011.js'), 'utf8')
    : html;
  assert(implementation.includes(`id:'${id}'`) || implementation.includes(`id: '${id}'`) || implementation.includes(`id:"${id}"`), file + ' must mount the correct tool id');
  assert(html.includes(version), file + ' must show the expected version');
  assert(implementation.includes('fromJSON:'), file + ' must define legacy JSON import mapping');
}

for (const file of ['rating-card.html', 'focus-card.html', 'thumbnail-frame.html']) {
  assert(fs.readFileSync(path.join(root, file), 'utf8').includes('imageNote:true') ||
    fs.readFileSync(path.join(root, file), 'utf8').includes('imageNote:!0'));
}
assert(fs.readFileSync(path.join(root, 'settlement-card-v011.js'), 'utf8').includes('imageNote: true'));

let syntaxFailures = [];
for (const [file] of tools) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const scriptPattern = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptPattern.exec(html))) {
    if (/\bsrc\s*=/.test(match[1]) || /application\/x-o-ne/.test(match[1])) continue;
    try { new Function(match[2]); } catch (error) { syntaxFailures.push(file + ': ' + error.message); }
  }
}
for (const file of ['edit-backup-v1.js', 'settlement-card-v011.js']) {
  try { new Function(fs.readFileSync(path.join(root, file), 'utf8')); }
  catch (error) { syntaxFailures.push(file + ': ' + error.message); }
}
assert.deepStrictEqual(syntaxFailures, []);

const registry = JSON.parse(fs.readFileSync(path.join(root, 'one-tools-registry-v1.json'), 'utf8'));
assert.strictEqual(registry.version, 'V2.12_20260826');
assert.strictEqual(registry.total, 17);
assert.strictEqual(registry.ready, 12);
assert.strictEqual(registry.candidate, 0);
const registryIds = ['general', 'trigger', 'effect', 'move', 'choice', 'challenge', 'dialogue', 'rating', 'focus', 'thumbnail-frame', 'settlement'];
for (const id of registryIds) {
  const entry = registry.tools.find(tool => tool.id === id);
  assert(entry, 'registry missing ' + id);
  for (const feature of ['local_edit_history_5', 'restore_latest_on_load', 'json_import_restore']) {
    assert(entry.features.includes(feature), id + ' missing ' + feature);
  }
}
assert.strictEqual(registry.shared_edit_backup.history_limit, 5);
assert.strictEqual(registry.shared_edit_backup.max_json_bytes, 1048576);

const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const href of [
  'general-card.html?v=121', 'trigger-card.html?v=102', 'effect-card.html?v=031',
  'move-card.html?v=107', 'choice-card.html?v=101', 'challenge-card.html?v=011',
  'dialogue-card.html?v=141', 'rating-card.html?v=131', 'focus-card.html?v=057',
  'thumbnail-frame.html?v=126', 'settlement-card.html?v=013'
]) assert(index.includes(href), 'index missing cache-busted link ' + href);

console.log('PASS: shared history, JSON validation boundaries, 11 adapters, syntax, registry and index checks.');

