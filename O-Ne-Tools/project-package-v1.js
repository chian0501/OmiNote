/* O-Ne shared project package / smart download names — V1.1.0 */
(function (global) {
  'use strict';

  var VERSION = '1.1.0';
  var PACKAGE_SCHEMA = 'o-ne.project-package.v1';
  var MAX_PACKAGE_BYTES = 200 * 1024 * 1024;
  var mounts = Object.create(null);
  var activeMount = null;
  var anchorClickPatched = false;
  var encoder = new TextEncoder();
  var decoder = new TextDecoder('utf-8');

  var TOOL_NAMES = {
    'general-card': '一般卡',
    'trigger-card': '觸發卡',
    'persistent-card': '常駐卡',
    'effect-card': '效果卡',
    'move-card': '移動卡',
    'choice-card': '選項卡',
    'challenge-card': '挑戰卡',
    'dialogue-card': '對話卡',
    'dialogue-card-v135': '對話卡',
    'rating-card': '評分卡',
    'focus-card': '焦點卡',
    'thumbnail-frame': '縮圖品牌框',
    'settlement-card': '片尾結算卡'
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function cleanPart(value, fallback) {
    var text = String(value == null ? '' : value)
      .replace(/[\\/:*?"<>|]/g, ' ')
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[. ]+$/g, '');
    if (!text) text = fallback || '未命名';
    if (text.length > 60) text = text.slice(0, 60).trim();
    return text || (fallback || '未命名');
  }

  function toolName(id) {
    if (TOOL_NAMES[id]) return TOOL_NAMES[id];
    if (/dialogue/i.test(id || '')) return '對話卡';
    return cleanPart(id || '字卡', '字卡');
  }

  var STATE_NAMES = {
    EVENT: '事件', MISSION: '任務中', DONE: '成功', FAIL: '失敗', BUFF: '增益', DEBUFF: '減益',
    WHITE: '白色', ORANGE: '橘色', ACCEPT: '接受', ABANDON: '放棄',
    YES: 'YES', NO: 'NO', BODY: '內文', LIST: '項目', STEPS: '步驟',
    HERE: 'HERE', GET: 'GET', COST: 'COST', CUSTOM: '自訂'
  };
  var EFFECT_NAMES = {
    delicious: '好吃', cute: '可愛', love: '心動', praised: '開心',
    badTaste: '踩雷', shock: '打擊', backstab: '背刺', sick: '不舒服'
  };
  var CHARACTER_NAMES = { Omi: 'Omi', NieTe: '涅特', Kuma: 'Kuma', Nomi: 'Nomi', NPC: 'NPC' };

  function valueOfField(value) {
    if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'value')) return value.value;
    return value;
  }

  function snapshotValue(snapshot, key) {
    if (!snapshot || typeof snapshot !== 'object') return '';
    if (Object.prototype.hasOwnProperty.call(snapshot, key)) return valueOfField(snapshot[key]);
    var nested = ['fields', 'data', 'extra', 'content', 'settings'];
    for (var i = 0; i < nested.length; i++) {
      if (snapshot[nested[i]] && typeof snapshot[nested[i]] === 'object' && Object.prototype.hasOwnProperty.call(snapshot[nested[i]], key)) {
        return valueOfField(snapshot[nested[i]][key]);
      }
    }
    return '';
  }

  function stateName(value, fallback) {
    var raw = String(value == null ? '' : value).replace(/!/g, '').trim();
    if (!raw) return fallback || '標準';
    var upper = raw.toUpperCase();
    return STATE_NAMES[upper] || cleanPart(raw, fallback || '標準');
  }

  function originalToken(originalName, tokens) {
    var base = String(originalName || '').replace(/\.[^.]+$/, '').toUpperCase();
    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i];
      if (new RegExp('(?:^|[_-])' + token + '(?:[_-]|$)').test(base)) return token;
    }
    return '';
  }

  function selectedFileBase(id) {
    if (id !== 'thumbnail-frame' || typeof document === 'undefined') return '';
    var input = document.getElementById && document.getElementById('fileInput');
    var file = input && input.files && input.files[0];
    return file && file.name ? String(file.name).replace(/\.[^.]+$/, '') : '';
  }

  function textFromObject(obj, keys) {
    if (!obj || typeof obj !== 'object') return '';
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        var value = valueOfField(obj[key]);
        if (typeof value === 'string' && value.trim()) return value.trim();
      }
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

  function labelTextFor(element) {
    if (!element) return '';
    var label = element.id ? document.querySelector('label[for="' + CSS.escape(element.id) + '"]') : null;
    if (!label && element.closest) label = element.closest('label');
    return label ? String(label.textContent || '').trim() : '';
  }

  function inferFromDom() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll('input:not([type="file"]),textarea'));
    var best = null;
    var keywords = [
      ['標題', 100], ['主標', 100], ['任務文字', 96], ['商品名稱', 94], ['品名', 94],
      ['問題', 92], ['對話', 90], ['內容', 86], ['地點', 84], ['路線', 82], ['名稱', 78], ['文字', 70]
    ];
    nodes.forEach(function (node, index) {
      if (node.closest && (node.closest('[data-one-backup-ui]') || node.closest('[data-one-project-package-ui]'))) return;
      var value = String(node.value || '').replace(/\s+/g, ' ').trim();
      if (!value || /^\d+\s*\/\s*\d+$/.test(value) || value.length > 180) return;
      var label = labelTextFor(node);
      var score = 10 - Math.min(index, 9);
      keywords.forEach(function (pair) { if (label.indexOf(pair[0]) >= 0) score = Math.max(score, pair[1]); });
      if (!best || score > best.score) best = { score: score, value: value };
    });
    return best ? best.value : '';
  }

  function inferTitle(instance, snapshot) {
    if (instance.config.getTitle) {
      try {
        var custom = instance.config.getTitle(clone(snapshot));
        if (custom) return cleanPart(custom, '未命名');
      } catch (error) {}
    }
    var id = instance && instance.id || '';
    if (id === 'general-card') {
      var mode = snapshot && snapshot.currentMode;
      var draft = mode && snapshot.drafts && snapshot.drafts[mode];
      if (draft && draft.title) return cleanPart(draft.title, '未命名');
    }
    if (id === 'challenge-card' && snapshot && snapshot.copy) {
      var challengeTitle = [snapshot.copy.prefix, snapshot.copy.emphasis, snapshot.copy.suffix].join('');
      if (challengeTitle.trim()) return cleanPart(challengeTitle, '未命名');
    }
    if (id === 'focus-card') {
      var focusContent = snapshot && snapshot.content && snapshot.content[snapshot.mode];
      if (focusContent && focusContent.title) return cleanPart(focusContent.title, '未命名');
    }
    if (id === 'thumbnail-frame') {
      var uploadTitle = selectedFileBase(id);
      if (uploadTitle) return cleanPart(uploadTitle, '未命名');
    }
    var keys = [
      'title', 'main_title', 'mainTitle', 'headline', 'task_text', 'task', 'product_name', 'productName',
      'product', 'storeName', 'store_name', 'chapterTitle', 'chapter_title', 'question', 'prompt',
      'dialogue', 'text', 'name', 'location', 'place'
    ];
    var value = textFromObject(snapshot, keys) || inferFromDom();
    return cleanPart(value, '未命名');
  }

  function variantSuffix(originalName) {
    var base = String(originalName || '').replace(/\.[^.]+$/, '').toUpperCase();
    var tokens = ['WHITE', 'ORANGE', 'MISSION', 'DONE', 'FAIL', 'YES', 'NO', 'ACCEPT', 'ABANDON', 'LEFT', 'RIGHT'];
    for (var i = 0; i < tokens.length; i++) {
      var re = new RegExp('(?:^|[_-])' + tokens[i] + '(?:[_-]|$)');
      if (re.test(base)) return '_' + tokens[i];
    }
    return '';
  }

  function dialogueStatus(snapshot) {
    var parts = [];
    ['left', 'right'].forEach(function (side) {
      var item = snapshot && snapshot[side];
      if (!item || item.character === 'NONE') return;
      var name = CHARACTER_NAMES[item.character] || item.name || item.character;
      var expression = item.character === 'NPC' ? '' : item.expression;
      parts.push(cleanPart(String(name || '') + String(expression || ''), '角色'));
    });
    return parts.join('-') || '對話';
  }

  function choiceStatus(snapshot) {
    var options = snapshot && Array.isArray(snapshot.options) ? snapshot.options : [];
    var bright = options.filter(function (option) { return option && option.bright; });
    if (bright.length === 1) return '高亮-' + cleanPart(bright[0].text, '選項');
    if (bright.length > 1) return '高亮' + bright.length + '項';
    return '未高亮';
  }

  function ratingStatus(snapshot) {
    var ratings = snapshot && Array.isArray(snapshot.ratings) ? snapshot.ratings : [];
    var scores = ratings.filter(function (item) { return item && item.type === 'score' && Number.isFinite(Number(item.value)); })
      .map(function (item) { return Number(item.value); });
    if (scores.length) {
      var average = scores.reduce(function (sum, score) { return sum + score; }, 0) / scores.length;
      return '評分' + average.toFixed(1);
    }
    return cleanPart(snapshotValue(snapshot, 'tagText'), '評分');
  }

  function focusStatus(snapshot, originalName) {
    var label = snapshot && snapshot.label && snapshot.label.enabled && snapshot.label.text
      ? cleanPart(String(snapshot.label.text).replace(/!/g, ''), '') : '';
    var mode = stateName(snapshot && snapshot.mode, '內容');
    var output = originalToken(originalName, ['FRAME', 'TEXT']);
    var outputName = output === 'FRAME' ? '空框' : '含字';
    return [label, mode, outputName].filter(Boolean).join('-') || '標準';
  }

  function statusFromSnapshot(id, snapshot, originalName) {
    var token;
    if (id === 'general-card') {
      var generalMode = snapshot && snapshot.currentMode || snapshotValue(snapshot, 'mode');
      if (generalMode === 'CUSTOM' && snapshot && snapshot.drafts && snapshot.drafts.CUSTOM && snapshot.drafts.CUSTOM.label) {
        return cleanPart(snapshot.drafts.CUSTOM.label, '自訂');
      }
      return stateName(generalMode, '一般');
    }
    if (id === 'trigger-card') return stateName(snapshotValue(snapshot, 'state'), '事件');
    if (id === 'persistent-card') return stateName(snapshot && snapshot.state, '任務中');
    if (id === 'effect-card') return EFFECT_NAMES[snapshot && snapshot.current] || stateName(snapshot && snapshot.state, '效果');
    if (id === 'move-card') {
      token = originalToken(originalName, ['WHITE', 'ORANGE']);
      return stateName(token || snapshot && snapshot.previewState, '白色');
    }
    if (id === 'choice-card') return choiceStatus(snapshot);
    if (id === 'challenge-card') {
      return stateName(snapshot && snapshot.mode, '挑戰') + '-' + stateName(snapshot && snapshot.selected, '選擇');
    }
    if (id === 'dialogue-card' || id === 'dialogue-card-v135') return dialogueStatus(snapshot);
    if (id === 'rating-card') return ratingStatus(snapshot);
    if (id === 'focus-card') return focusStatus(snapshot, originalName);
    if (id === 'thumbnail-frame') {
      if (/含底圖/.test(originalName || '')) return '含底圖';
      if (/透明底/.test(originalName || '')) return '透明底';
      return selectedFileBase(id) ? '含底圖' : '透明底';
    }
    if (id === 'settlement-card') {
      var leftMode = snapshotValue(snapshot, 'leftMode');
      return { question: '提問', thumbnail: '縮圖', empty: '空白' }[leftMode] || '結算';
    }
    return stateName(snapshotValue(snapshot, 'state'), '標準');
  }

  function buildBaseName(id, title, status) {
    return [
      cleanPart(toolName(id), '字卡'),
      cleanPart(title, '未命名'),
      cleanPart(status, '標準')
    ].join('-');
  }

  function inferStatus(instance, snapshot, originalName) {
    if (instance.config.getStatus) {
      try {
        var custom = instance.config.getStatus(clone(snapshot), originalName || '');
        if (custom) return cleanPart(custom, '標準');
      } catch (error) {}
    }
    return statusFromSnapshot(instance.id, snapshot, originalName);
  }

  function smartName(instance, originalName) {
    var original = String(originalName || '');
    var match = original.match(/\.([A-Za-z0-9]+)$/);
    if (!match) return original;
    var ext = match[1].toLowerCase();
    if (ext !== 'png' && ext !== 'json') return original;
    var snapshot;
    try { snapshot = instance.config.capture ? clone(instance.config.capture()) : {}; }
    catch (error) { snapshot = {}; }
    var base = buildBaseName(instance.id, inferTitle(instance, snapshot), inferStatus(instance, snapshot, original));
    return base + '.' + ext;
  }

  function patchAnchorClick() {
    if (anchorClickPatched || !global.HTMLAnchorElement) return;
    anchorClickPatched = true;
    var originalClick = global.HTMLAnchorElement.prototype.click;
    global.HTMLAnchorElement.prototype.click = function () {
      try {
        if (activeMount && this.download) this.download = smartName(activeMount, this.download);
      } catch (error) {}
      return originalClick.apply(this, arguments);
    };
  }

  function toolFileInputs() {
    return Array.prototype.slice.call(document.querySelectorAll('input[type="file"]')).filter(function (input) {
      return !(input.closest && (input.closest('[data-one-backup-ui]') || input.closest('[data-one-project-package-ui]')));
    });
  }

  function compactKey(value) {
    var text = String(value == null ? '' : value)
      .replace(/[\\/:*?"<>|]/g, ' ')
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, '-')
      .replace(/[^\w\-\u3400-\u9fff]/g, '')
      .replace(/^-+|-+$/g, '');
    return text.slice(0, 48);
  }

  function semanticSlotText(input) {
    if (!input || !input.closest) return '';
    var slot = input.closest('.image-slot');
    if (slot) {
      var strong = slot.querySelector('strong');
      var slotText = strong ? String(strong.textContent || '').trim() : '';
      if (slotText) return slotText;
    }
    var aria = input.getAttribute && (input.getAttribute('aria-label') || input.getAttribute('data-label'));
    if (aria) return String(aria).trim();
    var label = input.closest('label');
    if (label) {
      var labelText = String(label.textContent || '').replace(/尚未選擇圖片/g, '').replace(/選擇圖片|更換圖片/g, '').trim();
      if (labelText) return labelText;
    }
    return '';
  }

  function ensureAssetKey(input, index) {
    if (input.id) return 'id:' + input.id;
    var name = input.getAttribute && input.getAttribute('name');
    if (name) return 'name:' + name;
    var slotText = compactKey(semanticSlotText(input));
    if (slotText) return 'slot:' + slotText;
    return 'index:' + String(index);
  }

  function isImageFile(file) {
    return file && (String(file.type || '').indexOf('image/') === 0 || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name || ''));
  }

  function attachAssetTracking(instance) {
    if (instance.assetListener) return;
    instance.assetListener = function (event) {
      var input = event.target;
      if (!input || input.type !== 'file' || (input.closest && (input.closest('[data-one-backup-ui]') || input.closest('[data-one-project-package-ui]')))) return;
      var files = Array.prototype.slice.call(input.files || []).filter(isImageFile);
      if (!files.length) return;
      var all = toolFileInputs();
      var key = ensureAssetKey(input, all.indexOf(input));
      instance.assets[key] = files.slice();
    };
    document.addEventListener('change', instance.assetListener, true);
  }

  function gatherAssets(instance) {
    var result = [];
    Object.keys(instance.assets).forEach(function (key) {
      (instance.assets[key] || []).forEach(function (file, index) {
        if (isImageFile(file)) result.push({ key: key, index: index, file: file });
      });
    });
    toolFileInputs().forEach(function (input, index) {
      var key = ensureAssetKey(input, index);
      Array.prototype.slice.call(input.files || []).filter(isImageFile).forEach(function (file, fileIndex) {
        var duplicate = result.some(function (item) { return item.key === key && item.file.name === file.name && item.file.size === file.size; });
        if (!duplicate) result.push({ key: key, index: fileIndex, file: file });
      });
    });
    return result;
  }

  function findInputByKey(key) {
    if (key.indexOf('id:') === 0) return document.getElementById(key.slice(3));
    var inputs = toolFileInputs();
    for (var i = 0; i < inputs.length; i++) {
      if (ensureAssetKey(inputs[i], i) === key) return inputs[i];
    }
    return null;
  }

  function dosDateTime(date) {
    var d = date || new Date();
    var year = Math.max(1980, d.getFullYear());
    return {
      time: ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((Math.floor(d.getSeconds() / 2)) & 31),
      date: (((year - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31)
    };
  }

  var CRC_TABLE = (function () {
    var table = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    var c = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function u16(value) {
    return new Uint8Array([value & 255, (value >>> 8) & 255]);
  }

  function u32(value) {
    return new Uint8Array([value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]);
  }

  function joinBytes(parts) {
    var length = parts.reduce(function (sum, part) { return sum + part.length; }, 0);
    var out = new Uint8Array(length);
    var offset = 0;
    parts.forEach(function (part) { out.set(part, offset); offset += part.length; });
    return out;
  }

  async function toBytes(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (value instanceof Blob) return new Uint8Array(await value.arrayBuffer());
    return encoder.encode(String(value == null ? '' : value));
  }

  async function makeZip(entries) {
    var locals = [];
    var centrals = [];
    var offset = 0;
    var stamp = dosDateTime(new Date());
    for (var i = 0; i < entries.length; i++) {
      var nameBytes = encoder.encode(entries[i].name);
      var data = await toBytes(entries[i].data);
      var crc = crc32(data);
      var local = joinBytes([
        u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(stamp.time), u16(stamp.date),
        u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), nameBytes, data
      ]);
      var central = joinBytes([
        u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(stamp.time), u16(stamp.date),
        u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameBytes
      ]);
      locals.push(local);
      centrals.push(central);
      offset += local.length;
    }
    var centralBytes = joinBytes(centrals);
    var body = joinBytes(locals);
    var end = joinBytes([
      u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
      u32(centralBytes.length), u32(body.length), u16(0)
    ]);
    return new Blob([body, centralBytes, end], { type: 'application/zip' });
  }

  function readU16(view, offset) { return view.getUint16(offset, true); }
  function readU32(view, offset) { return view.getUint32(offset, true); }

  async function readZip(file) {
    var bytes = new Uint8Array(await file.arrayBuffer());
    var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    var entries = Object.create(null);
    var offset = 0;
    while (offset + 4 <= bytes.length) {
      var sig = readU32(view, offset);
      if (sig === 0x02014b50 || sig === 0x06054b50) break;
      if (sig !== 0x04034b50) throw new Error('ZIP 結構無法辨識。');
      if (offset + 30 > bytes.length) throw new Error('ZIP 標頭不完整。');
      var flags = readU16(view, offset + 6);
      var method = readU16(view, offset + 8);
      var compressedSize = readU32(view, offset + 18);
      var nameLength = readU16(view, offset + 26);
      var extraLength = readU16(view, offset + 28);
      if (flags & 0x0008) throw new Error('此 ZIP 使用資料描述器，請使用 O-Ne 工具輸出的專案包。');
      if (method !== 0) throw new Error('此 ZIP 使用壓縮格式，請使用 O-Ne 工具輸出的專案包。');
      var nameStart = offset + 30;
      var dataStart = nameStart + nameLength + extraLength;
      var dataEnd = dataStart + compressedSize;
      if (dataEnd > bytes.length) throw new Error('ZIP 內容不完整。');
      var name = decoder.decode(bytes.slice(nameStart, nameStart + nameLength));
      entries[name] = bytes.slice(dataStart, dataEnd);
      offset = dataEnd;
    }
    return entries;
  }

  function largestCanvas() {
    var canvases = Array.prototype.slice.call(document.querySelectorAll('canvas'));
    if (!canvases.length) return null;
    canvases.sort(function (a, b) { return (b.width * b.height) - (a.width * a.height); });
    return canvases[0];
  }

  function canvasBlob(instance) {
    return new Promise(function (resolve) {
      var canvas = instance.config.getCanvas ? instance.config.getCanvas() : largestCanvas();
      if (!canvas || typeof canvas.toBlob !== 'function') return resolve(null);
      try { canvas.toBlob(function (blob) { resolve(blob || null); }, 'image/png'); }
      catch (error) { resolve(null); }
    });
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function setStatus(instance, message, isError) {
    if (!instance.status) return;
    instance.status.textContent = message;
    instance.status.classList.toggle('error', Boolean(isError));
  }

  function ensureStyles() {
    if (document.getElementById('one-project-package-style')) return;
    var style = document.createElement('style');
    style.id = 'one-project-package-style';
    style.textContent = [
      '.one-project-package{margin-top:10px;padding:12px;border:1px solid #354052;border-radius:11px;background:#101620;color:#c9d1db;font-family:"Noto Sans TC","Microsoft JhengHei",sans-serif}',
      '.one-project-package__title{margin-bottom:8px;font-size:12px;font-weight:900;color:#f0a8cf}',
      '.one-project-package__row{display:flex;gap:7px;flex-wrap:wrap}',
      '.one-project-package button{min-height:38px;border:1px solid #3a4658;border-radius:8px;padding:7px 10px;background:#18212d;color:#f5f1ea;font:700 12px/1.2 inherit;cursor:pointer}',
      '.one-project-package button[data-action="export-package"]{border-color:#29a6a7;background:#12383d;color:#8fe0d7}',
      '.one-project-package__note{margin-top:7px;color:#8f9aa8;font-size:10px;line-height:1.55}',
      '.one-project-package__status{min-height:17px;margin-top:6px;color:#8fd4c8;font-size:11px;line-height:1.45}',
      '.one-project-package__status.error{color:#ff7770}'
    ].join('');
    document.head.appendChild(style);
  }

  function panelFor(instance) {
    ensureStyles();
    var panel = document.createElement('section');
    panel.className = 'one-project-package';
    panel.setAttribute('data-one-project-package-ui', '');
    panel.innerHTML =
      '<div class="one-project-package__title">完整專案包</div>' +
      '<div class="one-project-package__row">' +
        '<button type="button" data-action="export-package">下載專案包 ZIP</button>' +
        '<button type="button" data-action="import-package">載入專案包 ZIP</button>' +
      '</div>' +
      '<input type="file" accept=".zip,application/zip" hidden>' +
      '<div class="one-project-package__note">ZIP 會一起保存目前 PNG、編輯設定 JSON 與已置入圖片；檔名統一為「卡片分類-標題-狀態」，不加 O-Ne。舊 JSON 仍可照原方式使用。</div>' +
      '<div class="one-project-package__status" aria-live="polite"></div>';
    return panel;
  }

  function placePanel(instance) {
    var backups = document.querySelectorAll('[data-one-backup-ui]');
    var backup = backups.length ? backups[backups.length - 1] : null;
    if (backup && backup.parentNode) backup.parentNode.insertBefore(instance.panel, backup.nextSibling);
    else {
      var anchor = typeof instance.config.anchor === 'string' ? document.querySelector(instance.config.anchor) : instance.config.anchor;
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(instance.panel, anchor.nextSibling);
      else (document.querySelector('.panel') || document.body).appendChild(instance.panel);
    }
  }

  async function exportPackage(instance) {
    try {
      var snapshot = instance.config.capture ? clone(instance.config.capture()) : {};
      var title = inferTitle(instance, snapshot);
      var status = inferStatus(instance, snapshot, '');
      var base = buildBaseName(instance.id, title, status);
      var assets = gatherAssets(instance);
      var assetManifest = [];
      var entries = [];
      var seenNames = Object.create(null);
      var total = 0;
      for (var i = 0; i < assets.length; i++) {
        var file = assets[i].file;
        var shortKey = cleanPart(assets[i].key.replace(/^id:|^name:|^slot:|^index:/, ''), 'image');
        var original = cleanPart(file.name || ('image-' + (i + 1)), 'image-' + (i + 1));
        var path = 'assets/' + shortKey + '__' + original;
        var n = 2;
        while (seenNames[path]) {
          path = 'assets/' + shortKey + '__' + n + '__' + original;
          n++;
        }
        seenNames[path] = true;
        total += file.size || 0;
        if (total > MAX_PACKAGE_BYTES) throw new Error('置入圖片總量超過 200 MB，請先縮小圖片後再打包。');
        assetManifest.push({ input_key: assets[i].key, file_name: file.name, mime_type: file.type || '', size: file.size || 0, zip_path: path });
        entries.push({ name: path, data: file });
      }
      var project = {
        schema: PACKAGE_SCHEMA,
        package_version: VERSION,
        tool_id: instance.id,
        tool_name: toolName(instance.id),
        generator_version: instance.config.generatorVersion || null,
        saved_at: new Date().toISOString(),
        title: title,
        status: status,
        data: snapshot,
        assets: assetManifest
      };
      entries.unshift({ name: base + '.json', data: JSON.stringify(project, null, 2) });
      var preview = await canvasBlob(instance);
      if (preview) entries.splice(1, 0, { name: base + '.png', data: preview });
      var zip = await makeZip(entries);
      downloadBlob(zip, base + '.zip');
      setStatus(instance, '專案包已建立｜' + assetManifest.length + ' 個置入圖片' + (preview ? '＋目前 PNG' : '') + '。', false);
    } catch (error) {
      setStatus(instance, '專案包建立失敗：' + error.message, true);
    }
  }

  function restoreFileToInput(input, file) {
    if (!input || !global.DataTransfer) return false;
    try {
      var transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch (error) {
      return false;
    }
  }

  function delay(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

  async function importPackage(instance, file) {
    if (!file) return;
    try {
      if (file.size > MAX_PACKAGE_BYTES) throw new Error('ZIP 超過 200 MB。');
      var entries = await readZip(file);
      var jsonNames = Object.keys(entries).filter(function (name) { return /\.json$/i.test(name) && name.indexOf('/') < 0; });
      if (!jsonNames.length) throw new Error('ZIP 找不到專案 JSON。');
      var project = JSON.parse(decoder.decode(entries[jsonNames[0]]));
      if (!project || project.schema !== PACKAGE_SCHEMA) throw new Error('這不是 O-Ne 專案包。');
      if (project.tool_id !== instance.id) throw new Error('這份專案包屬於其他工具（' + (project.tool_name || project.tool_id || '未知') + '）。');

      if (instance.config.apply) instance.config.apply(clone(project.data));
      await delay(350);

      var restored = 0;
      var missing = 0;
      var assets = Array.isArray(project.assets) ? project.assets : [];
      for (var i = 0; i < assets.length; i++) {
        var meta = assets[i];
        var bytes = entries[meta.zip_path];
        var input = findInputByKey(meta.input_key || '');
        if (!bytes || !input) { missing++; continue; }
        var restoredFile = new File([bytes], meta.file_name || 'image', { type: meta.mime_type || 'application/octet-stream' });
        if (restoreFileToInput(input, restoredFile)) {
          instance.assets[meta.input_key] = [restoredFile];
          restored++;
          await delay(160);
        } else missing++;
      }
      if (assets.length) {
        await delay(650);
        if (instance.config.apply) instance.config.apply(clone(project.data));
      }
      setStatus(instance, '專案包載入成功｜設定已還原' + (assets.length ? '，圖片 ' + restored + '／' + assets.length + ' 個已回填' : '') + (missing ? '；' + missing + ' 個圖片欄位未能自動回填' : '') + '。', Boolean(missing));
    } catch (error) {
      setStatus(instance, '專案包載入失敗：' + error.message + '；目前內容未覆蓋。', true);
    } finally {
      if (instance.fileInput) instance.fileInput.value = '';
    }
  }

  function mount(config) {
    if (!config || !config.id) throw new Error('ONEProjectPackage.mount 需要工具 id。');
    if (mounts[config.id]) {
      mounts[config.id].config = config;
      activeMount = mounts[config.id];
      return mounts[config.id].api;
    }
    var instance = { id: config.id, config: config, assets: Object.create(null), panel: null, status: null, fileInput: null, assetListener: null };
    instance.panel = panelFor(instance);
    placePanel(instance);
    instance.status = instance.panel.querySelector('.one-project-package__status');
    instance.fileInput = instance.panel.querySelector('input[type="file"]');
    instance.panel.querySelector('[data-action="export-package"]').onclick = function () { exportPackage(instance); };
    instance.panel.querySelector('[data-action="import-package"]').onclick = function () { instance.fileInput.click(); };
    instance.fileInput.onchange = function (event) { importPackage(instance, event.target.files && event.target.files[0]); };
    attachAssetTracking(instance);
    activeMount = instance;
    patchAnchorClick();
    instance.api = {
      exportPackage: function () { return exportPackage(instance); },
      importPackage: function (file) { return importPackage(instance, file); },
      smartName: function (name) { return smartName(instance, name); },
      title: function () {
        var snapshot = instance.config.capture ? clone(instance.config.capture()) : {};
        return inferTitle(instance, snapshot);
      }
    };
    mounts[config.id] = instance;
    return instance.api;
  }

  function wrapEditBackup() {
    if (!global.ONEEditBackup || !global.ONEEditBackup.mount || global.ONEEditBackup.__projectPackageWrapped) return;
    var originalMount = global.ONEEditBackup.mount;
    global.ONEEditBackup.mount = function (config) {
      var api = originalMount(config);
      mount({
        id: config.id,
        generatorVersion: config.generatorVersion || null,
        anchor: config.anchor || config.host || null,
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
        }
      });
      return api;
    };
    global.ONEEditBackup.__projectPackageWrapped = true;
  }

  global.ONEProjectPackage = {
    mount: mount,
    version: VERSION,
    schema: PACKAGE_SCHEMA,
    wrapEditBackup: wrapEditBackup,
    __test: {
      cleanPart: cleanPart,
      variantSuffix: variantSuffix,
      crc32: crc32,
      makeZip: makeZip,
      readZip: readZip,
      toolName: toolName,
      stateName: stateName,
      statusFromSnapshot: statusFromSnapshot,
      buildBaseName: buildBaseName,
      assetKey: ensureAssetKey
    }
  };

  wrapEditBackup();

  if (typeof document !== 'undefined' && document.readyState === 'loading' && typeof document.write === 'function') {
    document.write('<script src="./batch-render-v1.js?v=110"></' + 'script>');
  } else if (typeof document !== 'undefined' && document.createElement && document.head) {
    var batchScript = document.createElement('script');
    batchScript.src = './batch-render-v1.js?v=110';
    document.head.appendChild(batchScript);
  }

  if (typeof document !== 'undefined' && document.readyState === 'loading' && typeof document.write === 'function') {
    document.write('<script src="./ai-json-guide-v1.js?v=104"></' + 'script>');
  } else if (typeof document !== 'undefined' && document.createElement && document.head) {
    var aiGuideScript = document.createElement('script');
    aiGuideScript.src = './ai-json-guide-v1.js?v=104';
    aiGuideScript.onload = function () { if (global.ONEAIJsonGuide) global.ONEAIJsonGuide.wrapProjectPackage(); };
    document.head.appendChild(aiGuideScript);
  }
})(window);
