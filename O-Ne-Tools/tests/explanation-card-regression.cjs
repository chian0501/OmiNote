'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'explanation-card.html'), 'utf8');
const baseFiles = [1, 2, 3, 4, 5].map(number => `explanation-card-v038-${number}.js`);
const scriptFiles = [...baseFiles, 'explanation-card-v040.js'];
const sources = Object.fromEntries(scriptFiles.map(file => [file, fs.readFileSync(path.join(root, file), 'utf8')]));
const combined = Object.values(sources).join('\n');
const gallerySource = sources['explanation-card-v040.js'];

for (const [file, source] of Object.entries(sources)) {
  assert.doesNotThrow(() => new Function(source), `${file} must parse`);
}

assert(html.includes('<title>O-Ne 說明卡生成器 V0.4.5 READY</title>'), 'ready version must be visible');
assert(html.includes('edit-backup-v1.js?v=1310'), 'shared manual backup library must load');
assert(html.includes('explanation-card-v040.css?v=0451'), 'gallery CSS must load with the legibility cache key');
assert(html.includes('explanation-card-v040.js?v=0454'), 'gallery runtime must load with the READY cache key');
const editorScrollStart = html.indexOf('<div class="editor-scroll" id="editorScroll">');
const editorScrollEnd = html.indexOf('</div></aside>', editorScrollStart);
const saveDockIndex = html.indexOf('<section class="save-dock">');
assert(editorScrollStart >= 0 && editorScrollEnd > editorScrollStart, 'editor scroll region must exist');
assert(saveDockIndex > html.indexOf('<section class="word-page-wrap">') && saveDockIndex < editorScrollEnd, 'save tools must live at the bottom of the editor scroll region');
assert(html.includes('<span class="save-badge">最後一步</span>'), 'save tools must be presented as the last step');
assert(html.includes('data-card-mode="content"') && html.includes('data-card-mode="gallery"'), 'content and gallery must be separate mode choices');
assert(html.includes('<div class="template-presets" id="contentTemplatePicker"'), 'content templates must be visible without opening a details control');
assert(html.includes('一般說明｜套用設計範本') && html.includes('更換範本會重設文字內容'), 'the original content template picker must explain its action and reset effect');
assert(!html.includes('<details class="template-presets"'), 'content templates must not be hidden in a collapsed control');
assert(html.includes('<summary><span>進階設定</span><small>提醒框與提示樣式</small></summary>'), 'advanced content settings must have an explicit readable purpose');
assert(html.includes('<details class="legacy-save-tools">'), 'legacy project formats and reset must be collapsed');

assert(combined.includes('const CARD_WIDTH=1552,MIN_HEIGHT=724'), 'formal explanation card dimensions must remain available');
assert(combined.includes("['contain','cover','free']"), 'content mode must preserve complete, fill and free crop modes');
assert(combined.includes("saveMode:'manual'"), 'history must remain manual');
assert(combined.includes("schema:'o-ne.explanation-card.project.v1'"), 'portable project schema must remain compatible');
assert(!combined.includes('focus-card'), 'explanation tool must remain independent from focus-card');

