/* O-Ne Tools shared application shell — V1.3.1 */
(function (global) {
  'use strict';

  var VERSION = '1.3.1';
  var observed = false;

  function escapeId(value) {
    return global.CSS && typeof global.CSS.escape === 'function' ? global.CSS.escape(value) : String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function resolve(value) {
    return typeof value === 'string' ? document.querySelector(value) : value;
  }

  function insideNativeSaveArea(node) {
    return Boolean(node && node.closest && node.closest('.save-dock,#quickSaveHost'));
  }

  function mergeDuplicateDocks(preferred) {
    if (!preferred) return null;
    var target = preferred.querySelector('.one-after-edit-dock__content');
    if (!target) return preferred;
    Array.prototype.slice.call(document.querySelectorAll('.one-after-edit-dock')).forEach(function (dock) {
      if (dock === preferred) return;
      var content = dock.querySelector('.one-after-edit-dock__content');
      if (content) while (content.firstChild) target.appendChild(content.firstChild);
      if (dock.open) preferred.open = true;
      dock.remove();
    });
    return preferred;
  }

  function dockFor(toolId, anchor, host) {
    var selector = '[data-one-after-edit-dock="' + String(toolId || 'tool').replace(/"/g, '') + '"]';
    var dock = document.querySelector(selector) || document.querySelector('.one-after-edit-dock');
    if (dock) return mergeDuplicateDocks(dock);
    dock = document.createElement('details');
    dock.className = 'one-after-edit-dock';
    dock.setAttribute('data-one-after-edit-dock', toolId || 'tool');
    dock.innerHTML =
      '<summary><span class="one-after-edit-dock__step">3</span>' +
      '<span class="one-after-edit-dock__copy"><span>完成後：儲存與輸出</span><small>暫存、專案搬移、批次輸出與 AI 格式都在這裡</small></span>' +
      '<span class="one-after-edit-dock__badge">完成編輯再開</span></summary>' +
      '<div class="one-after-edit-dock__content"></div>';
    if (host) host.appendChild(dock);
    else if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(dock, anchor.nextSibling);
    else (document.querySelector('.panel,.editor,.controls,.app') || document.body).appendChild(dock);
    return mergeDuplicateDocks(dock);
  }

  function place(toolId, panel, options) {
    if (!panel) return null;
    options = options || {};
    var anchor = resolve(options.anchor);
    var host = resolve(options.host);
    if (insideNativeSaveArea(host) || insideNativeSaveArea(anchor)) {
      (host || anchor.parentNode).appendChild(panel);
      return panel.parentNode;
    }
    var dock = dockFor(toolId, anchor, host);
    dock.querySelector('.one-after-edit-dock__content').appendChild(panel);
    return dock;
  }

  function textHint(element) {
    var id = element.id;
    if (id) {
      var label = document.querySelector('label[for="' + escapeId(id) + '"]');
      if (label && label.textContent.trim()) return label.textContent.trim();
    }
    var parentLabel = element.closest && element.closest('label');
    if (parentLabel && parentLabel.textContent.trim()) return parentLabel.textContent.trim();
    var group = element.closest && element.closest('.field,.control,.row,.item,.rating-editor,.row-editor,.section');
    var nearby = group && group.querySelector('label,.label,.title,.section-title,.item-head');
    if (nearby && nearby.textContent.trim()) return nearby.textContent.trim().replace(/\s+/g, ' ');
    return element.getAttribute('placeholder') || element.textContent.trim() || element.getAttribute('title') || '';
  }

  function enhanceLabels(root) {
    (root || document).querySelectorAll('input,select,textarea').forEach(function (element, index) {
      if (element.type === 'hidden') return;
      if (!element.id) element.id = 'one-control-' + index + '-' + Math.random().toString(36).slice(2, 7);
      var parentLabel = element.closest('label');
      var previous = element.previousElementSibling;
      if (!parentLabel && previous && previous.tagName === 'LABEL' && !previous.htmlFor) previous.htmlFor = element.id;
      if (!element.getAttribute('aria-label') && !document.querySelector('label[for="' + escapeId(element.id) + '"]') && !parentLabel) {
        var hint = textHint(element);
        if (hint) element.setAttribute('aria-label', hint);
      }
    });
    (root || document).querySelectorAll('button').forEach(function (button) {
      if (button.getAttribute('aria-label')) return;
      var text = button.textContent.replace(/\s+/g, ' ').trim();
      var hint = text || button.getAttribute('title') || button.getAttribute('data-action') || '';
      if (hint) button.setAttribute('aria-label', hint);
    });
  }

  function matching(root, selector) {
    var items = [];
    if (root && root.nodeType === 1 && root.matches(selector)) items.push(root);
    if (root && root.querySelectorAll) items = items.concat(Array.prototype.slice.call(root.querySelectorAll(selector)));
    return items;
  }

  function wrapCollapsible(node, kind) {
    if (!node || node.dataset.oneCollapsibleReady || node.closest('.one-collapsible-item')) return;
    node.dataset.oneCollapsibleReady = '1';
    var wrapper = document.createElement('details');
    wrapper.className = 'one-collapsible-item';
    wrapper.dataset.oneKind = kind;
    wrapper.open = !node.parentNode.querySelector('.one-collapsible-item[data-one-kind="' + kind + '"]');
    var summary = document.createElement('summary');
    var label = document.createElement('span');
    var state = document.createElement('small');
    state.style.color = '#8fe0d7';
    function update() {
      var input = node.querySelector(kind === 'station' ? 'input[data-k="station"]' : kind === 'rating' ? 'input[data-field="label"]' : 'input[data-field="title"]');
      var indexNode = node.querySelector('.rating-index,.row-no,.item-head');
      var index = indexNode ? indexNode.textContent.replace(/\s+/g, ' ').trim() : '';
      label.textContent = index || (kind === 'station' ? '站點設定' : kind === 'rating' ? '評分項目' : '結算列');
      state.textContent = input && input.value.trim() ? input.value.trim() : '尚未命名';
    }
    summary.append(label, state);
    var body = document.createElement('div'); body.className = 'one-collapsible-item__body';
    node.parentNode.insertBefore(wrapper, node); wrapper.append(summary, body); body.appendChild(node);
    var nameInput = node.querySelector(kind === 'station' ? 'input[data-k="station"]' : kind === 'rating' ? 'input[data-field="label"]' : 'input[data-field="title"]');
    if (nameInput) nameInput.addEventListener('input', update);
    update();
  }

  function enhanceLongEditors(root) {
    matching(root || document, '#stationList>.item:not([data-one-collapsible-ready])').forEach(function (node) { wrapCollapsible(node, 'station'); });
    matching(root || document, '.rating-editor:not([data-one-collapsible-ready])').forEach(function (node) { wrapCollapsible(node, 'rating'); });
    matching(root || document, '.row-editor:not([data-one-collapsible-ready])').forEach(function (node) { wrapCollapsible(node, 'settlement'); });
  }

  function inferToolId(panel) {
    var exact = panel.getAttribute('data-one-ai-json-guide') || panel.getAttribute('data-tool-id');
    if (exact) return exact;
    var known = document.querySelector('[data-one-after-edit-dock]');
    if (known) return known.getAttribute('data-one-after-edit-dock');
    var page = location.pathname.split('/').pop().replace(/\.html$/i, '');
    return page || 'tool';
  }

  function consolidate(root) {
    (root || document).querySelectorAll('[data-one-backup-ui],[data-one-project-package-ui],[data-one-batch-render-ui],[data-one-ai-json-guide]').forEach(function (panel) {
      if (panel.closest('.one-after-edit-dock,#quickSaveHost')) return;
      place(inferToolId(panel), panel, { anchor: panel.previousElementSibling });
    });
  }

  function refresh(root) {
    mergeDuplicateDocks(document.querySelector('.one-after-edit-dock'));
    enhanceLabels(root || document);
    enhanceLongEditors(root || document);
    consolidate(root || document);
  }

  function init() {
    try {
      if (new URL(location.href).searchParams.get('embed') === '1') document.body.classList.add('one-tool-embedded');
    } catch (error) {}
    refresh(document);
    if (!observed && document.body) {
      observed = true;
      new MutationObserver(function (changes) {
        changes.forEach(function (change) {
          change.addedNodes.forEach(function (node) {
            if (node.nodeType === 1) refresh(node);
          });
        });
      }).observe(document.body, { childList: true, subtree: true });
    }
  }

  global.ONEAfterEditDock = { version: VERSION, place: place, consolidate: consolidate };
  global.ONEUIEnhance = { version: VERSION, refresh: refresh };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window);
