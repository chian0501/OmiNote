'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const batchSource = fs.readFileSync(path.join(root, 'batch-render-v1.js'), 'utf8');
const packageSource = fs.readFileSync(path.join(root, 'project-package-v1.js'), 'utf8');

function cleanPart(value, fallback) {
  let text = String(value == null ? '' : value)
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');
  if (!text) text = fallback || '未命名';
  if (text.length > 60) text = text.slice(0, 60).trim();
  return text || (fallback || '未命名');
}
const toolNames = {
  'general-card':'一般卡','trigger-card':'觸發卡','persistent-card':'常駐卡','effect-card':'效果卡',
  'move-card':'移動卡','choice-card':'選項卡','challenge-card':'挑戰卡','dialogue-card':'對話卡',
  'rating-card':'評分卡','focus-card':'焦點卡','thumbnail-frame':'縮圖品牌框','settlement-card':'片尾結算卡'
};

const context = {
  console, URL, TextDecoder, Uint8Array, JSON, Date, Math, RegExp, Promise,
  setTimeout, clearTimeout,
  location: { href: 'https://example.com/O-Ne-Tools/move-card.html' },
  document: {
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() { return { style:{}, setAttribute(){}, querySelector(){return null;}, appendChild(){}, remove(){}, classList:{toggle(){}} }; },
    head: { appendChild() {} }, body: { appendChild() {} }
  },
  ONEProjectPackage: {
    mount() { return {}; },
    __test: {
      cleanPart,
      toolName(id) { return toolNames[id] || id; },
      statusFromSnapshot(id, snapshot) {
        if (id === 'move-card') return snapshot.previewState === 'orange' ? '橘色' : '白色';
        if (id === 'persistent-card') return snapshot.state === 'DONE' ? '成功' : snapshot.state === 'FAIL' ? '失敗' : '任務中';
        return '標準';
      },
      buildBaseName(id, title, status) { return [toolNames[id] || id, title, status].join('-'); },
      readZip() { throw new Error('not used'); },
      makeZip() { throw new Error('not used'); },
      assetKey() { return 'index:0'; }
    }
  }
};
context.window = context;
vm.createContext(context);
vm.runInContext(batchSource, context, { filename:'batch-render-v1.js' });

const batch = context.ONEBatchRender;
assert(batch, 'batch renderer must load');
assert.strictEqual(batch.version, '1.3.0');
assert.strictEqual(batch.__test.constants.maxFiles, 20);
assert.strictEqual(batch.__test.constants.maxBytes, 200 * 1024 * 1024);
assert.strictEqual(batch.__test.constants.workerParam, '__one_batch_worker');
assert.strictEqual(batch.__test.extension('a.JSON'), 'json');
assert.strictEqual(batch.__test.extension('a.zip'), 'zip');
assert.strictEqual(batch.__test.extension('a.png'), 'png');
assert.strictEqual(batch.__test.outputName('move-card', { previewState:'white' }, '關西機場到北浜'), '移動卡-關西機場到北浜-白色.png');
assert.strictEqual(batch.__test.outputName('persistent-card', { state:'DONE' }, '大阪城任務'), '常駐卡-大阪城任務-成功.png');
const used = Object.create(null);
assert.strictEqual(batch.__test.uniqueName('焦點卡-道頓堀-步驟.png', used), '焦點卡-道頓堀-步驟.png');
assert.strictEqual(batch.__test.uniqueName('焦點卡-道頓堀-步驟.png', used), '焦點卡-道頓堀-步驟-02.png');

const persistent = batch.__test.parsePersistentJson({
  component_id:'PERSISTENT-MISSION', tool:'persistent-card', state:'DONE!', task_text:'大阪城完成', progress:'1/1', task_font_size:22, progress_font_size:19
}, { taskSize:21, progressSize:20 });
assert.strictEqual(persistent.state, 'DONE');
assert.strictEqual(persistent.task, '大阪城完成');
assert.strictEqual(persistent.progress, '1/1');
assert.strictEqual(persistent.taskSize, 22);
assert.throws(() => batch.__test.parsePersistentJson({ component_id:'WRONG', state:'DONE', task_text:'x', progress:'1/1' }, {}), /PERSISTENT-MISSION/);

assert(batchSource.includes('選擇多個 JSON／ZIP'));
assert(batchSource.includes('開始批次出圖'));
assert(batchSource.includes('同卡種最多 20 份'));
assert(batchSource.includes('圖片型工具請使用 ZIP 專案包批次輸出'));
assert(batchSource.includes('directPngBytes'));
assert(batchSource.includes('__one_batch_worker'));
assert(packageSource.includes('batch-render-v1.js?v=1300'), 'project package must synchronously load batch renderer');
new Function(batchSource);
console.log('PASS: batch limits, naming, persistent JSON adapter, UI contract, image ZIP safety policy and worker bridge.');
