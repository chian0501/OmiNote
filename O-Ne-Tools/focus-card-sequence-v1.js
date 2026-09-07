/* Focus-card sequences. The existing renderer and o-ne.project-package.v1 remain canonical. */
(function (global) {
  'use strict';
  const KEYS = ['left', 'right', 'third', 'fourth'];
  const STATES = ['auto', 'hidden', 'show', 'focus', 'dim'];
  const EFFECTS = ['frame', 'badge', 'spotlight', 'none'];
  const PLACEMENTS = ['left', 'right', 'both', 'stack-left', 'stack-right', 'pair-left', 'pair-right',
    'triple-top-left', 'triple-top-right', 'triple-side-left', 'triple-side-right', 'grid-left', 'grid-right'];
  const clamp = (v, min, max) => Math.min(max, Math.max(min, Number(v) || min));
  const clone = value => JSON.parse(JSON.stringify(value));
  const label = key => '圖片 ' + (KEYS.indexOf(key) + 1);
  const isGrid = p => /^(triple-top|triple-side|grid)-/.test(p || '');
  const isGroup = p => /^(stack|pair|triple-top|triple-side|grid)-/.test(p || '');
  function slotKeys(images) {
    const p = images?.placement || 'right';
    if (p.startsWith('grid-')) return KEYS.slice();
    if (p.startsWith('triple-')) return KEYS.slice(0, 3);
    if (isGroup(p) || p === 'both') return KEYS.slice(0, 2);
    return [p === 'left' ? 'left' : 'right'];
  }
  function sequence(content, mode) {
    const raw = content?.sequence || {}, count = Math.max(1, content?.items?.length || 1);
    return { enabled: mode !== 'body' && raw.enabled === true,
      step: Math.round(clamp(raw.step ?? 1, 1, count)),
      imageMode: ['all', 'accumulate', 'single'].includes(raw.imageMode) ? raw.imageMode : 'accumulate',
      effect: EFFECTS.includes(raw.effect) ? raw.effect : 'frame',
      frames: Array.from({ length: count }, (_, i) => ({
        states: KEYS.map((k, n) => STATES.includes(raw.frames?.[i]?.states?.[n]) ? raw.frames[i].states[n] : 'auto'),
        effects: KEYS.map((k, n) => EFFECTS.includes(raw.frames?.[i]?.effects?.[n]) ? raw.frames[i].effects[n] : 'inherit')
      })) };
  }
  function stateFor(content, mode, images, key) {
    const q = sequence(content, mode), keys = slotKeys(images), i = keys.indexOf(key);
    if (!q.enabled) return { state: 'show', effect: 'none' };
    const frame = q.frames[q.step - 1], n = KEYS.indexOf(key), custom = frame.states[n];
    const active = q.imageMode === 'single' ? Math.min(q.step - 1, keys.length - 1) : q.step - 1;
    const state = custom !== 'auto' ? custom : i === active ? 'focus' : q.imageMode === 'all' ? 'show'
      : q.imageMode === 'single' || i > active ? 'hidden' : 'dim';
    return { state, effect: frame.effects[n] === 'inherit' ? q.effect : frame.effects[n] };
  }
  function gridBoxes(placement, width, gap = 24) {
    const half = (width - gap) / 2, h = half * 9 / 16;
    if (placement.startsWith('triple-top-')) return [
      { x: 0, y: 0, w: width, h: width * 9 / 16 },
      { x: 0, y: width * 9 / 16 + gap, w: half, h },
      { x: half + gap, y: width * 9 / 16 + gap, w: half, h }
    ];
    if (placement.startsWith('triple-side-')) return [
      { x: 0, y: 0, w: half, h: h * 2 + gap },
      { x: half + gap, y: 0, w: half, h },
      { x: half + gap, y: h + gap, w: half, h }
    ];
    return [{ x: 0, y: 0, w: half, h }, { x: half + gap, y: 0, w: half, h },
      { x: 0, y: h + gap, w: half, h }, { x: half + gap, y: h + gap, w: half, h }];
  }
  function gridLayout(mode, images, width = 1240) {
    const gap = 32, onLeft = images.placement.endsWith('left'), innerLeft = onLeft ? 34 : 86,
      innerRight = 64, minText = mode === 'body' ? 380 : 410,
      groupWidth = Math.max(120, Math.min(width * clamp(images.scale ?? 32, 18, 45) / 100,
        width - innerLeft - innerRight - minText - gap));
    return { count: slotKeys(images).length, left: true, right: true, both: false, grouped: true,
      grid: true, onLeft, gap, innerLeft, innerRight, minText, groupWidth,
      imageWidth: groupWidth, textWidth: width - innerLeft - innerRight - groupWidth - gap };
  }
  function gridHeight(images, width) {
    return Math.max(...gridBoxes(images.placement, width).map(r => r.y + r.h));
  }
  function drawAsset(ctx, asset, key, rect, content, mode, images, draw, crop) {
    if (!asset?.enabled || !asset.element) return;
    const current = stateFor(content, mode, images, key);
    if (current.state === 'hidden') return;
    const spotlight = slotKeys(images).some(k => {
      const s = stateFor(content, mode, images, k);
      return images[k]?.enabled && images[k]?.element && s.state === 'focus' && s.effect === 'spotlight';
    });
    ctx.save();
    ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
    if (current.state === 'dim' || spotlight && current.state !== 'focus') ctx.globalAlpha *= .3;
    const c = crop(asset);
    if (isGrid(images.placement) && c.fit === 'free') {
      // A crop in a fixed grid is contained, never stretched to the cell ratio.
      const image = asset.element, sw = image.naturalWidth * c.cropWidth / 100,
        sh = image.naturalHeight * c.cropHeight / 100, scale = Math.min(rect.w / sw, rect.h / sh);
      ctx.drawImage(image, image.naturalWidth * c.cropX / 100, image.naturalHeight * c.cropY / 100,
        sw, sh, rect.x + (rect.w - sw * scale) / 2, rect.y + (rect.h - sh * scale) / 2, sw * scale, sh * scale);
    } else draw(ctx, asset, rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
    if (current.state === 'focus' && current.effect === 'frame') {
      ctx.save(); ctx.strokeStyle = '#FFBE37'; ctx.lineWidth = 5;
      ctx.strokeRect(rect.x + 2.5, rect.y + 2.5, rect.w - 5, rect.h - 5); ctx.restore();
    }
    if (current.state === 'focus' && current.effect === 'badge') {
      ctx.save(); ctx.fillStyle = '#FFBE37'; ctx.beginPath();
      ctx.roundRect(rect.x + 8, rect.y + 8, 48, 38, 8); ctx.fill();
      ctx.fillStyle = '#1F1713'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '800 24px "Noto Sans TC", sans-serif';
      ctx.fillText(String(KEYS.indexOf(key) + 1).padStart(2, '0'), rect.x + 32, rect.y + 27); ctx.restore();
    }
    const m = ctx.getTransform();
    (ctx.canvas.__oneFocusImageTargets ||= []).push({ key: 'focus-image-' + key, label: label(key),
      inputId: 'one-focus-upload-' + key,
      rect: { x: m.a * rect.x + m.e, y: m.d * rect.y + m.f, w: m.a * rect.w, h: m.d * rect.h },
      onSelect: () => revealSlot(key), onEdit: () => revealSlot(key, true) });
  }
  function revealSlot(key, edit = false) {
    const input = document.getElementById('one-focus-upload-' + key), slot = input?.closest('.image-slot');
    if (!slot) return;
    for (let p = slot.parentElement; p; p = p.parentElement) if (p.tagName === 'DETAILS') p.open = true;
    slot.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    slot.classList.add('one-focus-selected-slot');
    setTimeout(() => slot.classList.remove('one-focus-selected-slot'), 1000);
    if (edit) slot.querySelector('.focus-image-thumb')?.click();
  }
  function serializeImages(images, crop) {
    const result = { placement: images.placement, scale: images.scale };
    KEYS.forEach(key => {
      const a = images[key] || {};
      result[key] = { enabled: !!a.enabled, name: a.name || '', assetId: a.assetId || '',
        width: a.element?.naturalWidth || a.width || 0, height: a.element?.naturalHeight || a.height || 0, ...crop(a) };
    });
    return result;
  }
  function validate(snapshot) {
    if (!snapshot || !['body', 'list', 'steps'].includes(snapshot.mode) || !snapshot.content || !snapshot.label || !snapshot.style)
      throw Error('焦點卡 JSON 結構不完整。');
    const images = snapshot.images;
    if (images?.placement && !PLACEMENTS.includes(images.placement)) throw Error('圖片位置無效。');
    for (const mode of ['body', 'list', 'steps']) {
      const c = snapshot.content[mode];
      if (!c) { if (mode === snapshot.mode) throw Error('缺少目前模式的內容。'); continue; }
      if (typeof c.title !== 'string' || mode === 'body' && typeof c.body !== 'string') throw Error('文字欄位格式錯誤。');
      if (mode !== 'body' && (!Array.isArray(c.items) || c.items.length < 1 || c.items.length > 8 || c.items.some(t => typeof t !== 'string')))
        throw Error('項目／步驟必須為 1–8 項文字。');
      if (c.sequence) {
        const q = c.sequence;
        if (typeof q.enabled !== 'boolean' || !Number.isInteger(q.step) || q.step < 1 || q.step > (c.items?.length || 1) ||
            !['all', 'accumulate', 'single'].includes(q.imageMode) || !EFFECTS.includes(q.effect) ||
            !Array.isArray(q.frames) || q.frames.length !== (c.items?.length || 1)) throw Error('累積幕設定無效。');
        for (const frame of q.frames) {
          if (!Array.isArray(frame.states) || frame.states.length !== 4 || frame.states.some(v => !STATES.includes(v)) ||
              !Array.isArray(frame.effects) || frame.effects.length !== 4 || frame.effects.some(v => v !== 'inherit' && !EFFECTS.includes(v)))
            throw Error('逐幕圖片狀態無效。');
        }
      }
    }
    return snapshot;
  }
  function reorder(content, order, mode, nextStep) {
    const q = sequence(content, mode);
    const oldCurrent = q.step - 1, step = nextStep ?? Math.max(1, order.indexOf(oldCurrent) + 1);
    return { items: order.map(i => content.items[i]), itemHighlights: order.map(i => !!content.itemHighlights?.[i]),
      itemFrameStates: order.map(i => content.itemFrameStates?.[i] || 'none'),
      ...(content.sequence ? { sequence: { ...q, step: Math.min(step, order.length), frames: order.map(i => q.frames[i]) } } : {}) };
  }
  const cleanName = title => String(title || '未命名').replace(/[【】]/g, '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').trim().slice(0,65) || '未命名';
  const nextPaint = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  function download(blob, filename) {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = filename; a.dataset.onePreserveFilename = '1';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  async function decodeImage(file) {
    if (file.size > 12 * 1024 * 1024) throw Error('圖片請控制在 12 MB 內。');
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw Error('請使用 PNG、JPG 或 WebP 圖片。');
    const bytes = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const assetId = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(Error('圖片讀取失敗。')); r.readAsDataURL(file);
    });
    const element = await new Promise((resolve, reject) => {
      const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(Error('圖片無法解碼。')); image.src = dataUrl;
    });
    return { enabled: true, name: file.name, dataUrl, element, assetId };
  }
  function useRuntime(React, options) {
    const latest = React.useRef(options); latest.current = options;
    const history = React.useRef({ entries: [], cursor: -1, applying: false, timer: null });
    const requests = React.useRef({ epoch: 0, slots: {}, pending: 0 });
    const operation = React.useRef(false);
    const [busy, setBusy] = React.useState(false), [historyTick, setHistoryTick] = React.useState(0);
    const raw = () => {
      const o = latest.current;
      return { mode: o.mode, contents: o.contents, images: o.images, label: o.label, style: o.style, placement: o.placement };
    };
    const signature = value => JSON.stringify({ ...value, images: serializeImages(value.images, latest.current.crop) });
    const record = () => {
      const h = history.current, value = raw(), key = signature(value);
      clearTimeout(h.timer);
      if (h.entries[h.cursor]?.key === key) return;
      h.entries.splice(h.cursor + 1); h.entries.push({ value, key });
      if (h.entries.length > 40) h.entries.shift();
      h.cursor = h.entries.length - 1; setHistoryTick(n => n + 1);
    };
    const applyRaw = value => {
      const o = latest.current;
      requests.current.epoch++;
      o.setMode(value.mode); o.setContents(value.contents); o.setImages(value.images);
      o.setLabel(value.label); o.setStyle(value.style); o.setPlacement(value.placement);
    };
    const undo = direction => {
      if (operation.current) return;
      record(); const h = history.current, target = h.cursor + direction;
      if (target < 0 || target >= h.entries.length) return;
      h.cursor = target; h.applying = true; applyRaw(h.entries[target].value); setHistoryTick(n => n + 1);
    };
    React.useEffect(() => {
      const h = history.current;
      if (h.applying) { h.applying = false; return; }
      if (!h.entries.length) record();
      else { clearTimeout(h.timer); h.timer = setTimeout(record, 300); setHistoryTick(n => n + 1); }
      return () => clearTimeout(h.timer);
    }, [options.mode, options.contents, options.images, options.label, options.style, options.placement]);
    React.useEffect(() => {
      const key = event => {
        if (event.defaultPrevented || event.isComposing || event.target.closest?.('.one-direct-editor') || !(event.ctrlKey || event.metaKey) || event.altKey) return;
        const k = event.key.toLowerCase();
        if (k === 'z' || k === 'y' && !event.metaKey) { event.preventDefault(); undo(k === 'y' || event.shiftKey ? 1 : -1); }
      };
      const focus = event => {
        const row = event.target.closest?.('.item-row');
        const o = latest.current, c = o.contents[o.mode], q = sequence(c, o.mode);
        if (!row || !q.enabled) return;
        const i = Array.from(document.querySelectorAll('.item-row')).indexOf(row);
        if (i >= 0 && q.step !== i + 1) o.updateContent({ sequence: { ...q, step: i + 1 } });
      };
      document.addEventListener('keydown', key); document.addEventListener('focusin', focus);
      return () => { document.removeEventListener('keydown', key); document.removeEventListener('focusin', focus); };
    }, []);
    const update = patch => {
      record(); const o = latest.current;
      o.updateContent({ sequence: { ...sequence(o.contents[o.mode], o.mode), ...patch } });
    };
    const setStep = step => update({ step });
    const selectImage = async (key, file) => {
      if (!file || operation.current) return;
      record(); const r = requests.current, token = (r.slots[key] || 0) + 1, epoch = r.epoch;
      r.slots[key] = token; r.pending++;
      try {
        const asset = await decodeImage(file);
        if (r.epoch !== epoch || r.slots[key] !== token) return;
        latest.current.setImages(prev => ({ ...prev, [key]: { ...latest.current.emptyImage(), ...latest.current.crop(prev[key]), ...asset } }));
        latest.current.notify(label(key) + '已加入');
      } catch (error) { if (r.epoch === epoch && r.slots[key] === token) latest.current.notify(error.message); }
      finally { r.pending--; }
    };
    const removeImage = key => {
      if (operation.current) return;
      record(); requests.current.slots[key] = (requests.current.slots[key] || 0) + 1;
      latest.current.setImages(prev => ({ ...prev, [key]: latest.current.emptyImage() }));
    };
    async function locked(action) {
      if (operation.current) throw Error('正在處理專案，請稍候。');
      if (requests.current.pending) throw Error('圖片還在讀取，請完成後再下載或載入。');
      operation.current = true; record(); setBusy(true);
      const blocked = Array.from(document.querySelectorAll('.editor-panel,.preview-panel,.one-workspace-header-actions,[data-one-backup-ui],[data-one-project-package-ui],[data-one-batch-render-ui]'));
      const before = blocked.map(node => node.inert); blocked.forEach(node => { node.inert = true; });
      try { await document.fonts.ready; await nextPaint(); return await action(latest.current); }
      finally { blocked.forEach((node, i) => { node.inert = before[i]; }); operation.current = false; setBusy(false); }
    }
    async function pngEntries(o) {
      const c = o.contents[o.mode], q = sequence(c, o.mode), count = q.enabled ? c.items.length : 1;
      const measured = o.measure(o.mode, o.style.cardSize, o.style.customWidth, c, o.label, o.style, o.images);
      const entries = [], base = '焦點卡-' + cleanName(c.title);
      for (let i = 1; i <= count; i++) {
        const canvas = document.createElement('canvas');
        canvas.setAttribute('aria-hidden', 'true'); canvas.style.cssText = 'position:fixed;left:-10000px;pointer-events:none';
        document.body.appendChild(canvas);
        let blob;
        try {
          o.render(canvas, { mode: measured, modeId: o.mode, content: q.enabled ? { ...c, sequence: { ...q, step: i } } : c,
            label: o.label, styleOptions: o.style, imageSettings: o.images, previewMode: 'component', safeGuide: false,
            placement: o.placement, includeText: true });
          blob = await new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(Error('PNG 輸出失敗。')), 'image/png'));
        } finally { canvas.remove(); }
        entries.push({ name: base + '-' + String(i).padStart(2, '0') + '.png', data: blob });
      }
      return entries;
    }
    const exportFrames = async () => {
      try { await locked(async o => {
        const entries = await pngEntries(o);
        download(await global.ONEProjectPackage.createZip(entries), '焦點卡-' + cleanName(o.contents[o.mode].title) + '-全部幕.png.zip');
        o.notify('已輸出 ' + entries.length + ' 幕 PNG，尺寸一致。');
      }); } catch (e) { latest.current.notify(e.message); }
    };
    const exportPackage = async () => locked(async o => {
      const snapshot = o.capture(), entries = await pngEntries(o), assets = [];
      for (const key of KEYS) {
        const image = o.images[key];
        if (snapshot.images[key]?.enabled && !image?.element) throw Error(label(key) + '缺少原圖，請先重新選圖。');
        if (!image?.element || !image.dataUrl) continue;
        const blob = await (await fetch(image.dataUrl)).blob(), name = image.name || key + '.png';
        const path = 'assets/' + key + '-' + cleanName(name);
        entries.push({ name: path, data: blob });
        assets.push({ input_key: 'slot:' + (key === 'left' ? '左側圖片' : key === 'right' ? '右側圖片' : key),
          file_name: name, mime_type: blob.type, size: blob.size, zip_path: path });
      }
      const project = { schema: global.ONEProjectPackage.schema, package_version: global.ONEProjectPackage.version, tool_id: 'focus-card',
        tool_name: '焦點卡', generator_version: 'V0.6.0', saved_at: new Date().toISOString(),
        title: o.contents[o.mode].title, status: '累積專案', data: snapshot, assets,
        sequence_export: { mode: o.mode, frames: entries.filter(e => e.name.endsWith('.png') && !e.name.startsWith('assets/')).map(e => e.name) } };
      entries.unshift({ name: 'project.json', data: JSON.stringify(project, null, 2) });
      download(await global.ONEProjectPackage.createZip(entries), '焦點卡-' + cleanName(project.title) + '-完整專案.project.zip');
      return '完整專案已下載｜全部幕 PNG、設定與 ' + assets.length + ' 張原圖。';
    });
    const importPackage = file => locked(async o => {
      if (file.size > 200 * 1024 * 1024) throw Error('ZIP 超過 200 MB。');
      const entries = await global.ONEProjectPackage.readZip(file, { strict: true }), decoder = new TextDecoder('utf-8', { fatal: true });
      const names = Object.keys(entries).filter(n => !n.includes('/') && n.endsWith('.json'));
      let project;
      for (const name of names) {
        try { const candidate = JSON.parse(decoder.decode(entries[name])); if (candidate.schema === global.ONEProjectPackage.schema) { project = candidate; break; } } catch (_) {}
      }
      if (!project || project.tool_id !== 'focus-card') throw Error('這不是焦點卡完整專案。');
      validate(project.data);
      if (!Array.isArray(project.assets) || project.assets.length > 4) throw Error('專案圖片清單無效。');
      const restored = {}, usedPaths = new Set();
      for (const meta of project.assets) {
        const key = ({ 'slot:左側圖片': 'left', 'slot:右側圖片': 'right', 'slot:third': 'third', 'slot:fourth': 'fourth' })[meta.input_key];
        if (!key || restored[key] || usedPaths.has(meta.zip_path)) throw Error('圖片槽位重複或無效。');
        const bytes = entries[meta.zip_path];
        if (!bytes || !meta.zip_path.startsWith('assets/') || meta.size !== bytes.length) throw Error('專案缺少圖片或檔案已損壞。');
        usedPaths.add(meta.zip_path);
        const asset = await decodeImage(new File([bytes], meta.file_name, { type: meta.mime_type }));
        const config = project.data.images?.[key] || {};
        if (config.assetId && asset.assetId !== config.assetId) throw Error('圖片校驗失敗：' + label(key));
        restored[key] = { ...o.emptyImage(), ...asset, ...o.crop(config), enabled: config.enabled === true };
      }
      const imageSettings = project.data.images || {};
      for (const key of KEYS) if (imageSettings[key]?.enabled && !restored[key]) throw Error('專案缺少' + label(key) + '，未變更目前內容。');
      // Commit once, after all JSON, slots and original image bytes have passed validation.
      requests.current.epoch++;
      o.apply(project.data);
      o.setImages({ placement: imageSettings.placement || 'right', scale: clamp(imageSettings.scale ?? imageSettings.scalePercent ?? 32, 18, 45),
        ...Object.fromEntries(KEYS.map(key => [key, restored[key] || o.emptyImage()])) });
      await nextPaint();
      return '專案包載入成功｜全部幕設定與 ' + Object.keys(restored).length + ' 張圖片已還原。';
    });
    const q = sequence(options.contents[options.mode], options.mode), h = history.current;
    const changed = h.entries[h.cursor]?.key !== signature(raw());
    return { React, ...options, q, busy, update, setStep, selectImage, removeImage, exportFrames, exportPackage, importPackage,
      invalidateImageLoads: () => { requests.current.epoch++; },
      undo: () => undo(-1), redo: () => undo(1), canUndo: h.cursor > 0 || h.cursor === 0 && changed,
      canRedo: !changed && h.cursor < h.entries.length - 1, historyTick };
  }
  function Toolbar({ runtime: r }) {
    const h = r.React.createElement, c = r.contents[r.mode], q = r.q;
    const button = (text, action, disabled, title) => h('button', { type: 'button', onClick: action, disabled: disabled || r.busy, title }, text);
    return h('div', { className: 'focus-sequence-toolbar', 'data-focus-sequence': '', 'aria-busy': r.busy },
      h('label', { className: 'focus-sequence-toggle' }, h('input', { type: 'checkbox', checked: q.enabled,
        disabled: r.mode === 'body' || r.busy, onChange: e => r.update({ enabled: e.target.checked, step: 1 }) }), '累積出現'),
      q.enabled ? h('div', { className: 'focus-sequence-navigation' },
        button('←', () => r.setStep(q.step - 1), q.step <= 1, '上一幕'),
        h('select', { 'aria-label': '目前累積幕', value: q.step, disabled: r.busy, onChange: e => r.setStep(Number(e.target.value)) },
          c.items.map((text, i) => h('option', { key: i, value: i + 1 }, (i + 1) + ' / ' + c.items.length + '　' + text.replace(/[【】]/g, '').slice(0, 20)))),
        button('→', () => r.setStep(q.step + 1), q.step >= c.items.length, '下一幕'))
        : h('span', { className: 'focus-sequence-hint' }, r.mode === 'body' ? '切到「項目／步驟」可累積' : '開啟後逐項亮起'),
      q.enabled && button('輸出全部幕 PNG ZIP', r.exportFrames, false),
      h('div', { className: 'focus-sequence-history' }, button('↶ 復原', r.undo, !r.canUndo, '復原整張卡（Ctrl/Cmd+Z）'),
        button('↷ 重做', r.redo, !r.canRedo, '重做整張卡（Ctrl/Cmd+Shift+Z）')),
      r.busy && h('span', { role: 'status' }, '正在處理…'));
  }
  function FrameEditor({ runtime: r }) {
    const h = r.React.createElement, q = r.q, frame = q.frames[q.step - 1];
    if (!q.enabled) return null;
    const modify = (key, field, value) => {
      const frames = clone(q.frames); frames[q.step - 1][field][KEYS.indexOf(key)] = value; r.update({ frames });
    };
    return h('div', { className: 'focus-sequence-frame' },
      h('label', null, '圖片出現方式', h('select', { 'aria-label': '圖片出現方式', value: q.imageMode,
        onChange: e => r.update({ imageMode: e.target.value }) },
        [['all', '全部固定顯示'], ['accumulate', '逐格累積出現'], ['single', '單步切換']].map(([v,t]) => h('option',{key:v,value:v},t)))),
      h('label', null, '預設焦點標示', h('select', { 'aria-label': '預設焦點標示', value: q.effect,
        onChange: e => r.update({ effect: e.target.value }) },
        [['frame','外框高亮'],['badge','數字徽章'],['spotlight','主圖突出／其他淡化'],['none','不加標示']].map(([v,t]) => h('option',{key:v,value:v},t)))),
      h('strong', null, '第 ' + q.step + ' 幕圖片狀態'),
      slotKeys(r.images).map(key => h('div', { className: 'focus-sequence-state', key },
        h('span', null, label(key)),
        h('select', { 'aria-label': label(key) + '這幕狀態', value: frame.states[KEYS.indexOf(key)], onChange: e => modify(key, 'states', e.target.value) },
          [['auto','自動'],['hidden','隱藏'],['show','顯示'],['focus','焦點'],['dim','淡化']].map(([v,t]) => h('option',{key:v,value:v},t))),
        h('select', { 'aria-label': label(key) + '這幕標示', value: frame.effects[KEYS.indexOf(key)], onChange: e => modify(key, 'effects', e.target.value) },
          [['inherit','預設標示'],['frame','外框高亮'],['badge','數字徽章'],['spotlight','主圖突出'],['none','無標示']].map(([v,t]) => h('option',{key:v,value:v},t))))),
      h('div', { className: 'focus-sequence-frame-actions' },
        h('button', { type: 'button', disabled: q.step <= 1, onClick: () => { const frames = clone(q.frames);
          // Copy the effective previous state, so an automatic focus does not move to a different image.
          const previous = { ...r.contents[r.mode], sequence: { ...q, step: q.step - 1 } };
          for (const key of slotKeys(r.images)) { const n = KEYS.indexOf(key), s = stateFor(previous, r.mode, r.images, key);
            frames[q.step - 1].states[n] = s.state; frames[q.step - 1].effects[n] = s.effect; }
          r.update({ frames }); } }, '複製上一幕'),
        h('button', { type: 'button', onClick: () => { const frames = clone(q.frames); frames[q.step - 1] = { states: KEYS.map(() => 'auto'), effects: KEYS.map(() => 'inherit') }; r.update({ frames }); } }, '本幕恢復自動')),
      h('p', { className: 'hint' }, '圖片共用原圖與裁切；每幕可分別設為隱藏、顯示、焦點或淡化。格位與整卡尺寸固定。'));
  }
  const api = { version: '0.6.0', KEYS, PLACEMENTS, STATES, EFFECTS, label, isGrid, isGroup, slotKeys, sequence,
    stateFor, gridBoxes, gridLayout, gridHeight, drawAsset, serializeImages, validate, reorder,
    useRuntime, Toolbar, FrameEditor, decodeImage };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.ONEFocusSequence = api;
})(typeof window !== 'undefined' ? window : this);
