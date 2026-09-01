'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const shell = fs.readFileSync(path.join(root, 'one-tools-ui-v1.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'one-tools-ui-v1.css'), 'utf8');
const backup = fs.readFileSync(path.join(root, 'edit-backup-v1.js'), 'utf8');
const project = fs.readFileSync(path.join(root, 'project-package-v1.js'), 'utf8');
const batch = fs.readFileSync(path.join(root, 'batch-render-v1.js'), 'utf8');
const guide = fs.readFileSync(path.join(root, 'ai-json-guide-v1.js'), 'utf8');
const commandSync = fs.readFileSync(path.join(root, 'command-center-registry-sync-v1.js'), 'utf8');

assert(shell.includes("var VERSION = '1.3.0'"));
assert(shell.includes('完成後：儲存與輸出'));
assert(shell.includes('enhanceLabels'));
assert(shell.includes('enhanceLongEditors'));
assert(shell.includes("searchParams.get('embed') === '1'"));
assert(css.includes('.one-after-edit-dock'));
assert(css.includes('min-height:42px'));
assert(css.includes('.one-collapsible-item'));
assert(backup.includes('ONEAfterEditDock.place'));
assert(project.includes('ONEAfterEditDock.place'));
assert(batch.includes('ONEAfterEditDock.place'));
assert(guide.includes('ONEAfterEditDock.place'));
assert(!guide.includes('<details open>'));
assert(commandSync.includes("fetch('./one-tools-registry-v1.json?v=2330'"));
assert(commandSync.includes("tool.id === 'explanation'"));

const persistent = fs.readFileSync(path.join(root, 'persistent-card.html'), 'utf8');
assert(persistent.includes('id="persistentHistory" data-one-backup-ui'));
assert(persistent.includes('project-package-v1.js?v=1300'));

const thumbnail = fs.readFileSync(path.join(root, 'thumbnail-frame.html'), 'utf8');
assert(thumbnail.includes('<div class="candidate-status">READY</div>'));
assert(thumbnail.includes('<details class="section one-advanced-section">'));

const effect = fs.readFileSync(path.join(root, 'effect-card.html'), 'utf8');
assert(!effect.includes('V0.3.0'));
assert(effect.includes('V0.3.1 已載入'));

const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert(index.includes('one-tools-ui-v1.css?v=1300'));
assert(index.includes('one-tools-ui-v1.js?v=1300'));
assert(index.includes("fetch('./one-tools-registry-v1.json?v=2330'"));

const bridge = fs.readFileSync(path.join(root, 'ai-card.html'), 'utf8');
assert(bridge.includes("+'&embed=1'"));
assert(bridge.includes('O-Ne AI 字卡助手 V1.3'));

const commandCenter = fs.readFileSync(path.join(root, 'command-center.html'), 'utf8');
assert(commandCenter.includes('13 個可用 UI'));
assert(commandCenter.includes('command-center-registry-sync-v1.js?v=1000'));

function assertClassicScriptsParse(file) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const pattern = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = pattern.exec(html))) {
    if (/\bsrc\s*=|type="module"|application\/x-o-ne/.test(match[1])) continue;
    assert.doesNotThrow(() => new Function(match[2]), file + ' inline script must parse');
  }
}
['index.html', 'ai-card.html', 'persistent-card.html', 'thumbnail-frame.html'].forEach(assertClassicScriptsParse);
['one-tools-ui-v1.js', 'edit-backup-v1.js', 'project-package-v1.js', 'batch-render-v1.js', 'ai-json-guide-v1.js', 'command-center-registry-sync-v1.js'].forEach(file => {
  assert.doesNotThrow(() => new Function(fs.readFileSync(path.join(root, file), 'utf8')), file + ' must parse');
});

console.log('PASS: shared completion dock, readable controls, collapsible long editors, embedded mode and primary entry syntax.');
