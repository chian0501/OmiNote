/* O-Ne shared same-tool batch renderer — V1.1.0 */
(function (global) {
  'use strict';

  var VERSION = '1.3.0';
  var MAX_BATCH_FILES = 20;
  var MAX_BATCH_BYTES = 200 * 1024 * 1024;
  var WORKER_PARAM = '__one_batch_worker';
  var batches = Object.create(null);
  var workerAdapters = Object.create(null);
  var isWorker = false;

  try {
    isWorker = new URL(global.location.href).searchParams.get(WORKER_PARAM) === '1';
  } catch (error) {}

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function helper() {
    if (!global.ONEProjectPackage || !global.ONEProjectPackage.__test) throw new Error('專案包核心尚未載入。');
    return global.ONEProjectPackage.__test;
  }
  function toolName(id) { return helper().toolName(id); }
  function cleanPart(value, fallback) { return helper().cleanPart(value, fallback); }
  function extension(name) {
    var match = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
    return match ? match[1] : '';
  }
  function topLevelNames(entries, pattern) {
    return Object.keys(entries || {}).filter(function (name) { return name.indexOf('/') < 0 && pattern.test(name); });
  }
  function textFromObject(obj, keys) {
    if (!obj || typeof obj !== 'object') return '';
    for (var i = 0; i < keys.length; i++) {
      var value = obj[keys[i]];
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (value && typeof value === 'object' && typeof value.value === 'string' && value.value.trim()) return value.value.trim();
    }
    var nested = ['fields', 'data', 'extra', 'content', 'settings'];
    for (var j = 0; j < nested.length; j++) {
      if (obj[nested[j]] && typeof obj[nested[j]] === 'object') {
        var found = textFromObject(obj[nested[j]], keys);
        if (found) return found;
      }
    }
    return '';
  }
  function inferTitle(adapter, snapshot, fallback) {
    if (adapter.getTitle) {
      try {
        var custom = adapter.getTitle(clone(snapshot));
        if (custom) return cleanPart(custom, fallback || '未命名');
      } catch (error) {}
    }
    var value = textFromObject(snapshot, [
      'title', 'main_title', 'mainTitle', 'headline', 'task_text', 'task', 'storeName', 'store_name',
      'product_name', 'productName', 'product', 'question', 'prompt', 'dialogue', 'text', 'name', 'location', 'place'
    ]);
    return cleanPart(value || fallback || '未命名', '未命名');
  }
  function outputName(adapter, snapshot, title, status) {
    var resolvedTitle = cleanPart(title || inferTitle(adapter, snapshot), '未命名');
    var resolvedStatus = cleanPart(status || helper().statusFromSnapshot(adapter.id, snapshot || {}, ''), '標準');
    return helper().buildBaseName(adapter.id, resolvedTitle, resolvedStatus) + '.png';
  }
  function uniqueName(name, used) {
    if (!used[name]) { used[name] = 1; return name; }
    var dot = name.lastIndexOf('.');
    var base = dot >= 0 ? name.slice(0, dot) : name;
    var ext = dot >= 0 ? name.slice(dot) : '';
    var n = ++used[name];
    var candidate = base + '-' + String(n).padStart(2, '0') + ext;
    while (used[candidate]) { n++; candidate = base + '-' + String(n).padStart(2, '0') + ext; }
    used[candidate] = 1;
    return candidate;
  }
  function todayStamp() {
    var d = new Date();
    return String(d.getFullYear()) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  }

  function parsePersistentJson(payload, current) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('JSON 最外層必須是物件。');
    if (payload.component_id != null && payload.component_id !== 'PERSISTENT-MISSION') throw new Error('component_id 不是 PERSISTENT-MISSION。');
    if (payload.tool != null && payload.tool !== 'persistent-card') throw new Error('tool 不是 persistent-card。');
    var state = String(payload.state == null ? '' : payload.state).toUpperCase().replace(/!/g, '').trim();
    if (['MISSION','DONE','FAIL'].indexOf(state) < 0) throw new Error('state 必須是 MISSION、DONE! 或 FAIL。');
    var task = payload.task_text != null ? payload.task_text : payload.task;
    if (task == null) throw new Error('缺少 task_text。');
    if (payload.progress == null) throw new Error('缺少 progress。');
    current = current || {};
    return {
      state: state,
      task: String(task),
      progress: String(payload.progress),
      taskSize: Number(payload.task_font_size != null ? payload.task_font_size : (current.taskSize || 21)),
      progressSize: Number(payload.progress_font_size != null ? payload.progress_font_size : (current.progressSize || 20)),
      savedAt: new Date().toISOString()
    };
  }

  function adapterFromEditBackup(config) {
    return {
      id: config.id,
      imageNote: Boolean(config.imageNote),
      getTitle: config.getTitle,
      getCanvas: config.getCanvas,
      capture: function () {
        if (config.capture) return clone(config.capture());
        return {
          fields: global.ONEEditBackup.captureFields(config.root || document),
          extra: config.getExtra ? clone(config.getExtra()) : null
        };
      },
      apply: function (snapshot) {
        if (config.apply) return config.apply(clone(snapshot));
        global.ONEEditBackup.applyFields(snapshot && snapshot.fields || {}, config.root || document);
        if (config.applyExtra) config.applyExtra(clone(snapshot && snapshot.extra));
        if (config.afterApply) config.afterApply(clone(snapshot));
      },
      parseJSON: function (parsed) {
        if (parsed && parsed.schema === 'o-ne.edit-backup.v1') {
          if (parsed.tool_id !== config.id) throw new Error('這份 JSON 屬於其他工具（' + (parsed.tool_id || '未知') + '）。');
          if (!parsed.data || typeof parsed.data !== 'object') throw new Error('備份檔缺少 data。');
          return clone(parsed.data);
        }
        if (!config.fromJSON) throw new Error('這不是此工具可載入的 JSON。');
        return clone(config.fromJSON(parsed));
      }
    };
  }

  function adapterFromProject(config) {
    return {
      id: config.id,
      imageNote: Boolean(config.imageNote),
      getTitle: config.getTitle,
      getCanvas: config.getCanvas,
      capture: function () { return config.capture ? clone(config.capture()) : {}; },
      apply: function (snapshot) { if (config.apply) return config.apply(clone(snapshot)); },
      parseJSON: function (parsed) {
        if (config.parseJSON) return clone(config.parseJSON(parsed));
        if (config.id === 'persistent-card') return parsePersistentJson(parsed, config.capture ? config.capture() : {});
        throw new Error('這個工具尚未提供獨立 JSON 批次解析。');
      }
    };
  }

  function registerAdapter(adapter) {
    if (!adapter || !adapter.id) return;
    workerAdapters[adapter.id] = adapter;
    if (!isWorker) mountBatch(adapter);
  }

  function patchMounts() {
    if (global.ONEEditBackup && global.ONEEditBackup.mount && !global.ONEEditBackup.__batchRenderWrapped) {
      var originalEditMount = global.ONEEditBackup.mount;
      global.ONEEditBackup.mount = function (config) {
        var api = originalEditMount(config);
        registerAdapter(adapterFromEditBackup(config));
        return api;
      };
      global.ONEEditBackup.__batchRenderWrapped = true;
    }
    if (global.ONEProjectPackage && global.ONEProjectPackage.mount && !global.ONEProjectPackage.__batchRenderWrapped) {
      var originalProjectMount = global.ONEProjectPackage.mount;
      global.ONEProjectPackage.mount = function (config) {
        var api = originalProjectMount(config);
        registerAdapter(adapterFromProject(config));
        return api;
      };
      global.ONEProjectPackage.__batchRenderWrapped = true;
    }
  }

  async function inspectFile(adapter, file) {
    var ext = extension(file && file.name);
    if (ext !== 'json' && ext !== 'zip') return { file: file, ready: false, level: 'error', message: '只接受 JSON 或 ZIP。' };
    if (ext === 'json') {
      try {
        var parsed = JSON.parse(await file.text());
        var snapshot = adapter.parseJSON(parsed);
        if (adapter.imageNote) {
          return { file: file, kind: 'json', ready: false, level: 'warning', snapshot: snapshot, title: inferTitle(adapter, snapshot), message: '此工具可能含置入圖片；批次請改用 ZIP 專案包。' };
        }
        return { file: file, kind: 'json', ready: true, level: 'ok', snapshot: snapshot, title: inferTitle(adapter, snapshot), message: '可輸出' };
      } catch (error) {
        return { file: file, kind: 'json', ready: false, level: 'error', message: error.message || 'JSON 無法解析。' };
      }
    }
    try {
      var entries = await helper().readZip(file);
      var jsonNames = topLevelNames(entries, /\.json$/i);
      if (!jsonNames.length) throw new Error('ZIP 找不到專案 JSON。');
      var project = JSON.parse(new TextDecoder('utf-8').decode(entries[jsonNames[0]]));
      if (!project || project.schema !== 'o-ne.project-package.v1') throw new Error('這不是 O-Ne 專案包。');
      if (project.tool_id !== adapter.id) throw new Error('卡種不符：這份 ZIP 是 ' + (project.tool_name || project.tool_id || '其他工具') + '。');
      var pngNames = topLevelNames(entries, /\.png$/i);
      var missingAssets = (Array.isArray(project.assets) ? project.assets : []).filter(function (asset) { return !entries[asset.zip_path]; }).length;
      if (missingAssets) throw new Error('ZIP 缺少 ' + missingAssets + ' 個圖片資產。');
      return {
        file: file,
        kind: 'zip',
        ready: true,
        level: 'ok',
        title: cleanPart(project.title || inferTitle(adapter, project.data), '未命名'),
        project: project,
        directPngName: pngNames[0] || null,
        directPngBytes: pngNames[0] ? entries[pngNames[0]] : null,
        message: pngNames[0] ? '可輸出｜直接取用專案包 PNG' : '可輸出｜將重新渲染'
      };
    } catch (error) {
      return { file: file, kind: 'zip', ready: false, level: 'error', message: error.message || 'ZIP 無法解析。' };
    }
  }

  function toolInputs() {
    return Array.prototype.slice.call(document.querySelectorAll('input[type="file"]')).filter(function (input) {
      return !(input.closest && (input.closest('[data-one-backup-ui]') || input.closest('[data-one-project-package-ui]') || input.closest('[data-one-batch-render-ui]')));
    });
  }
  function findInputByKey(key) {
    if (!key) return null;
    if (key.indexOf('id:') === 0) return document.getElementById(key.slice(3));
    var inputs = toolInputs();
    for (var i = 0; i < inputs.length; i++) {
      if (helper().assetKey(inputs[i], i) === key) return inputs[i];
    }
    return null;
  }
  function restoreFileToInput(input, file) {
    if (!input || !global.DataTransfer) return false;
    try {
      var transfer = new global.DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch (error) { return false; }
  }
  function delay(ms) { return new Promise(function (resolve) { global.setTimeout(resolve, ms); }); }
  function largestCanvas() {
    var canvases = Array.prototype.slice.call(document.querySelectorAll('canvas'));
    if (!canvases.length) return null;
    canvases.sort(function (a, b) { return (b.width * b.height) - (a.width * a.height); });
    return canvases[0];
  }
  function canvasBlob(adapter) {
    return new Promise(function (resolve, reject) {
      var canvas = adapter.getCanvas ? adapter.getCanvas() : largestCanvas();
      if (!canvas || typeof canvas.toBlob !== 'function') return reject(new Error('找不到可輸出的 Canvas。'));
      try {
        canvas.toBlob(function (blob) { if (blob) resolve(blob); else reject(new Error('PNG 產生失敗。')); }, 'image/png');
      } catch (error) { reject(error); }
    });
  }

  async function applyProject(adapter, project, entries) {
    adapter.apply(clone(project.data));
    await delay(350);
    var assets = Array.isArray(project.assets) ? project.assets : [];
    for (var i = 0; i < assets.length; i++) {
      var meta = assets[i];
      var bytes = entries[meta.zip_path];
      var input = findInputByKey(meta.input_key || '');
      if (!bytes || !input) throw new Error('圖片欄位無法回填：' + (meta.file_name || meta.input_key || '未知圖片'));
      var restoredFile = new global.File([bytes], meta.file_name || 'image', { type: meta.mime_type || 'application/octet-stream' });
      if (!restoreFileToInput(input, restoredFile)) throw new Error('圖片無法回填：' + (meta.file_name || '未知圖片'));
      await delay(180);
    }
    if (assets.length) {
      await delay(650);
      adapter.apply(clone(project.data));
    }
    await delay(120);
  }

  async function renderSingle(file, expectedId) {
    var adapter = workerAdapters[expectedId];
    if (!adapter) throw new Error('批次工作器尚未取得 ' + expectedId + ' 編輯器。');
    var ext = extension(file && file.name);
    var snapshot;
    var title;
    var status;
    if (ext === 'json') {
      if (adapter.imageNote) throw new Error('圖片型工具請使用 ZIP 專案包批次輸出。');
      var parsed = JSON.parse(await file.text());
      snapshot = adapter.parseJSON(parsed);
      adapter.apply(clone(snapshot));
      title = inferTitle(adapter, snapshot);
      await delay(300);
    } else if (ext === 'zip') {
      var entries = await helper().readZip(file);
      var jsonNames = topLevelNames(entries, /\.json$/i);
      if (!jsonNames.length) throw new Error('ZIP 找不到專案 JSON。');
      var project = JSON.parse(new TextDecoder('utf-8').decode(entries[jsonNames[0]]));
      if (!project || project.schema !== 'o-ne.project-package.v1' || project.tool_id !== adapter.id) throw new Error('專案包卡種不符。');
      snapshot = project.data;
      title = cleanPart(project.title || inferTitle(adapter, snapshot), '未命名');
      status = cleanPart(project.status || helper().statusFromSnapshot(adapter.id, snapshot, ''), '標準');
      await applyProject(adapter, project, entries);
    } else throw new Error('只接受 JSON 或 ZIP。');
    var blob = await canvasBlob(adapter);
    return { blob: blob, filename: outputName(adapter, snapshot, title, status) };
  }

  function ensureStyles() {
    if (document.getElementById('one-batch-render-style')) return;
    var style = document.createElement('style');
    style.id = 'one-batch-render-style';
    style.textContent = [
      '.one-batch-render{margin-top:10px;padding:12px;border:1px solid #354052;border-radius:11px;background:#101620;color:#c9d1db;font-family:"Noto Sans TC","Microsoft JhengHei",sans-serif}',
      '.one-batch-render__title{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;font-size:12px;font-weight:900;color:#f0a8cf}',
      '.one-batch-render__badge{font-size:10px;color:#8fe0d7;background:#21363b;border-radius:999px;padding:3px 7px}',
      '.one-batch-render__row{display:flex;gap:7px;flex-wrap:wrap}',
      '.one-batch-render button{min-height:38px;border:1px solid #3a4658;border-radius:8px;padding:7px 10px;background:#18212d;color:#f5f1ea;font:700 12px/1.2 inherit;cursor:pointer}',
      '.one-batch-render button[data-action="run"]{border-color:#29a6a7;background:#12383d;color:#8fe0d7}',
      '.one-batch-render button:disabled{cursor:not-allowed;opacity:.45}',
      '.one-batch-render__list{display:grid;gap:5px;max-height:220px;overflow:auto;margin-top:8px}',
      '.one-batch-render__item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:7px 8px;border:1px solid #2c3545;border-radius:8px;background:#121925;font-size:10px;line-height:1.4}',
      '.one-batch-render__item span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.one-batch-render__item.ok span:last-child{color:#8fd4c8}.one-batch-render__item.warning span:last-child{color:#ffcf6d}.one-batch-render__item.error span:last-child{color:#ff7770}',
      '.one-batch-render__note{margin-top:7px;color:#8f9aa8;font-size:10px;line-height:1.55}',
      '.one-batch-render__status{min-height:17px;margin-top:6px;color:#8fd4c8;font-size:11px;line-height:1.45}',
      '.one-batch-render__status.error{color:#ff7770}'
    ].join('');
    document.head.appendChild(style);
  }

  function panelFor(instance) {
    ensureStyles();
    var panel = document.createElement('section');
    panel.className = 'one-batch-render';
    panel.setAttribute('data-one-batch-render-ui', '');
    panel.innerHTML =
      '<div class="one-batch-render__title"><span>批次出圖</span><span class="one-batch-render__badge">同卡種最多 20 份</span></div>' +
      '<div class="one-batch-render__row">' +
        '<button type="button" data-action="select">選擇多個 JSON／ZIP</button>' +
        '<button type="button" data-action="run" disabled>開始批次出圖</button>' +
        '<button type="button" data-action="stop" disabled>停止</button>' +
        '<button type="button" data-action="clear" disabled>清空</button>' +
      '</div>' +
      '<input type="file" accept=".json,.zip,application/json,application/zip" multiple hidden>' +
      '<div class="one-batch-render__list"></div>' +
      '<div class="one-batch-render__note">純文字卡可批次讀 JSON；評分卡、焦點卡、縮圖品牌框、片尾結算卡等圖片型工具請用 ZIP 專案包，避免輸出少圖版本。結果會一次下載為 PNG ZIP。</div>' +
      '<div class="one-batch-render__status" aria-live="polite"></div>';
    return panel;
  }

  function placePanel(instance) {
    var packages = document.querySelectorAll('[data-one-project-package-ui]');
    var pkg = packages.length ? packages[packages.length - 1] : null;
    if (global.ONEAfterEditDock) global.ONEAfterEditDock.place(instance.id, instance.panel, { anchor: pkg });
    else if (pkg && pkg.parentNode) pkg.parentNode.insertBefore(instance.panel, pkg.nextSibling);
    else (document.querySelector('.panel') || document.body).appendChild(instance.panel);
  }
  function setStatus(instance, message, error) {
    instance.status.textContent = message || '';
    instance.status.classList.toggle('error', Boolean(error));
  }
  function refreshList(instance) {
    instance.list.innerHTML = '';
    instance.items.forEach(function (item) {
      var row = document.createElement('div');
      row.className = 'one-batch-render__item ' + (item.level || 'error');
      row.innerHTML = '<span></span><span></span>';
      row.children[0].textContent = item.file && item.file.name || '未命名';
      row.children[1].textContent = item.message || '';
      instance.list.appendChild(row);
    });
    var readyCount = instance.items.filter(function (item) { return item.ready; }).length;
    instance.runButton.disabled = !readyCount || instance.running;
    instance.clearButton.disabled = !instance.items.length || instance.running;
    instance.stopButton.disabled = !instance.running;
    if (!instance.running) setStatus(instance, instance.items.length ? ('已載入 ' + instance.items.length + ' 份｜可輸出 ' + readyCount + ' 份') : '尚未選擇批次檔案。', false);
  }

  async function chooseFiles(instance, files) {
    var selected = Array.prototype.slice.call(files || []);
    instance.fileInput.value = '';
    if (!selected.length) return;
    if (selected.length > MAX_BATCH_FILES) {
      selected = selected.slice(0, MAX_BATCH_FILES);
      setStatus(instance, '一次最多 20 份，已只取前 20 份。', true);
    }
    var total = selected.reduce(function (sum, file) { return sum + Number(file.size || 0); }, 0);
    if (total > MAX_BATCH_BYTES) {
      instance.items = [];
      refreshList(instance);
      setStatus(instance, '批次檔案總量超過 200 MB，請分批處理。', true);
      return;
    }
    instance.items = [];
    setStatus(instance, '正在檢查 ' + selected.length + ' 份檔案…', false);
    for (var i = 0; i < selected.length; i++) {
      var item = await inspectFile(instance.adapter, selected[i]);
      instance.items.push(item);
      refreshList(instance);
    }
  }

  function workerUrl() {
    var url = new URL(global.location.href);
    url.searchParams.set(WORKER_PARAM, '1');
    url.hash = '';
    return url.href;
  }
  async function renderViaWorker(instance, file) {
    var iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;width:1px;height:1px;left:-9999px;top:-9999px;opacity:0;pointer-events:none;border:0';
    iframe.src = workerUrl();
    document.body.appendChild(iframe);
    try {
      await new Promise(function (resolve, reject) {
        var timer = global.setTimeout(function () { reject(new Error('批次工作器載入逾時。')); }, 15000);
        iframe.onload = function () { global.clearTimeout(timer); resolve(); };
        iframe.onerror = function () { global.clearTimeout(timer); reject(new Error('批次工作器載入失敗。')); };
      });
      var win = iframe.contentWindow;
      var started = Date.now();
      while (!(win && win.ONEBatchRender && win.ONEBatchRender.hasAdapter(instance.adapter.id))) {
        if (Date.now() - started > 15000) throw new Error('批次工作器找不到目前卡種。');
        await delay(120);
      }
      var result = await win.ONEBatchRender.renderSingle(file, instance.adapter.id);
      var bytes = new Uint8Array(await result.blob.arrayBuffer());
      return { bytes: bytes, filename: result.filename };
    } finally {
      iframe.remove();
    }
  }

  async function runBatch(instance) {
    if (instance.running) return;
    var ready = instance.items.filter(function (item) { return item.ready; });
    if (!ready.length) return;
    instance.running = true;
    instance.abort = false;
    refreshList(instance);
    var outputs = [];
    var used = Object.create(null);
    var failures = 0;
    try {
      for (var i = 0; i < ready.length; i++) {
        if (instance.abort) break;
        var item = ready[i];
        setStatus(instance, '批次處理 ' + (i + 1) + '／' + ready.length + '｜' + item.file.name, false);
        try {
          var filename;
          var bytes;
          if (item.kind === 'zip' && item.directPngBytes) {
            filename = outputName(instance.adapter, item.project.data, item.title, item.project.status);
            bytes = item.directPngBytes;
          } else {
            var rendered = await renderViaWorker(instance, item.file);
            filename = rendered.filename;
            bytes = rendered.bytes;
          }
          outputs.push({ name: uniqueName(filename, used), data: bytes });
          item.level = 'ok';
          item.message = '已輸出';
        } catch (error) {
          failures++;
          item.level = 'error';
          item.message = '失敗｜' + (error.message || '無法輸出');
        }
        refreshList(instance);
      }
      if (!outputs.length) throw new Error(instance.abort ? '批次已停止，沒有完成的 PNG。' : '沒有成功產生 PNG。');
      var zip = await helper().makeZip(outputs);
      var name = [toolName(instance.adapter.id), '批次輸出', todayStamp()].map(function (part) {
        return cleanPart(part, '未命名');
      }).join('-') + '.zip';
      var url = URL.createObjectURL(zip);
      var a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      global.setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
      setStatus(instance, (instance.abort ? '已停止｜' : '完成｜') + outputs.length + ' 張 PNG 已打包下載' + (failures ? '；失敗 ' + failures + ' 份' : '') + '。', Boolean(failures));
    } catch (error) {
      setStatus(instance, error.message || '批次輸出失敗。', true);
    } finally {
      instance.running = false;
      instance.abort = false;
      refreshList(instance);
    }
  }

  function mountBatch(adapter) {
    if (batches[adapter.id]) {
      batches[adapter.id].adapter = adapter;
      return batches[adapter.id];
    }
    var instance = { adapter: adapter, panel: null, fileInput: null, list: null, status: null, runButton: null, stopButton: null, clearButton: null, items: [], running: false, abort: false };
    instance.panel = panelFor(instance);
    placePanel(instance);
    instance.fileInput = instance.panel.querySelector('input[type="file"]');
    instance.list = instance.panel.querySelector('.one-batch-render__list');
    instance.status = instance.panel.querySelector('.one-batch-render__status');
    instance.runButton = instance.panel.querySelector('[data-action="run"]');
    instance.stopButton = instance.panel.querySelector('[data-action="stop"]');
    instance.clearButton = instance.panel.querySelector('[data-action="clear"]');
    instance.panel.querySelector('[data-action="select"]').onclick = function () { instance.fileInput.click(); };
    instance.fileInput.onchange = function (event) { chooseFiles(instance, event.target.files); };
    instance.runButton.onclick = function () { runBatch(instance); };
    instance.stopButton.onclick = function () { instance.abort = true; setStatus(instance, '收到停止要求，會在目前這張完成後停止。', false); };
    instance.clearButton.onclick = function () { instance.items = []; refreshList(instance); };
    batches[adapter.id] = instance;
    refreshList(instance);
    return instance;
  }

  patchMounts();

  global.ONEBatchRender = {
    version: VERSION,
    hasAdapter: function (id) { return Boolean(workerAdapters[id]); },
    renderSingle: renderSingle,
    __test: {
      extension: extension,
      outputName: function (id, snapshot, title) { return outputName({ id: id, getTitle: null }, snapshot || {}, title || '未命名'); },
      uniqueName: uniqueName,
      parsePersistentJson: parsePersistentJson,
      inspectFile: inspectFile,
      constants: { maxFiles: MAX_BATCH_FILES, maxBytes: MAX_BATCH_BYTES, workerParam: WORKER_PARAM }
    }
  };
})(window);
