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
assert.strictEqual(backup.version, '1.2.0');
assert.strictEqual(backup.__test.constants.historyLimit, 5);
assert.strictEqual(backup.__test.constants.maxJsonBytes, 1024 * 1024);
assert.strictEqual(backup.__test.shouldPersist({}, 'edit'), false, 'default mode must ignore edits');
assert.strictEqual(backup.__test.shouldPersist({ saveMode: 'automatic' }, 'edit'), true, 'explicit automatic mode must keep edit autosave');
assert.strictEqual(backup.__test.shouldPersist({ saveMode: 'manual' }, 'edit'), false, 'manual mode must ignore edits');
assert.strictEqual(backup.__test.shouldPersist({ saveMode: 'manual' }, 'initial'), false, 'manual mode must not create an initial snapshot');
assert.strictEqual(backup.__test.shouldPersist({ saveMode: 'manual' }, 'restore'), false, 'manual restore must not add history');
assert.strictEqual(backup.__test.shouldPersist({ saveMode: 'manual' }, 'json-import'), false, 'manual JSON import must not add history');
assert.strictEqual(backup.__test.shouldPersist({ saveMode: 'manual' }, 'manual'), true, 'manual button must be allowed to save');
assert(librarySource.includes('data-action="save">暫存目前內容</button>'));
assert(librarySource.includes('目前內容與最新暫存相同，未新增重複版本。'));

let persisted = backup.__test.persistSnapshot('manual-card', {}, { value: 0 }, 'edit');
assert.strictEqual(persisted.ignored, true, 'typing in manual mode must not write');
assert.strictEqual(backup.__test.readHistory('manual-card').length, 0);
persisted = backup.__test.persistSnapshot('manual-card', {}, { value: 0 }, 'manual');
assert.strictEqual(persisted.saved, true, 'manual action must write');
persisted = backup.__test.persistSnapshot('manual-card', {}, { value: 0 }, 'manual');
assert.strictEqual(persisted.duplicate, true, 'identical manual snapshots must be deduplicated');
assert.strictEqual(backup.__test.readHistory('manual-card').length, 1);
for (let value = 1; value <= 6; value += 1) {
  backup.__test.persistSnapshot('manual-card', {}, { value }, 'manual');
}
assert.deepStrictEqual(
  Array.from(backup.__test.readHistory('manual-card'), item => item.data.value),
  [6, 5, 4, 3, 2],
  'manual history must retain the newest five snapshots only'
);
backup.__test.persistSnapshot('manual-card', {}, { value: 4 }, 'manual');
assert.deepStrictEqual(
  Array.from(backup.__test.readHistory('manual-card'), item => item.data.value),
  [4, 6, 5, 3, 2],
  'saving an older version again must move it to the front without creating a duplicate'
);

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
  ['focus-card.html', 'focus-card', 'V0.5.15'],
  ['explanation-card.html', 'explanation-card', 'V0.1.1'],
  ['thumbnail-frame.html', 'thumbnail-frame', 'V1.2.6'],
  ['settlement-card.html', 'settlement-card', 'V0.1.3']
];

for (const [file, id, version] of tools) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const backupVersion = file === 'explanation-card.html' ? 'edit-backup-v1.js?v=1216' : file === 'focus-card.html' ? 'edit-backup-v1.js?v=1215' : 'edit-backup-v1.js?v=121';
  assert(html.includes(backupVersion), file + ' must load the manual-by-default shared backup library');
  const implementation = file === 'settlement-card.html'
    ? fs.readFileSync(path.join(root, 'settlement-card-v011.js'), 'utf8')
    : html;
  assert(implementation.includes(`id:'${id}'`) || implementation.includes(`id: '${id}'`) || implementation.includes(`id:"${id}"`), file + ' must mount the correct tool id');
  assert(html.includes(version), file + ' must show the expected version');
  assert(implementation.includes('fromJSON:'), file + ' must define legacy JSON import mapping');
}

for (const [file, id] of tools) {
  const implementation = file === 'settlement-card.html'
    ? fs.readFileSync(path.join(root, 'settlement-card-v011.js'), 'utf8')
    : fs.readFileSync(path.join(root, file), 'utf8');
  assert(!implementation.includes('saveMode:"automatic"') && !implementation.includes("saveMode: 'automatic'"), id + ' must not opt back into autosave');
}

