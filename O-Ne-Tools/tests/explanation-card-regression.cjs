'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'explanation-card.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'explanation-card-v039.css'), 'utf8');
const parts = [1, 2, 3, 4, 5].map(number =>
  fs.readFileSync(path.join(root, `explanation-card-v039-${number}.js`), 'utf8')
);

for (const [index, source] of parts.entries()) {
  assert.doesNotThrow(() => new Function(source), `V0.3.9 script part ${index + 1} must parse`);
}
assert(html.includes('V0.3.9 CANDIDATE'), 'page must identify the V0.3.9 candidate bundle');
assert(html.includes('edit-backup-v1.js?v=1217'), 'page must load the cache-busted project and AI guide bridge');
for (let number = 1; number <= 5; number += 1) {
  assert(html.includes(`explanation-card-v039-${number}.js?v=039`), `page must load V0.3.9 part ${number}`);
}
assert(html.includes('explanation-card-v039.css?v=039'), 'page must load the cache-busted V0.3.9 stylesheet');
assert(css.includes('.template-btn.is-special'), 'special layout selector must be visually distinct');
assert(css.includes('body[data-explanation-layout="image-below"]'), 'editor must expose the image-below mode');

class FakeElement {
  constructor(tagName = 'DIV') {
    this.tagName = tagName.toUpperCase();
    this.nodeType = 1;
    this.childNodes = [];
    this.children = [];
    this.style = {};
    this.attributes = [];
    this.classList = { toggle() {}, add() {}, remove() {} };
    this.dataset = {};
  }
  set innerHTML(value) {
    this._innerHTML = String(value || '');
    const text = this._innerHTML
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    this.childNodes = [{ nodeType: 3, nodeValue: text }];
  }
  get innerHTML() { return this._innerHTML || ''; }
  removeAttribute() {}
  getContext() { return measureContext; }
}

const measureContext = {
  font: '',
  measureText(text) {
    const size = Number((this.font.match(/(\d+(?:\.\d+)?)px/) || [0, 29])[1]);
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

const fakeCanvas = new FakeElement('canvas');
const document = {
  createElement(tag) { return new FakeElement(tag); },
  getElementById(id) { return /Canvas$/.test(id) ? fakeCanvas : new FakeElement(); }
};
const context = { document, window: {}, console, JSON, Math, Array, String, Date };
vm.createContext(context);
vm.runInContext(
  `${parts[0]}\n${parts[2]}\nthis.__test={CARD_WIDTH,MIN_HEIGHT,TEMPLATES,defaults,clone,cleanState,layoutCard,setState(value){state=value},setImage(value){imageElement=value}};`,
  context,
  { filename: 'explanation-card-v039-layout.js' }
);

const api = context.__test;
assert(api, 'layout test API must evaluate');
assert.strictEqual(api.CARD_WIDTH, 1552);
assert.strictEqual(api.MIN_HEIGHT, 724);
assert.strictEqual(Object.keys(api.TEMPLATES).length, 7, 'six existing layouts plus one special layout must be available');
assert.strictEqual(api.TEMPLATES.imageTitle.layoutMode, 'image-below');

api.setImage(null);
api.setState(api.clone(api.defaults));
const normal = api.layoutCard(measureContext);
assert.strictEqual(normal.layoutMode, 'side-by-side');
assert.strictEqual(normal.imageX, 26);
assert.strictEqual(normal.imageW, 655, 'existing left-image geometry must stay unchanged');
assert.strictEqual(normal.textX, 724, 'existing text column must stay unchanged');
assert.strictEqual(normal.height, 724, 'short existing layouts must retain the formal minimum height');

const specialState = api.clone(api.defaults);
specialState.templateId = 'imageTitle';
specialState.layoutMode = 'image-below';
specialState.blocks = api.TEMPLATES.imageTitle.make();
specialState.note = { enabled: true, text: '特殊版型不可輸出提醒框', size: 24, color: '#29A6A7' };
api.setState(specialState);
const special = api.layoutCard(measureContext);
assert.strictEqual(special.layoutMode, 'image-below');
assert.strictEqual(special.imageX, 26);
assert.strictEqual(special.imageW, 1500, 'lower image must span the full inner card width');
assert(special.imageY > special.titleY + special.titleLayout.height, 'lower image must begin after the title');
assert.strictEqual(special.rows.length, 0, 'special layout must not render body rows');
assert.strictEqual(special.noteY, null, 'special layout must not render the note box');
assert.strictEqual(special.height, Math.ceil(special.imageY + special.imageH + 28), 'special layout must grow only from the bottom');
assert.strictEqual(special.imageH, Math.ceil(special.imageW * 9 / 16), 'cover mode must use a stable 16:9 lower image');

api.setImage({ naturalWidth: 1200, naturalHeight: 900 });
specialState.image.fit = 'contain';
api.setState(specialState);
const fourThree = api.layoutCard(measureContext);
assert.strictEqual(fourThree.imageH, 1125, 'complete image mode must use the source ratio at full width');
assert.strictEqual(fourThree.height, Math.ceil(fourThree.imageY + 1125 + 28), 'source ratio must extend the bottom edge');

specialState.image.fit = 'free';
specialState.image.cropWidth = 80;
specialState.image.cropHeight = 40;
api.setState(specialState);
const freeCrop = api.layoutCard(measureContext);
assert.strictEqual(freeCrop.imageH, 563, 'free crop ratio must control the lower image height');
assert.strictEqual(freeCrop.height, Math.ceil(freeCrop.imageY + freeCrop.imageH + 28));

const restored = api.cleanState({ ...specialState, templateId: 'custom' });
assert.strictEqual(restored.layoutMode, 'image-below', 'JSON, project and history restoration must retain the special layout');
const legacy = api.cleanState({ ...api.defaults, templateId: 'imageTitle', layoutMode: undefined, blocks: api.TEMPLATES.imageTitle.make() });
assert.strictEqual(legacy.layoutMode, 'image-below', 'imageTitle snapshots without an explicit mode must migrate safely');

const exportSource = parts[3];
assert(exportSource.includes("schema:'o-ne.explanation-card.candidate.v0.3.9'"), 'JSON must use the V0.3.9 candidate schema');
assert(exportSource.includes("status:'CANDIDATE'"), 'JSON and project files must remain candidate until Omi approves deployment');
assert(exportSource.includes("layout_modes:['side-by-side','image-below']"), 'JSON metadata must disclose both layout modes');
assert(exportSource.includes("state.layoutMode==='image-below'?'滿版圖':'RichText'"), 'filenames must distinguish the special layout state');
assert(exportSource.includes('V0.3.9_20260831'), 'project and JSON metadata must use V0.3.9');
assert(parts[4].includes("getStatus:s=>s&&s.layoutMode==='image-below'?'滿版圖':'RichText'"), 'shared project filenames must retain the layout state');
assert(parts[4].includes('fromJSON:fromJSON'), 'shared manual history must retain legacy JSON import mapping');
assert(parts[1].includes("state.templateId='custom'"), 'editing the title may become custom without changing layoutMode');
assert(exportSource.includes("state.layoutMode==='image-below'?'imageTitle':'standard'"), 'reset must preserve the special layout after title edits');
assert(exportSource.includes('imageElement=null;imageDataUrl=null;imageMimeType=null'), 'removing an image must clear the embedded project payload too');
assert(!parts.join('\n').includes('focus-card'), 'separate explanation tool must not reuse focus-card state');

console.log('PASS: Explanation Card V0.3.9 keeps existing layouts and adds a persisted title + full-width lower-image layout with downward autoheight.');
