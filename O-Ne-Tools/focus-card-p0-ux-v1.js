/* O-Ne focus card P0 direct-edit UX patch — V0.1.2
 * Scope: focus-card only. Keeps the existing React renderer, save formats and
 * 【...】 emphasis syntax as the source of truth while making the syntax optional
 * for human editors.
 */
(function (global) {
  'use strict';

  if (global.ONEFocusP0UX) return;

  var VERSION = '0.1.2';
  var STYLE_ID = 'one-focus-p0-ux-style';
  var observer = null;
  var pulseTimer = null;
  var canvasPulseTimer = null;

  function isFocusPage() {
    return Boolean(document.body && document.body.dataset.oneCardWorkspace === 'focus');
  }

  function directFields() {
    return Array.prototype.slice.call(document.querySelectorAll(
      '.one-workspace-editor input:not([type]),.one-workspace-editor input[type="text"],.one-workspace-editor textarea'
    )).filter(function (field) { return !field.disabled && !field.readOnly; });
  }

  function fieldForKey(key) {
    if (!key) return null;
    var exact = document.getElementById(key);
    if (exact) return exact;
    var fallback = /^field-(\d+)$/.exec(key);
    return fallback ? directFields()[Number(fallback[1])] || null : null;
  }

  function ensureModeForField(field) {
    if (!field || field.tagName !== 'TEXTAREA') return;
    var bodyTab = Array.prototype.find.call(document.querySelectorAll('.mode-tabs button'), function (button) {
      return button.textContent.trim() === '一般內文';
    });
    if (bodyTab && !bodyTab.classList.contains('is-active')) bodyTab.click();
  }

  function pulse(node, className, timerName) {
    if (!node) return;
    node.classList.remove(className);
    void node.offsetWidth;
    node.classList.add(className);
    if (timerName === 'canvas') {
      clearTimeout(canvasPulseTimer);
      canvasPulseTimer = setTimeout(function () { node.classList.remove(className); }, 950);
    } else {
      clearTimeout(pulseTimer);
      pulseTimer = setTimeout(function () { node.classList.remove(className); }, 950);
    }
  }

  function revealSidebarField(field) {
    if (!field) return;
    ensureModeForField(field);
    var group = field.closest('details.focus-settings-group');
    if (group) group.open = true;
    var target = field.closest('.item-row,.editor-section,.field') || field;
    var scroller = field.closest('.editor-scroll');
    if (scroller) {
      var scrollerRect = scroller.getBoundingClientRect();
      var targetRect = target.getBoundingClientRect();
      var nextTop = scroller.scrollTop + targetRect.top - scrollerRect.top - Math.max(42, scroller.clientHeight * 0.28);
      scroller.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
    } else {
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    pulse(target, 'one-focus-sidebar-linked', 'sidebar');
  }

  function directTargetForField(field) {
    if (!field) return null;
    if (field.id) {
      var escaped = global.CSS && typeof global.CSS.escape === 'function' ? global.CSS.escape(field.id) : field.id.replace(/"/g, '\\"');
      var target = document.querySelector('.one-direct-target[data-field-key="' + escaped + '"]');
      if (target) return target;
    }
    var fields = directFields();
    var index = fields.indexOf(field);
    return index >= 0 ? document.querySelector('.one-direct-target[data-field-key="field-' + index + '"]') : null;
  }

  function linkSidebarToCanvas(field) {
    var target = directTargetForField(field);
    if (!target) return;
    document.querySelectorAll('.one-direct-target.one-focus-canvas-linked').forEach(function (node) {
      if (node !== target) node.classList.remove('one-focus-canvas-linked');
    });
    pulse(target, 'one-focus-canvas-linked', 'canvas');
  }

  function buttonByLabel(buttons, label) {
    return buttons.find(function (button) {
      return button.textContent.trim() === label || (button.getAttribute('aria-label') || '').indexOf(label) >= 0;
    });
  }

  function shortenSizeLabel(label) {
    if (!label) return;
    Array.prototype.slice.call(label.childNodes).forEach(function (node) {
      if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim()) node.nodeValue = '字級 ';
    });
  }

  function inputValue(input) {
    return input && typeof input.value === 'string' ? input.value : '';
  }

  function selectionOffsets(input) {
    var selection = global.getSelection();
    if (!selection || !selection.rangeCount || selection.isCollapsed) return null;
    var range = selection.getRangeAt(0);
    if (!input.contains(range.commonAncestorContainer)) return null;
    var before = document.createRange();
    before.selectNodeContents(input);
    before.setEnd(range.startContainer, range.startOffset);
    var start = before.toString().length;
    return { start: start, end: start + range.toString().length };
  }

  function setTextSelection(input, start, end) {
    if (!input) return;
    var value = inputValue(input);
    if (!input.firstChild || input.firstChild.nodeType !== Node.TEXT_NODE) input.value = value;
    var node = input.firstChild;
    if (!node) return;
    var limit = node.nodeValue.length;
    var range = document.createRange();
    range.setStart(node, Math.max(0, Math.min(limit, start)));
    range.setEnd(node, Math.max(0, Math.min(limit, end)));
    var selection = global.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function emphasisBlock(value, start, end) {
    var open = value.lastIndexOf('【', Math.max(0, start));
    if (open < 0) return null;
    var close = value.indexOf('】', Math.max(open + 1, end - 1));
    if (close < 0) return null;
    if (value.indexOf('】', open + 1) !== close) return null;
    if (value.lastIndexOf('【', close - 1) !== open) return null;
    if (start > close || end <= open) return null;
    return { open: open, close: close };
  }

  function toggleEmphasis(panel, mark, event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    var input = panel.querySelector('.one-direct-input');
    var offsets = selectionOffsets(input);
    if (!input || !offsets || offsets.start === offsets.end) return;
    var value = inputValue(input);
    var block = emphasisBlock(value, offsets.start, offsets.end);
    var next;
    var selectStart;
    var selectEnd;
    if (block) {
      var inner = value.slice(block.open + 1, block.close);
      next = value.slice(0, block.open) + inner + value.slice(block.close + 1);
      selectStart = block.open;
      selectEnd = block.open + inner.length;
    } else {
      var selected = value.slice(offsets.start, offsets.end);
      next = value.slice(0, offsets.start) + '【' + selected + '】' + value.slice(offsets.end);
      selectStart = offsets.start + 1;
      selectEnd = selectStart + selected.length;
    }
    input.value = next;
    setTextSelection(input, selectStart, selectEnd);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus({ preventScroll: true });
    if (panel.__oneFocusHistory) panel.__oneFocusHistory.recordNow();
    mark.title = block ? '已取消重點。選取文字再按一次可重新設為重點。' : '已設為重點。選取重點文字再按一次可取消。';
  }

  function removeEmphasis(panel, event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    var input = panel.querySelector('.one-direct-input');
    var offsets = selectionOffsets(input);
    if (!input || !offsets || offsets.start === offsets.end) return;
    var value = inputValue(input);
    var block = emphasisBlock(value, offsets.start, offsets.end);
    if (!block) return;
    var inner = value.slice(block.open + 1, block.close);
    input.value = value.slice(0, block.open) + inner + value.slice(block.close + 1);
    setTextSelection(input, block.open, block.open + inner.length);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus({ preventScroll: true });
    if (panel.__oneFocusHistory) panel.__oneFocusHistory.recordNow();
  }

  function historySnapshot(panel) {
    var input = panel.querySelector('.one-direct-input');
    var size = panel.querySelector('.one-direct-format label input[type="number"]');
    var activeColor = panel.querySelector('.one-focus-style-menu__body button[aria-pressed="true"]');
    return {
      text: inputValue(input),
      size: size ? size.value : null,
      color: activeColor ? activeColor.getAttribute('aria-label') : null
    };
  }

  function sameSnapshot(a, b) {
    return Boolean(a && b && a.text === b.text && a.size === b.size && a.color === b.color);
  }

  function installHistory(panel, head, controls) {
    if (!panel || panel.dataset.oneFocusHistoryReady === '1') return;
    var input = panel.querySelector('.one-direct-input');
    if (!input) return;
    panel.dataset.oneFocusHistoryReady = '1';

    var undo = document.createElement('button');
    undo.type = 'button';
    undo.className = 'one-focus-history-button';
    undo.textContent = '↶';
    undo.setAttribute('aria-label', '復原上一個編輯');
    undo.title = '復原上一個編輯（Ctrl/Cmd+Z）';

    var redo = document.createElement('button');
    redo.type = 'button';
    redo.className = 'one-focus-history-button';
    redo.textContent = '↷';
    redo.setAttribute('aria-label', '重做下一個編輯');
    redo.title = '重做下一個編輯（Ctrl/Cmd+Shift+Z 或 Ctrl+Y）';

    head.insertBefore(undo, controls);
    head.insertBefore(redo, controls);

    var stack = [historySnapshot(panel)];
    var cursor = 0;
    var applying = false;
    var timer = null;

    function syncButtons() {
      undo.disabled = cursor <= 0;
      redo.disabled = cursor >= stack.length - 1;
    }

    function recordNow() {
      clearTimeout(timer);
      timer = null;
      if (applying) return;
      var snap = historySnapshot(panel);
      if (sameSnapshot(stack[cursor], snap)) {
        syncButtons();
        return;
      }
      stack = stack.slice(0, cursor + 1);
      stack.push(snap);
      if (stack.length > 50) stack.shift();
      cursor = stack.length - 1;
      syncButtons();
    }

    function schedule(delay) {
      if (applying) return;
      clearTimeout(timer);
      timer = setTimeout(recordNow, delay == null ? 350 : delay);
    }

    function applySnapshot(snap) {
      if (!snap) return;
      applying = true;
      input.value = snap.text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      var size = panel.querySelector('.one-direct-format label input[type="number"]');
      if (size && snap.size !== null && size.value !== String(snap.size)) {
        size.value = snap.size;
        size.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (snap.color) {
        var colors = Array.prototype.slice.call(panel.querySelectorAll('.one-focus-style-menu__body button[aria-label^="字色："]'));
        var color = colors.find(function (button) { return button.getAttribute('aria-label') === snap.color; });
        if (color && color.getAttribute('aria-pressed') !== 'true') color.click();
      }
      applying = false;
      input.focus({ preventScroll: true });
      syncButtons();
    }

    function flushPending() {
      if (timer) recordNow();
    }

    function undoOne() {
      flushPending();
      if (cursor <= 0) return;
      cursor -= 1;
      applySnapshot(stack[cursor]);
    }

    function redoOne() {
      flushPending();
      if (cursor >= stack.length - 1) return;
      cursor += 1;
      applySnapshot(stack[cursor]);
    }

    undo.addEventListener('pointerdown', function (event) { event.preventDefault(); });
    redo.addEventListener('pointerdown', function (event) { event.preventDefault(); });
    undo.addEventListener('click', undoOne);
    redo.addEventListener('click', redoOne);

    input.addEventListener('input', function () { schedule(350); });
    controls.addEventListener('input', function (event) {
      if (event.target.matches('input[type="number"]')) schedule(0);
    });
    controls.addEventListener('click', function (event) {
      var button = event.target.closest && event.target.closest('button');
      if (button && !button.classList.contains('one-focus-history-button')) schedule(0);
    });
    input.addEventListener('keydown', function (event) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      var key = String(event.key || '').toLowerCase();
      if (key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redoOne();
        else undoOne();
      } else if (key === 'y' && !event.metaKey) {
        event.preventDefault();
        redoOne();
      }
    });

    panel.__oneFocusHistory = { recordNow: recordNow, undo: undoOne, redo: redoOne };
    syncButtons();
  }

  function decorateToolbar(panel) {
    if (!panel || panel.dataset.oneFocusP0Ready === '1') return;
    var head = panel.querySelector('.one-direct-editor-head');
    var controls = head && head.querySelector('.one-direct-format');
    if (!head || !controls) return;

    panel.dataset.oneFocusP0Ready = '1';
    panel.classList.add('one-focus-p0-direct-editor');

    var mark = Array.prototype.find.call(controls.querySelectorAll('button'), function (button) {
      return button.textContent.trim() === '強調選字' || button.getAttribute('aria-label') === '強調選字';
    });
    var unmark = null;
    if (mark) {
      mark.classList.add('one-focus-emphasis-button');
      mark.textContent = '★ 重點';
      /* Keep the original accessible name so existing browser tests and
       * keyboard workflows remain backward-compatible. */
      mark.setAttribute('aria-label', '強調選字');
      mark.title = '選取一般文字可設為重點；選取已重點文字再按一次也可取消。';
      mark.addEventListener('click', function (event) { toggleEmphasis(panel, mark, event); }, true);

      unmark = document.createElement('button');
      unmark.type = 'button';
      unmark.className = 'one-focus-unemphasis-button';
      unmark.textContent = '取消重點';
      unmark.setAttribute('aria-label', '取消重點');
      unmark.title = '選取已設為重點的文字後取消【】重點標記';
      unmark.addEventListener('pointerdown', function (event) { event.preventDefault(); });
      unmark.addEventListener('click', function (event) { removeEmphasis(panel, event); }, true);
    }

    var colorButtons = Array.prototype.slice.call(controls.querySelectorAll('button[aria-label^="字色："]'));
    if (colorButtons.length) {
      var lightButton = buttonByLabel(colorButtons, '淺色字') || colorButtons[0];
      var highlightButton = buttonByLabel(colorButtons, '高亮黃') || colorButtons[1] || colorButtons[0];
      var rememberedStyle = highlightButton;

      var normal = document.createElement('button');
      normal.type = 'button';
      normal.className = 'one-focus-normal-button';
      normal.textContent = '一般';
      /* Old automation can keep clicking the old accessible color name while
       * people see the simpler label. */
      normal.setAttribute('aria-label', '字色：淺色字');
      normal.title = '切回一般淺色文字';
      normal.addEventListener('pointerdown', function (event) { event.preventDefault(); });
      normal.addEventListener('click', function () { lightButton.click(); });

      var split = document.createElement('span');
      split.className = 'one-focus-style-split';
      var applyStyle = document.createElement('button');
      applyStyle.type = 'button';
      applyStyle.className = 'one-focus-style-apply';
      applyStyle.textContent = '樣式';
      applyStyle.addEventListener('pointerdown', function (event) { event.preventDefault(); });
      function syncStyleButton() {
        applyStyle.setAttribute('aria-label', rememberedStyle.getAttribute('aria-label') || '套用目前樣式');
        applyStyle.title = '套用：' + rememberedStyle.textContent.trim();
      }
      applyStyle.addEventListener('click', function () { rememberedStyle.click(); });

      var menu = document.createElement('details');
      menu.className = 'one-focus-style-menu';
      var summary = document.createElement('summary');
      summary.textContent = '▾';
      summary.setAttribute('aria-label', '選擇其他字色');
      summary.title = '選擇其他字色';
      var body = document.createElement('div');
      body.className = 'one-focus-style-menu__body';
      menu.append(summary, body);
      colorButtons.forEach(function (button) {
        body.appendChild(button);
        button.addEventListener('click', function () {
          if (button !== lightButton) rememberedStyle = button;
          syncStyleButton();
          menu.open = false;
        });
      });
      syncStyleButton();
      split.append(applyStyle, menu);

      var sizeControl = controls.querySelector('label');
      shortenSizeLabel(sizeControl);
      controls.innerHTML = '';
      if (sizeControl) controls.appendChild(sizeControl);
      controls.appendChild(normal);
      if (mark) controls.appendChild(mark);
      if (unmark) controls.appendChild(unmark);
      controls.appendChild(split);
    }

    installHistory(panel, head, controls);
    var name = head.querySelector('strong');
    if (name) name.classList.add('one-focus-direct-label');
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = '\n' +
      'body[data-one-card-workspace="focus"] .one-focus-sidebar-linked{outline:2px solid #35c6cb!important;outline-offset:4px;border-radius:8px;box-shadow:0 0 0 5px rgba(53,198,203,.12);transition:outline-color .18s,box-shadow .18s}\n' +
      'body[data-one-card-workspace="focus"] .one-direct-target.one-focus-canvas-linked{outline:2px solid #ffbe37!important;outline-offset:2px;background:rgba(255,190,55,.10)!important}\n' +
      'body[data-one-card-workspace="focus"] .one-focus-p0-direct-editor .one-direct-editor-head{display:flex!important;flex-wrap:nowrap!important;align-items:center!important;gap:5px!important;padding:6px 7px!important;width:max-content!important;max-width:min(96vw,640px)!important;white-space:nowrap!important}\n' +
      'body[data-one-card-workspace="focus"] .one-focus-p0-direct-editor .one-direct-format{display:flex!important;flex-wrap:nowrap!important;align-items:center!important;gap:5px!important;width:auto!important}\n' +
      'body[data-one-card-workspace="focus"] .one-focus-p0-direct-editor .one-direct-format label{display:flex!important;align-items:center!important;gap:4px!important;margin:0!important}\n' +
      'body[data-one-card-workspace="focus"] .one-focus-p0-direct-editor .one-direct-format label input{width:50px!important;min-width:50px!important}\n' +
      'body[data-one-card-workspace="focus"] .one-focus-p0-direct-editor .one-focus-direct-label{max-width:72px;overflow:hidden;text-overflow:ellipsis}\n' +
      'body[data-one-card-workspace="focus"] .one-focus-p0-direct-editor .one-focus-emphasis-button{background:#ffbe37!important;color:#1f1713!important;border-color:#ffcf69!important;font-weight:900!important}\n' +
      'body[data-one-card-workspace="focus"] .one-focus-p0-direct-editor .one-focus-unemphasis-button{background:#17313a!important;color:#dff9f7!important;border-color:#397483!important;font-weight:800!important}\n' +
      'body[data-one-card-workspace="focus"] .one-focus-history-button{min-width:30px!important;padding-left:7px!important;padding-right:7px!important;font-size:16px!important;font-weight:900!important}\n' +
      'body[data-one-card-workspace="focus"] .one-focus-history-button:disabled{opacity:.35!important;cursor:not-allowed!important}\n' +
      'body[data-one-card-workspace="focus"] .one-focus-style-split{display:inline-flex;align-items:stretch;gap:2px}\n' +
      'body[data-one-card-workspace="focus"] .one-focus-style-split>.one-focus-style-apply{border-radius:7px 3px 3px 7px!important}\n' +
      'body[data-one-card-workspace="focus"] .one-focus-style-menu{position:relative;margin:0}\n' +
      'body[data-one-card-workspace="focus"] .one-focus-style-menu>summary{display:flex;align-items:center;height:100%;list-style:none;cursor:pointer;border:1px solid #397483;border-radius:3px 7px 7px 3px;padding:4px 6px;background:#15303a;color:#dff9f7;font-size:12px;font-weight:900}\n' +
      'body[data-one-card-workspace="focus"] .one-focus-style-menu>summary::-webkit-details-marker{display:none}\n' +
      'body[data-one-card-workspace="focus"] .one-focus-style-menu__body{position:absolute;z-index:12;top:calc(100% + 6px);right:0;display:grid;gap:5px;min-width:108px;padding:6px;border:1px solid #397483;border-radius:8px;background:#101d28;box-shadow:0 8px 24px rgba(0,0,0,.45)}\n' +
      'body[data-one-card-workspace="focus"] .one-focus-style-menu__body button{width:100%;justify-content:flex-start}\n' +
      'body[data-one-card-workspace="focus"] .one-focus-p0-direct-editor .one-direct-input{position:relative;z-index:2}\n' +
      '@media(max-width:520px){body[data-one-card-workspace="focus"] .one-focus-p0-direct-editor .one-focus-direct-label{display:none}body[data-one-card-workspace="focus"] .one-focus-p0-direct-editor .one-direct-editor-head{max-width:100%!important;gap:3px!important;padding:5px!important;overflow-x:auto!important}}\n';
    document.head.appendChild(style);
  }

  function handleCanvasTargetClick(event) {
    if (!isFocusPage()) return;
    var target = event.target.closest && event.target.closest('.one-direct-target');
    if (!target || target.classList.contains('one-direct-image-target')) return;
    setTimeout(function () {
      var field = fieldForKey(target.dataset.fieldKey);
      revealSidebarField(field);
      var panel = document.querySelector('.one-direct-editor.one-direct-inline-editor');
      if (panel) decorateToolbar(panel);
    }, 0);
  }

  function handleSidebarFocus(event) {
    if (!isFocusPage()) return;
    var field = event.target.closest && event.target.closest('.editor-panel input,.editor-panel textarea');
    if (!field) return;
    linkSidebarToCanvas(field);
  }

  function refresh(root) {
    if (!isFocusPage()) return;
    injectStyles();
    (root || document).querySelectorAll('.one-direct-editor.one-direct-inline-editor').forEach(decorateToolbar);
  }

  function init() {
    if (!isFocusPage()) return;
    injectStyles();
    refresh(document);
    document.addEventListener('click', handleCanvasTargetClick, true);
    document.addEventListener('focusin', handleSidebarFocus, true);
    observer = new MutationObserver(function (changes) {
      changes.forEach(function (change) {
        change.addedNodes.forEach(function (node) {
          if (node.nodeType === 1) refresh(node);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  global.ONEFocusP0UX = { version: VERSION, refresh: refresh };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window);
