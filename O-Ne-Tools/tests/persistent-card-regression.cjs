'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

class FakeClassList {
  constructor() { this.names = new Set(); }
  toggle(name, force) { force ? this.names.add(name) : this.names.delete(name); }
  contains(name) { return this.names.has(name); }
}

class FakeElement {
  constructor(tag = 'div', value = '') {
    this.tagName = tag.toUpperCase();
    this.value = String(value);
    this.textContent = '';
    this.disabled = false;
    this.className = '';
    this.classList = new FakeClassList();
    this.children = [];
    this.listeners = {};
    this.onclick = null;
    this.files = [];
    this.clickCount = 0;
  }
  set innerHTML(value) {
    this.children = [];
    this._innerHTML = value;
    if (this.tagName === 'SELECT') this.value = '';
  }
  get innerHTML() { return this._innerHTML || ''; }
  appendChild(child) {
    this.children.push(child);
    if (this.tagName === 'SELECT' && this.children.length === 1) this.value = child.value;
    return child;
  }
  addEventListener(type, handler) {
    (this.listeners[type] ||= []).push(handler);
  }
  dispatch(type) {
    return Promise.all((this.listeners[type] || []).map(handler => handler({ target: this, type })));
  }
  click() {
    this.clickCount += 1;
    if (typeof this.onclick === 'function') return this.onclick();
  }
}

