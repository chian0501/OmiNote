(function () {
  'use strict';

  var VERSION = '0.1.1';
  var SCHEMA = 'o-ne.settlement-card.ready.v0.1.1';
  var FORMAL = {
    component_id: 'QST-03',
    semantic_id: 'settlement_panel_16x9',
    usage: 'RESULT',
    formal_version: 'V1.1',
    extension_approved_by: 'Omi',
    folder_id: '1pMkqpnAXxWkVehQfNbxPIY8wEUhzxG1i',
    psd_id: '10TEJVILkN_wmVlstXxhJS_2NkLB41QA_',
    psd_sha256: 'c6529ab176ae53bc8e3d8aa5d64788e07e699e60be9e07b40cee6c8d4081f599',
    preview_id: '1SxExxdhWGrC6X9rNL-k51gfTlvSkCj-J',
    record_id: '1WaDTHdWqXIut-Lup6wzwQs9GwG011pGOKrHo9H84DiM',
    manifest_id: '1IJp9SUsCMhAiA-bLGc7NTI8n382rXnr0',
    mapping_id: '1-9cMX-gdTlYJ5Ej29o08oyy6Nu0Wu9ej',
    qa_id: '1VDtQLtu1yKvC5XqZpfgpKs49HsOQoTZf'
  };

  var STATIC_SOURCES = {
    background: './assets/settlement-background-v010.jpg',
    overlay: './assets/settlement-background-overlay-v010.png',
    ui: './assets/settlement-ui-base-v011.png',
    cats: './assets/settlement-cats-v010.png',
    resultPanel: './assets/settlement-result-panel-v011.png',
    rowFrame: './assets/settlement-row-frame-v011.png',
    subscribeFrame: './assets/settlement-subscribe-frame-v011.png',
    iconCheck: './assets/settlement-icon-check-v011.png',
    iconList: './assets/settlement-icon-list-v011.png',
    iconLocation: './assets/settlement-icon-location-v011.png',
    iconStar: './assets/settlement-icon-star-v011.png',
    iconPlus: './assets/settlement-icon-plus-v011.png'
  };

  var FIELD_PRESETS = [
    '任務進度',
    '解鎖項目',
    '購買品項',
    '購買數量',
    '總花費',
    '任務時間',
    '移動距離',
    '推薦指數',
    '滿意度',
    '今日 MVP',
    '意外事件',
    '最終結果'
  ];

  var ICON_PRESETS = [
    { key: 'check', label: '完成勾勾', asset: 'iconCheck', color: '#FFBE37' },
    { key: 'list', label: '清單', asset: 'iconList', color: '#29A6A7' },
    { key: 'location', label: '地點', asset: 'iconLocation', color: '#4BA8DB' },
    { key: 'star', label: '重點星星', asset: 'iconStar', color: '#FFBE37' },
    { key: 'plus', label: '加號', asset: 'iconPlus', color: '#FD4537' },
    { key: 'money', label: '金額 $', glyph: '$', color: '#FFBE37' },
    { key: 'count', label: '數量 ×', glyph: '×', color: '#29A6A7' },
    { key: 'time', label: '時間', glyph: '時', color: '#4BA8DB' },
    { key: 'question', label: '問題', glyph: '?', color: '#8D67AA' },
    { key: 'heart', label: '喜愛', glyph: '♥', color: '#FD6F78' },
    { key: 'none', label: '不顯示 Icon', glyph: '', color: '#F5EFE7' },
    { key: 'custom', label: '自訂符號', glyph: '', color: '#8D67AA' }
  ];

  var DEFAULT_ROWS = [
    { icon: 'check', title: '任務進度', value: '100%', accent: false },
    { icon: 'list', title: '解鎖項目', value: '5／5', accent: false },
    { icon: 'location', title: '購買品項', value: '替換結果值', accent: false },
    { icon: 'star', title: '今日 MVP', value: '替換結果值', accent: false },
    { icon: 'plus', title: '最終結果', value: 'MISSION CLEAR', accent: true }
  ];

  var $ = function (id) { return document.getElementById(id); };
  var canvas = $('canvas');
  var ctx = canvas.getContext('2d');
  var staticImages = {};
  var uploads = { background: null, next: null, subscribe: null };
  var objectUrls = { background: null, next: null, subscribe: null };
  var imageNames = { background: '正式背景', next: '尚未上傳', subscribe: '尚未上傳' };
  var rows = [];
  var nextRowId = 1;
  var assetsReady = false;
  var lastIssues = [];

  function cloneDefaultRows() {
    return DEFAULT_ROWS.map(function (item) {
      return {
        id: nextRowId++,
        icon: item.icon,
        customIcon: '',
        preset: FIELD_PRESETS.indexOf(item.title) >= 0 ? item.title : 'custom',
        title: item.title,
        value: item.value,
        accent: item.accent
      };
    });
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function fontSpec(size, weight) {
    return String(weight) + ' ' + String(size) + 'px "O-Ne Noto Sans TC","Noto Sans TC","Microsoft JhengHei",sans-serif';
  }

  function loadStatic(key, src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        staticImages[key] = img;
        resolve();
      };
      img.onerror = function () {
        reject(new Error('無法載入 ' + src));
      };
      img.src = src;
    });
  }

  function drawCover(img, x, y, width, height, scale, offsetX, offsetY) {
    var base = Math.max(width / img.naturalWidth, height / img.naturalHeight);
    var factor = base * Number(scale || 1);
    var drawWidth = img.naturalWidth * factor;
    var drawHeight = img.naturalHeight * factor;
    ctx.drawImage(
      img,
      x + (width - drawWidth) / 2 + Number(offsetX || 0),
      y + (height - drawHeight) / 2 + Number(offsetY || 0),
      drawWidth,
      drawHeight
    );
  }

  function fitText(text, maxWidth, startSize, minSize, weight, issueLabel) {
    var size = startSize;
    ctx.font = fontSpec(size, weight);
    while (size > minSize && ctx.measureText(text).width > maxWidth) {
      size -= 1;
      ctx.font = fontSpec(size, weight);
    }
    if (ctx.measureText(text).width > maxWidth) {
      lastIssues.push(issueLabel + '超出版位');
    }
    return size;
  }

  function paintText(text, x, y, maxWidth, startSize, minSize, weight, color, align, issueLabel, allowBlank) {
    var value = String(text || '').trim();
    if (!value) {
      if (!allowBlank) lastIssues.push(issueLabel + '不可空白');
      return;
    }
    var size = fitText(value, maxWidth, startSize, minSize, weight, issueLabel);
    ctx.font = fontSpec(size, weight);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function fieldPresetOptions(selected) {
    var options = FIELD_PRESETS.map(function (name) {
      return '<option value="' + escapeHtml(name) + '"' + (selected === name ? ' selected' : '') + '>' + escapeHtml(name) + '</option>';
    });
    options.push('<option value="custom"' + (selected === 'custom' ? ' selected' : '') + '>自行輸入</option>');
    return options.join('');
  }

  function iconPresetOptions(selected) {
    return ICON_PRESETS.map(function (item) {
      return '<option value="' + item.key + '"' + (selected === item.key ? ' selected' : '') + '>' + escapeHtml(item.label) + '</option>';
    }).join('');
  }

  function renderRowsEditor() {
    $('rowsEditor').innerHTML = rows.map(function (row, index) {
      return [
        '<div class="row-editor" data-row-id="' + row.id + '">',
        '<div class="row-no">' + String(index + 1).padStart(2, '0') + '</div>',
        '<div class="icon-field"><label>前方 Icon</label><select data-field="icon">' + iconPresetOptions(row.icon) + '</select>',
        '<input class="custom-icon' + (row.icon === 'custom' ? ' show' : '') + '" data-field="customIcon" type="text" maxlength="2" value="' + escapeHtml(row.customIcon) + '" placeholder="例：旅"></div>',
        '<div class="preset-field"><label>名稱預設</label><select data-field="preset">' + fieldPresetOptions(row.preset) + '</select></div>',
        '<button class="row-remove" data-action="remove" type="button" aria-label="刪除此列"' + (rows.length === 1 ? ' disabled' : '') + '>×</button>',
        '<div class="row-title-field"><label>欄位名稱（可自行修改）</label><input data-field="title" type="text" maxlength="14" value="' + escapeHtml(row.title) + '"></div>',
        '<div class="row-value-field"><label>結果值</label><input data-field="value" type="text" maxlength="16" value="' + escapeHtml(row.value) + '"></div>',
        '<label class="accent-check"><input data-field="accent" type="checkbox"' + (row.accent ? ' checked' : '') + '>結果值使用金色強調</label>',
        '</div>'
      ].join('');
    }).join('');
    $('rowCount').textContent = '目前 ' + rows.length + ' 列（最多 8 列）';
    $('addRow').disabled = rows.length >= 8;
  }

  function rowFromTarget(target) {
    var editor = target.closest('.row-editor');
    if (!editor) return null;
    var id = Number(editor.getAttribute('data-row-id'));
    return rows.find(function (row) { return row.id === id; }) || null;
  }

  function handleRowInput(event) {
    var target = event.target;
    var row = rowFromTarget(target);
    if (!row) return;
    var field = target.getAttribute('data-field');
    if (!field) return;

    if (field === 'preset') {
      row.preset = target.value;
      if (target.value !== 'custom') row.title = target.value;
      renderRowsEditor();
    } else if (field === 'icon') {
      row.icon = target.value;
      renderRowsEditor();
    } else if (field === 'accent') {
      row.accent = target.checked;
    } else {
      row[field] = target.value;
      if (field === 'title') {
        row.preset = FIELD_PRESETS.indexOf(target.value) >= 0 ? target.value : 'custom';
        var presetSelect = target.closest('.row-editor').querySelector('[data-field="preset"]');
        if (presetSelect) presetSelect.value = row.preset;
      }
    }
    render();
  }

  function addRow() {
    if (rows.length >= 8) return;
    rows.push({
      id: nextRowId++,
      icon: 'plus',
      customIcon: '',
      preset: 'custom',
      title: '自訂欄位',
      value: '替換結果值',
      accent: false
    });
    renderRowsEditor();
    render();
  }

  function removeRow(target) {
    if (rows.length <= 1) return;
    var row = rowFromTarget(target);
    if (!row) return;
    rows = rows.filter(function (item) { return item.id !== row.id; });
    renderRowsEditor();
    render();
  }

  function getIconPreset(key) {
    return ICON_PRESETS.find(function (item) { return item.key === key; }) || ICON_PRESETS[0];
  }

  function drawGlyphIcon(glyph, cx, cy, size, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, size * 0.07);
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
    if (glyph) {
      var fontSize = Math.max(14, size * (glyph.length > 1 ? 0.36 : 0.54));
      ctx.font = fontSpec(fontSize, 800);
      ctx.fillStyle = '#F5EFE7';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(glyph.slice(0, 2), cx, cy + 1);
    }
    ctx.restore();
  }

  function drawRowIcon(row, x, y, size) {
    if (row.icon === 'none') return;
    var preset = getIconPreset(row.icon);
    if (preset.asset && staticImages[preset.asset]) {
      ctx.drawImage(staticImages[preset.asset], x, y, size, size);
      return;
    }
    var glyph = row.icon === 'custom' ? String(row.customIcon || '?').slice(0, 2) : preset.glyph;
    drawGlyphIcon(glyph, x + size / 2, y + size / 2, size, preset.color);
  }

  function drawDynamicRows() {
    var patchX = 754;
    var patchY = 284;
    var patchWidth = 762;
    var patchHeight = 378;
    ctx.drawImage(staticImages.resultPanel, 28, 196, patchWidth, patchHeight, patchX, patchY, patchWidth, patchHeight);

    var areaTop = 297;
    var areaHeight = 361;
    var gap = 5;
    var count = rows.length;
    var rowHeight = Math.min(69, (areaHeight - gap * (count - 1)) / count);
    var contentHeight = rowHeight * count + gap * (count - 1);
    var startY = areaTop + (areaHeight - contentHeight) / 2;
    var cream = '#F5EFE7';
    var gold = '#FFBE37';

    rows.forEach(function (row, index) {
      var y = startY + index * (rowHeight + gap);
      ctx.drawImage(staticImages.rowFrame, 754, y, 762, rowHeight);
      var iconSize = Math.min(40, Math.max(26, rowHeight - 12));
      var iconY = y + (rowHeight - iconSize) / 2;
      drawRowIcon(row, 778, iconY, iconSize);
      var titleX = row.icon === 'none' ? 786 : 830;
      var fontSize = Math.min(28, Math.max(18, rowHeight * 0.41));
      var minSize = Math.max(15, fontSize - 6);
      var baseline = y + rowHeight / 2 + fontSize * 0.34;
      paintText(row.title, titleX, baseline, row.icon === 'none' ? 430 : 390, fontSize, minSize, 700, cream, 'left', '第 ' + (index + 1) + ' 列名稱', false);
      paintText(row.value, 1482, baseline, 300, fontSize, minSize, 700, row.accent ? gold : cream, 'right', '第 ' + (index + 1) + ' 列結果', false);
    });
  }

  function drawNextImage() {
    if ($('leftMode').value !== 'thumbnail' || !uploads.next) return;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(28, 117);
    ctx.lineTo(675, 117);
    ctx.lineTo(682, 124);
    ctx.lineTo(682, 495);
    ctx.lineTo(675, 502);
    ctx.lineTo(28, 502);
    ctx.closePath();
    ctx.clip();
    drawCover(uploads.next, 26, 117, 656, 385, $('nextScale').value, $('nextX').value, $('nextY').value);
    ctx.restore();
  }

  function wrapText(text, maxWidth, size, weight) {
    var lines = [];
    var current = '';
    ctx.font = fontSpec(size, weight);
    String(text || '').split(/\r?\n/).forEach(function (paragraph, paragraphIndex) {
      Array.from(paragraph).forEach(function (character) {
        var trial = current + character;
        if (current && ctx.measureText(trial).width > maxWidth) {
          lines.push(current);
          current = character;
        } else {
          current = trial;
        }
      });
      if (current || paragraph === '') lines.push(current);
      current = '';
      if (paragraphIndex < String(text || '').split(/\r?\n/).length - 1 && lines[lines.length - 1] !== '') lines.push('');
    });
    return lines;
  }

  function drawViewerQuestion() {
    if ($('leftMode').value !== 'question') return;
    var hint = $('questionHint').value.trim();
    var question = $('viewerQuestion').value.trim();
    if (!question) {
      lastIssues.push('觀眾互動問題不可空白');
      return;
    }

    if (hint) {
      paintText(hint, 354, 205, 520, 25, 20, 800, '#FFBE37', 'center', '問題上方小字', true);
    }

    var size = 42;
    var lines = wrapText(question, 540, size, 800);
    while (size > 27 && lines.length > 4) {
      size -= 1;
      lines = wrapText(question, 540, size, 800);
    }
    if (lines.length > 4) {
      lastIssues.push('觀眾互動問題超過四行');
      lines = lines.slice(0, 4);
    }
    var lineHeight = size * 1.38;
    var centerY = hint ? 337 : 310;
    var firstBaseline = centerY - ((lines.length - 1) * lineHeight) / 2;
    ctx.font = fontSpec(size, 800);
    ctx.fillStyle = '#F5EFE7';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach(function (line, index) {
      ctx.fillText(line, 354, firstBaseline + index * lineHeight);
    });
  }

  function drawSubscribe() {
    if (!$('subscribeVisible').checked) return;
    if (uploads.subscribe) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(1738.5, 290, 165, 0, Math.PI * 2);
      ctx.clip();
      drawCover(uploads.subscribe, 1573.5, 125, 330, 330, $('subscribeScale').value, $('subscribeX').value, $('subscribeY').value);
      ctx.restore();
    }
    ctx.drawImage(staticImages.subscribeFrame, 1563, 115, 351, 350);
  }

  function drawEditableText() {
    var cream = '#F5EFE7';
    var gold = '#FFBE37';
    var ink = '#2B211C';
    paintText($('chapterTitle').value, 770, 226, 700, 52, 40, 800, cream, 'left', '篇章標題', false);
    paintText($('chapterSubtitle').value, 771, 265, 700, 27, 20, 700, gold, 'left', '篇章副標', false);
    paintText($('summaryText').value, 779, 720, 705, 27, 20, 700, ink, 'left', '單行總結', false);
    paintText($('nextText').value, 1258, 888, 470, 36, 26, 700, cream, 'center', 'NEXT 文字', false);
  }

  function drawGuides() {
    ctx.save();
    ctx.setLineDash([14, 10]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#53CED0';
    ctx.fillStyle = '#53CED0';
    ctx.font = fontSpec(18, 800);
    ctx.textAlign = 'left';
    ctx.strokeRect(26, 117, 656, 385);
    ctx.fillText($('leftMode').value === 'question' ? 'VIEWER QUESTION SAFE' : 'NEXT VIDEO SAFE', 35, 142);
    if ($('subscribeVisible').checked) {
      ctx.beginPath();
      ctx.arc(1738.5, 290, 166, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillText('SUBSCRIBE SAFE', 1580, 100);
    }
    ctx.strokeRect(754, 110, 762, 802);
    ctx.fillText('RESULT CONTENT SAFE', 762, 103);
    ctx.restore();
  }

  function render(exportMode) {
    exportMode = Boolean(exportMode);
    if (!assetsReady) return false;
    lastIssues = [];
    ctx.clearRect(0, 0, 1920, 1080);

    if ($('bgVisible').checked) {
      var bg = uploads.background || staticImages.background;
      drawCover(bg, 0, 0, 1920, 1080, $('bgScale').value, $('bgX').value, $('bgY').value);
      ctx.drawImage(staticImages.overlay, 0, 0);
    }

    ctx.drawImage(staticImages.ui, 0, 0);
    drawNextImage();
    drawViewerQuestion();
    drawDynamicRows();
    drawSubscribe();
    if ($('catsVisible').checked) ctx.drawImage(staticImages.cats, 0, 0);
    drawEditableText();
    if (!exportMode && $('showGuides').checked) drawGuides();

    if (!exportMode) {
      var fontOk = document.fonts.check('700 28px "O-Ne Noto Sans TC"');
      $('status').classList.toggle('error', lastIssues.length > 0 || !fontOk);
      $('status').textContent = lastIssues.length
        ? '請修正後再輸出：' + lastIssues.join('、')
        : '版位檢查通過｜' + rows.length + ' 列結果｜文字溢位 0｜正式字體' + (fontOk ? '已載入' : '待載入') + '｜' + ($('subscribeVisible').checked ? '顯示訂閱框' : '訂閱框關閉');
    }
    return lastIssues.length === 0;
  }

  function syncLeftModeUI() {
    var mode = $('leftMode').value;
    $('questionControls').classList.toggle('hidden', mode !== 'question');
    $('nextControls').classList.toggle('hidden', mode !== 'thumbnail');
    render();
  }

  function syncRange(id) {
    $(id + 'Out').value = Number($(id).value).toFixed(2) + '×';
    render();
  }

  function revokeUpload(key) {
    if (objectUrls[key]) URL.revokeObjectURL(objectUrls[key]);
    objectUrls[key] = null;
    uploads[key] = null;
  }

  function assetPrefix(key) {
    return key === 'background' ? 'bg' : key;
  }

  function loadUpload(file, key) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('請選擇圖片檔');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      alert('圖片請小於 25 MB');
      return;
    }
    revokeUpload(key);
    var url = URL.createObjectURL(file);
    var img = new Image();
    var prefix = assetPrefix(key);
    objectUrls[key] = url;
    img.onload = function () {
      uploads[key] = img;
      imageNames[key] = file.name;
      $(prefix + 'Name').textContent = file.name;
      if (key === 'next') {
        $('leftMode').value = 'thumbnail';
        syncLeftModeUI();
      }
      if (key === 'subscribe') $('subscribeVisible').checked = true;
      render();
    };
    img.onerror = function () {
      revokeUpload(key);
      alert('圖片讀取失敗');
    };
    img.src = url;
  }

  function clearUpload(key) {
    var prefix = assetPrefix(key);
    revokeUpload(key);
    imageNames[key] = key === 'background' ? '正式背景' : '尚未上傳';
    $(prefix + 'Name').textContent = imageNames[key];
    $(prefix + 'Upload').value = '';
    if (key === 'next') {
      $('leftMode').value = 'empty';
      syncLeftModeUI();
    }
    if (key === 'subscribe') $('subscribeVisible').checked = false;
    render();
  }

  function downloadBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1200);
  }

  function currentRows() {
    return rows.map(function (row, index) {
      return {
        position: index + 1,
        icon: row.icon,
        custom_icon: row.customIcon,
        title: row.title,
        value: row.value,
        accent_value: row.accent
      };
    });
  }

  function downloadJson() {
    if (!render()) return;
    var leftMode = $('leftMode').value;
    var payload = {
      schema: SCHEMA,
      status: 'READY',
      generator_version: VERSION,
      component_id: FORMAL.component_id,
      semantic_id: FORMAL.semantic_id,
      usage: FORMAL.usage,
      formal_source: FORMAL,
      canvas: { width: 1920, height: 1080, color_mode: 'RGB', bit_depth: 8 },
      content: {
        chapter_title: $('chapterTitle').value,
        chapter_subtitle: $('chapterSubtitle').value,
        rows: currentRows(),
        summary: $('summaryText').value,
        next_text: $('nextText').value,
        viewer_question: leftMode === 'question' ? {
          hint: $('questionHint').value,
          text: $('viewerQuestion').value
        } : null
      },
      assets: {
        background: {
          visible: $('bgVisible').checked,
          source: uploads.background ? 'upload' : 'formal',
          file_name: imageNames.background,
          scale: Number($('bgScale').value),
          x: Number($('bgX').value),
          y: Number($('bgY').value)
        },
        left_panel: {
          mode: leftMode,
          file_name: imageNames.next,
          scale: Number($('nextScale').value),
          x: Number($('nextX').value),
          y: Number($('nextY').value)
        },
        subscribe: {
          frame_visible: $('subscribeVisible').checked,
          image_visible: $('subscribeVisible').checked && Boolean(uploads.subscribe),
          source: uploads.subscribe ? 'upload' : 'youtube_overlay_slot',
          file_name: imageNames.subscribe,
          scale: Number($('subscribeScale').value),
          x: Number($('subscribeX').value),
          y: Number($('subscribeY').value)
        },
        characters: {
          visible: $('catsVisible').checked,
          source: 'formal_psd_layers',
          names: ['Nomi', 'Kuma']
        }
      },
      safe_zones: {
        left_panel: [26, 117, 656, 385],
        subscribe_circle: { cx: 1738.5, cy: 290, radius: 165 },
        result_content: [754, 110, 762, 802]
      },
      qa: {
        row_count: rows.length,
        supported_row_range: [1, 8],
        overflow_count: lastIssues.length,
        guide_layers_rendered: false,
        psd_overwritten: false
      }
    };
    downloadBlob(
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
      'O-Ne_QST-03_片尾結算_READY_V0.1.1.json'
    );
  }

  function resetAll() {
    $('chapterTitle').value = '篇章任務完成';
    $('chapterSubtitle').value = 'D1／D2｜替換篇名與章節副標';
    $('summaryText').value = '總結置於此處。';
    $('nextText').value = '下一篇／下一任務';
    $('leftMode').value = 'question';
    $('questionHint').value = '留言告訴我們';
    $('viewerQuestion').value = '你見過外國旅客買過最意外的台灣商品是什麼？';
    rows = cloneDefaultRows();
    renderRowsEditor();
    $('bgVisible').checked = true;
    $('subscribeVisible').checked = false;
    $('catsVisible').checked = true;
    $('showGuides').checked = false;
    ['background', 'next', 'subscribe'].forEach(function (key) {
      revokeUpload(key);
      var prefix = assetPrefix(key);
      imageNames[key] = key === 'background' ? '正式背景' : '尚未上傳';
      $(prefix + 'Name').textContent = imageNames[key];
      $(prefix + 'Upload').value = '';
    });
    ['bgScale', 'nextScale', 'subscribeScale'].forEach(function (id) {
      $(id).value = '1';
      $(id + 'Out').value = '1.00×';
    });
    ['bgX', 'bgY', 'nextX', 'nextY', 'subscribeX', 'subscribeY'].forEach(function (id) {
      $(id).value = '0';
    });
    syncLeftModeUI();
    render();
  }

  rows = cloneDefaultRows();
  renderRowsEditor();

  $('rowsEditor').addEventListener('input', handleRowInput);
  $('rowsEditor').addEventListener('change', handleRowInput);
  $('rowsEditor').addEventListener('click', function (event) {
    if (event.target.getAttribute('data-action') === 'remove') removeRow(event.target);
  });
  $('addRow').addEventListener('click', addRow);

  ['chapterTitle', 'chapterSubtitle', 'summaryText', 'nextText', 'questionHint', 'viewerQuestion', 'bgX', 'bgY', 'nextX', 'nextY', 'subscribeX', 'subscribeY'].forEach(function (id) {
    $(id).addEventListener('input', function () { render(); });
  });
  ['bgVisible', 'subscribeVisible', 'catsVisible', 'showGuides'].forEach(function (id) {
    $(id).addEventListener('change', function () { render(); });
  });
  $('leftMode').addEventListener('change', syncLeftModeUI);
  ['bgScale', 'nextScale', 'subscribeScale'].forEach(function (id) {
    $(id).addEventListener('input', function () { syncRange(id); });
  });

  $('bgUpload').addEventListener('change', function (event) { loadUpload(event.target.files[0], 'background'); });
  $('nextUpload').addEventListener('change', function (event) { loadUpload(event.target.files[0], 'next'); });
  $('subscribeUpload').addEventListener('change', function (event) { loadUpload(event.target.files[0], 'subscribe'); });
  $('clearBg').onclick = function () { clearUpload('background'); };
  $('clearNext').onclick = function () { clearUpload('next'); };
  $('clearSubscribe').onclick = function () { clearUpload('subscribe'); };

  $('transparentView').onclick = function () {
    $('stage').classList.remove('dark');
    $('transparentView').classList.add('active');
    $('darkView').classList.remove('active');
  };
  $('darkView').onclick = function () {
    $('stage').classList.add('dark');
    $('darkView').classList.add('active');
    $('transparentView').classList.remove('active');
  };
  $('downloadPng').onclick = function () {
    if (!render(true)) {
      render(false);
      return;
    }
    canvas.toBlob(function (blob) {
      if (blob) downloadBlob(blob, 'O-Ne_QST-03_片尾結算_READY_V0.1.1_1920x1080.png');
      render(false);
    }, 'image/png');
  };
  $('downloadJson').onclick = downloadJson;
  $('reset').onclick = resetAll;

  syncLeftModeUI();

  var imageLoads = Object.keys(STATIC_SOURCES).map(function (key) {
    return loadStatic(key, STATIC_SOURCES[key]);
  });
  Promise.all(imageLoads.concat([
    document.fonts.load('700 36px "O-Ne Noto Sans TC"'),
    document.fonts.load('800 52px "O-Ne Noto Sans TC"')
  ])).then(function () {
    assetsReady = true;
    ['bgScale', 'nextScale', 'subscribeScale'].forEach(function (id) {
      $(id + 'Out').value = Number($(id).value).toFixed(2) + '×';
    });
    render();
  }).catch(function (error) {
    $('status').classList.add('error');
    $('status').textContent = '載入失敗：' + error.message;
  });
})();
