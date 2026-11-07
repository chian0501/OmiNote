/* Gives the explanation card the same names, top bar and file tabs as the other tools. Its editor stays its own. */
(function (global) {
  'use strict';

  var shared = global.ONECardWorkspace;
  if (!shared) return;
  var T = shared.TERMS;
  var RULES = [
    ['.back-link', /^← 回工具入口$/, T.home],
    ['.one-project-actions button', /^專案檔案$/, T.files],
    ['#exportPng', /^輸出說明卡 PNG$/, '輸出 PNG'],
    ['#exportPng', /^輸出目前(?:進度|第 \d+ 幕) PNG$/, '只輸出目前畫面'],
    ['#exportSequenceAll', /^(?:一鍵)?輸出全部 (\d+) (?:張|幕 PNG ZIP)$/, '輸出全部 PNG（$1 張）'],
    ['[data-one-project-quick="download"]', /^下載專案/, T.saveProject],
    ['[data-one-project-quick="upload"]', /^載入專案/, T.openProject],
    ['[data-action="export-package"]', /^下載完整 project\.zip$/, T.saveProject],
    ['[data-action="import-package"]', /^載入完整 project\.zip$/, T.openProject],
    ['[data-action="load"]', /^載入舊 JSON$/, T.importJson],
    ['[data-action="save"]', /^暫存目前內容$/, '暫存'],
    ['#exportJson', /^僅設定 JSON$/, T.exportJson],
    ['#resetAll', /^重設目前內容$/, T.reset],
    ['.one-edit-backup__note,.one-edit-backup__status', /「暫存目前內容」/g, '「暫存」'],
    ['.export-bar p', /專案檔案請由頂部載入或保存/, '專案用下方按鈕存取']
  ];
  var frame = { dirty: false, active: 'project', tabs: {} };

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }
  function find(selector) { return frame.dialog.querySelector(selector); }
  function toggle(node, hidden) { if (node && node.hidden !== hidden) node.hidden = hidden; }

  function showTab(key) {
    frame.active = key;
    Object.keys(frame.tabs).forEach(function (name) {
      frame.tabs[name].setAttribute('aria-selected', String(name === key));
      frame.tabs[name].tabIndex = name === key ? 0 : -1;
    });
    frame.title.textContent = frame.tabs[key].textContent;
    toggle(find('[data-one-project-package-ui]'), key !== 'project');
    toggle(find('[data-one-backup-ui]'), key !== 'history');
    toggle(find('[data-one-batch-render-ui]'), key !== 'batch');
    toggle(find('[data-one-ai-json-guide]'), key !== 'ai');
    toggle(frame.paste, key !== 'ai');
    toggle(frame.help, key !== 'help');
    var tools = find('.batch-tools');
    if (tools) { toggle(tools, key !== 'batch' && key !== 'ai'); tools.open = true; }
    var example = find('.ai-guide-details');
    if (example) example.open = true;
  }
  function openTab(key) {
    if (!frame.dialog.open) frame.filesButton.click();
    if (frame.dialog.open) { showTab(key); frame.tabs[key].focus(); }
  }

  function makeTabs(host) {
    var bar = element('div', 'one-frame-tabs');
    bar.setAttribute('role', 'tablist');
    bar.setAttribute('aria-label', '檔案與說明');
    T.tabs.forEach(function (entry) {
      var key = entry[0], tab = element('button', 'one-frame-tab', entry[1]);
      tab.type = 'button';
      tab.setAttribute('role', 'tab');
      tab.addEventListener('click', function () { showTab(key); });
      tab.addEventListener('keydown', function (event) {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        var keys = Object.keys(frame.tabs);
        var next = keys[(keys.indexOf(key) + (event.key === 'ArrowRight' ? 1 : -1) + keys.length) % keys.length];
        event.preventDefault();
        showTab(next);
        frame.tabs[next].focus();
      });
      frame.tabs[key] = tab;
      bar.appendChild(tab);
    });
    host.insertAdjacentElement('afterend', bar);
  }

  function trackEdits() {
    var mark = function (event) {
      var target = event.target;
      if (target && target.closest && !target.closest('dialog,[data-one-frame-control]')) frame.dirty = true;
    };
    document.addEventListener('input', mark, true);
    document.addEventListener('change', mark, true);
  }

  function watchStatus() {
    var status = find('.one-edit-backup__status');
    if (!status || frame.statusWatched) return;
    frame.statusWatched = true;
    new MutationObserver(function () {
      var message = status.textContent;
      shared.aiResult(frame, message);
      if (/^(已暫存目前內容|已自動暫存|目前內容與最新暫存相同)/.test(message)) frame.dirty = false;
    }).observe(status, { childList: true, subtree: true, characterData: true });
  }

  function sync() {
    shared.applyTerms(RULES);
    if (!frame.dialog) build();
    if (!frame.dialog) return;
    var guide = find('[data-one-ai-json-guide]');
    if (guide && frame.paste.parentNode !== guide.parentNode) guide.parentNode.insertBefore(frame.paste, guide);
    watchStatus();
    showTab(frame.active);
  }

  function build() {
    var dialog = document.getElementById('oneProjectDialog');
    var actions = document.querySelector('.one-project-actions');
    var heading = document.querySelector('.app-header');
    var help = document.querySelector('#oneHelpDialog p');
    if (!dialog || !actions || !heading || !help) return;
    frame.dialog = dialog;
    frame.title = document.getElementById('oneProjectDialogTitle');
    var buttons = actions.querySelectorAll('button');
    frame.filesButton = buttons[1];
    makeTabs(dialog.querySelector('header'));

    var title = heading.querySelector('h1');
    if (title && title.firstChild && title.firstChild.nodeType === 3) title.firstChild.nodeValue = title.firstChild.nodeValue.replace(/^O-Ne /, '');
    var switchHost = element('div', 'one-workspace-switch');
    switchHost.setAttribute('data-one-frame-control', '');
    switchHost.hidden = true;
    heading.querySelector('.title-block').insertAdjacentElement('afterend', switchHost);
    var guideHost = element('div', 'one-workspace-guide');
    guideHost.hidden = true;
    heading.insertAdjacentElement('afterend', guideHost);
    shared.fillGuide({ id: 'explanation', switchHost: switchHost, guideHost: guideHost, isDirty: function () { return frame.dirty; } });

    frame.paste = shared.makeAiPaste(frame);
    frame.help = element('p', 'one-frame-help', help.textContent);
    dialog.querySelector('.save-dock').appendChild(frame.help);

    actions.lastElementChild.onclick = function () { openTab('help'); };
    trackEdits();
    var open = new URL(location.href).searchParams.get('open');
    if (frame.tabs[open]) global.setTimeout(function () { openTab(open); }, 400);
  }

  var scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    global.setTimeout(function () { scheduled = false; sync(); }, 0);
  }
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  schedule();
})(window);
