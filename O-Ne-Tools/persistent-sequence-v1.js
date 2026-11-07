/* Persistent card: one task with several conditions, exported as every frame in one ZIP. The renderer stays in persistent-card.html. */
(function (global) {
  'use strict';

  var KEY = 'one-persistent-sequence-v1';

  function pad(number) { return String(number).padStart(2, '0'); }
  function cleanName(text) { return String(text).replace(/[\\/:*?"<>|]/g, ' ').trim() || '任務'; }

  // A failed condition still counts as finished, but only achieved ones raise the count.
  function buildFrames(name, conditions) {
    var total = conditions.length, done = 0, frames = [];
    conditions.forEach(function (condition, index) {
      var task = function () { return name + ' ' + done + '/' + total + '｜' + condition.text; };
      var prefix = pad(index + 1) + '_' + cleanName(condition.text);
      frames.push({ state: 'MISSION', task: task(), progress: '0/1', file: prefix + '_進行中.png' });
      if (condition.result === 'FAIL') {
        frames.push({ state: 'FAIL', task: task(), progress: '0/1', file: prefix + '_失敗.png' });
      } else {
        done += 1;
        frames.push({ state: 'DONE', task: task(), progress: '1/1', file: prefix + '_達成.png' });
      }
    });
    return frames;
  }

  function read() {
    try {
      var saved = JSON.parse(global.localStorage.getItem(KEY));
      if (saved && Array.isArray(saved.conditions) && saved.conditions.length) return saved;
    } catch (error) {}
    return { name: '', conditions: [{ text: '', result: 'DONE' }] };
  }
  function write(data) {
    try { global.localStorage.setItem(KEY, JSON.stringify(data)); } catch (error) {}
  }

  function canvasBytes(canvas) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) { if (blob) resolve(blob); else reject(new Error('PNG 產生失敗。')); }, 'image/png');
    });
  }
  async function exportAll(name, conditions, report) {
    var frames = buildFrames(name, conditions);
    var canvas = document.querySelector('.one-workspace-canvas');
    var saved = global.currentSnapshot();
    var entries = [];
    try {
      for (var i = 0; i < frames.length; i++) {
        global.applySnapshot(Object.assign({}, saved, frames[i]));
        if (global.render()) throw new Error('第 ' + (i + 1) + ' 張文字太長，請縮短任務或條件，或調小任務文字。');
        entries.push({ name: frames[i].file, data: await canvasBytes(canvas) });
      }
      var zip = await global.ONEProjectPackage.createZip(entries);
      var link = document.createElement('a');
      link.href = URL.createObjectURL(zip);
      link.download = 'O-Ne_常駐卡_' + cleanName(name) + '.zip';
      link.click();
      global.setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
      report('已輸出 ' + frames.length + ' 張。', false);
    } catch (error) {
      report(error.message, true);
    } finally {
      global.applySnapshot(saved);
    }
  }

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

  function mount() {
    var editor = document.querySelector('.one-workspace-editor');
    if (!editor || editor.querySelector('.one-persistent-sequence')) return;
    var data = read();
    var panel = element('details', 'one-workspace-fold one-persistent-sequence');
    panel.setAttribute('data-one-frame-control', '');
    var body = element('div', 'one-persistent-sequence__body');
    var hint = element('p', 'one-persistent-sequence__hint', '任務有多個條件時用。一個條件達成或失敗就換下一個，一次輸出全部畫面。');
    var nameLabel = element('label', '', '任務名稱');
    var name = element('input');
    name.value = data.name;
    nameLabel.appendChild(name);
    var rows = element('div', 'one-persistent-sequence__rows');
    var status = element('p', 'one-persistent-sequence__status');
    status.setAttribute('role', 'status');
    var output = button('', 'one-workspace-button', function () {
      output.disabled = true;
      exportAll(data.name.trim(), filled(), function (message, failed) {
        status.textContent = message;
        status.classList.toggle('is-error', failed);
        output.disabled = false;
        refresh();
      });
    });

    function filled() {
      return data.conditions.filter(function (condition) { return condition.text.trim(); })
        .map(function (condition) { return { text: condition.text.trim(), result: condition.result }; });
    }
    function refresh() {
      var count = buildFrames('', filled()).length;
      output.textContent = '輸出全部 PNG（' + count + ' 張）';
      output.setAttribute('aria-label', output.textContent);
      output.disabled = !count || !data.name.trim();
      write(data);
    }
    function drawRows() {
      rows.textContent = '';
      data.conditions.forEach(function (condition, index) {
        var row = element('div', 'one-persistent-sequence__row');
        var text = element('input');
        text.value = condition.text;
        text.setAttribute('aria-label', '條件 ' + (index + 1));
        text.addEventListener('input', function () { condition.text = text.value; refresh(); });
        var result = element('select');
        result.setAttribute('aria-label', '條件 ' + (index + 1) + ' 結果');
        [['DONE', '達成'], ['FAIL', '失敗']].forEach(function (entry) {
          var option = element('option', '', entry[1]);
          option.value = entry[0];
          result.appendChild(option);
        });
        result.value = condition.result;
        result.addEventListener('change', function () { condition.result = result.value; refresh(); });
        var remove = button('刪除', 'one-workspace-text-button', function () {
          data.conditions.splice(index, 1);
          if (!data.conditions.length) data.conditions.push({ text: '', result: 'DONE' });
          drawRows();
        });
        row.append(text, result, remove);
        rows.appendChild(row);
      });
      refresh();
    }
    name.addEventListener('input', function () { data.name = name.value; refresh(); });
    body.append(hint, nameLabel, rows, button('＋ 新增條件', 'one-workspace-button', function () {
      data.conditions.push({ text: '', result: 'DONE' });
      drawRows();
    }), output, status);
    panel.append(element('summary', '', '多條件任務'), body);
    editor.appendChild(panel);
    drawRows();
  }

  global.ONEPersistentSequence = { buildFrames: buildFrames };
  mount();
})(window);
