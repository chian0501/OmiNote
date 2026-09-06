/* Direct text editing over the native canvas. Renderers and saved formats remain the source of truth. */
(function (global) {
  'use strict';
  var drawings = new WeakMap(), imageTargets = new WeakMap();
  var mounted, queued = false;
  var selector = '.one-workspace-preview canvas';
  var fieldsByTool = {
    general: '#title,#subtitle,#customLabel', trigger: '#title,#subtitle,#progress',
    persistent: '#task,#progress', effect: '#titleText,#subtitleText', move: '#title,input[data-k="station"],input[data-k="name"]',
    choice: '#title,#question,#optionList input[data-action="text"]',
    challenge: '#prefix,#emphasis,#suffix,#yesText,#noText',
    dialogue: '#leftName,#rightName,#dialogue',
    rating: '#tagText,#storeName,#address,#priceBadgeText,#priceText,#reviewText,#ratingList input[data-field="label"],#ratingList input[data-field="value"]',
    focus: '.one-workspace-editor input:not([type]),.one-workspace-editor input[type="text"],.one-workspace-editor textarea',
    'thumbnail-frame': '#cornerText',
    settlement: '#chapterTitle,#chapterSubtitle,#summaryText,#nextText,#questionHint,#viewerQuestion,.row-editor input[type="text"]'
  };
  var names = { title: '主標題', subtitle: '副標題', question: '問題／提示', task: '任務文字', progress: '進度',
    titleText: '主標題', subtitleText: '副標題', prefix: '開頭文字', emphasis: '重點文字', suffix: '結尾文字',
    yesText: '接受按鈕文字', noText: '放棄按鈕文字', leftName: '左側名稱', rightName: '右側名稱', dialogue: '對話內容',
    tagText: '標籤文字', storeName: '店家／商品名稱', address: '地址／購買地點', priceBadgeText: '價格徽章',
    priceText: '價格／份量', reviewText: '心得', cornerText: '角標文字', chapterTitle: '篇章標題',
    chapterSubtitle: '篇章副標', summaryText: '單行總結', nextText: 'NEXT 文字', questionHint: '問題提示', viewerQuestion: '觀眾互動問題' };

  function enabled() { return document.body && fieldsByTool[document.body.dataset.oneCardWorkspace] && new URL(location.href).searchParams.get('embed') !== '1'; }
  function normal(value) { return String(value || '').normalize('NFKC').replace(/\s|\*\*|\[\[|\]\]|【|】/g, ''); }
  function transformRect(rect, matrix) {
    var points = [[rect.x, rect.y], [rect.x + rect.w, rect.y], [rect.x, rect.y + rect.h], [rect.x + rect.w, rect.y + rect.h]].map(function (p) {
      return { x: matrix.a * p[0] + matrix.c * p[1] + matrix.e, y: matrix.b * p[0] + matrix.d * p[1] + matrix.f };
    });
    var xs = points.map(function (p) { return p.x; }), ys = points.map(function (p) { return p.y; });
    return { x: Math.min.apply(null, xs), y: Math.min.apply(null, ys), w: Math.max.apply(null, xs) - Math.min.apply(null, xs), h: Math.max.apply(null, ys) - Math.min.apply(null, ys) };
  }
  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; if (mounted) refresh(); else mount(); });
  }
  function textRecord(ctx, text, x, y, maxWidth) {
    var metrics = ctx.measureText(text), size = parseFloat((ctx.font.match(/([\d.]+)px/) || [0, 16])[1]);
    var factor = maxWidth > 0 && metrics.width > maxWidth ? maxWidth / metrics.width : 1;
    var left = metrics.actualBoundingBoxLeft, right = metrics.actualBoundingBoxRight;
    if (!Number.isFinite(left) || !Number.isFinite(right)) {
      left = ctx.textAlign === 'center' ? metrics.width / 2 : ['right', 'end'].includes(ctx.textAlign) ? metrics.width : 0;
      right = metrics.width - left;
    }
    var ascent = metrics.actualBoundingBoxAscent, descent = metrics.actualBoundingBoxDescent;
    if (!Number.isFinite(ascent) || !Number.isFinite(descent) || ascent + descent < 1) { ascent = size * .8; descent = size * .2; }
    var matrix = ctx.getTransform();
    var rect = transformRect({ x: x - left * factor, y: y - ascent, w: Math.max(1, (left + right) * factor), h: Math.max(1, ascent + descent) }, matrix);
    return { text: String(text), rect: rect, font: ctx.font, color: typeof ctx.fillStyle === 'string' ? ctx.fillStyle : '#fdf3e7', size: size * Math.hypot(matrix.c, matrix.d) };
  }
  // Observe draw commands without changing any pixels. Offscreen canvas text is
  // carried through drawImage so the React focus card uses the same hit testing.
  var getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function () {
    var ctx = getContext.apply(this, arguments);
    if (arguments[0] !== '2d' || !ctx || !enabled() || drawings.has(this)) return ctx;
    var canvas = this, records = [];
    drawings.set(canvas, records);
    var fillText = ctx.fillText, clearRect = ctx.clearRect, drawImage = ctx.drawImage;
    ctx.clearRect = function (x, y, w, h) {
      var result = clearRect.apply(this, arguments);
      if (x <= 0 && y <= 0 && w >= canvas.width && h >= canvas.height) records.length = 0;
      if (canvas.isConnected) queue();
      return result;
    };
    ctx.fillText = function (text, x, y, maxWidth) {
      var result = fillText.apply(this, arguments);
      // Trigger renders two fields in one left-aligned draw call. Retain their
      // separate measured positions while leaving the actual draw untouched.
      var sub = document.body.dataset.oneCardWorkspace === 'trigger' && document.getElementById('subtitle');
      var progress = sub && document.getElementById('progress');
      if (sub && progress && sub.value.trim() && progress.value.trim() && String(text) === sub.value.trim() + ' ' + progress.value.trim()) {
        records.push(textRecord(this, sub.value.trim(), x, y));
        records.push(textRecord(this, progress.value.trim(), x + this.measureText(sub.value.trim() + ' ').width, y));
      } else records.push(textRecord(this, text, x, y, maxWidth));
      if (canvas.isConnected) queue();
      return result;
    };
    ctx.drawImage = function (source) {
      var result = drawImage.apply(this, arguments), sourceRecords = drawings.get(source);
      if (!sourceRecords || !sourceRecords.length || source === canvas) return result;
      var args = Array.prototype.slice.call(arguments, 1), sx = 0, sy = 0, sw = source.width, sh = source.height;
      var dx = args[0], dy = args[1], dw = sw, dh = sh;
      if (args.length === 4) { dw = args[2]; dh = args[3]; }
      if (args.length === 8) { sx = args[0]; sy = args[1]; sw = args[2]; sh = args[3]; dx = args[4]; dy = args[5]; dw = args[6]; dh = args[7]; }
      var matrix = this.getTransform();
      sourceRecords.forEach(function (record) {
        var r = record.rect;
        if (r.x + r.w < sx || r.y + r.h < sy || r.x > sx + sw || r.y > sy + sh) return;
        var rect = transformRect({ x: dx + (r.x - sx) * dw / sw, y: dy + (r.y - sy) * dh / sh, w: r.w * dw / sw, h: r.h * dh / sh }, matrix);
        records.push(Object.assign({}, record, { rect: rect, size: record.size * dh / sh * Math.hypot(matrix.c, matrix.d) }));
      });
      if (canvas.isConnected) queue();
      return result;
    };
    return ctx;
  };

  function fields() {
    if (!enabled()) return [];
    return Array.prototype.map.call(document.querySelectorAll(fieldsByTool[document.body.dataset.oneCardWorkspace]), function (input, index) {
      var label = names[input.id], nativeLabel = input.labels && input.labels[0];
      if (input.placeholder === '輸入卡片標題') label = '主標題';
      if (input.placeholder === '輸入標籤文字') label = '標籤文字';
      if (document.body.dataset.oneCardWorkspace === 'focus') {
        if (input.tagName === 'TEXTAREA') label = '一般內文';
        if (input.closest('.item-row')) label = '項目 ' + (Array.prototype.indexOf.call(document.querySelectorAll('.item-row'), input.closest('.item-row')) + 1);
      }
      if (input.dataset.action === 'text') label = '選項 ' + (Number(input.dataset.index) + 1);
      if (input.dataset.k === 'station') label = '站點 ' + (Number(input.dataset.i) + 1);
      if (input.dataset.k === 'name') label = '路段 ' + (Number(input.dataset.i) + 1);
      if (!label && nativeLabel) label = nativeLabel.querySelector('.field-label') ? nativeLabel.querySelector('.field-label').textContent : nativeLabel.textContent;
      if (input.closest('.rating-editor')) label = '評分 ' + (Array.prototype.indexOf.call(document.querySelectorAll('.rating-editor'), input.closest('.rating-editor')) + 1) + '｜' + label;
      if (!label) label = input.placeholder || (input.closest('.item-row') ? '項目 ' + (index + 1) : '文字 ' + (index + 1));
      return { key: input.id || 'field-' + index, index: index, input: input, label: label.replace(/\s+/g, ' ').trim().slice(0,45), value: input.value };
    }).filter(function (field) { return !field.input.disabled && !field.input.readOnly; });
  }
  function mergeRects(records) {
    var x = Math.min.apply(null, records.map(function (r) { return r.rect.x; }));
    var y = Math.min.apply(null, records.map(function (r) { return r.rect.y; }));
    return { x: x, y: y, w: Math.max.apply(null, records.map(function (r) { return r.rect.x + r.rect.w; })) - x,
      h: Math.max.apply(null, records.map(function (r) { return r.rect.y + r.rect.h; })) - y };
  }
  function targets() {
    var records = drawings.get(mounted.canvas) || [], used = new Set(), result = [];
    fields().sort(function (a, b) { return normal(b.value).length - normal(a.value).length || a.index - b.index; }).forEach(function (field) {
      var value = normal(field.value), variants = [value], match;
      if (field.input.type === 'number' && value !== '') variants.push(Number(field.value).toFixed(1));
      if (field.input.type === 'number' && field.input.closest('.rating-editor') && value !== '') variants.push(normal(Number(field.value).toFixed(1) + ' / 5'));
      if (value) {
        // First seek complete runs, then the native wrapped/highlighted fragments.
        for (var pass = 0; pass < 2 && !match; pass++) {
          for (var i = 0; i < records.length && !match; i++) {
            if (used.has(i)) continue;
            var combined = '';
            for (var j = i; j < records.length && j < i + 80; j++) {
              if (used.has(j)) break;
              combined += normal(records[j].text);
              var candidate = pass === 0 ? combined : combined.replace(/^\d+[.、]|^—/, '');
              if (variants.includes(candidate)) { match = { start: i, end: j }; break; }
              if (combined.length > Math.max.apply(null, variants.map(function (v) { return v.length; })) + 5) break;
            }
          }
        }
      }
      if (match) {
        var picked = records.slice(match.start, match.end + 1);
        for (var n = match.start; n <= match.end; n++) used.add(n);
        var target = Object.assign({}, field, { rect: mergeRects(picked), style: picked[0] });
        result.push(target); mounted.lastTargets.set(field.key, target);
      } else if (!value && mounted.lastTargets.has(field.key)) {
        result.push(Object.assign({}, mounted.lastTargets.get(field.key), field));
      }
    });
    (imageTargets.get(mounted.canvas) || []).forEach(function (target) {
      var input = document.getElementById(target.inputId);
      if (input && input.type === 'file' && !input.disabled) result.push(target);
    });
    return result.sort(function (a, b) { return a.rect.y - b.rect.y || a.rect.x - b.rect.x; });
  }
  function sourceFor(key) { return fields().find(function (field) { return field.key === key; }); }
  function writeField(key, value) {
    var field = sourceFor(key);
    if (!field) return;
    var proto = field.input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(field.input, value);
    field.input.dispatchEvent(new Event('input', { bubbles: true }));
    field.input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function finish(cancel, focus) {
    var session = mounted && mounted.session;
    if (!session) return;
    mounted.session = null;
    if (cancel) { writeField(session.target.key, session.original); if (session.format) session.format.restore(); }
    else writeField(session.target.key, session.input.value);
    session.panel.remove(); mounted.canvas.removeAttribute('data-one-direct-editing');
    refresh();
    if (focus) {
      var button = Array.prototype.find.call(mounted.buttons.children, function (node) { return node.dataset.fieldKey === session.target.key; });
      if (button) button.focus({ preventScroll: true });
    }
  }
  function edit(target) {
    finish(false, false);
    var field = sourceFor(target.key);
    if (!field) return;
    var tool = document.body.dataset.oneCardWorkspace, inline = ['focus', 'rating'].includes(tool);
    var panel = document.createElement('div'); panel.className = 'one-direct-editor' + (inline ? ' one-direct-inline-editor' : ''); panel.dataset.oneDirectUi = '1';
    var head = document.createElement('div'); head.className = 'one-direct-editor-head';
    var name = document.createElement('strong'); name.textContent = target.label;
    var done = document.createElement('button'); done.type = 'button'; done.textContent = '完成';
    var cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = '取消';
    var multiline = field.input.tagName === 'TEXTAREA';
    var input = document.createElement(inline ? 'div' : multiline ? 'textarea' : 'input'); input.className = 'one-direct-input';
    if (inline) {
      input.contentEditable = 'plaintext-only'; input.setAttribute('role', 'textbox'); input.setAttribute('aria-multiline', String(multiline));
      Object.defineProperty(input, 'value', { get: function () { return input.innerText.replace(/\r/g, ''); }, set: function (value) { input.textContent = value; } });
      input.select = function () { var range = document.createRange(); range.selectNodeContents(input); var selection = global.getSelection(); selection.removeAllRanges(); selection.addRange(range); };
    }
    input.setAttribute('aria-label', '直接編輯：' + target.label); input.value = field.value; input.spellcheck = false;
    if (!inline && !multiline) input.type = field.input.type === 'number' ? 'number' : 'text';
    ['maxlength', 'min', 'max', 'step'].forEach(function (key) { if (field.input.hasAttribute(key)) input.setAttribute(key, field.input.getAttribute(key)); });
    head.append(name, done, cancel); panel.append(head, input); mounted.layer.appendChild(panel);
    var formatter = tool === 'rating' ? global.ONERatingTextStyle : global.ONEFocusTextStyle;
    var format = inline && formatter && formatter.describe(field.input);
    mounted.session = { target: target, original: field.value, input: input, panel: panel, multiline: multiline, composing: false, inline: inline, format: format };
    if (format) addFormatControls(head, input, format);
    mounted.canvas.setAttribute('data-one-direct-editing', '1');
    done.addEventListener('click', function () { finish(false, true); });
    cancel.addEventListener('click', function () { finish(true, true); });
    input.addEventListener('compositionstart', function () { if (mounted.session) mounted.session.composing = true; });
    input.addEventListener('compositionend', function () { if (mounted.session) { mounted.session.composing = false; writeField(target.key, input.value); } });
    input.addEventListener('input', function () { if (mounted.session && !mounted.session.composing) writeField(target.key, input.value); });
    input.addEventListener('keydown', function (event) {
      if (event.isComposing || event.keyCode === 229 || mounted.session.composing) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish(true, true); }
      if (event.key === 'Enter' && (!multiline || event.ctrlKey || event.metaKey)) { event.preventDefault(); finish(false, true); }
    });
    panel.addEventListener('focusout', function () { setTimeout(function () { if (mounted.session && mounted.session.panel === panel && !panel.contains(document.activeElement)) finish(false, false); }, 0); });
    positionEditor(); input.focus({ preventScroll: true }); input.select();
  }
  function addFormatControls(head, input, format) {
    var controls = document.createElement('div'); controls.className = 'one-direct-format';
    controls.setAttribute('role', 'toolbar'); controls.setAttribute('aria-label', '文字格式');
    if (format.size !== null) {
      var label = document.createElement('label'); label.textContent = format.sizeLabel || (format.kind === 'title' ? '標題字級' : '內文／項目字級');
      var size = document.createElement('input'); size.type = 'number'; size.min = format.min; size.max = format.max; size.value = format.size;
      size.setAttribute('aria-label', label.textContent); label.appendChild(size); controls.appendChild(label);
      size.addEventListener('input', function () { if (size.value && size.validity.valid) format.update({ size: Number(size.value) }); });
    }
    format.colors.forEach(function (entry) {
      var button = document.createElement('button'); button.type = 'button'; button.textContent = entry[1];
      button.setAttribute('aria-label', '字色：' + entry[1]); button.style.setProperty('--text-color', entry[0]);
      button.setAttribute('aria-pressed', String(format.color.toUpperCase() === entry[0]));
      button.addEventListener('click', function () {
        format.update({ color: entry[0] }); controls.querySelectorAll('[aria-pressed]').forEach(function (node) { node.setAttribute('aria-pressed', String(node === button)); });
      }); controls.appendChild(button);
    });
    if (format.kind !== 'label' && format.emphasis !== false) {
      var mark = document.createElement('button'); mark.type = 'button'; mark.textContent = '強調選字';
      mark.addEventListener('pointerdown', function (event) { event.preventDefault(); });
      mark.addEventListener('click', function () {
        var selection = global.getSelection(); if (!selection.rangeCount || selection.isCollapsed) return;
        var range = selection.getRangeAt(0); if (!input.contains(range.commonAncestorContainer)) return;
        var value = range.toString(); range.deleteContents(); var node = document.createTextNode('【' + value + '】'); range.insertNode(node);
        range.selectNode(node); selection.removeAllRanges(); selection.addRange(range); input.dispatchEvent(new Event('input', { bubbles: true })); input.focus();
      }); controls.appendChild(mark);
    }
    head.appendChild(controls);
  }
  function positionEditor() {
    if (!mounted.session) return;
    var session = mounted.session, rect = session.target.rect, box = mounted.canvas.getBoundingClientRect(), scale = box.width / mounted.canvas.width;
    if (session.inline) {
      var fontSize = Math.max(16, session.target.style.size * scale), lineHeight = session.format && session.format.kind === 'body' ? 1.45 : 1.18;
      var inlineWidth = Math.min(box.width, Math.max(120, rect.w * scale + 16));
      var inlineX = Math.max(0, Math.min(box.width - inlineWidth, rect.x * scale - 4));
      Object.assign(session.panel.style, { left: inlineX + 'px', top: Math.max(0, rect.y * scale - fontSize * .12 - 4) + 'px', width: inlineWidth + 'px' });
      Object.assign(session.input.style, { font: session.target.style.font, fontSize: fontSize + 'px', lineHeight: String(lineHeight), color: session.target.style.color, minHeight: Math.max(fontSize * lineHeight, rect.h * scale + 8) + 'px' });
      var head = session.panel.firstChild, toolbarWidth = Math.min(480, Math.max(0, box.width));
      head.style.width = toolbarWidth + 'px'; head.style.left = Math.max(-inlineX, Math.min(0, box.width - inlineX - toolbarWidth)) + 'px';
      var top = parseFloat(session.panel.style.top), headHeight = head.getBoundingClientRect().height;
      var roomAbove = box.top - mounted.stage.getBoundingClientRect().top + top;
      head.style.bottom = roomAbove >= headHeight + 8 ? 'calc(100% + 8px)' : 'auto';
      head.style.top = roomAbove >= headHeight + 8 ? 'auto' : 'calc(100% + 8px)';
      return;
    }
    var width = Math.min(box.width, Math.max(240, rect.w * scale + 28)), x = Math.max(0, Math.min(box.width - width, rect.x * scale - 6));
    session.panel.style.left = x + 'px'; session.panel.style.top = Math.max(0, rect.y * scale - 36) + 'px'; session.panel.style.width = width + 'px';
    session.input.style.font = session.target.style.font;
    session.input.style.fontSize = Math.max(16, Math.min(40, session.target.style.size * scale)) + 'px';
    session.input.style.color = session.target.style.color;
    session.input.style.height = Math.max(session.multiline ? 88 : 42, rect.h * scale + 24) + 'px';
  }
  function refresh() {
    if (!mounted || !mounted.canvas.isConnected) return;
    var box = mounted.canvas.getBoundingClientRect(), parent = mounted.stage.getBoundingClientRect();
    var sx = box.width / mounted.canvas.width, sy = box.height / mounted.canvas.height;
    Object.assign(mounted.layer.style, { left: box.left - parent.left + mounted.stage.scrollLeft + 'px', top: box.top - parent.top + mounted.stage.scrollTop + 'px', width: box.width + 'px', height: box.height + 'px' });
    if (mounted.session) {
      if (mounted.session.inline) {
        var current = targets().find(function (target) { return target.key === mounted.session.target.key; });
        if (current) mounted.session.target = current;
      }
      positionEditor(); return;
    }
    var list = targets(); mounted.targets = list;
    var nodes = list.map(function (target) {
      var node = document.createElement('button'), r = target.rect;
      var isImage = target.type === 'image', padding = isImage ? 0 : 4;
      node.type = 'button'; node.className = 'one-direct-target' + (isImage ? ' one-direct-image-target' : ''); node.dataset.fieldKey = target.key;
      node.setAttribute('aria-label', (isImage ? '更換：' : '編輯：') + target.label);
      node.title = (isImage ? '點一下更換：' : '點一下直接編輯：') + target.label;
      var x = Math.max(0, r.x * sx - padding), y = Math.max(0, r.y * sy - padding);
      Object.assign(node.style, { left: x + 'px', top: y + 'px', width: Math.max(12, Math.min(box.width - x, r.w * sx + padding * 2)) + 'px', height: Math.max(16, r.h * sy + padding * 2) + 'px' });
      node.addEventListener('click', function () {
        if (!isImage) { edit(target); return; }
        var input = document.getElementById(target.inputId);
        if (input && !input.disabled) {
          // Clear only the picker so choosing the same file again fires change.
          // The renderer retains the current image if the picker is cancelled.
          input.value = ''; input.click();
        }
      }); return node;
    });
    list.filter(function (t) { return t.type === 'image' && typeof t.onEdit === 'function'; }).forEach(function (target) {
      var crop = document.createElement('button'), r = target.rect;
      crop.type = 'button'; crop.className = 'one-direct-crop-target'; crop.textContent = '裁切';
      crop.setAttribute('aria-label', '裁切：' + target.label);
      Object.assign(crop.style, { left: Math.max(0, (r.x + r.w) * sx - 52) + 'px', top: Math.max(0, (r.y + r.h) * sy - 34) + 'px' });
      crop.addEventListener('click', function (event) { event.stopPropagation(); target.onEdit(); }); nodes.push(crop);
    });
    mounted.buttons.replaceChildren.apply(mounted.buttons, nodes);
  }
  function mount() {
    if (mounted || !enabled()) return;
    var canvas = document.querySelector(selector), stage = canvas && canvas.closest('.preview-wrap,.stage,.canvas-stage');
    if (!canvas || !stage) return;
    var layer = document.createElement('div'), buttons = document.createElement('div');
    layer.className = 'one-direct-layer'; layer.dataset.oneDirectUi = '1'; buttons.className = 'one-direct-targets'; layer.appendChild(buttons); stage.appendChild(layer);
    mounted = { canvas: canvas, stage: stage, layer: layer, buttons: buttons, lastTargets: new Map(), session: null };
    var observer = new ResizeObserver(queue); observer.observe(canvas); observer.observe(stage);
    stage.addEventListener('scroll', queue, { passive: true }); global.addEventListener('resize', queue);
    document.addEventListener('pointerdown', function (event) { if (mounted.session && !mounted.session.panel.contains(event.target)) finish(false, false); }, true);
    refresh();
  }
  document.addEventListener('DOMContentLoaded', function () {
    mount();
    new MutationObserver(function (changes) { if (changes.some(function (change) { return !change.target.closest || !change.target.closest('[data-one-direct-ui]'); })) queue(); }).observe(document.body, { childList: true, subtree: true });
  });
  global.ONECardDirectEdit = {
    version: '1.3.0', refresh: queue, finish: function () { finish(false, false); },
    setImageTargets: function (canvas, targets) {
      imageTargets.set(canvas, targets.filter(function (target) {
        return target.rect && ['x', 'y', 'w', 'h'].every(function (key) { return Number.isFinite(target.rect[key]); }) && target.rect.w > 0 && target.rect.h > 0;
      }).map(function (target) { return Object.assign({}, target, { type: 'image', key: 'image-' + target.inputId }); }));
      queue();
    }
  };
})(window);