for (const id of ['single', 'split', 'triple', 'hero-right', 'hero-bottom', 'grid']) {
  const token = id.includes('-') ? `'${id}':{label:` : `${id}:{label:`;
  assert(gallerySource.includes(token), `gallery layout ${id} must exist`);
}
assert(gallerySource.includes("label:'純圖片字卡'"), 'mode picker must expose the image-only card');
assert(gallerySource.includes("modes:['content','gallery']"), 'JSON must declare both explanation modes');
assert(gallerySource.includes('gallery_images_max:4'), 'gallery must stay bounded at four images');
assert(gallerySource.includes('gallery_per_image_free_crop:true'), 'JSON metadata must declare independent free crop');
assert(gallerySource.includes('gallery_free_crop_unlocked_aspect:true'), 'JSON metadata must declare unlocked crop aspect');
assert(gallerySource.includes('payload.assets.gallery=galleryAssets.map(galleryAssetPayload)'), 'project file must embed gallery assets');
assert(gallerySource.includes("schema:'o-ne.explanation-card.formal.v0.4.5'"), 'formal JSON schema must be versioned');
assert(gallerySource.includes("status:'READY'"), 'formal JSON must be marked ready');
assert(gallerySource.includes("context.fillStyle='rgba(31,23,19,.80)'"), 'gallery card body must keep the formal 80% fill opacity');
assert(gallerySource.includes('gallery_full_bleed_below_header:true'), 'JSON metadata must declare the full-bleed image body');
assert(gallerySource.includes('gallery_inner_frame:false'), 'JSON metadata must declare that the inner gallery frame is removed');
assert(gallerySource.includes('gallery_continuous_coffee_background:true'), 'JSON metadata must declare the continuous coffee card background');
assert(gallerySource.includes('missingGallerySlots()'), 'PNG export must reject missing active images');
assert(gallerySource.includes("fit:['contain','cover','free'].includes(item.fit)"), 'each gallery image must support true free crop mode');
assert(gallerySource.includes('data-gallery-crop-canvas'), 'free crop must expose a draggable crop canvas per image');
assert(gallerySource.includes('galleryCropDrags[index]'), 'crop interactions must stay independent per image');

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert(start >= 0, `${name} must exist`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let index = brace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`unable to extract ${name}`);
}

const layoutContext = {};
vm.runInNewContext(`${extractFunction(gallerySource, 'galleryRects')};this.galleryRects=galleryRects;`, layoutContext);
const expectedCounts = { single: 1, split: 2, triple: 3, 'hero-right': 3, 'hero-bottom': 3, grid: 4 };
for (const [layout, count] of Object.entries(expectedCounts)) {
  const rects = layoutContext.galleryRects(layout, 28, 150, 1496, 650, 16);
  assert.strictEqual(rects.length, count, `${layout} image count`);
  for (const rect of rects) {
    assert(rect.w > 0 && rect.h > 0, `${layout} rectangles must have positive area`);
    assert(rect.x >= 28 && rect.y >= 150, `${layout} rectangles must stay inside the gallery origin`);
    assert(rect.x + rect.w <= 1524.001, `${layout} rectangles must stay inside the gallery width`);
    assert(rect.y + rect.h <= 800.001, `${layout} rectangles must stay inside the gallery height`);
  }
}

const galleryLayoutContext = {
  CARD_WIDTH: 1552,
  state: {
    label: { text: 'GET!' },
    blocks: [{ kind: 'title', html: '測試標題' }],
    gallery: { layout: 'triple', height: 650, gap: 16 }
  },
  block() { return { kind: 'title', html: '' }; },
  htmlToParagraphs() { return []; },
  layoutRich() { return { height: 68 }; },
  galleryRects(layout, x, y, w, h) { return [{ x, y, w, h }]; }
};
vm.runInNewContext(`${extractFunction(gallerySource, 'layoutGalleryCard')};this.layoutGalleryCard=layoutGalleryCard;`, galleryLayoutContext);
const galleryLayout = galleryLayoutContext.layoutGalleryCard({ measureText() { return { width: 72 }; } });
assert.strictEqual(galleryLayout.labelY + galleryLayout.labelH / 2, galleryLayout.titleY + galleryLayout.titleLayout.height / 2, 'label and title must share one vertical center');
assert.strictEqual(galleryLayout.height - (galleryLayout.galleryY + galleryLayout.galleryH), 3, 'gallery image area must meet the bottom border without a black band');
assert.strictEqual(galleryLayout.galleryX, 3, 'gallery image body must start at the outer card border');
assert.strictEqual(galleryLayout.galleryW, 1546, 'gallery image body must span the full card width inside the outer stroke');
assert.strictEqual(galleryLayout.galleryY - galleryLayout.dividerY, 3, 'gallery image body must meet the header divider without an inner top frame');
assert(!gallerySource.includes('Math.ceil(dividerY+3)'), 'gallery top edge must not gain a fractional browser seam');