function makeRuntime(script, sharedStorage = new Map()) {
  const ids = {
    c: new FakeElement('canvas'),
    state: new FakeElement('select', 'MISSION'),
    task: new FakeElement('input', 'Osaka Castle｜大阪城任務中'),
    taskSize: new FakeElement('input', '21'),
    taskSizeValue: new FakeElement(),
    progress: new FakeElement('input', '0/1'),
    progressSize: new FakeElement('input', '20'),
    progressSizeValue: new FakeElement(),
    status: new FakeElement(),
    download: new FakeElement('button'),
    jsonBtn: new FakeElement('button'),
    loadJson: new FakeElement('button'),
    jsonFile: new FakeElement('input'),
    reset: new FakeElement('button'),
    history: new FakeElement('select'),
    historyStatus: new FakeElement(),
    saveHistory: new FakeElement('button'),
    restoreHistory: new FakeElement('button'),
    clearHistory: new FakeElement('button')
  };
  const downloads = [];
  const canvasContext = {
    font: '800 20px sans-serif',
    fillStyle: '', strokeStyle: '', lineWidth: 0, lineCap: '', lineJoin: '', textAlign: '', textBaseline: '',
    beginPath() {}, roundRect() {}, fill() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {},
    save() {}, restore() {}, clearRect() {}, fillText() {},
    measureText(text) {
      const size = Number((this.font.match(/(\d+)px/) || [0, 20])[1]);
      const width = [...String(text)].reduce((sum, char) => sum + (/[^\x00-\xff]/.test(char) ? size : size * 0.56), 0);
      return { width };
    }
  };
  ids.c.getContext = () => canvasContext;
  ids.c.toBlob = callback => callback(new Blob(['png'], { type: 'image/png' }));
  const localStorage = {
    setItem(key, value) { sharedStorage.set(String(key), String(value)); },
    getItem(key) { return sharedStorage.has(String(key)) ? sharedStorage.get(String(key)) : null; },
    removeItem(key) { sharedStorage.delete(String(key)); }
  };
  const document = {
    getElementById(id) { return ids[id]; },
    createElement(tag) {
      const element = new FakeElement(tag);
      if (tag === 'a') element.click = () => downloads.push(element.download);
      return element;
    }
  };
  const context = {
    console,
    document,
    localStorage,
    Blob,
    Intl,
    Date,
    Number,
    String,
    JSON,
    setTimeout,
    clearTimeout,
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
    confirm: () => true
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(script, context, { filename: 'persistent-card.inline.js' });
  return { ids, downloads, sharedStorage };
}

function edit(runtime, id, value, event = 'input') {
  runtime.ids[id].value = String(value);
  return runtime.ids[id].dispatch(event);
}

(async () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'persistent-card.html'), 'utf8');
  const scriptMatch = source.match(/<script>([\s\S]*?)<\/script>/);
  assert(scriptMatch, 'inline script missing');
  new Function(scriptMatch[1]);
  assert(source.includes('O-Ne 常駐卡生成器 V1.1.2'));
  assert(source.includes('id="saveHistory">暫存目前內容</button>'));
  assert(source.includes('function handleEdit(){render();}'));
  assert(!source.includes('scheduleHistorySave'), 'legacy autosave scheduler must be removed');
  assert(source.includes("generator_version:'V1.1.2_20260827'"));

  const key = 'o-ne.persistent-card.history.v1';
  const runtime = makeRuntime(scriptMatch[1]);
  assert(!runtime.sharedStorage.has(key), 'initial render must not create history');
  assert(runtime.ids.historyStatus.textContent.includes('尚無手動暫存'));

  await edit(runtime, 'task', '只改文字，不應儲存');
  await edit(runtime, 'progress', '1/3');
  assert(!runtime.sharedStorage.has(key), 'typing must not create history');

  runtime.ids.saveHistory.click();
  let history = JSON.parse(runtime.sharedStorage.get(key));
  assert.strictEqual(history.length, 1, 'manual save must create one record');
  assert.strictEqual(history[0].task, '只改文字，不應儲存');

  const duplicateState = runtime.sharedStorage.get(key);
  runtime.ids.saveHistory.click();
  assert.strictEqual(runtime.sharedStorage.get(key), duplicateState, 'duplicate manual save must not rewrite history');
  assert(runtime.ids.historyStatus.textContent.includes('未新增重複版本'));

  for (let index = 1; index <= 6; index += 1) {
    await edit(runtime, 'task', '手動版本 ' + index);
    runtime.ids.saveHistory.click();
  }
  history = JSON.parse(runtime.sharedStorage.get(key));
  assert.strictEqual(history.length, 5, 'history limit must remain five');
  assert.deepStrictEqual(history.map(item => item.task), [
    '手動版本 6', '手動版本 5', '手動版本 4', '手動版本 3', '手動版本 2'
  ]);

  const reloaded = makeRuntime(scriptMatch[1], runtime.sharedStorage);
  assert.strictEqual(reloaded.ids.task.value, '手動版本 6', 'reload must restore latest manual save');
  await edit(reloaded, 'task', '未暫存修改');
  const reopened = makeRuntime(scriptMatch[1], runtime.sharedStorage);
  assert.strictEqual(reopened.ids.task.value, '手動版本 6', 'unsaved edit must not survive reopen');

  const beforeRestore = reopened.sharedStorage.get(key);
  reopened.ids.history.value = '4';
  reopened.ids.restoreHistory.click();
  assert.strictEqual(reopened.ids.task.value, '手動版本 2', 'selected manual version must restore');
  assert.strictEqual(reopened.sharedStorage.get(key), beforeRestore, 'restore must not add or reorder history');

  reopened.ids.jsonFile.files = [{
    size: 512,
    text: async () => JSON.stringify({
      component_id: 'PERSISTENT-MISSION',
      tool: 'persistent-card',
      state: 'DONE!',
      task_text: '抵達大阪城',
      progress: '1/1',
      task_font_size: 24,
      progress_font_size: 18
    })
  }];
  await reopened.ids.jsonFile.dispatch('change');
  assert.strictEqual(reopened.ids.state.value, 'DONE');
  assert.strictEqual(reopened.ids.task.value, '抵達大阪城');
  assert.strictEqual(reopened.ids.progress.value, '1/1');
  assert.strictEqual(Number(reopened.ids.taskSize.value), 24);
  assert.strictEqual(Number(reopened.ids.progressSize.value), 18);
  assert(reopened.ids.historyStatus.textContent.includes('目前尚未暫存'));
  assert.strictEqual(reopened.sharedStorage.get(key), beforeRestore, 'JSON import must not save automatically');

  const beforeRejected = {
    state: reopened.ids.state.value,
    task: reopened.ids.task.value,
    progress: reopened.ids.progress.value,
    taskSize: reopened.ids.taskSize.value,
    progressSize: reopened.ids.progressSize.value
  };
  reopened.ids.jsonFile.files = [{
    size: 128,
    text: async () => JSON.stringify({ component_id: 'WRONG-CARD', state: 'FAIL', task_text: '不應套用', progress: '0/1' })
  }];
  await reopened.ids.jsonFile.dispatch('change');
  assert(reopened.ids.historyStatus.textContent.includes('component_id'));
  assert.deepStrictEqual({
    state: reopened.ids.state.value,
    task: reopened.ids.task.value,
    progress: reopened.ids.progress.value,
    taskSize: reopened.ids.taskSize.value,
    progressSize: reopened.ids.progressSize.value
  }, beforeRejected, 'rejected JSON must not mutate current state');

  reopened.ids.jsonFile.files = [{ size: 6, text: async () => '{bad}' }];
  await reopened.ids.jsonFile.dispatch('change');
  assert.strictEqual(reopened.ids.historyStatus.textContent, '載入失敗｜JSON 格式錯誤');
  reopened.ids.jsonFile.files = [{ size: 256 * 1024 + 1, text: async () => '{}' }];
  await reopened.ids.jsonFile.dispatch('change');
  assert.strictEqual(reopened.ids.historyStatus.textContent, '載入失敗｜檔案超過 256 KB');

  const beforeActions = reopened.sharedStorage.get(key);
  reopened.ids.reset.click();
  reopened.ids.jsonBtn.click();
  reopened.ids.download.click();
  assert.strictEqual(reopened.sharedStorage.get(key), beforeActions, 'reset and exports must not save automatically');
  assert(reopened.downloads.includes('O-Ne_常駐卡_data_v112.json'));
  assert(reopened.downloads.some(name => name.startsWith('O-Ne_常駐卡_')));

  reopened.ids.clearHistory.click();
  assert(!reopened.sharedStorage.has(key), 'clear history must remove storage');
  assert.strictEqual(reopened.ids.historyStatus.textContent, '已清除暫存');

  console.log('PASS: persistent card manual-only save, dedupe, five-record limit, reopen, restore, JSON validation and export boundaries.');
})().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
