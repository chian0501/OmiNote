'use strict';

// Run with jsdom 30 and @napi-rs/canvas 0.1.100 available on NODE_PATH.
// This is a DOM/renderer integration test, not a browser layout test.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { JSDOM, requestInterceptor, VirtualConsole } = require('jsdom');
const { createCanvas, Image, GlobalFonts } = require('@napi-rs/canvas');
const root = path.resolve(__dirname, '..');
const repository = path.dirname(root);
// Keep the reference fixed after committing this test. Override to compare with
// another known renderer baseline; never silently compare the new shell to itself.
const baseRef = process.env.ONE_WORKSPACE_BASE_REF || '07e37a9dfbbddd3e27a91d4a80b6d40c5a12bb53';
const fontFile = path.join(root, 'assets/NotoSansTC-O-Ne.woff');
if (fs.existsSync(fontFile)) GlobalFonts.registerFromPath(fontFile, 'Noto Sans TC');
const tools = JSON.parse(fs.readFileSync(path.join(root, 'one-tools-registry-v1.json'))).tools
  .filter(tool => tool.href && tool.id !== 'explanation');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

class LocalLoader {
  fetch(url) {
    const parsed = new URL(url);
    if (parsed.hostname !== 'tools.test') return null;
    const relative = decodeURIComponent(parsed.pathname).replace(/^\/O-Ne-Tools\//, '');
    const file = path.resolve(root, relative);
    return file.startsWith(root + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()
      ? Promise.resolve(fs.readFileSync(file)) : null;
  }
}

function installCanvas(window) {
  const canvases = new WeakMap();
  const contexts = new WeakSet();
  const blobs = new Map();
  let blobId = 0;
  function native(canvas) {
    let current = canvases.get(canvas);
    if (!current || current.width !== canvas.width || current.height !== canvas.height) {
      current = createCanvas(canvas.width || 300, canvas.height || 150);
      canvases.set(canvas, current);
    }
    return current;
  }
  window.HTMLCanvasElement.prototype.getContext = function (type) {
    if (type !== '2d') return null;
    const context = native(this).getContext('2d');
    if (!contexts.has(context)) {
      const draw = context.drawImage.bind(context);
      context.drawImage = (image, ...args) => draw(image instanceof window.HTMLCanvasElement ? native(image) : image, ...args);
      contexts.add(context);
    }
    return context;
  };
  // Preserve context identity on resize, just as HTMLCanvasElement does.
  ['width', 'height'].forEach(key => {
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLCanvasElement.prototype, key);
    Object.defineProperty(window.HTMLCanvasElement.prototype, key, {
      get: descriptor.get,
      set(value) {
        descriptor.set.call(this, value);
        const current = canvases.get(this);
        if (current) current[key] = this[key] || 1;
      }
    });
  });
  window.HTMLCanvasElement.prototype.toDataURL = function () { return native(this).toDataURL('image/png'); };
  window.HTMLCanvasElement.prototype.toBlob = function (callback) {
    const blob = new window.Blob([native(this).toBuffer('image/png')], { type: 'image/png' });
    window.setTimeout(() => callback(blob), 0);
  };
  window.Image = class extends Image {
    set src(value) {
      this.source = String(value);
      if (/^data:/.test(this.source)) { super.src = Buffer.from(this.source.split(',')[1], 'base64'); return; }
      try {
        const relative = new URL(this.source, window.location.href).pathname.replace(/^\/O-Ne-Tools\//, '');
        super.src = fs.readFileSync(path.join(root, decodeURIComponent(relative)));
      } catch (error) {
        window.setTimeout(() => { if (this.onerror) this.onerror(error); }, 0);
      }
    }
    get src() { return this.source; }
    decode() { return Promise.resolve(); }
  };
  window.URL.createObjectURL = blob => { const url = 'blob:qa-' + ++blobId; blobs.set(url, blob); return url; };
  window.URL.revokeObjectURL = () => {};
  window.__downloads = [];
  window.HTMLAnchorElement.prototype.click = function () {
    window.__downloads.push({ name: this.download, href: this.href, blob: blobs.get(this.href) });
  };
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  window.HTMLElement.prototype.scrollTo = function () {};
  window.HTMLElement.prototype.scrollIntoView = function () {};
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new window.Event('close')); };
  window.confirm = () => true;
  window.alert = () => {};
  window.fetch = async url => {
    const data = await new LocalLoader().fetch(new URL(url, window.location.href).href);
    return { ok: !!data, status: data ? 200 : 404, json: async () => JSON.parse(data), text: async () => data.toString(), arrayBuffer: async () => data };
  };
  window.FontFace = class { async load() { return this; } };
  Object.defineProperty(window.document, 'fonts', { value: { ready: Promise.resolve(), add() {}, check() { return true; }, async load() { return []; } } });
  Object.defineProperty(window.navigator, 'clipboard', { value: { async writeText() {} } });
  // jsdom's async resource interception does not block nested document.write
  // scripts like a browser parser. Execute only the tool's known local helpers
  // synchronously so the original mount wrappers install before inline editors.
  const documentWrite = window.document.write.bind(window.document);
  window.document.write = value => {
    const match = String(value).match(/^<script src="\.\/(project-package-v1|batch-render-v1|ai-json-guide-v1)\.js[^"]*"><\/script>$/);
    if (match) window.eval(fs.readFileSync(path.join(root, match[1] + '.js'), 'utf8'));
    else documentWrite(value);
  };
}

