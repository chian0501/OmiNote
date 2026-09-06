/* O-Ne card editor workspace. The renderer and project formats remain owned by each tool. */
(function (global) {
  'use strict';

  var CONFIG = {
    general: { name: '一般卡', mode: 'mode' },
    trigger: { name: '觸發卡', mode: 'state' },
    persistent: { name: '常駐卡', mode: 'state' },
    effect: { name: '效果卡', mode: 'stateText' },
    move: { name: '移動卡', mode: 'previewState' },
    choice: { name: '選項卡' },
    challenge: { name: '挑戰卡' },
    dialogue: { name: '對話卡', actualSize: true },
    rating: { name: '評分卡' },
    focus: { name: '焦點內容卡', react: true },
    'thumbnail-frame': { name: '縮圖品牌框' },
    settlement: { name: '片尾結算卡' }
  };
  var instance;
  var scheduled = false;
  var observer;

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }
  function button(text, className, action) {
    var node = element('button', className, text);
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
  }
  function labelText(node) {
    var heading = node.querySelector('.section-title,.group-title,.section-heading,h3');
    if (heading && heading.matches('.group-title') && heading.querySelector('span')) heading = heading.querySelector('span');
    return (heading ? heading.textContent : '').replace(/^\s*\d+\s*[｜|]\s*/, '').replace(/\s+/g, ' ').trim();
  }
  function hideEmptyContainers(root) {
    root.querySelectorAll('.buttons,.two,.title-row,.app-header,.export,.export-actions').forEach(function (node) {
      if (!node.children.length && !node.textContent.trim()) node.classList.add('one-workspace-empty');
    });
  }

  function makeDialog(state) {
    var dialog = element('dialog', 'one-workspace-dialog');
    dialog.id = 'one-workspace-files';
    dialog.setAttribute('aria-labelledby', 'one-workspace-files-title');
    var head = element('header', 'one-workspace-dialog-head');
    var title = element('strong', '', '專案檔案');
    title.id = 'one-workspace-files-title';
    var close = button('關閉', 'one-workspace-button', function () { dialog.close(); });
    head.append(title, close);
    var tabs = element('div', 'one-workspace-file-tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', '檔案與說明');
    var panels = element('div', 'one-workspace-file-panels');
    state.fileTabs = {};
    state.filePanels = {};
    [
      ['project', '專案檔案'], ['history', '暫存紀錄'],
      ['batch', '批次輸出'], ['ai', 'AI 格式'], ['help', '使用說明']
    ].forEach(function (entry) {
      var key = entry[0];
      var tab = button(entry[1], 'one-workspace-file-tab', function () { selectTab(state, key); });
      tab.id = 'one-workspace-tab-' + key;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', 'one-workspace-pane-' + key);
      tab.addEventListener('keydown', function (event) {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        var keys = Object.keys(state.fileTabs);
        var index = keys.indexOf(key);
        var next = event.key === 'Home' ? 0 : event.key === 'End' ? keys.length - 1 :
          (index + (event.key === 'ArrowRight' ? 1 : -1) + keys.length) % keys.length;
        event.preventDefault();
        selectTab(state, keys[next]);
        state.fileTabs[keys[next]].focus();
      });
      var panel = element('section', 'one-workspace-file-pane');
      panel.id = 'one-workspace-pane-' + key;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', tab.id);
      state.fileTabs[key] = tab;
      state.filePanels[key] = panel;
      tabs.appendChild(tab);
      panels.appendChild(panel);
    });
    state.nativeFiles = element('div', 'one-workspace-native-files');
    state.filePanels.project.appendChild(element('p', 'one-workspace-hint', '跨裝置接續編輯請下載完整專案 ZIP；只需文字與設定時可使用 JSON。'));
    state.filePanels.project.appendChild(state.nativeFiles);
    state.filePanels.history.appendChild(element('p', 'one-workspace-hint', '按頂部「暫存」才會保留目前內容；最近 5 次紀錄只存在這台裝置。'));
    state.filePanels.help.appendChild(element('p', 'one-workspace-hint', '左側編輯內容與設定，右側確認字卡；預覽下方直接輸出 PNG。頂部可暫存、載入專案或查看 AI 格式。'));
    dialog.append(head, tabs, panels);
    document.body.appendChild(dialog);
    state.dialog = dialog;
    // Keep both Tab directions inside the modal, including at the ends of the
    // native tab sequence where Chromium may otherwise focus browser chrome.
    dialog.addEventListener('keydown', function (event) {
      if (event.key !== 'Tab') return;
      var targets = Array.prototype.filter.call(dialog.querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex]'), function (node) {
        return node.tabIndex >= 0 && !node.disabled && !node.closest('[hidden],[inert]') &&
          node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden';
      });
      if (!targets.length) { event.preventDefault(); return; }
      var first = targets[0], last = targets[targets.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    });
    dialog.addEventListener('close', function () {
      if (state.opener && state.opener.isConnected) state.opener.focus();
    });
    dialog.addEventListener('click', function (event) {
      if (event.target !== dialog) return;
      var rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    selectTab(state, 'project');
  }

  function selectTab(state, key) {
    state.activeTab = key;
    Object.keys(state.filePanels).forEach(function (name) {
      state.filePanels[name].hidden = name !== key;
      state.fileTabs[name].setAttribute('aria-selected', String(name === key));
      state.fileTabs[name].tabIndex = name === key ? 0 : -1;
    });
    state.dialog.querySelector('#one-workspace-files-title').textContent = state.fileTabs[key].textContent;
    routeUtilities(state);
  }
  function openFiles(state, key, opener) {
    state.opener = opener || document.activeElement;
    selectTab(state, key);
    if (!state.dialog.open) state.dialog.showModal();
    state.fileTabs[key].focus();
  }

  function makeHeader(state) {
    var header = element('header', 'one-workspace-header');
    var home, title;
    if (state.config.react) {
      home = element('a', 'one-workspace-home', '← 回工具入口');
      home.href = './';
      var originalTitle = state.app.querySelector('h1');
      title = originalTitle ? originalTitle.cloneNode(true) : element('h1', '', 'O-Ne ' + state.config.name);
      state.app.classList.add('one-workspace-react-app');
      state.app.parentNode.insertBefore(header, state.app);
    } else {
      home = state.app.querySelector('.tool-home-link,.home,.back-link');
      title = state.app.querySelector('h1');
      if (!home) { home = element('a', '', '← 回工具入口'); home.href = './'; }
      home.classList.add('one-workspace-home');
      if (!title) title = element('h1', '', 'O-Ne ' + state.config.name);
      state.app.insertBefore(header, state.app.firstChild);
    }
    header.append(home, title);
    var actions = element('div', 'one-workspace-header-actions');
    state.saveHost = element('div', 'one-workspace-save-host');
    state.saveFeedback = element('span', 'one-workspace-save-feedback');
    state.saveFeedback.setAttribute('role', 'status');
    state.saveFeedback.setAttribute('aria-live', 'polite');
    var files = button('專案檔案', 'one-workspace-button', function () { openFiles(state, 'project', files); });
    var history = button('暫存紀錄', 'one-workspace-button', function () { openFiles(state, 'history', history); });
    var help = button('？', 'one-workspace-button one-workspace-help-button', function () { openFiles(state, 'help', help); });
    help.setAttribute('aria-label', '使用說明');
    [files, history, help].forEach(function (node) {
      node.setAttribute('aria-haspopup', 'dialog');
      node.setAttribute('aria-controls', state.dialog.id);
    });
    actions.append(state.saveFeedback, state.saveHost, history, files, help);
    header.appendChild(actions);
    state.header = header;
  }

  function makeModebar(state) {
    var bar = element('div', 'one-workspace-modebar');
    var toggle = button('內容設定', 'one-workspace-button', function () {
      state.sidebarHidden = !state.sidebarHidden;
      document.body.classList.toggle('one-workspace-sidebar-hidden', state.sidebarHidden);
      toggle.setAttribute('aria-expanded', String(!state.sidebarHidden));
      if (state.sidebarHidden && state.editor.contains(document.activeElement)) toggle.focus();
      state.editor.setAttribute('aria-hidden', String(state.sidebarHidden));
      state.editor.inert = state.sidebarHidden;
      fitPreview(state);
    });
    toggle.setAttribute('aria-expanded', 'true');
    if (!state.editor.id) state.editor.id = 'one-workspace-editor';
    toggle.setAttribute('aria-controls', state.editor.id);
    bar.appendChild(toggle);
    var summary = element('span', 'one-workspace-mode-hint', '點字卡文字直接編輯｜預覽最多 100%，只縮小');
    if (state.id === 'rating') summary.textContent = '點文字編輯・點圖片更換｜預覽最多 100%，只縮小';
    bar.appendChild(summary);
    if (state.config.mode) {
      var control = document.getElementById(state.config.mode);
      if (control) {
        var mode = element('section', 'one-workspace-mode');
        var heading = element('div', 'one-workspace-mode-heading');
        var value = element('span', 'one-workspace-mode-value');
        heading.append(element('strong', '', '版型與狀態'), value);
        var body = element('div', 'one-workspace-mode-content');
        var label = document.querySelector('label[for="' + control.id + '"]') || control.previousElementSibling;
        if (label && label.tagName === 'LABEL') body.appendChild(label);
        if (!control.getAttribute('aria-label')) control.setAttribute('aria-label', '版型與狀態');
        body.appendChild(control);
        if (state.id === 'general') {
          var custom = document.getElementById('customControls');
          if (custom) body.appendChild(custom);
        }
        mode.append(heading, body);
        state.editor.insertBefore(mode, state.editor.firstChild);
        var update = function () {
          var selected = control.options[control.selectedIndex];
          var text = selected ? selected.textContent : '';
          if (value.textContent !== text) value.textContent = text;
        };
        control.addEventListener('change', update);
        state.updateMode = update;
        update();
      }
    }
    state.workspace.parentNode.insertBefore(bar, state.workspace);
    state.modebar = bar;
  }

  function foldSection(node, open) {
    if (!node || node.closest('.one-workspace-fold') || node.tagName === 'DETAILS') return;
    var title = labelText(node);
    if (!title) return;
    var wrapper = element('details', 'one-workspace-fold');
    wrapper.open = open;
    var summary = element('summary', '', title);
    var heading = node.querySelector('.section-title,.group-title,.section-heading,h3');
    if (heading) heading.classList.add('one-workspace-fold-heading');
    node.parentNode.insertBefore(wrapper, node);
    wrapper.append(summary, node);
  }
  function foldRatingGroups(editor) {
    Array.prototype.slice.call(editor.querySelectorAll(':scope > .group-title')).forEach(function (heading, index) {
      var section = element('section', 'one-workspace-rating-group');
      heading.parentNode.insertBefore(section, heading);
      var node = heading;
      while (node) {
        var next = node.nextElementSibling;
        section.appendChild(node);
        if (!next || next.matches('.group-title,.status,.buttons,.mini')) break;
        node = next;
      }
      foldSection(section, index === 3);
    });
  }
  function prepareEditor(state) {
    state.editor.classList.add('one-workspace-editor');
    if (state.config.react) return;
    var title = element('div', 'one-workspace-editor-heading');
    title.append(element('strong', '', '內容與設定'));
    var toggle = button('收合全部', 'one-workspace-text-button', function () {
      var items = state.editor.querySelectorAll('details');
      var shouldOpen = !Array.prototype.some.call(items, function (item) { return item.open; });
      items.forEach(function (item) { item.open = shouldOpen; });
      toggle.textContent = shouldOpen ? '收合全部' : '展開全部';
    });
    title.appendChild(toggle);
    state.editor.insertBefore(title, state.editor.firstChild);
    state.editor.querySelectorAll(':scope > .section-title').forEach(function (node) { node.classList.add('one-workspace-empty'); });
    if (state.id === 'rating') foldRatingGroups(state.editor);
    var sections = state.editor.querySelectorAll(':scope > .section,:scope > .slots > .slot');
    sections.forEach(function (node, index) {
      var open = state.id === 'dialogue' ? true : state.id === 'effect' ? index === 1 : state.id === 'settlement' ? index < 2 : index === 0;
      foldSection(node, open);
    });
    if (!state.editor.querySelector('details')) toggle.hidden = true;
    if (state.id === 'dialogue') {
      var swap = state.editor.querySelector('#swap');
      if (swap) { swap.textContent = '⇄ 交換左右角色'; swap.setAttribute('aria-label', '交換左右角色'); }
    }
  }

  function fitPreview(state) {
    if (!state.canvas || !state.stage) return;
    var rect = state.stage.getBoundingClientRect();
    var width = state.canvas.width, height = state.canvas.height;
    if (!width || !height) return;
    var size = width + ' × ' + height + ' px';
    if (state.size.textContent !== size) state.size.textContent = size;
    if (rect.width <= 24 || rect.height <= 24) return;
    var scale = state.zoom.value === 'actual' ? 1 : Math.min(1, (rect.width - 32) / width, (rect.height - 32) / height);
    state.stage.classList.toggle('one-workspace-actual-size', state.zoom.value === 'actual');
    state.canvas.style.width = Math.max(1, Math.round(width * scale)) + 'px';
    state.canvas.style.height = Math.max(1, Math.round(height * scale)) + 'px';
    if (global.ONECardDirectEdit) global.ONECardDirectEdit.refresh();
  }
  function preparePreview(state) {
    state.preview.classList.add('one-workspace-preview');
    var originalTitle = state.preview.querySelector(':scope > .section-title');
    if (originalTitle) originalTitle.classList.add('one-workspace-empty');
    var toolbar = element('div', 'one-workspace-preview-heading');
    toolbar.append(element('strong', '', '字卡預覽'));
    state.size = element('span', 'one-workspace-size');
    var zoomLabel = element('div', 'one-workspace-zoom');
    zoomLabel.setAttribute('role', 'group');
    zoomLabel.setAttribute('aria-label', '預覽縮放');
    zoomLabel.append(element('span', '', '檢視'));
    state.zoom = { value: 'fit' };
    var zoomButtons = [];
    [['fit', '適合畫面'], ['actual', '100% 原尺寸']].forEach(function (entry) {
      var option = button(entry[1], '', function () {
        state.zoom.value = entry[0];
        zoomButtons.forEach(function (node) { node.setAttribute('aria-pressed', String(node.value === entry[0])); });
        fitPreview(state);
      });
      option.value = entry[0];
      option.setAttribute('aria-pressed', String(entry[0] === state.zoom.value));
      zoomButtons.push(option);
      zoomLabel.appendChild(option);
    });
    toolbar.append(state.size, zoomLabel);
    state.preview.insertBefore(toolbar, state.preview.firstChild);
    state.stage = state.preview.querySelector('.preview-wrap,.stage,.canvas-stage');
    state.canvas = state.stage && state.stage.querySelector('canvas');
    if (state.stage) state.stage.classList.add('one-workspace-stage');
    if (state.canvas) state.canvas.classList.add('one-workspace-canvas');
    var footer = element('footer', 'one-workspace-export');
    var status = document.getElementById('status');
    if (status) footer.appendChild(status);
    var exports = element('div', 'one-workspace-export-actions');
    ['downloadSet', 'download', 'downloadPng', 'downloadWhite', 'downloadOrange', 'downloadBoth'].forEach(function (id) {
      var node = document.getElementById(id);
      if (node && /^(BUTTON|A)$/.test(node.tagName)) {
        node.classList.add('one-workspace-export-button');
        exports.appendChild(node);
      }
    });
    if (exports.children.length) footer.appendChild(exports);
    if (!state.config.react) state.preview.appendChild(footer);
    if (global.ResizeObserver && state.stage) {
      state.resizeObserver = new ResizeObserver(function () { fitPreview(state); });
      state.resizeObserver.observe(state.stage);
    }
    if (state.canvas) {
      state.canvasObserver = new MutationObserver(function () { fitPreview(state); });
      state.canvasObserver.observe(state.canvas, { attributes: true, attributeFilter: ['width', 'height'] });
    }
    global.addEventListener('resize', function () { fitPreview(state); });
    fitPreview(state);
  }

  function moveNativeFiles(state) {
    if (state.config.react) {
      var proxy = button('輸出設定 JSON', 'one-workspace-button', function () {
        var original = state.app.querySelector('.export-actions .export-button.secondary');
        if (original) original.click();
      });
      state.nativeFiles.appendChild(proxy);
      return;
    }
    ['jsonBtn', 'downloadJson', 'reset'].forEach(function (id) {
      var node = document.getElementById(id);
      if (node) { node.classList.add('one-workspace-button'); state.nativeFiles.appendChild(node); }
    });
    var help = state.filePanels.help;
    state.app.querySelectorAll(':scope > .sub,:scope > .title-row,:scope > .app-header,.one-workspace-editor > .note,.one-workspace-editor > .mini,.formal-note').forEach(function (node) {
      if (node.contains(state.header) || node === state.header) return;
      help.appendChild(node);
    });
    state.editor.querySelectorAll('[id="rules"]').forEach(function (node) { if (!help.contains(node)) help.appendChild(node); });
  }

  function routeUtilities(state) {
    // Keep native utility panels inside their existing completion dock. Shared helpers
    // still own these nodes and can mount late without recreating or losing handlers.
    var docks = document.querySelectorAll('.one-after-edit-dock');
    docks.forEach(function (dock) {
      if (dock.parentNode !== state.filePanels[state.activeTab]) state.filePanels[state.activeTab].appendChild(dock);
      if (!dock.open) dock.open = true;
      dock.setAttribute('data-one-workspace-utility-dock', '1');
      dock.querySelectorAll('[data-one-backup-ui],[data-one-project-package-ui],[data-one-batch-render-ui],[data-one-ai-json-guide]').forEach(function (panel) {
        var key = panel.hasAttribute('data-one-backup-ui') ? 'history' :
          panel.hasAttribute('data-one-project-package-ui') ? 'project' :
          panel.hasAttribute('data-one-batch-render-ui') ? 'batch' : 'ai';
        var hidden = key !== state.activeTab;
        if (panel.hidden !== hidden) panel.hidden = hidden;
        panel.setAttribute('aria-label', state.fileTabs[key].textContent);
      });
    });
    var loadJSON = document.querySelector('[data-one-backup-ui] [data-action="load"],#loadJson');
    if (loadJSON && state.nativeFiles && !state.nativeFiles.contains(loadJSON)) {
      loadJSON.classList.add('one-workspace-button');
      state.nativeFiles.appendChild(loadJSON);
    }
    var save = document.querySelector('[data-one-backup-ui] [data-action="save"],#saveHistory');
    if (save && state.saveHost && !state.saveHost.contains(save)) {
      save.textContent = '暫存';
      save.setAttribute('aria-label', '暫存目前內容');
      save.setAttribute('title', '儲存這台裝置最近 5 次不同內容');
      save.classList.add('one-workspace-button', 'one-workspace-save');
      save.addEventListener('click', function () {
        global.setTimeout(function () {
          var status = document.querySelector('[data-one-backup-ui] .one-edit-backup__status,#historyStatus');
          if (status && state.saveFeedback) {
            state.saveFeedback.textContent = status.textContent;
            state.saveFeedback.title = status.textContent;
            state.saveFeedback.classList.toggle('is-error', /失敗|不可用/.test(status.textContent));
          }
        }, 0);
      });
      state.saveHost.appendChild(save);
    }
  }

  function refresh() {
    if (!instance) { mount(); return; }
    routeUtilities(instance);
    if (instance.updateMode) instance.updateMode();
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    global.setTimeout(function () { scheduled = false; refresh(); }, 0);
  }
  function mount() {
    if (instance || !document.body) return;
    var id = document.body.getAttribute('data-one-card-workspace');
    var config = CONFIG[id];
    if (!config || new URL(location.href).searchParams.get('embed') === '1') return;
    var app = document.querySelector(config.react ? '.app-shell' : '.app');
    var workspace = app && app.querySelector(config.react ? '.workspace' : ':scope > .grid,:scope > .workspace');
    if (!workspace) return;
    var editor = workspace.querySelector(':scope > .panel:not(.preview-panel)');
    var preview = workspace.querySelector(':scope > .preview-panel') || workspace.querySelector(':scope > .panel:last-child');
    if (!editor || !preview || editor === preview) return;
    var state = { id: id, config: config, app: app, workspace: workspace, editor: editor, preview: preview, sidebarHidden: false };
    instance = state;
    app.classList.add('one-workspace-app');
    workspace.classList.add('one-workspace-layout');
    document.body.setAttribute('data-one-workspace-ready', '1');
    makeDialog(state);
    makeHeader(state);
    makeModebar(state);
    prepareEditor(state);
    preparePreview(state);
    moveNativeFiles(state);
    routeUtilities(state);
    if (!config.react) hideEmptyContainers(app);
    document.addEventListener('change', function () { if (state.updateMode) state.updateMode(); });
    global.requestAnimationFrame(function () { fitPreview(state); });
  }
  function init() {
    mount();
    if (!document.body || !CONFIG[document.body.getAttribute('data-one-card-workspace')]) return;
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
  }
  global.ONECardWorkspace = { version: '1.2.0', refresh: refresh };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window);
