(function () {
  'use strict';

  var WRAPPER_VERSION = '0.1.5-beige-bg-asset-fix';
  var CORE_SRC = './settlement-card-v011-core-v013.js?v=015-bgfix';
  var OVERLAY_TOKEN = 'settlement-background-overlay-v010.png';
  var BACKGROUND_TOKEN = 'settlement-background-v010.jpg';
  var BACKGROUND_SRC = './assets/settlement-background-v011.jpg?v=011';
  var backgroundOpacity = 100;

  function $(id) { return document.getElementById(id); }

  function clampOpacity(value) {
    value = Number(value);
    if (!Number.isFinite(value)) value = 100;
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  function triggerRender() {
    var bgX = $('bgX');
    if (bgX) bgX.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function syncOpacityUI(value, rerender) {
    backgroundOpacity = clampOpacity(value);
    var input = $('backgroundOpacity');
    var output = $('backgroundOpacityOut');
    if (input) input.value = String(backgroundOpacity);
    if (output) output.value = String(backgroundOpacity) + '%';
    if (rerender) triggerRender();
  }

  function installOpacityControl() {
    if ($('backgroundOpacity')) return;
    var bgScale = $('bgScale');
    if (!bgScale) return;
    var asset = bgScale.closest('.asset');
    if (!asset) return;

    var wrap = document.createElement('div');
    wrap.className = 'adjust one-background-opacity-control';
    wrap.style.gridTemplateColumns = '1fr';
    wrap.style.marginTop = '9px';
    wrap.innerHTML = [
      '<label>背景透明度 <output id="backgroundOpacityOut">100%</output>',
      '<input id="backgroundOpacity" type="range" min="0" max="100" step="1" value="100">',
      '</label>'
    ].join('');
    asset.appendChild(wrap);

    $('backgroundOpacity').addEventListener('input', function () {
      syncOpacityUI(this.value, true);
    });
  }

  function patchImageSource() {
    var proto = window.HTMLImageElement && window.HTMLImageElement.prototype;
    if (!proto || proto.__oneSettlementBackgroundSourcePatched) return;
    var descriptor = Object.getOwnPropertyDescriptor(proto, 'src');
    if (!descriptor || typeof descriptor.set !== 'function') return;

    Object.defineProperty(proto, 'src', {
      configurable: descriptor.configurable,
      enumerable: descriptor.enumerable,
      get: descriptor.get,
      set: function (value) {
        if (typeof value === 'string' && value.indexOf(BACKGROUND_TOKEN) !== -1) {
          value = BACKGROUND_SRC;
        }
        return descriptor.set.call(this, value);
      }
    });
    proto.__oneSettlementBackgroundSourcePatched = true;
  }

  function patchCanvasDrawImage() {
    var proto = CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
    if (!proto || proto.__oneSettlementBeigePatched) return;
    var original = proto.drawImage;

    proto.drawImage = function () {
      var image = arguments[0];
      var src = image && typeof image.src === 'string' ? image.src : '';

      if (src && src.indexOf(OVERLAY_TOKEN) !== -1) return;

      var isFullCanvasCover = arguments.length === 5 && Number(arguments[3]) >= 1900 && Number(arguments[4]) >= 1060;
      if (isFullCanvasCover) {
        var previousAlpha = this.globalAlpha;
        this.globalAlpha = previousAlpha * (backgroundOpacity / 100);
        var result = original.apply(this, arguments);
        this.globalAlpha = previousAlpha;
        return result;
      }

      return original.apply(this, arguments);
    };
    proto.__oneSettlementBeigePatched = true;
  }

  function patchEditBackup() {
    if (!window.ONEEditBackup || typeof window.ONEEditBackup.mount !== 'function' || window.ONEEditBackup.__oneSettlementOpacityPatched) return;
    var originalMount = window.ONEEditBackup.mount.bind(window.ONEEditBackup);

    window.ONEEditBackup.mount = function (options) {
      if (options && options.id === 'settlement-card') {
        var originalCapture = options.capture;
        var originalApply = options.apply;
        var originalFromJSON = options.fromJSON;

        options.capture = function () {
          var snapshot = originalCapture();
          snapshot.fields = snapshot.fields || {};
          snapshot.fields.backgroundOpacity = backgroundOpacity;
          return snapshot;
        };

        options.apply = function (snapshot) {
          var result = originalApply(snapshot);
          var value = snapshot && snapshot.fields && snapshot.fields.backgroundOpacity;
          syncOpacityUI(value == null ? 100 : value, true);
          return result;
        };

        options.fromJSON = function (payload) {
          var snapshot = originalFromJSON(payload);
          snapshot.fields = snapshot.fields || {};
          var bg = payload && payload.assets && payload.assets.background;
          snapshot.fields.backgroundOpacity = bg && bg.opacity != null ? bg.opacity : 100;
          return snapshot;
        };
      }
      return originalMount(options);
    };
    window.ONEEditBackup.__oneSettlementOpacityPatched = true;
  }

  function downloadBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1200);
  }

  function readRowsFromDOM() {
    return Array.from(document.querySelectorAll('.row-editor')).map(function (editor, index) {
      function field(name) { return editor.querySelector('[data-field="' + name + '"]'); }
      var icon = field('icon');
      var customIcon = field('customIcon');
      var title = field('title');
      var value = field('value');
      var accent = field('accent');
      return {
        position: index + 1,
        icon: icon ? icon.value : 'none',
        custom_icon: customIcon ? customIcon.value : '',
        title: title ? title.value : '',
        value: value ? value.value : '',
        accent_value: Boolean(accent && accent.checked)
      };
    });
  }

  function installJsonExporter() {
    var button = $('downloadJson');
    if (!button) return;

    button.onclick = function () {
      triggerRender();
      var status = $('status');
      if (status && status.classList.contains('error')) {
        alert(status.textContent || '請先修正版位問題');
        return;
      }

      var leftMode = $('leftMode').value;
      var payload = {
        schema: 'o-ne.settlement-card.ready.v0.1.3',
        status: 'READY',
        generator_version: '0.1.3+' + WRAPPER_VERSION,
        component_id: 'QST-03',
        semantic_id: 'settlement_panel_16x9',
        usage: 'RESULT',
        formal_source: {
          component_id: 'QST-03',
          semantic_id: 'settlement_panel_16x9',
          usage: 'RESULT',
          formal_ref: 'QST-03',
          formal_version: 'V1.1',
          extension_approved_by: 'Omi'
        },
        canvas: { width: 1920, height: 1080, color_mode: 'RGB', bit_depth: 8 },
        content: {
          chapter_title: $('chapterTitle').value,
          chapter_subtitle: $('chapterSubtitle').value,
          rows: readRowsFromDOM(),
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
            source: $('bgName').textContent === '正式背景' ? 'formal' : 'upload',
            file_name: $('bgName').textContent,
            scale: Number($('bgScale').value),
            x: Number($('bgX').value),
            y: Number($('bgY').value),
            opacity: backgroundOpacity
          },
          left_panel: {
            mode: leftMode,
            file_name: $('nextName').textContent,
            scale: Number($('nextScale').value),
            x: Number($('nextX').value),
            y: Number($('nextY').value)
          },
          subscribe: {
            frame_visible: $('subscribeVisible').checked,
            image_visible: $('subscribeVisible').checked && $('subscribeName').textContent !== '尚未上傳',
            source: $('subscribeName').textContent !== '尚未上傳' ? 'upload' : 'youtube_overlay_slot',
            file_name: $('subscribeName').textContent,
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
          row_count: readRowsFromDOM().length,
          supported_row_range: [1, 8],
          overflow_count: 0,
          guide_layers_rendered: false,
          psd_overwritten: false
        }
      };

      downloadBlob(
        new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
        'O-Ne_QST-03_片尾結算_READY_V0.1.3.json'
      );
    };
  }

  function installResetFix() {
    var button = $('reset');
    if (!button) return;
    button.addEventListener('click', function () {
      setTimeout(function () {
        if ($('bgVisible')) $('bgVisible').checked = true;
        syncOpacityUI(100, false);
        if ($('bgVisible')) $('bgVisible').dispatchEvent(new Event('change', { bubbles: true }));
      }, 0);
    });
  }

  function loadCore() {
    var script = document.createElement('script');
    script.src = CORE_SRC;
    script.onload = function () {
      installJsonExporter();
      installResetFix();
      syncOpacityUI(100, true);
    };
    script.onerror = function () {
      var status = $('status');
      if (status) {
        status.classList.add('error');
        status.textContent = '載入失敗：settlement-card core';
      }
    };
    document.body.appendChild(script);
  }

  installOpacityControl();
  patchImageSource();
  patchCanvasDrawImage();
  patchEditBackup();
  if ($('bgVisible')) $('bgVisible').checked = true;
  syncOpacityUI(100, false);
  loadCore();
})();