async function load(tool, enhanced) {
  const file = tool.id === 'dialogue' ? 'dialogue-card-v135.html' : tool.href.split('?')[0].replace('./', '');
  let html = enhanced ? fs.readFileSync(path.join(root, file), 'utf8') :
    execFileSync('git', ['show', baseRef + ':O-Ne-Tools/' + file], { cwd: repository, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  // Bundled module contains no imports; run in its own lexical scope in jsdom.
  html = html.replace(/<script type="module">([\s\S]*?)<\/script>/g, '<script>;(function(){\n$1\n})();</script>');
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(html, {
    url: 'https://tools.test/O-Ne-Tools/' + file,
    resources: { interceptors: [requestInterceptor(async request => {
      const data = await new LocalLoader().fetch(request.url);
      const pathname = new URL(request.url).pathname;
      return new Response(data || '', {
        status: data ? 200 : 404,
        headers: { 'Content-Type': pathname.endsWith('.css') ? 'text/css' : pathname.endsWith('.js') ? 'application/javascript' : 'application/octet-stream' }
      });
    })] }, runScripts: 'dangerously', pretendToBeVisual: true,
    virtualConsole, beforeParse: installCanvas
  });
  for (let i = 0; i < 80; i++) {
    await delay(25);
    if (dom.window.document.readyState === 'complete' &&
      dom.window.document.querySelector('canvas') &&
      dom.window.document.querySelector('[data-one-project-package-ui]') &&
      dom.window.document.querySelector('[data-one-batch-render-ui]') &&
      dom.window.document.querySelector('[data-one-ai-json-guide]') &&
      (!enhanced || dom.window.document.body.dataset.oneWorkspaceReady === '1')) break;
  }
  await delay(250);
  return { dom, window: dom.window, document: dom.window.document, errors, file };
}

function canvasBytes(page) {
  const canvas = page.document.querySelector('.preview-wrap canvas,.stage canvas,.preview-canvas');
  assert(canvas, page.file + ': preview canvas');
  return { width: canvas.width, height: canvas.height, data: canvas.toDataURL() };
}
function click(page, selector) {
  const target = page.document.querySelector(selector);
  assert(target, page.file + ': missing ' + selector);
  target.click();
  return target;
}
function set(page, id, value, type = 'input') {
  const node = page.document.getElementById(id);
  assert(node, page.file + ': missing ' + id);
  node.value = value;
  node.dispatchEvent(new page.window.Event(type, { bubbles: true }));
}

(async () => {
  const results = [];
  for (const tool of tools) {
    const before = await load(tool, false);
    const page = await load(tool, true);
    try {
      assert.deepEqual(page.errors, before.errors, tool.id + ': new runtime errors');
      assert.deepEqual(canvasBytes(page), canvasBytes(before), tool.id + ': initial artwork changed');
      assert.equal(page.document.querySelectorAll('.one-workspace-header').length, 1, tool.id + ': one header');
      assert.equal(page.document.querySelectorAll('.one-workspace-dialog').length, 1, tool.id + ': one file dialog');
      assert.equal(page.document.querySelectorAll('.one-after-edit-dock').length, 1, tool.id + ': one native utility dock');
      assert(page.document.querySelector('.one-workspace-save-host button'), tool.id + ': top save button');
      assert(page.document.querySelector('.one-workspace-native-files [data-action="load"],.one-workspace-native-files #loadJson'), tool.id + ': JSON import in project dialog');
      const originalControls = [...before.document.querySelectorAll('input[id],select[id],textarea[id],button[id],canvas[id],a[id]')]
        .filter(node => !/one-control-/.test(node.id)).map(node => node.id);
      for (const id of originalControls) {
        assert.equal(page.document.querySelectorAll('[id="' + id + '"]').length, 1, tool.id + ': preserve ' + id);
      }
      const dialog = page.document.querySelector('.one-workspace-dialog');
      click(page, '.one-workspace-header-actions button[aria-controls="one-workspace-files"]');
      assert(dialog.open, tool.id + ': file dialog opens');
      for (const key of ['project', 'history', 'batch', 'ai', 'help']) {
        click(page, '#one-workspace-tab-' + key);
        await delay(10);
        assert.equal(page.document.querySelectorAll('.one-workspace-file-tab[aria-selected="true"]').length, 1);
        assert.equal(page.document.querySelector('#one-workspace-pane-' + key).hidden, false);
        const expected = { project: 'data-one-project-package-ui', history: 'data-one-backup-ui', batch: 'data-one-batch-render-ui', ai: 'data-one-ai-json-guide' }[key];
        if (expected) {
          const panel = page.document.querySelector('[' + expected + ']');
          assert(panel && !panel.hidden && page.document.querySelector('#one-workspace-pane-' + key).contains(panel), tool.id + ': ' + key + ' panel; ' + JSON.stringify({ baselineProject: !!before.document.querySelector('[data-one-project-package-ui]'), api: typeof page.window.ONEProjectPackage, scripts: [...page.document.scripts].map(s => s.src).filter(Boolean), errors: page.errors }));
        }
      }
      click(page, '.one-workspace-dialog-head button');
      assert(!dialog.open);
      click(page, '.one-workspace-modebar > button');
      assert(page.document.body.classList.contains('one-workspace-sidebar-hidden'));
      click(page, '.one-workspace-modebar > button');
      assert(!page.document.body.classList.contains('one-workspace-sidebar-hidden'));
      if (tool.id === 'general') {
        set(page, 'title', '修改後的測試標題');
        set(before, 'title', '修改後的測試標題');
        set(page, 'mode', 'GET', 'change'); set(before, 'mode', 'GET', 'change');
      } else if (tool.id === 'trigger' || tool.id === 'persistent') {
        set(page, 'state', 'DONE', 'change'); set(before, 'state', 'DONE', 'change');
      } else if (tool.id === 'choice') {
        click(page, '#addOption'); click(before, '#addOption');
      } else if (tool.id === 'move') {
        click(page, '#addStation'); click(before, '#addStation');
      } else if (tool.id === 'rating') {
        click(page, '#addRating'); click(before, '#addRating');
      } else if (tool.id === 'settlement') {
        click(page, '#addRow'); click(before, '#addRow');
      } else if (tool.id === 'effect') {
        set(page, 'titleText', '測試效果'); set(before, 'titleText', '測試效果');
      } else if (tool.id === 'dialogue') {
        set(page, 'dialogue', '測試角色對話'); set(before, 'dialogue', '測試角色對話');
      } else if (tool.id === 'challenge') {
        set(page, 'prefix', '準備'); set(before, 'prefix', '準備');
      } else if (tool.id === 'thumbnail-frame') {
        click(page, '[data-corner-content="text"]'); click(before, '[data-corner-content="text"]');
        set(page, 'cornerText', '測試預告'); set(before, 'cornerText', '測試預告');
      } else if (tool.id === 'focus') {
        const native = '.mode-tabs button:nth-child(2)';
        click(page, native); click(before, native);
      }
      await delay(100);
      assert.deepEqual(canvasBytes(page), canvasBytes(before), tool.id + ': artwork differs after edit');
      click(page, '.one-workspace-save-host button');
      click(before, '[data-one-backup-ui] [data-action="save"],#saveHistory');
      await delay(30);
      const history = page.document.querySelector('[data-one-backup-ui] select');
      assert(history && history.options.length, tool.id + ': save history');
      assert.equal(page.window.localStorage.length, before.window.localStorage.length, tool.id + ': unchanged storage keys');
      for (let index = 0; index < page.window.localStorage.length; index++) {
        const key = page.window.localStorage.key(index);
        const actual = JSON.parse(page.window.localStorage.getItem(key));
        const expected = JSON.parse(before.window.localStorage.getItem(key));
        assert(expected, tool.id + ': preserve storage key ' + key);
        const stripTime = value => JSON.parse(JSON.stringify(value, (name, content) => /^(saved_at|savedAt|timestamp|created_at|updated_at)$/.test(name) ? undefined : content));
        assert.deepEqual(stripTime(actual), stripTime(expected), tool.id + ': preserve project snapshot');
      }
      const savedCanvas = canvasBytes(page);
      const savedHistory = Array.from({ length: page.window.localStorage.length }, (_, index) => {
        const key = page.window.localStorage.key(index);
        return [key, page.window.localStorage.getItem(key)];
      });
      if (tool.id === 'focus') {
        click(page, '.mode-tabs button:first-child');
      } else {
        const field = page.document.querySelector(tool.id === 'general' ? '#title' : '.one-workspace-editor input[type="text"],.one-workspace-editor input:not([type]),.one-workspace-editor textarea');
        assert(field, tool.id + ': editable content for restore');
        field.value = '還原測試';
        field.dispatchEvent(new page.window.Event('input', { bubbles: true }));
      }
      await delay(100);
      assert.notDeepEqual(canvasBytes(page), savedCanvas, tool.id + ': unsaved edit must actually change artwork');
      click(page, '.one-workspace-header-actions button[aria-controls="one-workspace-files"]');
      click(page, '#one-workspace-tab-history');
      click(page, '[data-one-backup-ui] [data-action="restore"],#restoreHistory');
      await delay(180);
      assert.deepEqual(canvasBytes(page), savedCanvas, tool.id + ': restore saved artwork');
      for (const [key, value] of savedHistory) {
        assert.equal(page.window.localStorage.getItem(key), value, tool.id + ': restore must not rewrite history');
      }
      click(page, '.one-workspace-dialog-head button');
      const output = page.document.querySelector('.one-workspace-export-button:not(#downloadSet),.export-actions .export-button.primary');
      assert(output, tool.id + ': preview export');
      const exportEnabled = !output.disabled && output.getAttribute('aria-disabled') !== 'true';
      if (exportEnabled) {
        output.click();
        await delay(80);
        assert(page.window.__downloads.some(download => /\.png$/i.test(download.name)), tool.id + ': actual PNG download callback');
      }
      assert.deepEqual(page.errors, before.errors, tool.id + ': errors after edits');
      results.push({ tool: tool.id, status: 'PASS', rendererPixels: 'unchanged', restored: true, pngDownload: exportEnabled, originalControlIds: originalControls.length, baselineErrors: before.errors });
      console.log(JSON.stringify(results[results.length - 1]));
    } finally {
      before.window.close();
      page.window.close();
    }
  }
  console.log('PASS: ' + results.length + ' editors preserve rendering, native controls, editing, save/restore, dialogs and export callbacks.');
})().catch(error => { console.error(error); process.exitCode = 1; });
