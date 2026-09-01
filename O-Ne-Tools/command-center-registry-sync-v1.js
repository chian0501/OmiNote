(function () {
  'use strict';

  var EXPLANATION_COPY = {
    use: '標籤＋標題下方接續圖文，或單張／多張圖片拼版。',
    not: '短提示、任務狀態或一般位置資訊。',
    source: 'EXPLANATION-CARD 正式母版',
    prompt: '依 O-Ne 正式說明卡整理這段內容。先決定圖文或純圖片模式，再設定標籤、標題與圖片版型；卡片底色需保持連續的正式咖啡色 80% 透明規則，不新增內層黑底框。'
  };

  function text(value) {
    return String(value == null ? '' : value);
  }

  function syncRegistry(registry) {
    if (!Array.isArray(registry.tools) || typeof UIS === 'undefined') return;
    var existing = new Map(UIS.map(function (item) { return [item.id, item]; }));
    var ready = registry.tools.filter(function (tool) {
      return (tool.status === 'ready' || tool.status === 'candidate') && tool.href;
    });
    var merged = ready.map(function (tool) {
      var prior = existing.get(tool.id) || {};
      var extra = tool.id === 'explanation' ? EXPLANATION_COPY : {};
      return Object.assign({}, extra, prior, {
        id: tool.id,
        name: tool.name,
        group: tool.group,
        status: tool.status === 'ready' ? 'READY' : 'CANDIDATE',
        badge: tool.status === 'ready' ? 'ready' : 'candidate',
        use: prior.use || extra.use || tool.desc || '開啟工具查看用途。',
        not: prior.not || extra.not || '不符合此卡型時請改用其他正式工具。',
        tool: tool.href,
        source: prior.source || extra.source || text(tool.formal_ref),
        prompt: prior.prompt || extra.prompt || ('依 O-Ne 正式' + tool.name + '處理內容，不更改正式卡體。')
      });
    });

    UIS.splice.apply(UIS, [0, UIS.length].concat(merged));
    document.documentElement.setAttribute('data-registry-version', registry.version || 'unknown');
    var stats = document.querySelectorAll('.stats .stat');
    if (stats[1]) {
      stats[1].querySelector('b').textContent = ready.length;
      stats[1].querySelector('span').textContent = '可用 UI 工具';
    }
    var uiBadge = document.querySelector('#ui .head .badge');
    if (uiBadge) uiBadge.textContent = ready.length + ' TOOLS';
    if (typeof renderUI === 'function') renderUI();
  }

  fetch('./one-tools-registry-v1.json?v=2360', { cache: 'no-store' })
    .then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    })
    .then(syncRegistry)
    .catch(function () {
      document.documentElement.setAttribute('data-registry-sync', 'fallback');
    });
})();
