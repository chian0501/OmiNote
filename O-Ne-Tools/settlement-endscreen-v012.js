/* O-Ne 片尾結算卡：結束畫面模式（草案 D 後段）。
 * 只加不改：不動 settlement-card 核心；切到「結束畫面」時左側換成本模式設定，
 * 預覽仍在右側，輸出沿用底部「下載 PNG／下載設定 JSON」。
 * 名單只放佔位，不放真實帳號（公開 repo）。 */
(function () {
  'use strict';

  var VERSION = '0.1.0-endscreen-mode';
  var A = './assets/';
  var SRC = {
    bg: A + 'settlement-background-v011.jpg?v=012',
    avatar: A + 'endscreen-avatar-v001.png',
    badge: A + 'endscreen-badge-n-v001.png',
    nomi: A + 'endscreen-cat-nomi-v001.png',
    kuma: A + 'endscreen-cat-kuma-v001.png',
    sanmei: A + 'endscreen-cat-sanmei-v001.png'
  };
  var imgs = {};
  var ready = false;
  var active = false;
  var esCanvas = null;
  var esCtx = null;
  var panelObserver = null;
  var statusObserver = null;
  var myStatus = { text: '', error: false };
  var settingStatus = false;
  var DEFAULTS = { esNames: '工會成員 01\n工會成員 02', esFs: '28', esTag: '歐涅任務工會', esTitle: '感謝加入的工會成員',
    esPrice: 'NT$25／月（勿用蘋果裝置加入）', esP1: 'Instagram', esP2: 'Threads', esP3: 'Facebook' };

  function $(id) { return document.getElementById(id); }
  function font(size, weight) {
    return weight + ' ' + size + 'px "O-Ne Noto Sans TC","Noto Sans TC","Microsoft JhengHei",sans-serif';
  }

  var CHECKS = [
    ['esVid1', '影片框 1', '上：系列下一支／最新片', true],
    ['esVid2', '影片框 2', '下：播放清單／熱門片', true],
    ['esMem', '工會成員名單', '中間欄', true],
    ['esWait', '「招募中」補格', '名單只有幾位時補空位', true],
    ['esSub', '訂閱頭像圈', '右上，對 YouTube 訂閱元素', true],
    ['esPlat', 'IG／Threads／FB 平台牌', '有經營再開；開啟時罐罐贊助列自動收起', false],
    ['esJoin', '加入工會', '加入說明牌', true],
    ['esCan', '罐罐贊助', '加入牌內的價格列', true],
    ['esNomi', 'Nomi', '貓', true],
    ['esKuma', 'Kuma', '貓', true],
    ['esSanmei', '三妹', '三妹影片上架後再開', false],
    ['esGuide', '標示框（對位用）', '輸出標示版給剪輯對位；上片請關掉', false]
  ];

  function buildUI() {
    var panel = document.querySelector('.workspace > .panel');
    if (!panel || $('esModeSection')) return false;

    var mode = document.createElement('div');
    mode.className = 'section';
    mode.id = 'esModeSection';
    mode.innerHTML =
      '<div class="section-title"><span>00｜輸出模式</span><small>結算卡＝前段；結束畫面＝最後 15～20 秒</small></div>' +
      '<select id="esMode"><option value="card">片尾結算卡（前段）</option><option value="end">結束畫面（最後 15～20 秒）</option></select>';
    panel.insertBefore(mode, panel.firstChild);

    var sec = document.createElement('div');
    sec.className = 'section';
    sec.id = 'esSection';
    sec.style.display = 'none';
    var h = '<div class="section-title"><span>結束畫面設定</span><small>左兩格影片、中間名單、右上訂閱</small></div>';
    h += '<div class="note">YouTube 的影片、訂閱元素在 Studio 疊上去；這張只留位置。框比元素大一點，正式前請在 Studio 對位一次。</div>';
    CHECKS.forEach(function (c) {
      h += '<div class="switch-row"><div class="switch-copy"><strong>' + c[1] + '</strong><small>' + c[2] +
        '</small></div><input id="' + c[0] + '" type="checkbox"' + (c[3] ? ' checked' : '') + '></div>';
    });
    h += '<label for="esNames">工會成員（一行一位，最多 20 位）</label>' +
      '<textarea id="esNames" maxlength="800">工會成員 01\n工會成員 02</textarea>' +
      '<label for="esFs">名單字級 <output id="esFsOut">28</output> px（放不下會自動縮）</label>' +
      '<input id="esFs" type="range" min="16" max="36" step="1" value="28" style="width:100%;accent-color:var(--teal)">' +
      '<div class="two"><div><label for="esTag">名單標籤</label><input id="esTag" type="text" maxlength="12" value="歐涅任務工會"></div>' +
      '<div><label for="esTitle">名單標題</label><input id="esTitle" type="text" maxlength="16" value="感謝加入的工會成員"></div></div>' +
      '<label for="esPrice">罐罐價格文字</label><input id="esPrice" type="text" maxlength="30" value="NT$25／月（勿用蘋果裝置加入）">' +
      '<div class="two"><div><label for="esP1">平台牌 1</label><input id="esP1" type="text" maxlength="16" value="Instagram"></div>' +
      '<div><label for="esP2">平台牌 2</label><input id="esP2" type="text" maxlength="16" value="Threads"></div></div>' +
      '<label for="esP3">平台牌 3</label><input id="esP3" type="text" maxlength="16" value="Facebook">';
    sec.innerHTML = h;
    mode.parentNode.insertBefore(sec, mode.nextSibling);

    var stage = $('stage');
    esCanvas = document.createElement('canvas');
    esCanvas.id = 'esCanvas';
    esCanvas.width = 1920;
    esCanvas.height = 1080;
    esCanvas.style.display = 'none';
    esCanvas.className = ($('canvas') && $('canvas').className) || '';
    stage.appendChild(esCanvas);
    var core = $('canvas');
    if (core && window.MutationObserver) {
      new MutationObserver(syncSize).observe(core, { attributes: true, attributeFilter: ['style', 'class'] });
    }
    window.addEventListener('resize', function () { setTimeout(syncSize, 60); });
    esCtx = esCanvas.getContext('2d');
    return true;
  }

  function on(id) { return $(id) && $(id).checked; }

  function setStatus(text, error) {
    myStatus = { text: text, error: !!error };
    var st = $('status');
    if (!st) return;
    settingStatus = true;
    st.classList.toggle('error', !!error);
    st.textContent = text;
    settingStatus = false;
  }

  /* 預覽大小跟舊結算卡畫布走（適合畫面／100% 原尺寸由 card-workspace 設在 #canvas 上） */
  function syncSize() {
    var core = $('canvas');
    if (!core || !esCanvas) return;
    if (core.style.width) esCanvas.style.width = core.style.width;
    if (core.style.height) esCanvas.style.height = core.style.height;
  }

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function box(ctx, x, y, w, h, fill, stroke, lw, dash, r) {
    rr(ctx, x, y, w, h, r || 18);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.setLineDash(dash || []); ctx.lineWidth = lw || 4; ctx.strokeStyle = stroke; ctx.stroke(); ctx.setLineDash([]); }
  }

  function cover(ctx, img, x, y, w, h) {
    var s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    var dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }

  function text(ctx, str, x, y, size, weight, color, align, maxW) {
    ctx.font = font(size, weight);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    if (maxW) {
      var s = String(str);
      while (s.length > 1 && ctx.measureText(s).width > maxW) s = s.slice(0, -1);
      if (s !== String(str)) s = s.slice(0, -1) + '…';
      ctx.fillText(s, x, y);
    } else {
      ctx.fillText(str, x, y);
    }
  }

  function names() {
    return $('esNames').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function drawMembers(ctx, issues) {
    var X = 785, Y = 100, W = 520, H = 803;
    box(ctx, X, Y, W, H, '#2a1f17', '#f2b632', 4, null, 18);
    var left = X + 4 + 30, right = X + W - 4 - 30;
    var top = Y + 4 + 24;
    var tag = $('esTag').value || '';
    ctx.font = font(26, 700);
    var tw = ctx.measureText(tag).width + 36;
    box(ctx, left, top, tw, 44, '#f2b632', null, 0, null, 8);
    text(ctx, tag, left + 18, top + 32, 26, 700, '#2a1f17', 'left');
    var titleBase = top + 44 + 12 + 42;
    text(ctx, $('esTitle').value || '', left, titleBase, 42, 700, '#fff6e3', 'left', right - left);
    var listTop = titleBase + 18;
    var listBottom = Y + H - 4 - 20;
    var all = names();
    var list = all.slice(0, 20);
    if (all.length > 20) issues.push('名單 ' + all.length + ' 位，只放前 20 位');
    var cols = list.length > 9 ? 2 : 1;
    var gap = 12;
    var colW = (right - left - gap * (cols - 1)) / cols;
    var waitOn = on('esWait');
    var f = Number($('esFs').value);
    var min = 12;
    var fit = false;
    function layout(size) {
      var rh = Math.round(size * 1.75), rg = Math.round(size * 0.3);
      var n = list.length;
      var rowsUsed = Math.ceil(n / cols);
      var h = rowsUsed * (rh + rg) + (waitOn ? rh + rg : 0);
      var ok = h <= listBottom - listTop + rg;
      ctx.font = font(size, 500);
      for (var i = 0; i < n; i++) {
        if (ctx.measureText(list[i]).width > colW - size * 1.4) ok = false;
      }
      return { rh: rh, rg: rg, ok: ok };
    }
    var L = layout(f);
    while (!L.ok && f > min) { f--; L = layout(f); }
    fit = L.ok;
    if (!fit) issues.push('名單放不下');
    var shown = f;
    for (var i = 0; i < list.length; i++) {
      var c = i % cols, r = Math.floor(i / cols);
      var rx = left + c * (colW + gap), ry = listTop + r * (L.rh + L.rg);
      box(ctx, rx, ry, colW, L.rh, 'rgba(255,255,255,.07)', null, 0, null, 8);
      text(ctx, list[i], rx + shown * 0.7, ry + L.rh * 0.68, shown, 500, '#f0e3c8', 'left', colW - shown * 1.4);
    }
    if (waitOn) {
      var wr = Math.ceil(list.length / cols);
      var wy = listTop + wr * (L.rh + L.rg);
      box(ctx, left, wy, right - left, L.rh, null, '#8a7350', 2, [8, 6], 8);
      text(ctx, list.length ? '下一位工會成員招募中…' : '工會成員招募中', left + shown * 0.7, wy + L.rh * 0.68, shown, 500, '#c9a96a', 'left', right - left - shown * 1.4);
    }
    $('esFsOut').value = String(shown) + (shown < Number($('esFs').value) ? '（自動縮）' : '');
  }

  function drawPlatforms(ctx) {
    var tags = [['IG', $('esP1').value], ['Th', $('esP2').value], ['FB', $('esP3').value]];
    var ys = [440, 520, 600];
    for (var i = 0; i < 3; i++) {
      var x = 1330, y = ys[i];
      box(ctx, x, y, 540, 70, '#2a1f17', '#7a3fb5', 4, null, 18);
      ctx.beginPath();
      ctx.arc(x + 4 + 22 + 28, y + 35, 28, 0, Math.PI * 2);
      ctx.fillStyle = '#7a3fb5';
      ctx.fill();
      text(ctx, tags[i][0], x + 4 + 22 + 28, y + 43, 22, 700, '#ffffff', 'center');
      text(ctx, tags[i][1] || '', x + 4 + 22 + 56 + 16, y + 45, 30, 700, '#fff6e3', 'left', 540 - 120);
    }
  }

  function drawJoin(ctx) {
    var plat = on('esPlat');
    var can = on('esCan') && !plat;
    var x = 1330, y = plat ? 690 : 450, w = 540, h = can ? 262 : 146;
    box(ctx, x, y, w, h, '#2a1f17', '#f2b632', 4, null, 18);
    text(ctx, '加入歐涅任務工會', x + 4 + 26, y + 4 + 20 + 34, 34, 700, '#f2b632', 'left', w - 80);
    text(ctx, '影片下方按「加入」，一起出任務', x + 4 + 26, y + 4 + 20 + 34 + 12 + 26, 26, 500, '#f0e3c8', 'left', w - 80);
    if (can) {
      var ly = y + 4 + 20 + 34 + 12 + 26 + 26;
      ctx.fillStyle = '#5a4630';
      ctx.fillRect(x + 4 + 26, ly, w - 8 - 52, 2);
      ctx.drawImage(imgs.badge, x + 4 + 26, ly + 16, 78, 78);
      text(ctx, '感謝每月罐罐贊助', x + 4 + 26 + 78 + 16, ly + 16 + 36, 28, 700, '#f2b632', 'left', w - 200);
      text(ctx, $('esPrice').value || '', x + 4 + 26 + 78 + 16, ly + 16 + 36 + 30, 22, 500, '#e8d6b0', 'left', w - 200);
    }
  }

  function drawCats(ctx) {
    var plat = on('esPlat');
    var set = [];
    if (on('esNomi')) set.push({ img: imgs.nomi, h: 290, ml: 0, mr: -30 });
    if (on('esKuma')) set.push({ img: imgs.kuma, h: 252, ml: 0, mr: 0 });
    if (on('esSanmei')) set.push({ img: imgs.sanmei, h: 256, ml: -10, mr: 0 });
    if (!set.length) return;
    var n = set.length;
    var s = plat ? (n >= 3 ? 0.5 : 0.62) : (n >= 3 ? 0.78 : 1);
    var total = 0;
    set.forEach(function (c) {
      c.w = c.img.naturalWidth * (c.h / c.img.naturalHeight);
      total += c.ml + c.w + c.mr;
    });
    var RX = 1920 - 110, BY = 1080 - 40;
    var x = RX - total;
    ctx.save();
    ctx.translate(RX, BY);
    ctx.scale(s, s);
    ctx.translate(-RX, -BY);
    set.forEach(function (c) {
      x += c.ml;
      ctx.drawImage(c.img, x, BY - c.h, c.w, c.h);
      x += c.w + c.mr;
    });
    ctx.restore();
  }

  function render() {
    if (!active || !ready || !esCtx) return true;
    var ctx = esCtx;
    var issues = [];
    ctx.clearRect(0, 0, 1920, 1080);
    cover(ctx, imgs.bg, 0, 0, 1920, 1080);
    var guide = on('esGuide');

    [['esVid1', 100, '影片元素 1', '系列下一支／最新片'], ['esVid2', 520, '影片元素 2', '播放清單／熱門片']].forEach(function (v) {
      if (!on(v[0]) || !guide) return;
      box(ctx, 60, v[1], 680, 383, 'rgba(255,255,255,.4)', '#2d6cdf', 4, [14, 10], 18);
      text(ctx, 'YouTube ' + v[2], 400, v[1] + 183, 30, 700, '#1d4aa8', 'center');
      text(ctx, v[3], 400, v[1] + 223, 24, 700, '#1d4aa8', 'center');
    });

    if (on('esMem')) drawMembers(ctx, issues);

    if (on('esSub')) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(1600, 250, 170, 0, Math.PI * 2);
      ctx.clip();
      cover(ctx, imgs.avatar, 1430, 80, 340, 340);
      ctx.restore();
      if (guide) {
        ctx.beginPath();
        ctx.arc(1600, 250, 168, 0, Math.PI * 2);
        ctx.setLineDash([14, 10]);
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#e0453a';
        ctx.stroke();
        ctx.setLineDash([]);
        box(ctx, 1540, 40, 120, 38, '#e0453a', null, 0, null, 6);
        text(ctx, '訂閱元素', 1600, 68, 22, 700, '#ffffff', 'center');
      }
    }

    if (on('esPlat')) drawPlatforms(ctx);
    if (on('esJoin')) drawJoin(ctx);
    drawCats(ctx);

    setStatus(issues.length
      ? '請修正後再輸出：' + issues.join('、')
      : '結束畫面｜1920×1080｜版位檢查通過｜' + (guide ? '標示版（對位用）' : '乾淨版（可上片）'), issues.length > 0);
    return issues.length === 0;
  }

  function applyPanelVisibility() {
    // 舊結算卡載入後會把設定重組成可摺疊區塊（heading／跳轉列／fold），所以直接處理編輯面板的所有子層
    var editor = $('esModeSection') && $('esModeSection').parentElement;
    if (!editor) return;
    Array.prototype.forEach.call(editor.children, function (s) {
      if (s.id === 'esModeSection') return;
      if (s.id === 'esSection') { s.style.display = active ? '' : 'none'; return; }
      var want = active ? 'none' : '';
      if (s.style.display !== want) s.style.display = want;
    });
  }

  function setMode(isEnd) {
    active = isEnd;
    applyPanelVisibility();
    if (!panelObserver && window.MutationObserver) {
      panelObserver = new MutationObserver(applyPanelVisibility);
      panelObserver.observe($('esModeSection').parentElement, { childList: true });
    }
    if (!statusObserver && window.MutationObserver && $('status')) {
      // 核心結算卡的 render 會改狀態列；結束畫面模式下把我們的訊息蓋回去，免得名單溢位警告被蓋掉
      statusObserver = new MutationObserver(function () {
        if (!active || settingStatus || !myStatus.text) return;
        if ($('status').textContent !== myStatus.text) setStatus(myStatus.text, myStatus.error);
      });
      statusObserver.observe($('status'), { childList: true, characterData: true, subtree: true });
    }
    var vt = $('transparentView') && $('transparentView').parentElement;
    var sg = $('showGuides') && $('showGuides').closest('label');
    [vt, sg].forEach(function (el) { if (el) el.style.display = isEnd ? 'none' : ''; });
    $('canvas').style.display = isEnd ? 'none' : '';
    esCanvas.style.display = isEnd ? '' : 'none';
    syncSize();
    setTimeout(syncSize, 80);
    var title = document.querySelector('.preview-toolbar strong');
    if (title) title.textContent = isEnd ? '1920 × 1080 結束畫面預覽（最後 15～20 秒）' : '1920 × 1080 即時預覽';
    if (isEnd) render();
    else { var bgX = $('bgX'); if (bgX) bgX.dispatchEvent(new Event('input', { bubbles: true })); }
  }

  function download(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1200);
  }

  function settings() {
    var o = { schema: 'o-ne.settlement-card.endscreen.v0.1.0', generator_version: VERSION, canvas: { width: 1920, height: 1080 }, fields: {} };
    CHECKS.forEach(function (c) { o.fields[c[0]] = on(c[0]); });
    ['esNames', 'esFs', 'esTag', 'esTitle', 'esPrice', 'esP1', 'esP2', 'esP3'].forEach(function (id) { o.fields[id] = $(id).value; });
    return o;
  }

  function bindExport() {
    document.addEventListener('click', function (e) {
      if (!active) return;
      var blocked = e.target && e.target.closest ? e.target.closest('button,[data-action]') : null;
      if (blocked && !blocked.closest('#esSection') && blocked.id !== 'downloadPng' && blocked.id !== 'downloadJson') {
        var txt = blocked.innerText || '';
        var act = blocked.getAttribute('data-action') || '';
        if (/存專案 ZIP|開專案 ZIP|匯入 JSON/.test(txt) || /^(save|load|export-package|import-package)$/.test(act)) {
          e.stopImmediatePropagation();
          e.preventDefault();
          setStatus('結束畫面模式不支援暫存、專案 ZIP、匯入 JSON（會存成舊結算卡內容）。請用「輸出 PNG」和「匯出 JSON」；要存專案請先切回「片尾結算卡」。', true);
          return;
        }
      }
      var t = e.target && e.target.closest ? e.target.closest('#downloadPng,#downloadJson,#reset') : null;
      if (!t) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      if (t.id === 'downloadPng') {
        if (!render()) return;
        var name = 'O-Ne_片尾結束畫面_' + (on('esGuide') ? '標示版' : '乾淨版') + '_1920x1080.png';
        esCanvas.toBlob(function (b) { if (b) download(b, name); }, 'image/png');
      } else if (t.id === 'downloadJson') {
        download(new Blob([JSON.stringify(settings(), null, 2)], { type: 'application/json' }), 'O-Ne_片尾結束畫面_設定.json');
      } else {
        Object.keys(DEFAULTS).forEach(function (id) { $(id).value = DEFAULTS[id]; });
        CHECKS.forEach(function (c) { $(c[0]).checked = c[3]; });
        render();
      }
    }, true);
  }

  function load(key) {
    return new Promise(function (resolve, reject) {
      var im = new Image();
      im.onload = function () { imgs[key] = im; resolve(); };
      im.onerror = function () { reject(new Error('無法載入 ' + SRC[key])); };
      im.src = SRC[key];
    });
  }

  function init() {
    if (!buildUI()) return;
    $('esMode').addEventListener('change', function () { setMode(this.value === 'end'); });
    $('esSection').addEventListener('input', render);
    $('esSection').addEventListener('change', render);
    bindExport();
    Promise.all(Object.keys(SRC).map(load).concat([
      document.fonts.load('700 36px "O-Ne Noto Sans TC"'),
      document.fonts.load('500 28px "O-Ne Noto Sans TC"')
    ])).then(function () {
      ready = true;
      if (active) render();
      var q = new URLSearchParams(location.search);
      if (q.get('mode') === 'end') { $('esMode').value = 'end'; setMode(true); }
    }).catch(function (err) {
      var st = $('status');
      if (st) { st.classList.add('error'); st.textContent = '結束畫面素材載入失敗：' + err.message; }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