const renderGallerySource = extractFunction(gallerySource, 'renderGalleryCanvas');
assert(renderGallerySource.lastIndexOf('cutCornerPath(context,3,3') > renderGallerySource.indexOf('layout.rects.forEach'), 'outer border must be redrawn over the flush image edge');
const drawGallerySlotSource = extractFunction(gallerySource, 'drawGallerySlot');
assert(!drawGallerySlotSource.includes('roundRect(rect.x'), 'gallery slots must not add an inner rounded frame');
assert(!drawGallerySlotSource.includes('strokeRect(rect.x'), 'gallery slots must not draw a second border');
assert(!drawGallerySlotSource.includes("fillStyle='#151a18'"), 'gallery slots must not replace the 80% coffee card background');
assert(!drawGallerySlotSource.includes('fillRect(rect.x'), 'transparent image pixels must reveal the continuous coffee card background');

const cropContext = { clamp(value, min, max) { return Math.min(max, Math.max(min, Number(value) || 0)); } };
vm.runInNewContext(`${extractFunction(gallerySource, 'galleryCropSource')};this.galleryCropSource=galleryCropSource;`, cropContext);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(cropContext.galleryCropSource({ cropX: 10, cropY: 12, cropWidth: 64, cropHeight: 70 }, 1600, 900))),
  { sx: 160, sy: 108, sw: 1024, sh: 630 },
  'free crop percentages must map to the selected source pixels'
);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(cropContext.galleryCropSource({ cropX: 99, cropY: -5, cropWidth: 20, cropHeight: 120 }, 1000, 500))),
  { sx: 800, sy: 0, sw: 200, sh: 500 },
  'free crop source must clamp legacy or malformed values inside the image'
);
vm.runInNewContext(`${extractFunction(gallerySource, 'galleryCropAfterDrag')};this.galleryCropAfterDrag=galleryCropAfterDrag;`, cropContext);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(cropContext.galleryCropAfterDrag('move', { x: 10, y: 15, w: 60, h: 50 }, 50, -40))),
  { x: 40, y: 0, w: 60, h: 50 },
  'moving one crop box must stay within its own image bounds'
);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(cropContext.galleryCropAfterDrag('nw', { x: 20, y: 20, w: 60, h: 60 }, 15, 10))),
  { x: 35, y: 30, w: 45, h: 50 },
  'north-west crop handle must independently resize width and height'
);

const css = fs.readFileSync(path.join(root, 'explanation-card-v040.css'), 'utf8');
assert(css.includes('.gallery-layouts'), 'gallery layout picker must be styled');
assert(css.includes('.gallery-slots'), 'gallery image slots must be styled');
assert(css.includes('.layout-mini.triple'), 'three-across layout preview must be styled');
assert(css.includes('.gallery-free-crop canvas'), 'per-image crop canvas must be styled');
assert(css.includes('.gallery-mode .image-trigger'), 'left-image control must be hidden in gallery mode');
assert(css.includes('.gallery-mode .word-page{min-height:0'), 'gallery title editor must stay compact');
assert(css.includes('.mode-buttons'), 'mode picker must be styled as the primary entry');
assert(css.includes('.template-presets-head'), 'visible content template guidance must be styled');
assert(css.includes('.template-presets-head strong{color:#f3f0ea;font-size:14px}'), 'template heading must remain readable');
assert(css.includes('.template-presets .template-btn{min-height:44px;padding:0 10px;font-size:12px}'), 'template choices must remain readable and easy to click');
assert(css.includes('#contentCardSettings>summary>span{font-size:13px'), 'advanced settings heading must remain readable');
assert(css.includes('.gallery-slot-adjust'), 'per-image adjustment controls must be collapsible');
assert(css.includes('.save-tool-details'), 'batch output must be collapsible');
assert(css.includes('.editor-scroll>.save-dock{margin:4px 16px 18px'), 'bottom save tools must be styled as the last editor card');
assert(!css.includes('.gallery-mode .save-dock{max-height:'), 'save tools must no longer reserve a fixed block above the editor');

console.log('PASS: explanation-card V0.4.5 READY keeps templates readable and continues the 80% coffee background through the full-bleed gallery.');