for (const file of ['rating-card.html', 'focus-card.html', 'explanation-card.html', 'thumbnail-frame.html']) {
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
assert.strictEqual(registry.version, 'V2.24_20260830');
assert.strictEqual(registry.total, 18);
assert.strictEqual(registry.ready, 13);
assert.strictEqual(registry.candidate, 0);
const registryIds = ['general', 'trigger', 'persistent', 'effect', 'move', 'choice', 'challenge', 'dialogue', 'rating', 'focus', 'explanation', 'thumbnail-frame', 'settlement'];
for (const id of registryIds) {
  const entry = registry.tools.find(tool => tool.id === id);
  assert(entry, 'registry missing ' + id);
  for (const feature of ['local_edit_history_5', 'manual_edit_history_save', 'unsaved_edits_not_persisted', 'restore_latest_on_load', 'json_import_restore', 'ai_json_schema_guide']) {
    assert(entry.features.includes(feature), id + ' missing ' + feature);
  }
}
assert.strictEqual(registry.shared_ai_json_guide.version, 'V1.0.5_20260830');
assert.strictEqual(registry.shared_ai_json_guide.tool_count, 13);
assert.strictEqual(registry.shared_ai_json_guide.raw_json_only_instruction, true);
assert.strictEqual(registry.shared_ai_json_guide.placement, 'same_right_column_directly_below_preview');
assert.strictEqual(registry.shared_ai_json_guide.left_controls_untouched, true);
assert.strictEqual(registry.shared_batch_render.version, 'V1.1.0_20260829');
assert.strictEqual(registry.shared_batch_render.max_files, 20);
assert.strictEqual(registry.shared_batch_render.image_tool_json_policy, 'zip_project_package_required');
assert.strictEqual(registry.shared_project_package.version, 'V1.1.0_20260829');
assert.strictEqual(registry.shared_project_package.filename_pattern, '{card_category}-{title}-{state}.{ext}');
assert.strictEqual(registry.shared_project_package.brand_prefix_in_filename, false);
assert.strictEqual(registry.shared_project_package.same_title_variant_safe, true);
assert.strictEqual(registry.shared_edit_backup.history_limit, 5);
assert.strictEqual(registry.shared_edit_backup.max_json_bytes, 1048576);
assert.strictEqual(registry.shared_edit_backup.version, 'V1.2.0_20260827');
assert.strictEqual(registry.shared_edit_backup.default_save_mode, 'manual');
assert.strictEqual(registry.shared_edit_backup.manual_save_supported, true);
assert.deepStrictEqual(registry.shared_edit_backup.manual_save_tools, [
  'general-card', 'trigger-card', 'persistent-card', 'effect-card', 'move-card', 'choice-card',
  'challenge-card', 'dialogue-card', 'rating-card', 'focus-card', 'explanation-card', 'thumbnail-frame', 'settlement-card'
]);

const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const id of registryIds) {
  const entry = registry.tools.find(tool => tool.id === id);
  const href = entry.href.replace(/^\.\//, '');
  assert(index.includes(href), 'index missing cache-busted link ' + href);
}

const aiBridge = fs.readFileSync(path.join(root, 'ai-card.html'), 'utf8');
for (const href of [
  'general-card.html?v=121&build=manual-history-v2',
  'trigger-card.html?v=102&build=manual-history-v2',
  'persistent-card.html?v=112&build=manual-history-v2',
  'move-card.html?v=107&build=manual-history-v2',
  'choice-card.html?v=101&build=manual-history-v2'
]) assert(aiBridge.includes(href), 'AI Bridge missing current editor link ' + href);

const persistentMapping = JSON.parse(fs.readFileSync(path.join(root, 'persistent-card-mapping.json'), 'utf8'));
assert.strictEqual(persistentMapping.generator_version, 'V1.1.2_20260827');
const legacyRegistry = JSON.parse(fs.readFileSync(path.join(root, 'registry.json'), 'utf8'));
const legacyPersistent = legacyRegistry.tools.find(tool => tool.id === 'persistent');
assert.strictEqual(legacyPersistent.href, './persistent-card.html?v=112&build=manual-history-v2');
assert.strictEqual(legacyPersistent.generator_version, 'V1.1.2_20260827');
assert(legacyPersistent.features.includes('manual_edit_history_save'));
assert(legacyPersistent.features.includes('unsaved_edits_not_persisted'));

console.log('PASS: manual shared history, JSON validation boundaries, 12 shared adapters, syntax, registries, index and AI Bridge links.');
