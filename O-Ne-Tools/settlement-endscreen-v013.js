/* O-Ne 片尾結算卡：結束畫面模式＋動畫（草案 D 後段）。
 * 只加不改：不動 settlement-card 核心；切到「結束畫面」時左側換成本模式設定，
 * 預覽仍在右側。V0.2：加動畫時間軸（預覽播放、每元素可調出現秒數／長度／動法、
 * 風格預設、待機小動作）與輸出 WebM／圖片序列 ZIP。
 * 名單只放佔位，不放真實帳號（公開 repo）。 */
(function () {
  'use strict';

  var VERSION = '0.3.1-endscreen-subframe';
  var A = './assets/';
  var SRC = {
    bg: A + 'settlement-background-v011.jpg?v=012',
    badge: A + 'endscreen-badge-n-v001.png',
    nomi: A + 'endscreen-cat-nomi-v001.png',
    kuma: A + 'endscreen-cat-kuma-v001.png',
    sanmei: A + 'endscreen-cat-sanmei-v001.png',
    nomiBlink: A + 'endscreen-cat-nomi-blink-v001.png',
    kumaBlink: A + 'endscreen-cat-kuma-blink-v001.png',
    sanmeiBlink: A + 'endscreen-cat-sanmei-blink-v001.png',
    nomiBody: A + 'endscreen-cat-nomi-body-v001.png',
    nomiTail: A + 'endscreen-cat-nomi-tail-v001.png'
  };
  // 貓的小動作素材：眨眼＝閉眼補丁疊上去；搖尾＝尾巴獨立圖層繞根部轉（只有 Nomi；Kuma 趴著看不到尾巴、三妹尾巴切不乾淨）
  var CAT_EXTRA = {
    nomi: { blink: 'nomiBlink', body: 'nomiBody', tail: 'nomiTail', pivot: [800, 1190], period: 4.6, phase: 0.4 },
    kuma: { blink: 'kumaBlink', period: 5.3, phase: 2.1 },
    sanmei: { blink: 'sanmeiBlink', period: 4.9, phase: 3.3 }
  };
  var imgs = {};
  var OPTIONAL = { nomiBlink: 1, kumaBlink: 1, sanmeiBlink: 1, nomiBody: 1, nomiTail: 1 };
  var ready = false;
  var active = false;
  var esCanvas = null;
  var esCtx = null;
  var panelObserver = null;
  var statusObserver = null;
  var myStatus = { text: '', error: false };
  var settingStatus = false;
  var busy = false; // 輸出中
  var DEFAULTS = { esNames: '工會成員 01\n工會成員 02', esFs: '28', esTag: '歐涅任務工會', esTitle: '感謝加入的工會成員',
    esPrice: 'NT$25／月（勿用蘋果裝置加入）', esP1: 'Instagram', esP2: 'Threads', esP3: 'Facebook' };

  function $(id) { return document.getElementById(id); }
  function font(size, weight) {
    return weight + ' ' + size + 'px "O-Ne Noto Sans TC","Noto Sans TC","Microsoft JhengHei",sans-serif';
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  var CHECKS = [
    ['esMem', '工會成員名單', '中間欄', true],
    ['esWait', '「招募中」補格', '名單只有幾位時補空位', true],
    ['esSub', '訂閱元素定位框', '右上圓框，只在標示版畫出；頭像由 YouTube 訂閱元素自己帶', true],
    ['esPlat', 'IG／Threads／FB 平台牌', '有經營再開；開啟時罐罐贊助列自動收起', false],
    ['esJoin', '加入工會', '加入說明牌', true],
    ['esCan', '罐罐贊助', '加入牌內的價格列', true],
    ['esNomi', 'Nomi', '貓', true],
    ['esKuma', 'Kuma', '貓', true],
    ['esSanmei', '三妹', '三妹影片上架後再開', false],
    ['esGuide', '標示框（對位用）', '輸出標示版給剪輯對位（會畫出兩個影片框與訂閱框位置）；上片請關掉', false]
  ];

  /* ───────── 動畫設定 ───────── */
  var ELEMENTS = [
    ['mem', '工會成員面板'], ['rows', '名單逐行'], ['join', '加入工會小卡'],
    ['plat', '平台牌（三顆依序）'], ['nomi', 'Nomi'], ['kuma', 'Kuma'], ['sanmei', '三妹']
  ];
  var STYLES = [
    ['none', '不動畫（直接出現）'], ['fade', '淡入'], ['slideL', '從左滑入'], ['slideR', '從右滑入'],
    ['slideU', '從下滑入'], ['pop', '彈跳放大'], ['peek', '探頭彈出（貓用）'], ['type', '逐字打出（名單逐行用）']
  ];
  var PRESETS = {
    pop: { label: '彈跳探頭', rowStep: 0.3, amp: 1,
      cfg: { mem: ['slideL', 0.4, 0.6], rows: ['slideR', 1.1, 0.45], join: ['pop', 1.6, 0.6], plat: ['pop', 2.0, 0.5], nomi: ['peek', 2.2, 0.7], kuma: ['peek', 2.6, 0.7], sanmei: ['peek', 3.0, 0.7] } },
    slide: { label: '滑入', rowStep: 0.25, amp: 1,
      cfg: { mem: ['slideL', 0.3, 0.7], rows: ['slideR', 1.0, 0.5], join: ['slideU', 1.4, 0.6], plat: ['slideR', 1.8, 0.5], nomi: ['slideU', 2.0, 0.6], kuma: ['slideU', 2.3, 0.6], sanmei: ['slideU', 2.6, 0.6] } },
    type: { label: '逐行打字', rowStep: 0.55, amp: 1,
      cfg: { mem: ['fade', 0.3, 0.5], rows: ['type', 1.0, 0.7], join: ['slideU', 2.4, 0.5], plat: ['fade', 2.8, 0.4], nomi: ['peek', 3.2, 0.6], kuma: ['peek', 3.5, 0.6], sanmei: ['peek', 3.8, 0.6] } },
    breathe: { label: '輕微呼吸晃動', rowStep: 0.2, amp: 1,
      cfg: { mem: ['fade', 0.2, 0.7], rows: ['fade', 0.9, 0.5], join: ['slideU', 1.3, 0.8], plat: ['slideU', 1.6, 0.7], nomi: ['slideU', 1.8, 0.9], kuma: ['slideU', 2.1, 0.9], sanmei: ['slideU', 2.4, 0.9] } }
  };
  var anim = { t: null, playing: false, raf: 0, t0: 0, cfg: null, rowStep: 0.3, idleOn: true, amp: 1, total: 15 };

  function readAnimUI() {
    var cfg = {};
    ELEMENTS.forEach(function (e) {
      var k = e[0];
      cfg[k] = {
        style: $('esA_' + k + '_style').value,
        start: Math.max(0, Number($('esA_' + k + '_start').value) || 0),
        dur: Math.max(0.05, Number($('esA_' + k + '_dur').value) || 0.5)
      };
    });
    anim.cfg = cfg;
    anim.rowStep = clamp(Number($('esRowStep').value) || 0.3, 0.05, 2);
    anim.idleOn = on('esIdle');
    anim.amp = Number($('esAmp').value) || 1;
    anim.total = clamp(Number($('esTotal').value) || 15, 3, 30);
  }

  function writeAnimUI(p) {
    ELEMENTS.forEach(function (e) {
      var v = p.cfg[e[0]];
      $('esA_' + e[0] + '_style').value = v[0];
      $('esA_' + e[0] + '_start').value = v[1];
      $('esA_' + e[0] + '_dur').value = v[2];
    });
    $('esRowStep').value = p.rowStep;
    $('esAmp').value = String(p.amp);
  }

  function ease(p) { return 1 - Math.pow(1 - p, 3); }
  function back(p) { var c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); }

  /* t === null＝靜態完成畫面（輸出 PNG 用） */
  function prog(k, t, idx, step) {
    if (t === null) return 1;
    var c = anim.cfg[k];
    var start = c.start + (idx || 0) * (step || 0);
    if (c.style === 'none') return t >= start ? 1 : 0;
    return clamp((t - start) / c.dur, 0, 1);
  }

  function fxOf(style, p, h) {
    var o = { a: 1, dx: 0, dy: 0, sx: 1, sy: 1, rot: 0 };
    if (p <= 0) { o.a = 0; return o; }
    var e = ease(p);
    switch (style) {
      case 'fade': case 'type': o.a = e; break;
      case 'slideL': o.a = e; o.dx = -(1 - e) * 220; break;
      case 'slideR': o.a = e; o.dx = (1 - e) * 220; break;
      case 'slideU': o.a = e; o.dy = (1 - e) * 160; break;
      case 'pop': { var b = Math.max(0.01, back(p)); o.sx = b; o.sy = b; o.a = Math.min(1, p * 4); break; }
      case 'peek': o.dy = (1 - back(p)) * (h || 300); break;
      default: break;
    }
    return o;
  }

  var PHASE = { nomi: 0, kuma: 1.7, sanmei: 3.1, mem: 0, join: 2 };
  function idleOf(k, t) {
    var o = { dx: 0, dy: 0, sx: 1, sy: 1, rot: 0 };
    if (t === null || !anim.idleOn) return o;
    var c = anim.cfg[k];
    var end = c.start + c.dur + (k === 'rows' || k === 'plat' ? 0.6 : 0);
    var ramp = clamp((t - end) / 0.8, 0, 1);
    if (ramp <= 0) return o;
    var s = anim.amp * ramp, ph = PHASE[k] || 0, tau = Math.PI * 2;
    if (k === 'nomi' || k === 'kuma' || k === 'sanmei') {
      var w = Math.sin(tau * t / 2.8 + ph);
      o.sy = 1 + 0.014 * s * w;
      o.sx = 1 - 0.007 * s * w;
      o.rot = 0.022 * s * Math.sin(tau * t / 3.4 + ph);
    } else if (k === 'mem' || k === 'join') {
      o.dy = 3 * s * Math.sin(tau * t / 4 + ph);
    }
    return o;
  }

  function pushFx(ctx, o, ax, ay) {
    ctx.save();
    ctx.globalAlpha *= o.a;
    ctx.translate(ax + o.dx, ay + o.dy);
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale(o.sx, o.sy);
    ctx.translate(-ax, -ay);
  }

  /* 出現動畫＋待機小動作，包住一個元素；回傳 false 代表還沒出現（不用畫） */
  function openEl(ctx, k, t, ax, ay, h, idx, step) {
    var p = prog(k, t, idx, step);
    if (p <= 0) return false;
    var f = fxOf(anim.cfg[k].style, p, h);
    pushFx(ctx, f, ax, ay);
    var id = idleOf(k === 'rows' ? 'mem' : k, t);
    if (id.dx || id.dy || id.rot || id.sx !== 1 || id.sy !== 1) pushFx(ctx, { a: 1, dx: id.dx, dy: id.dy, sx: id.sx, sy: id.sy, rot: id.rot }, ax, ay);
    else ctx.save();
    return true;
  }
  function closeEl(ctx) { ctx.restore(); ctx.restore(); }

  /* ───────── 介面 ───────── */
  function buildUI() {
    var panel = document.querySelector('.workspace > .panel');
    if (!panel || $('esModeSection')) return false;

    var mode = document.createElement('div');
    mode.className = 'section';
    mode.id = 'esModeSection';
    mode.innerHTML =
      '<div class="section-title"><span>00｜輸出模式</span><small>結算卡＝前段；結束畫面＝最後 15～20 秒</small></div>' +
      '<select id="esMode"><option value="card">片尾結算卡（前段）</option><option value="end">結束畫面（最後 15～20 秒）</option></select>';
    mode.style.display = 'none';
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
    h += '<label for="esNames">工會成員（一行一位；人多會自動分欄、縮字，放不下就改成捲動）</label>' +
      '<textarea id="esNames" maxlength="6000">工會成員 01\n工會成員 02</textarea>' +
      '<label for="esFs">名單字級 <output id="esFsOut">28</output> px（放不下會自動縮）</label>' +
      '<input id="esFs" type="range" min="16" max="36" step="1" value="28" style="width:100%;accent-color:var(--teal)">' +
      '<div class="two"><div><label for="esTag">名單標籤</label><input id="esTag" type="text" maxlength="12" value="歐涅任務工會"></div>' +
      '<div><label for="esTitle">名單標題</label><input id="esTitle" type="text" maxlength="16" value="感謝加入的工會成員"></div></div>' +
      '<label for="esPrice">罐罐價格文字</label><input id="esPrice" type="text" maxlength="30" value="NT$25／月（勿用蘋果裝置加入）">' +
      '<div class="two"><div><label for="esP1">平台牌 1</label><input id="esP1" type="text" maxlength="16" value="Instagram"></div>' +
      '<div><label for="esP2">平台牌 2</label><input id="esP2" type="text" maxlength="16" value="Threads"></div></div>' +
      '<label for="esP3">平台牌 3</label><input id="esP3" type="text" maxlength="16" value="Facebook">';

    // 動畫
    h += '<div class="section-title" style="margin-top:18px"><span>動畫</span><small>預覽鈕在預覽區下方</small></div>';
    h += '<div class="note">每個元素可調「動法／幾秒出現／動畫長多久」。「輸出 PNG」永遠是最後的靜態完成畫面；動畫用預覽區下方的 WebM 或圖片序列 ZIP 輸出。</div>';
    h += '<label for="esPreset">動畫風格預設</label><select id="esPreset"><option value="">（選一個套用，之後可微調）</option>';
    Object.keys(PRESETS).forEach(function (k) { h += '<option value="' + k + '">' + PRESETS[k].label + '</option>'; });
    h += '</select>';
    h += '<div class="two"><div><label for="esTotal">全片長度（秒）</label><input id="esTotal" type="number" min="3" max="30" step="0.5" value="15"></div>' +
      '<div><label for="esRowStep">名單逐行間隔（秒）</label><input id="esRowStep" type="number" min="0.05" max="2" step="0.05" value="0.3"></div></div>';
    h += '<div class="switch-row"><div class="switch-copy"><strong>待機小動作</strong><small>出現後貓輕輕呼吸晃動並定時眨眼、Nomi 會搖尾巴、背景緩慢漂移，不會 3 秒後就停住（Kuma 趴著看不到尾巴、三妹只有眨眼）</small></div><input id="esIdle" type="checkbox" checked></div>';
    h += '<label for="esAmp">待機幅度</label><select id="esAmp"><option value="0.6">輕</option><option value="1" selected>中</option><option value="1.8">強</option></select>';
    h += '<div style="margin-top:12px;display:grid;grid-template-columns:1fr 1.25fr .6fr .6fr;gap:6px;align-items:center;font-size:11px;color:#9ea7b3"><b>元素</b><b>動法</b><b>幾秒出現</b><b>長度(秒)</b></div>';
    ELEMENTS.forEach(function (e) {
      h += '<div style="margin-top:6px;display:grid;grid-template-columns:1fr 1.25fr .6fr .6fr;gap:6px;align-items:center">' +
        '<span style="font-size:12px">' + e[1] + '</span>' +
        '<select id="esA_' + e[0] + '_style" style="min-height:34px;font-size:11px">' +
        STYLES.map(function (s) { return '<option value="' + s[0] + '">' + s[1] + '</option>'; }).join('') + '</select>' +
        '<input id="esA_' + e[0] + '_start" type="number" min="0" max="30" step="0.1" style="min-height:34px;padding:0 6px;font-size:11px">' +
        '<input id="esA_' + e[0] + '_dur" type="number" min="0.05" max="10" step="0.05" style="min-height:34px;padding:0 6px;font-size:11px"></div>';
    });
    sec.innerHTML = h;
    mode.parentNode.insertBefore(sec, mode.nextSibling);

    // 預覽區下方：播放列
    var st = $('status');
    var bar = document.createElement('div');
    bar.id = 'esBar';
    bar.style.cssText = 'display:none;margin:0 0 10px;padding:10px;border:1px solid #2a3240;border-radius:10px;background:#101620';
    bar.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
      '<button id="esPlay" class="action" type="button" style="min-height:40px;padding:0 16px">▶ 播放預覽</button>' +
      '<button id="esStopBtn" class="action ghost" type="button" style="min-height:40px;padding:0 14px">■ 停止（回完成畫面）</button>' +
      '<input id="esSeek" type="range" min="0" max="1500" value="1500" style="flex:1;min-width:140px;accent-color:#53ced0">' +
      '<output id="esTime" style="min-width:110px;font-size:12px;color:#8fd4c8">完成畫面</output>' +
      '<label style="display:flex;align-items:center;gap:5px;margin:0;font-size:11px"><input id="esLoop" type="checkbox"> 循環</label></div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">' +
      '<button id="esWebm" class="action secondary" type="button" style="min-height:40px;padding:0 16px">輸出動畫 MP4</button>' +
      '<button id="esZip" class="action secondary" type="button" style="min-height:40px;padding:0 16px">輸出圖片序列 ZIP</button>' +
      '<select id="esFps" style="min-height:40px;max-width:130px"><option value="10">10 fps</option><option value="15" selected>15 fps</option><option value="24">24 fps</option><option value="30">30 fps</option></select>' +
      '<div style="flex-basis:100%;font-size:11px;line-height:1.6;color:#76818f">動畫是直接錄畫布（不是錄螢幕），固定 1920×1080；Chrome 會存成 MP4，不支援才存 WebM。錄製是即時的，請保持此分頁在前景、電腦別同時跑重的東西；要一格不漏、可後製，改用圖片序列 ZIP。動畫最後一格會帶待機小動作，跟靜態「輸出 PNG」略有不同。<br><span id="esZipHint"></span></div></div>';
    if (st && st.parentElement) st.parentElement.insertBefore(bar, st);

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

    writeAnimUI(PRESETS.pop);
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

  /* ───────── 繪圖 ───────── */
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

  function drawMembers(ctx, issues, t, notes) {
    var X = 785, Y = 100, W = 520, H = 803;
    var left = X + 4 + 30, right = X + W - 4 - 30;
    var top = Y + 4 + 24;
    var titleBase = top + 44 + 12 + 42;
    var listTop = titleBase + 18;
    var listBottom = Y + H - 4 - 20;
    var visH = listBottom - listTop;
    var all = names();
    var items = all.slice(0, 200);
    if (all.length > 200) issues.push('名單 ' + all.length + ' 位，最多放 200 位');
    var gap = 12;
    var waitOn = on('esWait');
    var f0 = Number($('esFs').value);
    var waitLabel = items.length ? '下一位工會成員招募中…' : '工會成員招募中';

    function wideOk(cols, size) {
      var colW = (right - left - gap * (cols - 1)) / cols;
      ctx.font = font(size, 500);
      for (var i = 0; i < items.length; i++) if (ctx.measureText(items[i]).width > colW - size * 1.4) return false;
      return true;
    }
    function lay(cols, size) {
      var colW = (right - left - gap * (cols - 1)) / cols;
      var rh = Math.round(size * 1.75), rg = Math.round(size * 0.3);
      var rowsUsed = Math.ceil(items.length / cols);
      var hh = rowsUsed * (rh + rg) + (waitOn ? rh + rg : 0);
      return { cols: cols, size: size, colW: colW, rh: rh, rg: rg, hh: hh, ok: wideOk(cols, size) && hh <= visH + rg };
    }
    // 先試 1 欄、2 欄、3 欄（字級往下縮到各欄下限）；都放不下就改成捲動名單
    var MINS = { 1: 22, 2: 18, 3: 16 };
    var L = null, c, sz, cols;
    for (cols = 1; cols <= 3 && !L; cols++) {
      for (sz = f0; sz >= MINS[cols]; sz--) {
        c = lay(cols, sz);
        if (c.ok) { L = c; break; }
      }
    }
    var scroll = false;
    if (!L) {
      scroll = true;
      var sc = 2;
      sz = Math.min(f0, 24);
      while (sz > 14 && !wideOk(sc, sz)) sz--;
      L = lay(sc, sz);
      notes.push('名單 ' + items.length + ' 位放不下，改成捲動名單（只在動畫輸出會捲，靜態 PNG 只看得到前面）');
    }
    var shown = L.size;
    $('esFsOut').value = String(shown) + (shown < f0 ? '（自動縮）' : '') + (L.cols > 1 ? '・' + L.cols + ' 欄' : '') + (scroll ? '・捲動' : '');

    if (!openEl(ctx, 'mem', t, X + W / 2, Y + H / 2, 0)) return;
    box(ctx, X, Y, W, H, '#2a1f17', '#f2b632', 4, null, 18);
    var tag = $('esTag').value || '';
    ctx.font = font(26, 700);
    var tw = ctx.measureText(tag).width + 36;
    box(ctx, left, top, tw, 44, '#f2b632', null, 0, null, 8);
    text(ctx, tag, left + 18, top + 32, 26, 700, '#2a1f17', 'left');
    text(ctx, $('esTitle').value || '', left, titleBase, 42, 700, '#fff6e3', 'left', right - left);

    var rowStyle = anim.cfg.rows.style;
    function plainRow(label, rx, ry, rw, isWait) {
      if (isWait) {
        box(ctx, rx, ry, rw, L.rh, null, '#8a7350', 2, [8, 6], 8);
        text(ctx, label, rx + shown * 0.7, ry + L.rh * 0.68, shown, 500, '#c9a96a', 'left', rw - shown * 1.4);
      } else {
        box(ctx, rx, ry, rw, L.rh, 'rgba(255,255,255,.07)', null, 0, null, 8);
        text(ctx, label, rx + shown * 0.7, ry + L.rh * 0.68, shown, 500, '#f0e3c8', 'left', rw - shown * 1.4);
      }
    }
    function drawRow(idx, label, rx, ry, rw, isWait) {
      var p = prog('rows', t, idx, anim.rowStep);
      if (p <= 0) return;
      var cx = rx + rw / 2, cy = ry + L.rh / 2;
      var chars = null, f2;
      if (rowStyle === 'type') {
        f2 = { a: ease(Math.min(1, p * 4)), dx: 0, dy: 0, sx: 1, sy: 1, rot: 0 };
        chars = Math.ceil(label.length * clamp((p - 0.15) / 0.85, 0, 1));
      } else {
        f2 = fxOf(rowStyle, p, 0);
      }
      pushFx(ctx, f2, cx, cy);
      plainRow(chars === null ? label : label.slice(0, chars), rx, ry, rw, isWait);
      ctx.restore();
    }

    if (!scroll) {
      for (var i = 0; i < items.length; i++) {
        var cc = i % L.cols, rr0 = Math.floor(i / L.cols);
        drawRow(i, items[i], left + cc * (L.colW + gap), listTop + rr0 * (L.rh + L.rg), L.colW, false);
      }
      if (waitOn) {
        var wr = Math.ceil(items.length / L.cols);
        drawRow(items.length, waitLabel, left, listTop + wr * (L.rh + L.rg), right - left, true);
      }
    } else {
      // 捲動名單：整份名單當一組出現，之後像片尾字幕一樣往上捲、循環
      var p0 = prog('rows', t, 0, 0);
      if (p0 > 0) {
        pushFx(ctx, fxOf(rowStyle === 'type' ? 'fade' : rowStyle, p0, 0), left + (right - left) / 2, listTop + visH / 2);
        ctx.beginPath();
        ctx.rect(left - 6, listTop - 4, right - left + 12, visH + 8);
        ctx.clip();
        var period = L.hh + 40;
        var off = (t === null) ? 0 : (Math.max(0, t - anim.cfg.rows.start - 1.2) * 46) % period;
        var copies = (t === null || off === 0) ? [0] : [0, period];
        copies.forEach(function (add) {
          var base = listTop - off + add;
          for (var j = 0; j < items.length; j++) {
            var c3 = j % L.cols, r3 = Math.floor(j / L.cols);
            plainRow(items[j], left + c3 * (L.colW + gap), base + r3 * (L.rh + L.rg), L.colW, false);
          }
          if (waitOn) plainRow(waitLabel, left, base + Math.ceil(items.length / L.cols) * (L.rh + L.rg), right - left, true);
        });
        ctx.restore();
      }
    }
    closeEl(ctx);
  }

  function drawPlatforms(ctx, t) {
    var tags = [['IG', $('esP1').value], ['Th', $('esP2').value], ['FB', $('esP3').value]];
    var ys = [440, 520, 600];
    for (var i = 0; i < 3; i++) {
      var x = 1330, y = ys[i];
      if (!openEl(ctx, 'plat', t, x + 270, y + 35, 0, i, 0.2)) continue;
      box(ctx, x, y, 540, 70, '#2a1f17', '#7a3fb5', 4, null, 18);
      ctx.beginPath();
      ctx.arc(x + 4 + 22 + 28, y + 35, 28, 0, Math.PI * 2);
      ctx.fillStyle = '#7a3fb5';
      ctx.fill();
      text(ctx, tags[i][0], x + 4 + 22 + 28, y + 43, 22, 700, '#ffffff', 'center');
      text(ctx, tags[i][1] || '', x + 4 + 22 + 56 + 16, y + 45, 30, 700, '#fff6e3', 'left', 540 - 120);
      closeEl(ctx);
    }
  }

  function drawJoin(ctx, t) {
    var plat = on('esPlat');
    var can = on('esCan') && !plat;
    var x = 1330, y = plat ? 690 : 450, w = 540, h = can ? 262 : 146;
    if (!openEl(ctx, 'join', t, x + w / 2, y + h / 2, 0)) return;
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
    closeEl(ctx);
  }

  /* 訂閱元素：只留定位框（和影片框一樣只在標示版畫），頭像交給 YouTube 訂閱元素本身 */
  function drawSub(ctx, guide) {
    if (!guide) return;
    ctx.beginPath();
    ctx.arc(1600, 250, 168, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    ctx.fill();
    ctx.setLineDash([14, 10]);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#e0453a';
    ctx.stroke();
    ctx.setLineDash([]);
    box(ctx, 1540, 40, 120, 38, '#e0453a', null, 0, null, 6);
    text(ctx, '訂閱元素', 1600, 68, 22, 700, '#ffffff', 'center');
    text(ctx, 'YouTube 訂閱元素', 1600, 260, 28, 700, '#b8322a', 'center');
  }

  function drawCat(ctx, c, X, Y, t) {
    var ex = CAT_EXTRA[c.k] || {};
    var live = t !== null && anim.idleOn;
    var ramp = 0;
    if (live) { var cf = anim.cfg[c.k]; ramp = clamp((t - (cf.start + cf.dur)) / 0.8, 0, 1); }
    if (ramp > 0 && ex.tail && imgs[ex.tail] && imgs[ex.body]) {
      var sc = c.h / c.img.naturalHeight, px = X + ex.pivot[0] * sc, py = Y + ex.pivot[1] * sc;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(0.06 * anim.amp * ramp * Math.sin(Math.PI * 2 * (t / 1.15 + ex.phase)));
      ctx.translate(-px, -py);
      ctx.drawImage(imgs[ex.tail], X, Y, c.w, c.h);
      ctx.restore();
      ctx.drawImage(imgs[ex.body], X, Y, c.w, c.h);
    } else {
      ctx.drawImage(c.img, X, Y, c.w, c.h);
    }
    if (ramp > 0 && ex.blink && imgs[ex.blink]) {
      var ph = (t + ex.phase) % ex.period, d = 0.2;
      if (ph < d) {
        ctx.save();
        ctx.globalAlpha *= Math.sin(Math.PI * ph / d);
        ctx.drawImage(imgs[ex.blink], X, Y, c.w, c.h);
        ctx.restore();
      }
    }
  }

  function drawCats(ctx, t) {
    var plat = on('esPlat');
    var set = [];
    if (on('esNomi')) set.push({ k: 'nomi', img: imgs.nomi, h: 290, ml: 0, mr: 6 });
    if (on('esKuma')) set.push({ k: 'kuma', img: imgs.kuma, h: 252, ml: 0, mr: 0 });
    if (on('esSanmei')) set.push({ k: 'sanmei', img: imgs.sanmei, h: 256, ml: -10, mr: 0 });
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
      if (openEl(ctx, c.k, t, x + c.w / 2, BY, c.h)) {
        drawCat(ctx, c, x, BY - c.h, t);
        closeEl(ctx);
      }
      x += c.w + c.mr;
    });
    ctx.restore();
  }

  /* tOverride：undefined＝用目前預覽時間；null＝靜態完成畫面；數字＝該秒 */
  function render(tOverride) {
    if (!active || !ready || !esCtx) return true;
    readAnimUI();
    var t = (tOverride === undefined) ? anim.t : tOverride;
    var ctx = esCtx;
    var issues = [], notes = [];
    ctx.clearRect(0, 0, 1920, 1080);
    if (t !== null && anim.idleOn) {
      var tau = Math.PI * 2;
      ctx.save();
      ctx.translate(960, 540);
      ctx.scale(1.05, 1.05);
      ctx.translate(-960 + 24 * anim.amp * Math.sin(tau * t / 14), -540 + 8 * anim.amp * Math.sin(tau * t / 11));
      cover(ctx, imgs.bg, 0, 0, 1920, 1080);
      ctx.restore();
    } else {
      cover(ctx, imgs.bg, 0, 0, 1920, 1080);
    }
    var guide = on('esGuide');

    [['esVid1', 100, '影片元素 1', '系列下一支／最新片'], ['esVid2', 520, '影片元素 2', '播放清單／熱門片']].forEach(function (v) {
      if (!guide) return;
      box(ctx, 60, v[1], 680, 383, 'rgba(255,255,255,.4)', '#2d6cdf', 4, [14, 10], 18);
      text(ctx, 'YouTube ' + v[2], 400, v[1] + 183, 30, 700, '#1d4aa8', 'center');
      text(ctx, v[3], 400, v[1] + 223, 24, 700, '#1d4aa8', 'center');
    });

    if (on('esMem')) drawMembers(ctx, issues, t, notes);
    if (on('esSub')) drawSub(ctx, guide);
    if (on('esPlat')) drawPlatforms(ctx, t);
    if (on('esJoin')) drawJoin(ctx, t);
    drawCats(ctx, t);

    if (!busy) {
      setStatus(issues.length
        ? '請修正後再輸出：' + issues.join('、')
        : '結束畫面｜1920×1080｜版位檢查通過｜' + (guide ? '標示版（對位用）' : '乾淨版（可上片）') + (t === null ? '' : '｜動畫 ' + t.toFixed(1) + ' 秒') + (notes.length ? '｜' + notes.join('；') : ''), issues.length > 0);
    }
    return issues.length === 0;
  }

  /* ───────── 播放 ───────── */
  function updateBar() {
    var seek = $('esSeek'), tm = $('esTime');
    if (!seek) return;
    var max = Math.round(anim.total * 100);
    seek.max = String(max);
    if (anim.t === null) { seek.value = String(max); tm.textContent = '完成畫面（靜態）'; }
    else { seek.value = String(Math.round(anim.t * 100)); tm.textContent = anim.t.toFixed(1) + ' / ' + anim.total.toFixed(1) + ' 秒'; }
  }

  function pause() {
    anim.playing = false;
    cancelAnimationFrame(anim.raf);
    var b = $('esPlay');
    if (b) b.textContent = '▶ 播放預覽';
  }

  function play() {
    if (busy) return;
    readAnimUI();
    if (anim.playing) { pause(); return; }
    anim.playing = true;
    var base = (anim.t === null || anim.t >= anim.total) ? 0 : anim.t;
    anim.t0 = performance.now() - base * 1000;
    $('esPlay').textContent = '❚❚ 暫停';
    (function loop() {
      if (!anim.playing) return;
      var t = (performance.now() - anim.t0) / 1000;
      if (t >= anim.total) {
        if (on('esLoop')) { anim.t0 = performance.now(); t = 0; }
        else { anim.t = anim.total; pause(); render(); updateBar(); return; }
      }
      anim.t = t;
      render();
      updateBar();
      anim.raf = requestAnimationFrame(loop);
    })();
  }

  function stopAnim() {
    pause();
    anim.t = null;
    render();
    updateBar();
  }

  /* ───────── 輸出 ───────── */
  function download(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1200);
  }

  var CRC_TABLE = null;
  function crc32(buf) {
    if (!CRC_TABLE) {
      CRC_TABLE = new Uint32Array(256);
      for (var n = 0; n < 256; n++) {
        var c = n;
        for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        CRC_TABLE[n] = c >>> 0;
      }
    }
    var crc = 0xFFFFFFFF;
    for (var i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 255] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  /* 只存不壓縮的 ZIP（PNG 本身已壓縮），檔名皆 ASCII */
  function buildZip(files) {
    var parts = [], central = [], offset = 0;
    files.forEach(function (f) {
      var name = new TextEncoder().encode(f.name);
      var crc = crc32(f.data);
      var lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, f.data.length, true); lh.setUint32(22, f.data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(lh.buffer, name, f.data);
      var ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
      ch.setUint16(10, 0, true); ch.setUint16(12, 0, true); ch.setUint16(14, 0x21, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, f.data.length, true); ch.setUint32(24, f.data.length, true); ch.setUint16(28, name.length, true);
      ch.setUint32(42, offset, true);
      central.push(ch.buffer, name);
      offset += 30 + name.length + f.data.length;
    });
    var csize = 0;
    central.forEach(function (c) { csize += c.byteLength !== undefined ? c.byteLength : c.length; });
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, csize, true); end.setUint32(16, offset, true);
    return new Blob(parts.concat(central, [end.buffer]), { type: 'application/zip' });
  }

  function zipEstimate() {
    readAnimUI();
    var fps = Number($('esFps').value) || 15;
    var n = Math.round(anim.total * fps) + 1;
    return { fps: fps, n: n, mb: Math.round(n * 0.5) };
  }
  function updateZipHint() {
    var h = $('esZipHint');
    if (!h) return;
    var e = zipEstimate();
    h.textContent = '圖片序列約 ' + e.n + ' 張、預估 ' + e.mb + ' MB（全部先存在記憶體，過大會讓分頁當掉；建議 15 fps）。';
    h.style.color = e.n > 600 ? '#ffb86b' : '#76818f';
  }

  function guard() {
    if (busy) return false;
    if (!render(null)) { setStatus('請先修正版面問題再輸出動畫。', true); return false; }
    return true;
  }

  async function exportVideo() {
    if (!guard()) return;
    if (!window.MediaRecorder || !esCanvas.captureStream) { setStatus('這個瀏覽器不支援影片錄製，請改用圖片序列 ZIP。', true); return; }
    pause();
    readAnimUI();
    var types = ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    var mt = types.filter(function (m) { return MediaRecorder.isTypeSupported(m); })[0];
    if (!mt) { setStatus('這個瀏覽器不支援影片錄製，請改用圖片序列 ZIP。', true); return; }
    var isMp4 = mt.indexOf('mp4') >= 0;
    busy = true;
    try {
      var chunks = [];
      var rec = new MediaRecorder(esCanvas.captureStream(30), { mimeType: mt, videoBitsPerSecond: 16000000 });
      var failed = null;
      rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onerror = function (e) { failed = (e && e.error && e.error.message) || '錄影器回報錯誤'; };
      var stopped = new Promise(function (res) { rec.onstop = res; });
      rec.start();
      var t0 = performance.now(), T = anim.total;
      await new Promise(function (res) {
        (function step() {
          if (failed || (performance.now() - t0) / 1000 > T + 20) { res(); return; } // 逾時或錄影器出錯就收工
          var t = Math.min((performance.now() - t0) / 1000, T);
          render(t);
          setStatus('錄製動畫中 ' + t.toFixed(1) + ' / ' + T.toFixed(1) + ' 秒（請保持此分頁在前景）', false);
          if (t < T) requestAnimationFrame(step); else res();
        })();
      });
      await new Promise(function (r) { setTimeout(r, 250); });
      if (failed) { try { rec.stop(); } catch (e0) { /* 已停止 */ } throw new Error(failed); }
      if (rec.state !== 'inactive') rec.stop();
      await Promise.race([stopped, new Promise(function (r) { setTimeout(r, 5000); })]);
      if (!chunks.length) throw new Error('沒有錄到畫面（分頁在背景時瀏覽器會暫停畫面）');
      download(new Blob(chunks, { type: isMp4 ? 'video/mp4' : 'video/webm' }), 'O-Ne_片尾結束畫面_動畫_1920x1080.' + (isMp4 ? 'mp4' : 'webm'));
      busy = false;
      anim.t = null;
      render();
      updateBar();
      setStatus('已輸出動畫 ' + (isMp4 ? 'MP4' : 'WebM') + '（' + T.toFixed(1) + ' 秒，1920×1080）。進 ChatCut／剪映前請先播放確認。', false);
    } catch (err) {
      busy = false;
      anim.t = null;
      render();
      setStatus('輸出動畫失敗：' + err.message, true);
    }
  }

  async function exportZip() {
    if (!guard()) return;
    pause();
    readAnimUI();
    var fps = Number($('esFps').value) || 15;
    var T = anim.total;
    var N = Math.round(T * fps) + 1;
    if (N > 600 && !window.confirm('這會輸出約 ' + N + ' 張 1920×1080 圖片（預估 ' + Math.round(N * 0.5) + ' MB），可能讓分頁記憶體不足。要繼續嗎？建議改 15 fps 或縮短秒數。')) return;
    busy = true;
    try {
      var files = [];
      for (var i = 0; i < N; i++) {
        render(Math.min(i / fps, T));
        var blob = await new Promise(function (r) { esCanvas.toBlob(r, 'image/png'); });
        var buf = new Uint8Array(await blob.arrayBuffer());
        files.push({ name: 'O-Ne_endscreen_frames/frame_' + String(i + 1).padStart(4, '0') + '.png', data: buf });
        if (i % 3 === 0) {
          setStatus('輸出圖片序列中 ' + (i + 1) + ' / ' + N + ' 張（' + fps + ' fps）', false);
          await new Promise(function (r) { setTimeout(r, 0); });
        }
      }
      setStatus('打包 ZIP 中…', false);
      await new Promise(function (r) { setTimeout(r, 0); });
      var zip = buildZip(files);
      download(zip, 'O-Ne_片尾結束畫面_圖片序列_' + fps + 'fps.zip');
      busy = false;
      anim.t = null;
      render();
      updateBar();
      setStatus('已輸出圖片序列 ZIP：' + N + ' 張，' + fps + ' fps，約 ' + (zip.size / 1048576).toFixed(0) + ' MB。', false);
    } catch (err) {
      busy = false;
      anim.t = null;
      render();
      setStatus('輸出圖片序列失敗：' + err.message, true);
    }
  }

  function settings() {
    readAnimUI();
    var o = { schema: 'o-ne.settlement-card.endscreen.v0.2.0', generator_version: VERSION, canvas: { width: 1920, height: 1080 }, fields: {} };
    CHECKS.forEach(function (c) { o.fields[c[0]] = on(c[0]); });
    ['esNames', 'esFs', 'esTag', 'esTitle', 'esPrice', 'esP1', 'esP2', 'esP3'].forEach(function (id) { o.fields[id] = $(id).value; });
    o.animation = { cfg: anim.cfg, row_step: anim.rowStep, idle: anim.idleOn, idle_amp: anim.amp, total_seconds: anim.total };
    return o;
  }

  function bindExport() {
    document.addEventListener('click', function (e) {
      if (!active) return;
      var blocked = e.target && e.target.closest ? e.target.closest('button,[data-action]') : null;
      if (blocked && !blocked.closest('#esSection') && !blocked.closest('#esBar') && blocked.id !== 'downloadPng' && blocked.id !== 'downloadJson') {
        var txt = blocked.innerText || '';
        var act = blocked.getAttribute('data-action') || '';
        if (/存專案 ZIP|開專案 ZIP|匯入 JSON/.test(txt) || /^(save|load|export-package|import-package)$/.test(act)) {
          e.stopImmediatePropagation();
          e.preventDefault();
          setStatus('結束畫面模式不支援暫存、專案 ZIP、匯入 JSON（會存成舊結算卡內容）。請用「輸出 PNG」、「匯出 JSON」和預覽區下方的動畫輸出；要存專案請先切回「片尾結算卡」。', true);
          return;
        }
      }
      var t = e.target && e.target.closest ? e.target.closest('#downloadPng,#downloadJson,#reset') : null;
      if (!t) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      if (busy) return;
      if (t.id === 'downloadPng') {
        if (busy || !render(null)) return;
        var name = 'O-Ne_片尾結束畫面_' + (on('esGuide') ? '標示版' : '乾淨版') + '_1920x1080.png';
        esCanvas.toBlob(function (b) { if (b) download(b, name); render(); }, 'image/png');
      } else if (t.id === 'downloadJson') {
        download(new Blob([JSON.stringify(settings(), null, 2)], { type: 'application/json' }), 'O-Ne_片尾結束畫面_設定.json');
      } else {
        Object.keys(DEFAULTS).forEach(function (id) { $(id).value = DEFAULTS[id]; });
        CHECKS.forEach(function (c) { $(c[0]).checked = c[3]; });
        $('esPreset').value = '';
        $('esTotal').value = '15';
        $('esIdle').checked = true;
        writeAnimUI(PRESETS.pop);
        stopAnim();
      }
    }, true);
  }

  /* ───────── 面板、模式 ───────── */
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
    if (!isEnd) { pause(); anim.t = null; }
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
    $('esBar').style.display = isEnd ? '' : 'none';
    $('canvas').style.display = isEnd ? 'none' : '';
    esCanvas.style.display = isEnd ? '' : 'none';
    syncSize();
    setTimeout(syncSize, 80);
    var title = document.querySelector('.preview-toolbar strong');
    if (title) title.textContent = isEnd ? '1920 × 1080 結束畫面預覽（最後 15～20 秒）' : '1920 × 1080 即時預覽';
    if (isEnd) { render(); updateBar(); }
    else { var bgX = $('bgX'); if (bgX) bgX.dispatchEvent(new Event('input', { bubbles: true })); }
  }

  function load(key) {
    return new Promise(function (resolve, reject) {
      var im = new Image();
      im.onload = function () { imgs[key] = im; resolve(); };
      im.onerror = function () {
        if (OPTIONAL[key]) { resolve(); return; } // 選用素材：缺了只是沒有眨眼／搖尾
        reject(new Error('無法載入 ' + SRC[key]));
      };
      im.src = SRC[key];
    });
  }

  function init() {
    if (!buildUI()) return;
    readAnimUI();
    $('esMode').addEventListener('change', function () {
      if (busy) { this.value = 'end'; return; }
      setMode(this.value === 'end');
    });
    $('esSection').addEventListener('input', function (e) {
      if (busy) return;
      if (e.target && e.target.id === 'esPreset') return;
      render();
      if (e.target && e.target.id === 'esTotal') { updateBar(); }
      updateZipHint();
    });
    $('esSection').addEventListener('change', function (e) {
      if (busy) return;
      if (e.target && e.target.id === 'esPreset') {
        var p = PRESETS[e.target.value];
        if (p) { writeAnimUI(p); updateBar(); }
      }
      render();
    });
    $('esFps').addEventListener('change', updateZipHint);
    updateZipHint();
    $('esPlay').addEventListener('click', play);
    $('esStopBtn').addEventListener('click', stopAnim);
    $('esSeek').addEventListener('input', function () { pause(); readAnimUI(); anim.t = Number(this.value) / 100; render(); updateBar(); });
    $('esWebm').addEventListener('click', exportVideo);
    $('esZip').addEventListener('click', exportZip);
    bindExport();
    $('esMode').value = 'end';
    setMode(true);
    Promise.all(Object.keys(SRC).map(load).concat([
      document.fonts.load('700 36px "O-Ne Noto Sans TC"'),
      document.fonts.load('500 28px "O-Ne Noto Sans TC"')
    ])).then(function () {
      ready = true;
      if (active) render();
      var q = new URLSearchParams(location.search);
    }).catch(function (err) {
      var st = $('status');
      if (st) { st.classList.add('error'); st.textContent = '結束畫面素材載入失敗：' + err.message; }
    });
  }

  window.ONEEndscreenTools = { buildZip: buildZip, crc32: crc32, version: VERSION };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
