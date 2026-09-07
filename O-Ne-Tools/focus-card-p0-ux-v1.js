/* O-Ne focus card P0 direct-edit UX patch — V0.1.0
 * Scope: focus-card only. Keeps the existing React renderer, save formats and
 * 【...】 emphasis syntax as the source of truth while making the syntax optional
 * for human editors.
 */
(function (global) {
  'use strict';

  if (global.ONEFocusP0UX) return;

  var VERSION = '0.1.0';
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

  function labelForField(field) {
    if (!field) return '目前欄位';
    if (field.tagName === 'TEXTAREA') return '一般內文';
    if (field.placeholder === '輸入卡片標題') return '主標題';
    if (field.placeholder === '輸入標籤文字') return '標籤文字';
    var row = field.closest('.item-row');
    if (row) {
      var rows = Array.prototype.slice.call(document.querySelectorAll('.item-row'));
      var mode = document.querySelector('.mode-tabs button.is-active');
      var prefix = mode && mode.textContent.trim() === '步驟' ? '步驟' : '項目';
      return prefix + ' ' + (rows.indexOf(row) + 1);
    }
    var fieldLabel = field.closest('label') && field.closest('label').querySelector('.field-label');
    return fieldLabel && fieldLabel.textContent.trim() || field.getAttribute('aria-label') || '目前欄位';
  }

  function ensureModeForField(field) {
    if (!field) return;
    if (field.tagName !== 'TEXTAREA') return;
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
      var target = document.querySelector('.one-direct-target[data-field-key="' + (global.CSS && CSS.escape ? CSS.escape(field.id) : field.id.replace(/"/g, '\\"')) + '"]');
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

  function selectedColorLabel(buttons) {
    var selected = buttons.find(function (button) { return button.getAttribute('aria-pressed') === 'true'; });
    return selected ? selected.textContent.trim() : '字色';
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
    if (mark) {
      mark.classList.add('one-focus-emphasis-button');
      mark.textContent = '★ 重點';
      /* Keep the original accessible name so existing browser regression tests
       * and keyboard workflows remain backward-compatible. */
      mark.setAttribute('aria-label', '強調選字');
      mark.title = '先選取文字，再按「重點」。不用手動輸入【】。';
    }

    var colorButtons = Array.prototype.slice.call(controls.querySelectorAll('button[aria-label^="字色："]'));
    if (colorButtons.length) {
      var normal = document.createElement('button');
      normal.type = 'button';
      normal.className = 'one-focus-normal-button';
      normal.textContent = '一般';
      normal.setAttribute('aria-label', '一般字色');
      normal.title = '切回一般淺色文字';
      normal.addEventListener('pointerdown', function (event) { event.preventDefault(); });
      normal.addEventListener('click', function () {
        var light = colorButtons.find(function (button) {
          return button.textContent.trim() === '淺色字' || /淺色字/.test(button.getAttribute('aria-label') || '');
        }) || colorButtons[0];
        light.click();
      });

      var menu = document.createElement('details');
      menu.className = 'one-focus-style-menu';
      var summary = document.createElement('summary');
      summary.textContent = '樣式';
      summary.title = '更多文字顏色';
      var body = document.createElement('div');
      body.className = 'one-focus-style-menu__body';
      menu.append(summary, body);
      colorButtons.forEach(function (button) { body.appendChild(button); });
      function refreshSummary() {
        var label = selectedColorLabel(colorButtons);
        summary.textContent = label && label !== '淺色字' ? '樣式｜' + label : '樣式';
      }
      colorButtons.forEach(function (button) { button.addEventListener('click', function () { setTimeout(refreshSummary, 0); }); });
      refreshSummary();

      var sizeControl = controls.querySelector('label');
      controls.innerHTML = '';
      if (sizeControl) controls.appendChild(sizeControl);
      controls.appendChild(normal);
      if (mark) controls.appendChild(mark);
      controls.appendChild(menu);
    }

    var name = head.querySelector('strong');
    if (name) name.classList.add('one-focus-direct-label');

    requestAnimationFrame(function () { keepToolbarClear(panel); });
  }

  function keepToolbarClear(panel) {
    if (!panel || !panel.isConnected) return;
    var head = panel.querySelector('.one-direct-editor-head');
    var preview = panel.closest('.one-workspace-preview');
    if (!head || !preview) return;
    panel.classList.remove('one-focus-toolbar-below');
    var headRect = head.getBoundingClientRect();
    var previewRect = preview.getBoundingClientRect();
    if (headRect.top < previewRect.top + 6) panel.classList.add('one-focus-toolbar-below');
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = '\n' +
      'body[data-one-card-workspace="focus"] .one-focus-sidebar-linked{outline:2px solid #35c6cb!important;outline-offset:4px;border-radius:8px;box-shadow:0 0 0 5px rgba(53,198,203,.12);transition:outline-color .18s,box-shadow .18s}\n' +
      'body[data-one-card-workspace="focus"] .one-direct-target.one-focus-canvas-linked{outline:2px solid #ffbe37!important;outline-offset:2px;background:rgba(255,190,55,.10)!important}\n' +
      'body[data-one-card-workspace="focus"] .one-focus-p0-direct-editor .one-direct-editor-head{display:flex!important;flex-wrap:nowrap!important;align-items:center!important;gap:5px!important;padding:6px 7px!important;width:max-content!important;max-width:min(94vw,620px)!important;white-space:nowrap!important;transform:translateY(calc(-100% - 7px));}\n' +
      'body[data-one-card-workspace="focus"] .one-focus-p0-direct-editor.one-focus-toolbar-below .one-direct-editor-head{top:100%!important;transform:translateY(7px)!important}\n' +
      'body[data-one-card-workspace="focus"] .one-focus-p0-direct-editor .one-direct-format{display:flex!important;flex-wrap:nowrap!important;align-items:center!important;gap:5px!important;width:auto!important}\n' +
      'body[data-one-card-workspace="focus"] .one-focus-p0-direct-editor .one-direct-format label{display:flex!important;align-items:center!important;gap:4px!important;margin:0!important}\n' +
      'body[data-one-card-workspace="focus"] .one-focus-p0-direct-editor .one-direct-format label input{width:54px!important;min-width:54px!important}\n' +
      'body[data-one-card-workspace="focus"] .one-focus-p0-direct-editor .one-focus-direct-label{max-width:120px;overflow:hidden;text-overflow:ellipsis}\n' +
      'body[data-one-card-workspace="focus"] .one-focus-p0-direct-editor .one-focus-emphasis-button{background:#ffbe37!important;color:#1f1713!important;border-color:#ffcf69!important;font-weight:900!important}\n' +
      'body[data-one-card-workspace="focus"] .one-focus-style-menu{position:relative;margin:0}\n' +
      'body[data-one-card-workspace="focus"] .one-focus-style-menu>summary{list-style:none;cursor:pointer;border:1px solid #397483;border-radius:7px;padding:5px 7px;background:#15303a;color:#dff9f7;font-size:12px;font-weight:800}\n' +
      'body[data-one-card-workspace="focus"] .one-focus-style-menu>summary::-webkit-details-marker{display:none}\n' +
      'body[data-one-card-workspace="focus"] .one-focus-style-menu__body{position:absolute;z-index:12;top:calc(100% + 6px);right:0;display:grid;gap:5px;min-width:108px;padding:6px;border:1px solid #397483;border-radius:8px;background:#101d28;box-shadow:0 8px 24px rgba(0,0,0,.45)}\n' +
      'body[data-one-card-workspace="focus"] .one-focus-style-menu__body button{width:100%;justify-content:flex-start}\n' +
      'body[data-one-card-workspace="focus"] .one-focus-p0-direct-editor .one-direct-input{position:relative;z-index:2}\n';
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
    global.addEventListener('resize', function () {
      var panel = document.querySelector('.one-focus-p0-direct-editor');
      if (panel) requestAnimationFrame(function () { keepToolbarClear(panel); });
    });
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
