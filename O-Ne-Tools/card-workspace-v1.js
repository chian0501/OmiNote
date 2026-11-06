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
  // 統一用語的唯一位置。工具 HTML 鎖雜湊不改，舊字樣在這裡換成統一名稱。
  var TERMS = {
    home: '← 工具入口', files: '檔案', reset: '重設內容',
    saveProject: '存專案 ZIP', openProject: '開專案 ZIP', exportJson: '匯出 JSON', importJson: '匯入 JSON',
    tabs: [['project', '專案'], ['history', '暫存紀錄'], ['batch', '批次輸出'], ['ai', 'AI'], ['help', '說明']]
  };
  var RELABEL = [
    ['#download,#downloadPng', /^(?:輸出|下載) ?(?:透明(?:底框)? |1920×1080 )PNG$/, '輸出 PNG'],
    ['#download', /^僅下載目前畫面 PNG$/, '只輸出目前畫面'],
    ['#downloadSet', /^輸出整組 PNG（(\d+) 張）$/, '輸出全部 PNG（$1 張）'],
    ['#downloadBoth', /^下載兩版 PNG ZIP$/, '輸出全部 PNG（2 張）'],
    ['#downloadWhite', /^輸出白色版 PNG$/, '只輸出白色版'],
    ['#downloadOrange', /^輸出橘色版 PNG$/, '只輸出橘色版'],
    ['.one-workspace-react-app .export-button.primary strong', /^輸出含字 PNG$/, '輸出 PNG'],
    ['.one-workspace-react-app .export-bar > p', /輸出含字 PNG/g, '輸出 PNG'],
    ['#jsonBtn,#downloadJson', /^(?:輸出欄位|輸出設定|下載設定|下載) JSON$/, TERMS.exportJson],
    ['[data-action="load"],#loadJson', /^載入 JSON$/, TERMS.importJson],
    ['#reset', /^重設目前內容$/, TERMS.reset],
    ['.one-edit-backup__note,.one-edit-backup__status,#historyStatus,.note', /「暫存目前內容」/g, '「暫存」'],
    ['.one-project-package__title', /^完整專案包$/, '專案 ZIP'],
    ['[data-one-project-package-ui] [data-action="export-package"]', /^下載專案包 ZIP$/, TERMS.saveProject],
    ['[data-one-project-package-ui] [data-action="import-package"]', /^載入專案包 ZIP$/, TERMS.openProject]
  ];
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
    if (heading && heading.querySelector('strong,span')) heading = heading.querySelector('strong,span');
    return (heading ? heading.textContent : '').replace(/^\s*\d+\s*[｜|]\s*/, '').replace(/\s+/g, ' ').trim();
  }
  function relabel(node, pattern, replacement) {
    var aria = node.getAttribute('aria-label');
    if (aria && aria.replace(pattern, replacement) !== aria) node.setAttribute('aria-label', aria.replace(pattern, replacement));
    var text = node.childNodes.length === 1 && node.firstChild.nodeType === 3 ? node.firstChild : null;
    if (!text) return;
    var next = text.nodeValue.trim().replace(pattern, replacement);
    if (next !== text.nodeValue.trim()) text.nodeValue = next;
  }
  // 工具會在輸出中暫時改字再改回來，所以每次刷新都重套；只換認得的舊字樣。
  function applyTerms() {
    RELABEL.forEach(function (rule) {
      document.querySelectorAll(rule[0]).forEach(function (node) { relabel(node, rule[1], rule[2]); });
    });
    var frames = document.querySelector('.focus-sequence-navigation select');
    Array.prototype.forEach.call(document.querySelectorAll('.focus-sequence-toolbar > button'), function (node) {
      if (frames) relabel(node, /^輸出全部(?:幕 PNG ZIP| PNG（\d+ 張）)$/, '輸出全部 PNG（' + frames.options.length + ' 張）');
    });
  }
  function hideEmptyContainers(root) {
    Array.prototype.slice.call(root.querySelectorAll('.buttons,.two,.title-row,.app-header,.export,.export-bar,.export-actions')).reverse().forEach(function (node) {
      var visibleChild = Array.prototype.some.call(node.children, function (child) { return getComputedStyle(child).display !== 'none'; });
      if (!visibleChild && !node.textContent.trim()) node.classList.add('one-workspace-empty');
    });
  }

  /* Pasted JSON goes through the tool's own file import, so errors and Canonical conversion stay the same. */
  function pasteJson(state, text) {
    var input = document.getElementById('jsonFile') || document.querySelector('[data-one-backup-ui] input[type="file"]');
    var report = function (message, failed) {
      state.aiFeedback.textContent = message;
      state.aiFeedback.classList.toggle('is-error', Boolean(failed));
    };
    if (!text.trim()) { report('先貼上 AI 給的 JSON。', true); return; }
    try { JSON.parse(text); } catch (error) { report('JSON 格式錯誤，請確認貼上的內容完整。', true); return; }
    if (!input) { report('匯入功能仍在載入，請稍後再試。', true); return; }
    try {
      var transfer = new DataTransfer();
      transfer.items.add(new File([text], 'ai-paste.card.json', { type: 'application/json' }));
      input.files = transfer.files;
    } catch (error) { report('這個瀏覽器無法貼上，請改用「專案」分頁的匯入 JSON。', true); return; }
    report('正在套用…');
    state.aiPending = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function makeAiPaste(state) {
    var box = element('section', 'one-workspace-ai-paste');
    box.setAttribute('data-one-frame-control', '');
    var label = element('label', '', '貼上 AI 給的 JSON');
    var area = element('textarea');
    area.rows = 5;
    area.spellcheck = false;
    label.appendChild(area);
    state.aiFeedback = element('p', 'one-workspace-ai-feedback');
    state.aiFeedback.setAttribute('role', 'status');
    box.append(label, button('套用到字卡', 'one-workspace-button', function () { pasteJson(state, area.value); }), state.aiFeedback);
    state.filePanels.ai.appendChild(box);
  }

  function makeDialog(state) {
    var dialog = element('dialog', 'one-workspace-dialog');
    dialog.id = 'one-workspace-files';
    dialog.setAttribute('aria-labelledby', 'one-workspace-files-title');
    var head = element('header', 'one-workspace-dialog-head');
    var title = element('strong', '', TERMS.files);
    title.id = 'one-workspace-files-title';
    var close = button('關閉', 'one-workspace-button', function () { dialog.close(); });
    head.append(title, close);
    var tabs = element('div', 'one-workspace-file-tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', '檔案與說明');
    var panels = element('div', 'one-workspace-file-panels');
    state.fileTabs = {};
    state.filePanels = {};
    TERMS.tabs.forEach(function (entry) {
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
    state.filePanels.project.appendChild(element('p', 'one-workspace-hint', '跨裝置接續編輯請用「存專案 ZIP」；只需文字與設定時可使用 JSON。'));
    state.filePanels.project.appendChild(state.nativeFiles);
    state.projectFeedback = element('p', 'one-workspace-project-feedback');
    state.projectFeedback.setAttribute('role', 'status');
    state.filePanels.project.appendChild(state.projectFeedback);
    state.filePanels.history.appendChild(element('p', 'one-workspace-hint', '按頂部「暫存」才會保留目前內容；最近 5 次紀錄只存在這台裝置。'));
    makeAiPaste(state);
    state.filePanels.help.appendChild(element('p', 'one-workspace-hint', '點字卡文字直接修改，預覽下方輸出 PNG。按 Ctrl／⌘＋S 或頂部「暫存」保留目前內容；跨裝置使用「存專案 ZIP」，JSON 僅保存文字與設定。'));
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
  function projectAction(action) {
    var panel = document.querySelector('[data-one-project-package-ui]');
    return panel && panel.querySelector('[data-action="' + action + '"]');
  }
  function makeProjectQuickButton(state, action, text) {
    var className = state.config.react ? 'export-button outline' : 'one-workspace-export-button secondary';
    var proxy;
    proxy = button(text, className, function () {
      var target = projectAction(action);
      if (target) { target.click(); return; }
      state.projectFeedback.textContent = '專案功能仍在載入，請稍後再試。';
      openFiles(state, 'project', proxy);
    });
    proxy.setAttribute('data-one-project-quick', action === 'export-package' ? 'download' : 'upload');
    proxy.setAttribute('aria-label', text + '（完整 project.zip）');
    proxy.setAttribute('title', text + '完整 project.zip');
    return proxy;
  }
  function ensureProjectQuickActions(state) {
    if (!projectAction('export-package') || !projectAction('import-package')) return false;
    var exports = state.config.react ?
      (state.preview.querySelector('.export-actions') || state.app.querySelector('.export-actions')) :
      state.preview.querySelector('.one-workspace-export-actions');
    if (!exports) return false;
    if (!exports.querySelector('[data-one-project-quick="download"]')) exports.appendChild(makeProjectQuickButton(state, 'export-package', TERMS.saveProject));
    if (!exports.querySelector('[data-one-project-quick="upload"]')) exports.appendChild(makeProjectQuickButton(state, 'import-package', TERMS.openProject));
    return true;
  }

  function makeHeader(state) {
    var header = element('header', 'one-workspace-header');
    var home, title;
    if (state.config.react) {
      home = element('a', 'one-workspace-home');
      home.href = './';
      var originalTitle = state.app.querySelector('h1');
      title = originalTitle ? originalTitle.cloneNode(true) : element('h1', '', 'O-Ne ' + state.config.name);
      state.app.classList.add('one-workspace-react-app');
      state.app.parentNode.insertBefore(header, state.app);
    } else {
      home = state.app.querySelector('.tool-home-link,.home,.back-link');
      title = state.app.querySelector('h1');
      if (!home) { home = element('a'); home.href = './'; }
      home.classList.add('one-workspace-home');
      if (!title) title = element('h1', '', 'O-Ne ' + state.config.name);
      state.app.insertBefore(header, state.app.firstChild);
    }
    home.textContent = TERMS.home;
    if (title.firstChild && title.firstChild.nodeType === 3) title.firstChild.nodeValue = title.firstChild.nodeValue.replace(/^O-Ne /, '').replace(/生成器|工具/, '');
    state.switchHost = element('div', 'one-workspace-switch');
    // Tools save every field with an id as card content; frame controls must stay out of it.
    state.switchHost.setAttribute('data-one-frame-control', '');
    state.switchHost.hidden = true;
    header.append(home, title, state.switchHost);
    var actions = element('div', 'one-workspace-header-actions');
    state.saveHost = element('div', 'one-workspace-save-host');
    state.saveFeedback = element('span', 'one-workspace-save-feedback');
    state.saveFeedback.setAttribute('role', 'status');
    state.saveFeedback.setAttribute('aria-live', 'polite');
    var files = button(TERMS.files, 'one-workspace-button', function () { openFiles(state, 'project', files); });
    var help = button('？', 'one-workspace-button one-workspace-help-button', function () { openFiles(state, 'help', help); });
    help.setAttribute('aria-label', '說明');
    [files, help].forEach(function (node) {
      node.setAttribute('aria-haspopup', 'dialog');
      node.setAttribute('aria-controls', state.dialog.id);
    });
    actions.append(state.saveFeedback, state.saveHost, files, help);
    header.appendChild(actions);
    state.header = header;
  }

  /* The registry supplies the card list and usage line. If it cannot load, the tool works without them. */
  function makeGuide(state) {
    state.guide = element('div', 'one-workspace-guide');
    state.guide.hidden = true;
    state.modebar.parentNode.insertBefore(state.guide, state.modebar);
    if (!global.fetch) return;
    global.fetch('./one-tools-registry-v1.json', { cache: 'no-cache' }).then(function (response) {
      if (!response.ok) throw new Error('registry');
      return response.json();
    }).then(function (registry) {
      var ready = registry.tools.filter(function (tool) { return tool.status === 'ready' && tool.href; });
      var current = ready.filter(function (tool) { return tool.id === state.id; })[0];
      if (!current) return;
      var label = element('label', '', '換卡種');
      var select = element('select');
      label.appendChild(select);
      ready.forEach(function (tool) {
        var option = element('option', '', tool.name);
        option.value = tool.href;
        option.selected = tool === current;
        select.appendChild(option);
      });
      select.addEventListener('change', function () {
        if (state.dirty && !global.confirm('換到別張卡？尚未暫存的修改不會保留。')) { select.value = current.href; return; }
        location.href = new URL(select.value, location.href).href;
      });
      state.switchHost.appendChild(label);
      state.switchHost.hidden = false;
      var guide = current.guide;
      if (!guide || !guide.summary) return;
      state.guide.append(element('strong', '', '這張用在'), element('span', '', guide.summary));
      var reference = guide.references && guide.references[0];
      if (reference) {
        var link = element('a', '', '過往範例 ↗');
        link.href = reference.url;
        link.target = '_blank';
        link.rel = 'noopener';
        state.guide.appendChild(link);
      }
      state.guide.hidden = false;
      fitPreview(state);
    }).catch(function () {});
  }

  function makeModebar(state) {
    var bar = element('div', 'one-workspace-modebar');
    var toggle = button('內容設定', 'one-workspace-button', function () {
      state.sidebarHidden = !state.sidebarHidden;
      document.body.classList.toggle('one-workspace-sidebar-hidden', state.sidebarHidden);
      toggle.setAttribute('aria-expanded', String(!state.sidebarHidden));
      toggle.textContent = state.sidebarHidden ? '展開設定' : '收合設定';
      if (state.sidebarHidden && state.editor.contains(document.activeElement)) toggle.focus();
      state.editor.setAttribute('aria-hidden', String(state.sidebarHidden));
      state.editor.inert = state.sidebarHidden;
      fitPreview(state);
    });
    toggle.setAttribute('aria-expanded', 'true');
    toggle.textContent = '收合設定';
    state.sidebarToggle = toggle;
    if (!state.editor.id) state.editor.id = 'one-workspace-editor';
    toggle.setAttribute('aria-controls', state.editor.id);
    bar.appendChild(toggle);
    var summary = element('span', 'one-workspace-mode-hint', '點字卡文字直接編輯｜預覽最多 100%，只縮小');
    if (state.id === 'rating') summary.textContent = '點文字編輯・點圖片更換｜預覽最多 100%，只縮小';
    bar.appendChild(summary);
    makeStepNavigator(state, bar);
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


  /* Process shortcuts navigate existing controls, never replace native events. */
  function makeStepNavigator(state, bar) {
    var nav = element('nav', 'one-workspace-steps');
    nav.setAttribute('aria-label', '製作流程快速導覽');
    var buttons = {};
    var steps = [
      ['content', '① 編輯', function () {
        if (state.sidebarHidden && state.sidebarToggle) state.sidebarToggle.click();
        state.editor.scrollIntoView({ block: 'nearest' });
        var field = state.editor.querySelector('select,input:not([type=hidden]):not([type=file]),textarea');
        if (field && !field.disabled && field.getClientRects().length) field.focus({ preventScroll: true });
      }],
      ['preview', '② 預覽', function () {
        state.preview.scrollIntoView({ block: 'nearest' });
        var head = state.preview.querySelector('.one-workspace-preview-heading,.preview-toolbar');
        if (head) { head.tabIndex = -1; head.focus({ preventScroll: true }); }
      }],
      ['export', '③ 輸出', function () {
        var target = state.preview.querySelector('.one-workspace-export,.export-bar,.export-actions') || state.preview;
        target.scrollIntoView({ block: 'nearest' });
        var control = target.querySelector('button:not(:disabled),a[href]');
        if (control) control.focus({ preventScroll: true });
      }]
    ];
    state.activateStep = function (name) {
      Object.keys(buttons).forEach(function (key) {
        if (key === name) buttons[key].setAttribute('aria-current', 'step');
        else buttons[key].removeAttribute('aria-current');
      });
    };
    steps.forEach(function (entry) {
      var node = button(entry[1], '', function () {
        entry[2]();
        state.activateStep(entry[0]);
      });
      node.setAttribute('title', entry[0] === 'export' ? '前往下載與專案區，不會自動下載' : '快速移至' + entry[1]);
      buttons[entry[0]] = node;
      nav.appendChild(node);
    });
    bar.appendChild(nav);
    state.activateStep('content');
  }

  function makeSectionJump(state) {
    if (state.config.react) return;
    var headings = Array.prototype.slice.call(state.editor.querySelectorAll('details.one-workspace-fold > summary'));
    if (headings.length < 2) return;
    var host = element('div', 'one-workspace-section-jump');
    var label = element('label', '', '☰ 快速跳到設定');
    var select = element('select', '', '');
    select.id = 'one-workspace-section-select';
    label.htmlFor = select.id;
    var empty = element('option', '', '選擇要調整的項目…');
    empty.value = '';
    select.appendChild(empty);
    headings.forEach(function (summary, index) {
      var name = (summary.textContent || '').replace(/\s+/g, ' ').trim();
      var option = element('option', '', name || ('設定 ' + (index + 1)));
      option.value = String(index);
      select.appendChild(option);
    });
    select.addEventListener('change', function () {
      if (!select.value) return;
      var target = headings[Number(select.value)];
      if (!target || !target.parentNode) return;
      target.parentNode.open = true;
      target.scrollIntoView({ block: 'nearest' });
      if (state.sidebarHidden && state.sidebarToggle) state.sidebarToggle.click();
      if (state.activateStep) state.activateStep('content');
      select.value = '';
    });
    host.append(label, select);
    var header = state.editor.querySelector('.one-workspace-editor-heading');
    if (header) header.insertAdjacentElement('afterend', host);
    else state.editor.insertBefore(host, state.editor.firstChild);
  }

  function trackUnsaved(state) {
    state.dirty = false;
    if (state.saveFeedback && !state.saveFeedback.textContent.trim()) {
      state.saveFeedback.textContent = '手動暫存 · 修改後記得儲存';
      state.saveFeedback.title = '內容只會在按下暫存後保留在此瀏覽器';
    }
    function markUnsaved(event) {
      var target = event.target;
      if (!target || !target.closest) return;
      if (target.closest('.one-workspace-dialog,.one-workspace-section-jump,.one-workspace-switch,[data-one-backup-ui],[data-one-project-package-ui]')) return;
      state.dirty = true;
      state.saveFeedback.textContent = '● 有尚未暫存的修改';
      state.saveFeedback.dataset.oneUnsaved = 'true';
      state.saveFeedback.classList.remove('is-error');
    }
    state.app.addEventListener('input', markUnsaved, true);
    state.app.addEventListener('change', markUnsaved, true);
    // Dynamic card data also changes through buttons (add row, switch modes,
    // toggle options, swap characters) without any native input/change event.
    // Observe these only in the actual editor and ignore navigation, tooltips,
    // fold controls, crop-dialog openers and preview-only actions.
    state.app.addEventListener('click', function (event) {
      var control = event.target && event.target.closest && event.target.closest('button');
      if (!control || !state.editor.contains(control) || control.disabled) return;
      if (control.closest('.one-workspace-editor-heading,.one-workspace-section-jump')) return;
      if (control.matches('.one-workspace-text-button,[aria-haspopup="dialog"],.image-crop-button,[id^="crop"]')) return;
      if (control.id === 'transparentView' || control.id === 'darkView') return;
      markUnsaved(event);
    }, true);
    // Image cropping uses a modal attached to document.body, outside the
    // card editor. Applying a crop must also show the manual-save reminder.
    document.addEventListener('click', function (event) {
      if (event.target && event.target.closest && event.target.closest('.one-image-dialog [data-apply]')) {
        markUnsaved(event);
      }
    }, true);
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
    state.editor.querySelectorAll(':scope > .section-title,:scope > h2').forEach(function (node) { node.classList.add('one-workspace-empty'); });
    if (state.id === 'rating') foldRatingGroups(state.editor);
    var sections = state.editor.querySelectorAll(':scope > .section,:scope > .slots > .slot');
    sections.forEach(function (node, index) {
      var open = state.id === 'dialogue' ? true : state.id === 'effect' ? index === 1 : state.id === 'settlement' ? index < 2 : index === 0;
      foldSection(node, open);
    });
    var syncFolds = function () {
      var items = state.editor.querySelectorAll('details');
      toggle.hidden = !items.length;
      var text = Array.prototype.some.call(items, function (item) { return item.open; }) ? '收合全部' : '展開全部';
      if (toggle.textContent !== text) toggle.textContent = text;
    };
    state.editor.addEventListener('toggle', syncFolds, true);
    state.syncFolds = syncFolds;
    syncFolds();
    makeSectionJump(state);
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
    // Measure the real toolbar/footer instead of assuming every card has the same
    // chrome. Small cards get a short stage; large cards leave room for export.
    var footer = state.preview.querySelector(state.config.react ? '.export-bar' : '.one-workspace-export');
    var stacked = getComputedStyle(state.workspace).gridTemplateColumns.split(' ').length === 1;
    var available = stacked ? Math.min(520, global.innerHeight * .48) :
      Math.max(180, global.innerHeight - (rect.top + global.scrollY) - (footer ? footer.offsetHeight : 84) - 20);
    // Compact focus cards need space above the text for their inline format bar.
    var nativeFitHeight = height * Math.min(1, Math.max(1, rect.width - 32) / width) + (state.id === 'focus' ? 224 : 48);
    var stageHeight = Math.round(Math.min(available, Math.max(200, nativeFitHeight)));
    if (state.id === 'dialogue') stageHeight = Math.min(220, stageHeight);
    var stageSize = stageHeight + 'px';
    if (state.stage.style.height !== stageSize) state.stage.style.setProperty('height', stageSize, 'important');
    rect = state.stage.getBoundingClientRect();
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
    var originalTitle = state.preview.querySelector(':scope > .section-title,:scope > h2,:scope > .preview-top');
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
    var status = document.getElementById('status') || state.editor.querySelector('.status');
    if (status) footer.appendChild(status);
    var exports = element('div', 'one-workspace-export-actions');
    ['downloadSet', 'downloadBoth', 'download', 'downloadPng', 'downloadWhite', 'downloadOrange'].forEach(function (id) {
      var node = document.getElementById(id);
      if (node && /^(BUTTON|A)$/.test(node.tagName)) {
        node.classList.add('one-workspace-export-button');
        exports.appendChild(node);
      }
    });
    if (exports.children.length) footer.appendChild(exports);
    if (!state.config.react) state.preview.appendChild(footer);
    ensureProjectQuickActions(state);
    if (global.ResizeObserver && state.stage) {
      state.resizeObserver = new ResizeObserver(function () { fitPreview(state); });
      state.resizeObserver.observe(state.stage);
      state.resizeObserver.observe(state.config.react ? state.preview.querySelector('.export-bar') : footer);
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
      var proxy = button(TERMS.exportJson, 'one-workspace-button', function () {
        var original = state.app.querySelector('.export-actions .export-button.secondary');
        if (original) original.click();
      });
      state.nativeFiles.appendChild(proxy);
      return;
    }
    ['jsonBtn', 'downloadJson', 'reset'].forEach(function (id) {
      var node = document.getElementById(id);
      if (node) { node.classList.add('one-workspace-button'); state.nativeFiles.appendChild(node); }
      if (node && id === 'reset') {
        node.textContent = TERMS.reset;
        node.addEventListener('click', function (event) {
          if (!global.confirm('重設目前內容？尚未暫存的文字與圖片會被取代。')) {
            event.preventDefault(); event.stopImmediatePropagation();
          }
        }, true);
      }
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
      save.setAttribute('title', '暫存目前內容（Ctrl／⌘＋S）；保留最近 5 次不同內容');
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
    var status = document.querySelector('[data-one-backup-ui] .one-edit-backup__status,#historyStatus');
    if (status && !state.statusObserver) {
      state.statusObserver = new MutationObserver(function () {
        var message = status.textContent;
        state.projectFeedback.textContent = message;
        state.projectFeedback.classList.toggle('is-error', /失敗|不可用|無法|不支援/.test(message));
        if (state.aiPending && message) {
          state.aiPending = false;
          state.aiFeedback.textContent = message;
          state.aiFeedback.classList.toggle('is-error', /失敗|不可用|無法|不支援|錯誤/.test(message));
        }
        state.saveFeedback.textContent = message;
        state.saveFeedback.title = message;
        state.saveFeedback.classList.toggle('is-error', /失敗|不可用|無法|不支援/.test(message));
        if (/^(已暫存目前內容|已自動暫存|目前內容與最新暫存相同)/.test(message)) {
          state.dirty = false;
          delete state.saveFeedback.dataset.oneUnsaved;
        }
      });
      state.statusObserver.observe(status, { childList: true, subtree: true, characterData: true });
    }
  }

  function refresh() {
    if (!instance) { mount(); return; }
    routeUtilities(instance);
    ensureProjectQuickActions(instance);
    applyTerms();
    if (instance.updateMode) instance.updateMode();
    if (instance.syncFolds) instance.syncFolds();
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    global.setTimeout(function () { scheduled = false; refresh(); }, 0);
  }
  // ?mode=COST opens a card in that mode. Runs after load so a restored draft is not overwritten.
  function applyRequestedMode(config) {
    var requested = new URL(location.href).searchParams.get('mode');
    var select = requested && config.mode && document.getElementById(config.mode);
    if (!select || select.tagName !== 'SELECT') return;
    if (!Array.prototype.some.call(select.options, function (option) { return option.value === requested; })) return;
    select.value = requested;
    select.dispatchEvent(new Event('change', { bubbles: true }));
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
    if (document.readyState === 'complete') global.setTimeout(function () { applyRequestedMode(config); }, 0);
    else global.addEventListener('load', function () { global.setTimeout(function () { applyRequestedMode(config); }, 0); });
    app.classList.add('one-workspace-app');
    workspace.classList.add('one-workspace-layout');
    document.body.setAttribute('data-one-workspace-ready', '1');
    makeDialog(state);
    makeHeader(state);
    makeModebar(state);
    makeGuide(state);
    prepareEditor(state);
    preparePreview(state);
    moveNativeFiles(state);
    routeUtilities(state);
    ensureProjectQuickActions(state);
    trackUnsaved(state);
    applyTerms();
    if (!config.react) hideEmptyContainers(app);
    document.addEventListener('change', function () { if (state.updateMode) state.updateMode(); });
    document.addEventListener('keydown', function (event) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== 's') return;
      event.preventDefault();
      if (event.isComposing || document.querySelector('dialog[open]')) return;
      if (global.ONECardDirectEdit) global.ONECardDirectEdit.finish();
      var save = state.saveHost.querySelector('button');
      if (save && !save.disabled) save.click();
    });
    global.requestAnimationFrame(function () { fitPreview(state); });
  }
  function init() {
    mount();
    if (!document.body || !CONFIG[document.body.getAttribute('data-one-card-workspace')]) return;
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
  }
  global.ONECardWorkspace = { version: '1.8.0', refresh: refresh };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window);