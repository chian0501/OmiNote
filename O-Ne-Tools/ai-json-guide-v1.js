/* O-Ne shared AI JSON format guide — V1.0.1 */
(function (global) {
  'use strict';

  var VERSION = '1.0.1';
  var mounted = Object.create(null);

  var GUIDES = {
    'general-card': {
      name: '一般卡', code: 'GENERAL-CARD', version: 'V1.2.1', file: 'O-Ne_一般卡_卡片標題.json',
      values: ['mode：HERE／GET／COST／CUSTOM', 'HERE=地點定位；GET=獲得；COST=花費；CUSTOM=自訂標籤'],
      example: {
        component_id: 'HERE-01', mapping_status: 'MAPPED', generator_version: 'V1.2.1_20260826', panel_fill_opacity: 0.8,
        mode: 'HERE', variant: 'HERE', label: { text: 'HERE', color: '#29A6A7', text_color: '#FFFFFF', custom: false },
        title: '臨空城華盛頓飯店', subtitle: '計畫外多住的一晚'
      }
    },
    'trigger-card': {
      name: '觸發卡', code: 'TRIGGER-CARD', version: 'V1.0.2', file: 'O-Ne_觸發卡_卡片標題.json',
      values: ['component_id 固定 TRIGGER-CARD', 'state：EVENT／DONE／FAIL', 'progress 例如 0/1、1/1'],
      example: {
        component_id: 'TRIGGER-CARD', master_psd_id: '10sd-QP_W3YqYksm1cVGYhaAqLbppjBJY', generator_version: 'V1.0.2_20260826', panel_fill_opacity: 0.8,
        state: 'EVENT', title: '在機場看煙火', subtitle: '關西國際機場 (KIX) 看到煙火', progress: '0/1'
      }
    },
    'persistent-card': {
      name: '常駐卡', code: 'PERSISTENT-MISSION', version: 'V1.1.2', file: 'O-Ne_常駐卡_任務標題.json',
      values: ['component_id 固定 PERSISTENT-MISSION', 'tool 固定 persistent-card', 'state：MISSION／DONE／FAIL', '字級為數字，font_size_mode 固定 manual'],
      example: {
        component_id: 'PERSISTENT-MISSION', tool: 'persistent-card', schema_version: '1.2', master_psd_id: '1VMBCecO8QLuwtSMxy-BplfUa2Ybr3YDU',
        generator_version: 'V1.1.2_20260827', panel_fill_opacity: 0.8, state: 'MISSION', task_text: '準備返台', progress: '0/1',
        task_font_size: 21, progress_font_size: 20, font_size_mode: 'manual'
      }
    },
    'effect-card': {
      name: '效果卡', code: 'STA-02', version: 'V0.3.1', file: 'O-Ne_效果卡_效果標題.json',
      values: [
        'schema 固定以 o-ne.effect-card.formal. 開頭', 'state 建議 BUFF／DEBUFF',
        'text_style：white／accent／gold；decoration_density：light／standard',
        'decoration：delicious／cute／love／praised／badTaste／shock／backstab／sick／none',
        'atmosphere：none／loveBubbles／mintMist／scarletTrap／electricBurst／cottonCandy／goldenCelebration'
      ],
      example: {
        schema: 'o-ne.effect-card.formal.v0.3.1', version: '0.3.1', status: 'FORMAL', preset: 'delicious', state: 'BUFF',
        title: '好吃到爆！', subtitle: '幸福感 +999', title_font_size: 42, content_font_size: 22, content_visible: true,
        accent: '#FFBE37', text_style: 'white', decoration: 'delicious', decoration_density: 'standard', decoration_visible: true, atmosphere: 'none'
      }
    },
    'move-card': {
      name: '移動卡', code: 'NAV-01', version: 'V1.0.7', file: 'O-Ne_移動卡_起點到終點.json',
      values: ['component_id 固定 NAV-01', 'state：white／orange', 'stations 必須 2–8 站', 'segments 數量必須等於 stations 數量 − 1', 'segment.style：solid／dashed'],
      example: {
        component_id: 'NAV-01', generator_version: 'V1.0.7_20260826', panel_fill_opacity: 0.8, title: '一蘭 → 關西機場', state: 'white',
        stations: ['一蘭', '飯店拿行李', '梅田', '大阪站（JR）', '關西機場'],
        segments: [
          { name: '步行', style: 'solid' }, { name: '移動', style: 'solid' }, { name: '步行', style: 'solid' }, { name: 'JR', style: 'solid' }
        ]
      }
    },
    'choice-card': {
      name: '選項卡', code: 'SELECT-CARD', version: 'V1.0.1', file: 'O-Ne_選項卡_問題標題.json',
      values: ['component_id 固定 SELECT-CARD', 'options 每項要有 index、text、state', 'option.state：BRIGHT／DIM；可以同時多項 BRIGHT'],
      example: {
        component_id: 'SELECT-CARD', generator_version: 'V1.0.1_20260826', master_psd_id: '1wYnhZVvoQMl4hn1W7msw_oh3k-RqbHca',
        title: '關西國際機場 (KIX) → 住宿飯店', question: '選擇的交通工具？',
        options: [{ index: 1, text: '關空特急 HARUKA', state: 'DIM' }, { index: 2, text: '南海電鐵', state: 'BRIGHT' }]
      }
    },
    'challenge-card': {
      name: '挑戰卡', code: 'CHALLENGE-CARD', version: 'V0.1.1', file: 'O-Ne_挑戰卡_挑戰標題.json',
      values: ['schema 固定 o-ne.challenge-card.ready.v0.1.1', 'mode：accept／abandon', 'selected：yes／no', 'copy.prefix／emphasis／suffix 與 YES／NO 按鈕文字可替換'],
      example: {
        schema: 'o-ne.challenge-card.ready.v0.1.1', status: 'READY', generator_version: 'V0.1.1_20260826', approved_by: 'Omi', approved_on: '2026-08-21',
        mode: 'accept', selected: 'yes', copy: { prefix: '確認', emphasis: '接受', suffix: '挑戰任務？', yes: 'YES', no: 'NO' },
        formal_sources: { accept_psd_id: '1SqUYmbv5VfVWei1Gp4hoUFPDiynwoIPU', abandon_psd_id: '1eNgO2nsgtK9A4h6Ieak6WkYv6J232gWd' },
        visual_rules: { panel_fill_opacity: 0.8, select_label_locked: true }
      }
    },
    'dialogue-card': {
      name: '對話卡', code: 'DIALOGUE-CARD', version: 'V1.3.7', file: 'O-Ne_對話卡_對話摘要.json',
      values: ['component_id 固定 DIALOGUE-CARD', 'character：NONE／Omi／NieTe／Kuma／Nomi／NPC', '表情：大笑／驚訝／生氣／委屈哭／疑惑／無奈（NPC 不使用頭像表情）', 'left／right 都要保留 character、expression、name'],
      example: {
        component_id: 'DIALOGUE-CARD', generator_version: 'V1.3.7_20260826',
        left: { character: 'Omi', expression: '疑惑', name: 'Omi' }, right: { character: 'NieTe', expression: '無奈', name: 'Nie Te' },
        dialogue: '你不是說走這條比較快嗎？'
      }
    },
    'rating-card': {
      name: '評分卡', code: 'COL-02', version: 'V1.3.1', file: 'O-Ne_評分卡_店家或商品名稱.json', image: true,
      values: ['component_id 固定 COL-02；schema 以 o-ne.rating-card.ready. 開頭', 'ratings 1–8 項；type=score 時填 score，type=text 時填 result', 'layout.mode：left／right／both／none', 'JSON 不含圖片位元；要連商品圖／背景一起交付請使用 O-Ne 專案 ZIP'],
      example: {
        schema: 'o-ne.rating-card.ready.v1.3.1', status: 'READY', component_id: 'COL-02', generator_version: 'V1.3.1_20260826',
        layout: { mode: 'none', requested_width_px: 1856 }, label: { text: '美食評分', size_px: 32 }, store_name: '燒肉力丸 道頓堀店', address: '大阪・道頓堀',
        ratings: [{ label: '好吃度', type: 'score', score: 4.8 }, { label: 'CP 值', type: 'score', score: 4.5 }, { label: '結論', type: 'text', result: '值得再訪' }],
        price_badge: '¥', price: '一人 5000 日圓', review: '上菜速度快，牛舌好吃',
        image_adjustments: { background: { visible: false, scale: 1, x: 0, y: 0 }, product: { position: 'none', size_percent: 28 }, left_product: { visible: false }, right_product: { visible: false } }
      }
    },
    'focus-card': {
      name: '焦點／說明內容卡', code: 'FOCUS-CARD', version: 'V0.5.11', file: 'O-Ne_焦點卡_卡片標題.json', image: true,
      values: ['schema 固定 o-ne.focus-card.ready.v0.5.11', 'mode：body／list／steps', 'body 模式 content 使用 body；list／steps 模式改用 items 陣列', 'titleColor：highlight／light；itemFrameStates：none／focus／idle', 'JSON 不含圖片位元；有商品圖請用 O-Ne 專案 ZIP'],
      example: {
        schema: 'o-ne.focus-card.ready.v0.5.11', status: 'READY', mode: 'body', component: { placement: 'centerLower' },
        style: { accentColor: '#29A6A7', cardSize: 'large', customWidth: 882, titleSize: 56, contentSize: 36 },
        label: { enabled: false, text: '', position: 'above', background: '#29A6A7', color: '#FFFFFF' },
        images: { placement: 'right', scale: 32, left: { enabled: false, name: '' }, right: { enabled: false, name: '' } },
        content: { titleEnabled: true, title: '道頓堀觀光船', titleColor: 'highlight', divider: true, body: '從河面看道頓堀招牌，是另一種視角。', ctaEnabled: false, cta: '', sourceEnabled: false, source: '' }
      }
    },
    'thumbnail-frame': {
      name: '縮圖品牌框', code: 'THUMBNAIL-FRAME', version: 'V1.2.6', file: 'O-Ne_縮圖品牌框_封面名稱.json', image: true,
      values: ['component_id 固定 THUMBNAIL-FRAME；schema 以 o-ne.thumbnail-frame.ready. 開頭', 'source_image.mode：cover／contain', 'corner.content：logo／text／image／none', 'corner.position：top-left／top-right／bottom-left／bottom-right', 'JSON 不含底圖或自訂角標圖片；完整交付請用 O-Ne 專案 ZIP'],
      example: {
        schema: 'o-ne.thumbnail-frame.ready.v1.2.6', status: 'READY', component_id: 'THUMBNAIL-FRAME', generator_version: 'V1.2.6_20260826', canvas: [1920, 1080],
        source_image: { embedded: false, present: false, mode: 'cover', zoom_percent: 100, position_x: 0, position_y: 0, background_color: '#000000' },
        corner: { content: 'logo', position: 'top-right', text: '', text_color: '#FFFFFF', custom_image_embedded: false, custom_image_present: false }
      }
    },
    'settlement-card': {
      name: '片尾結算卡', code: 'QST-03', version: 'V0.1.3', file: 'O-Ne_片尾結算卡_章節標題.json', image: true,
      values: ['component_id 固定 QST-03；schema 固定 o-ne.settlement-card.ready.v0.1.3', 'rows 支援 1–8 列', 'row.icon 可用 check／list／location／star／plus／money／count／time／question／heart／none／custom', 'left_panel.mode 可使用 question／image／empty（依工具當前選項）', 'JSON 不含使用者上傳圖片；完整交付請用 O-Ne 專案 ZIP'],
      example: {
        schema: 'o-ne.settlement-card.ready.v0.1.3', status: 'READY', generator_version: '0.1.3', component_id: 'QST-03', semantic_id: 'settlement_panel_16x9',
        content: {
          chapter_title: '大阪任務結算', chapter_subtitle: 'DAY 5 RESULT',
          rows: [{ icon: 'check', title: '任務進度', value: '100%', accent: false }, { icon: 'star', title: '今日 MVP', value: '燒肉力丸', accent: true }],
          summary: '本日任務完成', next_text: '下一集：返台危機', viewer_question: { hint: '留言告訴我們', text: '你最想挑戰哪一個？' }
        },
        assets: {
          background: { visible: true, source: 'formal', file_name: '正式背景', scale: 1, x: 0, y: 0 },
          left_panel: { mode: 'question', file_name: '尚未上傳', scale: 1, x: 0, y: 0 },
          subscribe: { visible: false, file_name: '尚未上傳', scale: 1, x: 0, y: 0 }
        }
      }
    }
  };

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function exampleJson(guide) { return JSON.stringify(guide.example, null, 2); }

  function aiPrompt(guide) {
    var lines = [
      '你要製作 O-Ne「' + guide.name + '」的 JSON 設定檔。',
      '請依我接下來提供的內容，把資料填入下方格式；不要自行重新設計欄位，不要刪除固定識別欄位。',
      '',
      '交付規則：',
      '1. 請回傳 UTF-8 的 .json 檔，建議檔名：' + guide.file,
      '2. 如果目前介面不能直接建立附件，就只輸出「純 JSON 原文」。',
      '3. 不要使用 ```json 程式碼框，不要在 JSON 前後加說明、標題、註解或 Markdown。',
      '4. 不知道的內容不要猜；保留原值、空字串或先詢問我。',
      '5. JSON 必須可被 JSON.parse() 直接解析；不可有 trailing comma。'
    ];
    if (guide.image) lines.push('6. 這是圖片型工具：JSON 不包含圖片本體；若需要把圖片一起搬移，應由 O-Ne Tools 另存「專案 ZIP」。');
    lines.push('', '欄位規則：');
    guide.values.forEach(function (item) { lines.push('- ' + item); });
    lines.push('', '請使用這個 JSON 結構：', exampleJson(guide));
    return lines.join('\n');
  }

  function copyText(text, done) {
    if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
      global.navigator.clipboard.writeText(text).then(function () { done(true); }).catch(function () { fallbackCopy(text, done); });
    } else fallbackCopy(text, done);
  }

  function fallbackCopy(text, done) {
    try {
      var area = document.createElement('textarea');
      area.value = text; area.setAttribute('readonly', '');
      area.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
      document.body.appendChild(area); area.select();
      var ok = document.execCommand('copy'); area.remove(); done(Boolean(ok));
    } catch (error) { done(false); }
  }

  function downloadExample(guide) {
    var blob = new Blob([exampleJson(guide) + '\n'], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob); var a = document.createElement('a');
    a.href = url; a.download = guide.file; a.click();
    global.setTimeout(function () { URL.revokeObjectURL(url); }, 1200);
  }

  function ensureStyles() {
    if (document.getElementById('one-ai-json-guide-style')) return;
    var style = document.createElement('style');
    style.id = 'one-ai-json-guide-style';
    style.textContent = [
      '.one-ai-json-guide{min-width:0;width:100%;margin:0;padding:16px;border:1px solid #354052;border-radius:14px;background:#111923;color:#d8dee7;font-family:"Noto Sans TC","Microsoft JhengHei",sans-serif;box-shadow:0 12px 28px rgba(0,0,0,.18)}',
      '.one-ai-json-guide__head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px}.one-ai-json-guide__head strong{color:#f0a8cf;font-size:14px}.one-ai-json-guide__badge{padding:4px 8px;border-radius:999px;background:#21363b;color:#8fe0d7;font-size:10px;font-weight:800}',
      '.one-ai-json-guide__note{margin:0 0 10px;color:#9ba6b4;font-size:11px;line-height:1.65}',
      '.one-ai-json-guide__rules{margin:0 0 10px;padding-left:19px;color:#c9d1db;font-size:11px;line-height:1.65}',
      '.one-ai-json-guide__buttons{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}.one-ai-json-guide button{min-height:38px;border:1px solid #3a4658;border-radius:8px;padding:7px 11px;background:#18212d;color:#f5f1ea;font:700 12px/1.2 inherit;cursor:pointer}.one-ai-json-guide button[data-action="copy-prompt"]{border-color:#29a6a7;background:#12383d;color:#8fe0d7}',
      '.one-ai-json-guide__file{margin:0 0 9px;color:#8fd4c8;font-size:10px}.one-ai-json-guide details{border:1px solid #2c3545;border-radius:9px;background:#0d141d}.one-ai-json-guide summary{cursor:pointer;padding:9px 11px;color:#d9dee5;font-size:11px;font-weight:800}.one-ai-json-guide pre{max-height:380px;overflow:auto;margin:0;padding:12px;border-top:1px solid #2c3545;color:#d6e4ef;background:#0b1118;font:11px/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre-wrap;word-break:break-word}',
      '.one-ai-json-guide__status{min-height:17px;margin-top:8px;color:#8fd4c8;font-size:11px}.one-ai-json-guide__status.error{color:#ff7770}',
      '.one-ai-json-guide-stack{min-width:0;width:100%;display:flex;flex-direction:column;gap:14px;align-self:start}.one-ai-json-guide-stack>.panel,.one-ai-json-guide-stack>.preview-panel{width:100%}.app-shell.one-ai-json-guide-enabled{height:auto;min-height:100dvh}',
      '@media(max-width:680px){.one-ai-json-guide{padding:13px}.one-ai-json-guide__head{align-items:flex-start;flex-direction:column}}'
    ].join('');
    document.head.appendChild(style);
  }

  function setStatus(panel, message, error) {
    var node = panel.querySelector('.one-ai-json-guide__status');
    if (!node) return;
    node.textContent = message || '';
    node.classList.toggle('error', Boolean(error));
  }

  function panelFor(id, guide) {
    ensureStyles();
    var panel = document.createElement('section');
    panel.className = 'one-ai-json-guide';
    panel.setAttribute('data-one-ai-json-guide', id);
    panel.innerHTML =
      '<div class="one-ai-json-guide__head"><strong>給 AI 的 JSON 格式｜' + escapeHtml(guide.name) + '</strong><span class="one-ai-json-guide__badge">' + escapeHtml(guide.code + ' · ' + guide.version) + '</span></div>' +
      '<p class="one-ai-json-guide__note">把「完整 AI 指令」貼給 AI，就會知道這張卡要回什麼欄位與怎麼交檔。AI 應回傳 .json 檔；不能建立附件時，只回純 JSON，不要加 Markdown。</p>' +
      '<div class="one-ai-json-guide__file">建議檔名：' + escapeHtml(guide.file) + (guide.image ? ' ｜ 有圖片時完整搬移請用 O-Ne 專案 ZIP' : '') + '</div>' +
      '<ul class="one-ai-json-guide__rules">' + guide.values.map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</ul>' +
      '<div class="one-ai-json-guide__buttons">' +
        '<button type="button" data-action="copy-prompt">複製完整 AI 指令</button>' +
        '<button type="button" data-action="copy-json">複製 JSON 範例</button>' +
        '<button type="button" data-action="download-json">下載 JSON 範例</button>' +
      '</div>' +
      '<details open><summary>JSON 範例｜可直接給 AI 照這個結構回覆</summary><pre></pre></details>' +
      '<div class="one-ai-json-guide__status" aria-live="polite"></div>';
    panel.querySelector('pre').textContent = exampleJson(guide);
    panel.querySelector('[data-action="copy-prompt"]').onclick = function () {
      copyText(aiPrompt(guide), function (ok) { setStatus(panel, ok ? '已複製完整 AI 指令。' : '複製失敗，請手動選取文字。', !ok); });
    };
    panel.querySelector('[data-action="copy-json"]').onclick = function () {
      copyText(exampleJson(guide), function (ok) { setStatus(panel, ok ? '已複製 JSON 範例。' : '複製失敗，請手動選取 JSON。', !ok); });
    };
    panel.querySelector('[data-action="download-json"]').onclick = function () { downloadExample(guide); setStatus(panel, 'JSON 範例已下載。', false); };
    return panel;
  }

  function directPreviewPanel(host) {
    if (!host || !host.children) return null;
    var children = Array.prototype.slice.call(host.children);
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (!child || !child.querySelector) continue;
      if (child.classList && child.classList.contains('preview-panel')) return child;
      if (child.querySelector('.preview-wrap,.stage,.canvas-stage,canvas')) return child;
    }
    return null;
  }

  function insertBelowPreview(panel) {
    var workspace = document.querySelector('.workspace');
    var grid = document.querySelector('.grid');
    var host = workspace || grid;
    var previewPanel = directPreviewPanel(host);

    // The stack replaces the preview panel at the exact same grid position. This means
    // two-column tools keep it in the right column, while each tool's own responsive
    // breakpoint can naturally collapse the same stack to one column without hardcoding widths.
    if (host && previewPanel && previewPanel.parentNode === host) {
      var stack = document.createElement('div');
      stack.className = 'one-ai-json-guide-stack';
      host.insertBefore(stack, previewPanel);
      stack.appendChild(previewPanel);
      stack.appendChild(panel);
      var shell = host.closest ? host.closest('.app-shell') : null;
      if (shell && shell.classList) shell.classList.add('one-ai-json-guide-enabled');
      return;
    }

    var preview = document.querySelector('.preview-panel') || document.querySelector('.preview-wrap') || document.querySelector('.stage') || document.querySelector('.canvas-stage');
    var container = preview && preview.classList && preview.classList.contains('preview-panel') ? preview : (preview && preview.parentNode);
    if (container && container.parentNode) {
      container.parentNode.insertBefore(panel, container.nextSibling);
      return;
    }
    (document.querySelector('.app') || document.body).appendChild(panel);
  }

  function mountGuide(id) {
    if (mounted[id] || !GUIDES[id]) return mounted[id] || null;
    var panel = panelFor(id, GUIDES[id]);
    insertBelowPreview(panel);
    mounted[id] = panel;
    return panel;
  }

  function wrapMounts() {
    if (global.ONEEditBackup && global.ONEEditBackup.mount && !global.ONEEditBackup.__aiJsonGuideWrapped) {
      var originalEditMount = global.ONEEditBackup.mount;
      global.ONEEditBackup.mount = function (config) {
        var api = originalEditMount(config);
        if (config && config.id && GUIDES[config.id]) global.setTimeout(function () { mountGuide(config.id); }, 0);
        return api;
      };
      global.ONEEditBackup.__aiJsonGuideWrapped = true;
    }
    if (global.ONEProjectPackage && global.ONEProjectPackage.mount && !global.ONEProjectPackage.__aiJsonGuideWrapped) {
      var originalProjectMount = global.ONEProjectPackage.mount;
      global.ONEProjectPackage.mount = function (config) {
        var api = originalProjectMount(config);
        if (config && config.id && GUIDES[config.id]) global.setTimeout(function () { mountGuide(config.id); }, 0);
        return api;
      };
      global.ONEProjectPackage.__aiJsonGuideWrapped = true;
    }
  }

  global.ONEAIJsonGuide = {
    version: VERSION,
    guides: GUIDES,
    mount: mountGuide,
    prompt: function (id) { return GUIDES[id] ? aiPrompt(GUIDES[id]) : ''; },
    example: function (id) { return GUIDES[id] ? JSON.parse(JSON.stringify(GUIDES[id].example)) : null; },
    wrapProjectPackage: wrapMounts
  };

  wrapMounts();
})(window);
