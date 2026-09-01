/* O-Ne shared edit backup / JSON import — V1.2.0 + project package bridge */
(function (global) {
  'use strict';

  function ensureSharedUi() {
    if (typeof document === 'undefined' || !document.getElementById || !document.createElement) return;
    if (!document.getElementById('one-tools-ui-css')) {
      var link = document.createElement('link');
      link.id = 'one-tools-ui-css'; link.rel = 'stylesheet'; link.href = './one-tools-ui-v1.css?v=1300';
      (document.head || document.documentElement).appendChild(link);
    }
    if (!global.ONEAfterEditDock && !document.getElementById('one-tools-ui-js')) {
      var script = document.createElement('script');
      script.id = 'one-tools-ui-js'; script.src = './one-tools-ui-v1.js?v=1300'; script.async = false;
      (document.head || document.documentElement).appendChild(script);
    }
  }
  ensureSharedUi();

  var SCHEMA = 'o-ne.edit-backup.v1';
  var HISTORY_LIMIT = 5;
  var MAX_JSON_BYTES = 1024 * 1024;
  var instances = Object.create(null);

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function storageKey(toolId) { return 'one.edit-history.v1:' + toolId; }
  function readHistory(toolId) {
    try {
      var parsed = JSON.parse(global.localStorage.getItem(storageKey(toolId)) || '[]');
      return Array.isArray(parsed) ? parsed.slice(0, HISTORY_LIMIT) : [];
    } catch (error) { return []; }
  }
  function writeHistory(toolId, history) {
    global.localStorage.setItem(storageKey(toolId), JSON.stringify(history.slice(0, HISTORY_LIMIT)));
  }

  function fieldElements(root) {
    return Array.prototype.slice.call((root || document).querySelectorAll('input[id],select[id],textarea[id]'))
      .filter(function (element) { return element.type !== 'file' && !element.closest('[data-one-backup-ui]'); });
  }
  function collectFields(root) {
    var fields = {};
    fieldElements(root).forEach(function (element) {
      if (element.type === 'radio' || element.type === 'checkbox') fields[element.id] = { kind: 'checked', value: Boolean(element.checked) };
      else fields[element.id] = { kind: 'value', value: element.value };
    });
    return fields;
  }
  function setNativeValue(element, value) {
    var prototype = element instanceof global.HTMLInputElement
      ? global.HTMLInputElement.prototype
      : element instanceof global.HTMLTextAreaElement
        ? global.HTMLTextAreaElement.prototype
        : global.HTMLSelectElement.prototype;
    var descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    if (descriptor && descriptor.set) descriptor.set.call(element, value);
    else element.value = value;
  }
  function applyFields(fields, root) {
    Object.keys(fields || {}).forEach(function (id) {
      var element = (root || document).getElementById(id);
      if (!element || element.type === 'file' || element.closest('[data-one-backup-ui]')) return;
      var saved = fields[id] || {};
      if (saved.kind === 'checked') element.checked = Boolean(saved.value);
      else setNativeValue(element, saved.value == null ? '' : String(saved.value));
    });
    Object.keys(fields || {}).forEach(function (id) {
      var element = (root || document).getElementById(id);
      if (!element || element.type === 'file' || element.closest('[data-one-backup-ui]')) return;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }
  function defaultCapture(config) {
    return { fields: collectFields(config.root || document), extra: config.getExtra ? clone(config.getExtra()) : null };
  }
  function defaultApply(config, snapshot) {
    if (!snapshot || typeof snapshot !== 'object') throw new Error('JSON 缺少可還原的內容。');
    applyFields(snapshot.fields || {}, config.root || document);
    if (config.applyExtra) config.applyExtra(clone(snapshot.extra));
    if (config.afterApply) config.afterApply(clone(snapshot));
  }
  function sameData(a, b) {
    try { return JSON.stringify(a) === JSON.stringify(b); } catch (error) { return false; }
  }
  function isManual(instance) { return !(instance && instance.config && instance.config.saveMode === 'automatic'); }
  function shouldPersist(instance, reason) { return !isManual(instance) || reason === 'manual'; }
  function formatTime(iso) {
    try {
      return new Intl.DateTimeFormat('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(iso));
    } catch (error) { return iso; }
  }

  function ensureStyles() {
    if (document.getElementById('one-edit-backup-style')) return;
    var style = document.createElement('style');
    style.id = 'one-edit-backup-style';
    style.textContent = [
      '.one-edit-backup{margin-top:14px;padding:13px;border:1px solid #354052;border-radius:11px;background:#101620;color:#c9d1db;font-family:"Noto Sans TC","Microsoft JhengHei",sans-serif}',
      '.one-edit-backup__title{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px;font-size:12px;font-weight:900;color:#f0a8cf}',
      '.one-edit-backup__badge{padding:3px 7px;border-radius:999px;background:#21363b;color:#8fe0d7;font-size:10px}',
      '.one-edit-backup__row{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;gap:7px}',
      '.one-edit-backup__row.is-manual{grid-template-columns:minmax(0,1fr) auto auto auto auto}',
      '.one-edit-backup select,.one-edit-backup button{min-height:38px;border:1px solid #3a4658;border-radius:8px;padding:7px 9px;background:#18212d;color:#f5f1ea;font:700 12px/1.2 inherit}',
      '.one-edit-backup button{cursor:pointer;white-space:nowrap}.one-edit-backup button:hover{border-color:#29a6a7}.one-edit-backup button:disabled{cursor:not-allowed;opacity:.45}',
      '.one-edit-backup [data-action="save"]{border-color:#29a6a7;background:#12383d;color:#8fe0d7}',
      '.one-edit-backup__note{margin-top:8px;color:#8f9aa8;font-size:10px;line-height:1.55}',
      '.one-edit-backup__status{min-height:17px;margin-top:7px;color:#8fd4c8;font-size:11px;line-height:1.45}',
      '.one-edit-backup__status.error{color:#ff7770}',
      '@media(max-width:680px){.one-edit-backup__row,.one-edit-backup__row.is-manual{grid-template-columns:1fr 1fr}.one-edit-backup__row select{grid-column:1/-1}}'
    ].join('');
    document.head.appendChild(style);
  }
  function panelFor(instance) {
    ensureStyles();
    var manual = isManual(instance);
    var panel = document.createElement('section');
    panel.className = 'one-edit-backup';
    panel.setAttribute('data-one-backup-ui', '');
    panel.setAttribute('aria-label', '最近編輯與 JSON 載入');
    panel.innerHTML =
      '<div class="one-edit-backup__title"><span>最近編輯與 JSON 載入</span><span class="one-edit-backup__badge">' +
        (manual ? '手動保留 5 次' : '自動保留 5 次') + '</span></div>' +
      '<div class="one-edit-backup__row' + (manual ? ' is-manual' : '') + '">' +
        '<select aria-label="最近編輯版本"></select>' +
        (manual ? '<button type="button" data-action="save">暫存目前內容</button>' : '') +
        '<button type="button" data-action="restore">還原</button>' +
        '<button type="button" data-action="load">載入 JSON</button>' +
        '<button type="button" data-action="clear">清除暫存</button>' +
      '</div>' +
      '<input type="file" accept="application/json,.json" hidden>' +
      '<div class="one-edit-backup__note">' +
        (manual ? '只有按「暫存目前內容」才會保存；未暫存的修改，重新整理或重開後會回到最後一筆。' : '關閉視窗後仍會保留；清除瀏覽器網站資料或換裝置則不會。') +
        (instance.config.imageNote ? '文字與設定會還原，單獨 JSON 不含圖片；完整搬移請使用下方 ZIP 專案包。' : 'JSON 可用於跨裝置備份。') +
      '</div>' +
      '<div class="one-edit-backup__status" aria-live="polite"></div>';
    return panel;
  }
  function setStatus(instance, message, error) {
    if (!instance.status) return;
    instance.status.textContent = message;
    instance.status.classList.toggle('error', Boolean(error));
  }
  function refresh(instance) {
    var history = readHistory(instance.id);
    instance.history = history;
    instance.select.innerHTML = '';
    if (!history.length) {
      var empty = document.createElement('option');
      empty.value = '';
      empty.textContent = '尚無暫存';
      instance.select.appendChild(empty);
    } else {
      history.forEach(function (item, index) {
        var option = document.createElement('option');
        option.value = String(index);
        option.textContent = '第 ' + (index + 1) + ' 次｜' + formatTime(item.saved_at);
        instance.select.appendChild(option);
      });
    }
    instance.restoreButton.disabled = !history.length;
    instance.clearButton.disabled = !history.length;
  }
  function capture(instance) { return clone(instance.config.capture ? instance.config.capture() : defaultCapture(instance.config)); }
  function persistSnapshot(instance, snapshot, reason) {
    if (!shouldPersist(instance, reason)) return { saved: false, ignored: true, duplicate: false };
    var history = readHistory(instance.id);
    if (history[0] && sameData(history[0].data, snapshot)) return { saved: false, ignored: false, duplicate: true };
    history = history.filter(function (item) { return !sameData(item && item.data, snapshot); });
    history.unshift({ schema: SCHEMA, tool_id: instance.id, generator_version: instance.config.generatorVersion || null, saved_at: new Date().toISOString(), reason: reason || 'edit', data: snapshot });
    writeHistory(instance.id, history);
    return { saved: true, ignored: false, duplicate: false };
  }
  function save(instance, reason) {
    if (instance.suspended || !shouldPersist(instance, reason)) return false;
    try {
      var snapshot = capture(instance);
      var result = persistSnapshot(instance, snapshot, reason);
      if (result.duplicate) {
        if (reason === 'manual') setStatus(instance, '目前內容與最新暫存相同，未新增重複版本。', false);
        return false;
      }
      if (!result.saved) return false;
      refresh(instance);
      setStatus(instance, (reason === 'manual' ? '已暫存目前內容；目前保留 ' : '已自動暫存；目前保留 ') + instance.history.length + '／5 次。', false);
      return true;
    } catch (error) {
      setStatus(instance, '暫存失敗：' + error.message, true);
      return false;
    }
  }
  function scheduleSave(instance, reason) {
    if (instance.suspended || !shouldPersist(instance, reason)) return;
    global.clearTimeout(instance.timer);
    instance.timer = global.setTimeout(function () { save(instance, reason); }, 650);
  }
  function applySnapshot(instance, snapshot, reason) {
    instance.suspended = true;
    try {
      if (instance.config.apply) instance.config.apply(clone(snapshot));
      else defaultApply(instance.config, clone(snapshot));
    } finally { instance.suspended = false; }
    if (!isManual(instance)) global.setTimeout(function () { save(instance, reason || 'restore'); }, 0);
  }
  function restoreSelected(instance) {
    var index = Number(instance.select.value);
    var item = instance.history[index];
    if (!item) return;
    try {
      applySnapshot(instance, item.data, 'restore');
      setStatus(instance, '已還原 ' + formatTime(item.saved_at) + ' 的內容。', false);
    } catch (error) { setStatus(instance, '還原失敗：' + error.message, true); }
  }
  function parseImported(instance, parsed) {
    if (parsed && parsed.schema === SCHEMA) {
      if (parsed.tool_id !== instance.id) throw new Error('這份 JSON 屬於其他工具（' + (parsed.tool_id || '未知') + '）。');
      if (!parsed.data || typeof parsed.data !== 'object') throw new Error('備份檔缺少 data。');
      return clone(parsed.data);
    }
    if (!instance.config.fromJSON) throw new Error('這不是此工具可載入的 JSON。');
    return clone(instance.config.fromJSON(parsed));
  }
  function importFile(instance, file) {
    if (!file) return;
    if (file.size > MAX_JSON_BYTES) { setStatus(instance, '載入失敗：JSON 不可超過 1 MB。', true); return; }
    var reader = new FileReader();
    reader.onerror = function () { setStatus(instance, '載入失敗：無法讀取檔案。', true); };
    reader.onload = function () {
      try {
        var parsed = JSON.parse(String(reader.result || ''));
        var snapshot = parseImported(instance, parsed);
        applySnapshot(instance, snapshot, 'json-import');
        setStatus(instance, (isManual(instance) ? 'JSON 載入成功；目前尚未暫存，需要保留時請按「暫存目前內容」。' : 'JSON 載入成功，並已加入最近 5 次編輯。') + (instance.config.imageNote ? ' 單獨 JSON 不含圖片；完整還原請改用 ZIP 專案包。' : ''), false);
      } catch (error) {
        setStatus(instance, '載入失敗：' + error.message + '；目前內容未變更。', true);
      } finally { instance.fileInput.value = ''; }
    };
    reader.readAsText(file, 'utf-8');
  }
  function placePanel(instance) {
    var config = instance.config;
    var anchor = typeof config.anchor === 'string' ? document.querySelector(config.anchor) : config.anchor;
    var host = typeof config.host === 'string' ? document.querySelector(config.host) : config.host;
    if (global.ONEAfterEditDock) global.ONEAfterEditDock.place(instance.id, instance.panel, { anchor: anchor, host: host });
    else if (host) host.appendChild(instance.panel);
    else if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(instance.panel, anchor.nextSibling);
    else (document.querySelector('.panel') || document.body).appendChild(instance.panel);
  }
  function attach(instance) {
    placePanel(instance);
    instance.select = instance.panel.querySelector('select');
    instance.saveButton = instance.panel.querySelector('[data-action="save"]');
    instance.restoreButton = instance.panel.querySelector('[data-action="restore"]');
    instance.clearButton = instance.panel.querySelector('[data-action="clear"]');
    instance.fileInput = instance.panel.querySelector('input[type="file"]');
    instance.status = instance.panel.querySelector('.one-edit-backup__status');
    instance.panel.querySelector('[data-action="load"]').onclick = function () { instance.fileInput.click(); };
    if (instance.saveButton) instance.saveButton.onclick = function () { save(instance, 'manual'); };
    instance.restoreButton.onclick = function () { restoreSelected(instance); };
    instance.clearButton.onclick = function () {
      try {
        global.localStorage.removeItem(storageKey(instance.id));
        refresh(instance);
        setStatus(instance, '已清除這個工具的暫存；目前畫面不受影響。', false);
      } catch (error) { setStatus(instance, '清除失敗：' + error.message, true); }
    };
    instance.fileInput.onchange = function (event) { importFile(instance, event.target.files[0]); };
    instance.listener = function (event) {
      if (instance.suspended || (event.target && event.target.closest && event.target.closest('[data-one-backup-ui]'))) return;
      scheduleSave(instance, 'edit');
    };
    if (!isManual(instance)) {
      document.addEventListener('input', instance.listener, true);
      document.addEventListener('change', instance.listener, true);
      document.addEventListener('click', instance.listener, true);
    }
    refresh(instance);
    if (instance.history.length) {
      try {
        applySnapshot(instance, instance.history[0].data, 'page-load');
        setStatus(instance, isManual(instance) ? '已載入最後一筆暫存；未暫存的修改不會寫入紀錄。' : '已自動載入上次編輯；可從清單還原最近 5 次。', false);
      } catch (error) { setStatus(instance, '上次暫存無法還原：' + error.message, true); }
    } else if (!isManual(instance)) global.setTimeout(function () { save(instance, 'initial'); }, 0);
    else setStatus(instance, '尚無手動暫存；完成編輯後請按「暫存目前內容」。', false);
  }
  function mount(config) {
    if (!config || !config.id) throw new Error('ONEEditBackup.mount 需要工具 id。');
    if (instances[config.id]) {
      instances[config.id].config = config;
      if (!instances[config.id].panel.isConnected) placePanel(instances[config.id]);
      return instances[config.id].api;
    }
    var instance = { id: config.id, config: config, history: [], suspended: false, timer: null };
    instance.panel = panelFor(instance);
    instance.api = {
      saveNow: function () { return save(instance, 'manual'); },
      restoreLatest: function () { refresh(instance); if (instance.history[0]) applySnapshot(instance, instance.history[0].data, 'restore'); },
      history: function () { return clone(readHistory(instance.id)); },
      clear: function () { global.localStorage.removeItem(storageKey(instance.id)); refresh(instance); },
      parseImported: function (parsed) { return parseImported(instance, parsed); }
    };
    instances[config.id] = instance;
    attach(instance);
    return instance.api;
  }

  global.ONEEditBackup = {
    mount: mount,
    schema: SCHEMA,
    version: '1.3.0',
    captureFields: function (root) { return collectFields(root || document); },
    applyFields: function (fields, root) { return applyFields(fields, root || document); },
    __test: {
      collectFields: collectFields,
      applyFields: applyFields,
      readHistory: readHistory,
      writeHistory: writeHistory,
      storageKey: storageKey,
      sameData: sameData,
      shouldPersist: function (config, reason) { return shouldPersist({ config: config || {} }, reason); },
      persistSnapshot: function (toolId, config, snapshot, reason) { return persistSnapshot({ id: toolId, config: config || {} }, clone(snapshot), reason); },
      parseImported: function (toolId, fromJSON, parsed) { return parseImported({ id: toolId, config: { fromJSON: fromJSON } }, parsed); },
      constants: { historyLimit: HISTORY_LIMIT, maxJsonBytes: MAX_JSON_BYTES }
    }
  };

  if (typeof document !== 'undefined' && document.readyState === 'loading' && typeof document.write === 'function') {
    document.write('<script src="./project-package-v1.js?v=1300"></' + 'script>');
  } else if (typeof document !== 'undefined' && document.createElement && document.head) {
    var packageScript = document.createElement('script');
    packageScript.src = './project-package-v1.js?v=1300';
    packageScript.onload = function () { if (global.ONEProjectPackage) global.ONEProjectPackage.wrapEditBackup(); };
    document.head.appendChild(packageScript);
  }
})(window);
