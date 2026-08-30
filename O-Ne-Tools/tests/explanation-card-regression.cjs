'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'explanation-card.html'), 'utf8');
const scriptMatch = source.match(/<script>\s*\(function\(\)\{([\s\S]*?)function drawImage/);
assert(scriptMatch, 'explanation layout helpers must be present');

const measureContext = {
  font: '',
  measureText(text) {
    const size = Number((this.font.match(/(\d+(?:\.\d+)?)px/) || [0, 31])[1]);
    const width = Array.from(String(text)).reduce((sum, ch) => {
      if (ch === ' ') return sum + size * 0.32;
      if (/[\u3400-\u9fff\u3000-\u303f\uff00-\uffef]/.test(ch)) return sum + size;
      if (/[A-Z]/.test(ch)) return sum + size * 0.72;
      if (/[a-z0-9]/.test(ch)) return sum + size * 0.58;
      return sum + size * 0.52;
    }, 0);
    return { width };
  }
};
const fakeCanvas = { getContext() { return measureContext; } };
const context = {
  document: { getElementById() { return fakeCanvas; } },
  JSON,
  Math,
  Array,
  String
};
vm.runInNewContext(
  scriptMatch[1] + ';this.__test={CARD_WIDTH,MIN_HEIGHT,defaults,cleanState,wrapText,layoutCard,setState(value){state=value}};',
  context,
  { filename: 'explanation-card-layout.js' }
);

const api = context.__test;
assert(api, 'explanation card helpers must evaluate');
assert.strictEqual(api.CARD_WIDTH, 1552);
assert.strictEqual(api.MIN_HEIGHT, 724);
assert.strictEqual(api.wrapText(measureContext, '梅田到 HARUKA｜跟著 5 步走', 360).length >= 2, true, 'mixed title must wrap by measured width');

const normal = api.cleanState(api.defaults);
api.setState(normal);
const normalLayout = api.layoutCard(measureContext);
assert.strictEqual(normalLayout.height, 724, 'short official example should retain the formal minimum height');

const long = api.cleanState({
  ...normal,
  title: '梅田到 HARUKA｜跟著 5 步走：第一次搭乘也不迷路的完整說明',
  rows: Array.from({ length: 8 }, (_, index) => ({
    key: '重點 ' + String(index + 1).padStart(2, '0'),
    text: '這是一段會依照實際字寬換行的長說明內容，卡片外框、左側圖片與預覽區都必須只向下延伸，不能裁掉最後一行。'
  }))
});
api.setState(long);
const longLayout = api.layoutCard(measureContext);
assert(longLayout.height > normalLayout.height + 700, 'eight long rows must materially increase card height');
const last = longLayout.rowLayouts.at(-1);
assert(last.y + last.height + 32 <= longLayout.height, 'last explanation row must remain inside the lower border');
assert.strictEqual(longLayout.imageH, longLayout.height - 60, 'left image panel must grow from its fixed top only toward the bottom');

assert(source.includes("id:'explanation-card'"), 'manual history must use an independent tool id');
assert(source.includes("saveMode:'manual'"), 'history must only save when the user presses the save button');
assert(source.includes("schema:'o-ne.explanation-card.ready.v0.1.1'"), 'JSON must use the separate explanation-card schema');
assert(source.includes("height_mode:'canvas-measured-auto'"), 'JSON must disclose measured automatic height');
assert(source.includes("['contain','cover','free']"), 'image settings must support complete, fill and free crop modes');
assert(source.includes('next.rows=next.rows.slice(0,MAX_ROWS)'), 'row count must stay bounded at eight');
assert(source.includes('preview-canvas{display:block;width:94%;max-width:100%;height:auto}'), 'preview canvas must keep its natural auto height');
assert(!source.includes('focus-card'), 'separate explanation tool must not reuse the focus-card storage or schema id');

const scripts = [...source.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)];
for (const match of scripts) {
  if (/\bsrc\s*=/.test(match[1])) continue;
  assert.doesNotThrow(() => new Function(match[2]), 'inline script must parse');
}

console.log('PASS: independent official explanation card uses measured downward autoheight, manual history, JSON and three image-fit modes.');
