/* O-Ne explanation-card Canonical JSON bridge — V1.0.0 */
(function (global) {
  'use strict';
  if (typeof document === 'undefined' || global.__oneExplanationCanonicalBridge) return;
  global.__oneExplanationCanonicalBridge = true;

  function statusFor(input) {
    var panel = input && input.closest && input.closest('.one-edit-backup');
    return panel && panel.querySelector('.one-edit-backup__status');
  }
  function setStatus(input, message, error) {
    var node = statusFor(input);
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('error', Boolean(error));
  }
  function isExplanationJsonInput(target) {
    return Boolean(target && target.matches && target.matches('#quickSaveHost .one-edit-backup input[type="file"]'));
  }

  document.addEventListener('change', function (event) {
    var input = event.target;
    if (!isExplanationJsonInput(input)) return;
    var file = input.files && input.files[0];
    if (!file) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    if (file.size > 1024 * 1024) {
      setStatus(input, '載入失敗：JSON 不可超過 1 MB。', true);
      input.value = '';
      return;
    }

    Promise.resolve(file.text()).then(function (raw) {
      var parsed = JSON.parse(String(raw || ''));
      var payload = parsed;
      if (parsed && parsed.schema === 'o-ne.card.canonical.v1') {
        if (!global.ONEAIJsonGuide || !global.ONE_CARD_CANONICAL) throw new Error('Canonical adapter 尚未載入。');
        payload = global.ONEAIJsonGuide.prepareImport('explanation-card', parsed);
      }
      if (typeof global.fromJSON !== 'function' || typeof global.applySnapshot !== 'function') throw new Error('說明卡匯入器尚未就緒。');
      var snapshot = global.fromJSON(payload);
      global.applySnapshot(snapshot);
      setStatus(input, 'JSON 載入成功；目前尚未暫存，需要保留時請按「暫存目前內容」。 單獨 JSON 不含圖片；完整還原請改用 ZIP 專案包。', false);
    }).catch(function (error) {
      setStatus(input, '載入失敗：' + (error && error.message ? error.message : '無法讀取檔案') + '；目前內容未變更。', true);
    }).finally(function () {
      input.value = '';
    });
  }, true);
})(window);
