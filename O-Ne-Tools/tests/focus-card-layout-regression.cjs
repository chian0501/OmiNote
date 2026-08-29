'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'focus-card.html'), 'utf8');
const start = source.indexOf('const FOCUS_TEXT_LIMITS');
const end = source.indexOf('function yv', start);
assert(start >= 0 && end > start, 'focus layout helpers must be present');

const context = {};
vm.runInNewContext(
  'function Zh(value,min,max){return Math.min(max,Math.max(min,value))}' +
  source.slice(start, end) +
  ';this.__focusLayout={' +
    'FOCUS_TEXT_LIMITS,FOCUS_LABEL_METRICS,FOCUS_TYPE_METRICS,FOCUS_CROP_ASPECT,' +
    'focusTextLength,focusEstimatedLineCount,focusTypography,' +
    'focusImageLayout,focusCrop,focusImageDisplayHeight,focusImageDrawRect,focusImageHeight,focusVerticalMetrics,focusImageTop,' +
    'focusRowMetrics,focusAutoHeight' +
  '};',
  context,
  { filename: 'focus-card-layout.js' }
);

const layout = context.__focusLayout;
assert(layout, 'focus layout helpers must evaluate');
assert.strictEqual(layout.FOCUS_LABEL_METRICS.regularHeight, 32);
assert.strictEqual(layout.FOCUS_LABEL_METRICS.titleGap, 24);
assert.strictEqual(layout.FOCUS_TYPE_METRICS.contentLineHeight, 1.45);
assert.strictEqual(layout.FOCUS_CROP_ASPECT, 16 / 9);
assert.strictEqual(
  layout.focusEstimatedLineCount('第一行\n\n第二行', 50),
  3,
  'blank paragraphs must consume a rendered line'
);

const style = { titleSize: 58, contentSize: 37 };
const type = layout.focusTypography(style);
assert.strictEqual(type.titleSize, 58, 'title size must use the manual px value');
assert.strictEqual(type.contentSize, 37, 'content size must use the manual px value');
assert.strictEqual(type.contentLineHeight, 37 * 1.45, 'content line height must stay fixed at 145%');

const legacyType = layout.focusTypography({ textScale: 130 });
assert.strictEqual(legacyType.titleSize, 56, 'legacy JSON title scale must migrate to px');
assert.strictEqual(legacyType.contentSize, 38, 'legacy JSON content scale must migrate to px');

const sample = '01｜飲食味道較明顯\n韓國料理常見泡菜、蒜、蔥等食材，飯後容易留下明顯氣味。\n\n02｜飯後刷牙是日常習慣\n韓國人常在飯後刷牙，保持口腔清新，也方便繼續行程。';
const content = {
  titleEnabled: true,
  title: '外國旅客都在買什麼？',
  divider: true,
  body: sample,
  ctaEnabled: false,
  sourceEnabled: false
};
const label = { enabled: true, text: 'GET!', position: 'above' };
const noImages = {
  placement: 'left',
  scale: 32,
  left: { enabled: false, element: null },
  right: { enabled: false, element: null }
};
const scale = 882 / 1240;
const brokenParagraphHeight = layout.focusAutoHeight('body', content, label, style, noImages, scale);
const flattenedHeight = layout.focusAutoHeight(
  'body',
  { ...content, body: sample.replace(/\n/g, '') },
  label,
  style,
  noImages,
  scale
);
assert(
  brokenParagraphHeight > flattenedHeight + 80,
  'explicit line breaks and blank paragraphs must increase card height'
);

const narrowImage = {
  placement: 'left',
  scale: 18,
  left: { enabled: true, element: { naturalWidth: 800, naturalHeight: 800 } },
  right: { enabled: false, element: null }
};
const largeImage = { ...narrowImage, scale: 45 };
const narrowLayout = layout.focusImageLayout('body', narrowImage);
const largeLayout = layout.focusImageLayout('body', largeImage);
assert(largeLayout.imageWidth > narrowLayout.imageWidth * 2, 'image slider must change the actual image width');
assert(largeLayout.imageWidth >= 0.44 * 1240, 'single image must be allowed to reach the formal-card proportion');

const shortContent = { ...content, body: '短內文' };
const narrowHeight = layout.focusAutoHeight('body', shortContent, label, style, narrowImage, scale);
const largeHeight = layout.focusAutoHeight('body', shortContent, label, style, largeImage, scale);
assert(largeHeight > narrowHeight + 250, 'larger square images must extend the card downward');

const cropAsset = {
  enabled: true,
  element: { naturalWidth: 800, naturalHeight: 800 },
  fit: 'cover',
  zoom: 100,
  offsetX: 0,
  offsetY: 0
};
assert.strictEqual(
  layout.focusImageDisplayHeight(cropAsset, 320),
  180,
  'fill crop must use a stable 16:9 display frame'
);
const centeredCrop = layout.focusImageDrawRect(cropAsset, 0, 0, 320, 180);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(centeredCrop)),
  { x: 0, y: -70, width: 320, height: 320 },
  'square image must cover and center inside the 16:9 crop frame'
);
const bottomCrop = layout.focusImageDrawRect({ ...cropAsset, offsetY: 100 }, 0, 0, 320, 180);
assert.strictEqual(bottomCrop.y, 0, 'positive vertical position must move the image down without exposing empty space');
const zoomedCrop = layout.focusImageDrawRect({ ...cropAsset, zoom: 200 }, 0, 0, 320, 180);
assert.strictEqual(zoomedCrop.width, 640, 'crop zoom must change the actual drawn image size');
const containRect = layout.focusImageDrawRect({ ...cropAsset, fit: 'contain' }, 0, 12, 320, 320);
assert.strictEqual(containRect.y, 12, 'complete display must remain anchored to the title-aligned top');
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(layout.focusCrop({ fit: 'cover', zoom: 999, offsetX: -999, offsetY: 999 }))),
  { fit: 'cover', zoom: 300, offsetX: -100, offsetY: 100 },
  'crop values must be clamped before render and restore'
);

const rows = layout.focusRowMetrics(
  'list',
  ['短句', '這是一段比較長但不應該自動縮小的項目文字，必要時只需要換行'],
  style,
  scale,
  520
);
assert.strictEqual(rows.fontSize, 37, 'all list rows must share the same manual font size');
assert(rows.rows[1].lineCount > rows.rows[0].lineCount, 'long items must wrap instead of shrinking');
assert(Number.isFinite(rows.totalHeight), 'list row height total must be a finite number');

const listContent = {
  ...content,
  items: ['短句', '這是一段比較長但只換行、不縮字的項目文字'],
  itemHighlights: [false, false],
  itemFrameStates: ['focus', 'none']
};
for (const mode of ['list', 'steps']) {
  const height = layout.focusAutoHeight(mode, listContent, label, style, noImages, scale);
  assert(Number.isFinite(height) && height >= 220, `${mode} auto height must remain finite`);
}

const vertical = layout.focusVerticalMetrics('body', content, label, style, scale, false, false, 520);
const labelBottom = vertical.labelY + vertical.labelHeight;
const titleTop = vertical.titleBaseline - vertical.titleFont * 0.8;
assert(Math.abs(titleTop - labelBottom - vertical.labelTitleGap) < 0.001, 'label-to-title gap must be dedicated and stable');
assert(vertical.labelHeight < 43, 'label vertical padding must remain compact');
assert.strictEqual(
  layout.focusImageTop(content, vertical),
  titleTop,
  'image top must align to the rendered title top'
);
assert.notStrictEqual(
  layout.focusImageTop(content, vertical),
  vertical.labelY,
  'image top must not remain aligned to the label'
);

assert(!source.includes('function focusShrinkScale'), 'automatic text shrink helper must be removed');
assert(!source.includes('Ph(s,B.title'), 'title renderer must not auto-shrink');
assert(source.includes('const p=f+focusImageTop(B,ht)'), 'renderer must use the title-aligned image anchor');
assert(source.includes('zl=ul?focusImageTop(j,W)+ul+'), 'auto height must use the same title-aligned image anchor');
assert(!source.includes('const p=f+ht.labelY'), 'renderer must not align the image to the label top');
assert(source.includes('zl&&Kh(s,X.left'), 'renderer must pass the full left image crop state');
assert(source.includes('cl&&Kh(s,X.right'), 'renderer must pass the full right image crop state');
assert(source.includes('max:"45"'), 'image control must allow 45% width');
assert(source.includes('children:"填滿裁切"'), 'image editor must expose fill crop mode');
assert(source.includes('拖曳圖片定位'), 'image editor must expose direct drag positioning');
assert(source.includes('max:"300"'), 'crop zoom control must reach 300%');
assert(source.includes('...focusCrop(fl.left)'), 'manual history must capture left crop settings');
assert(source.includes('...focusCrop(fl.right)'), 'manual history must capture right crop settings');
assert(source.includes('...focusCrop(q),embeddedInPngOnly'), 'JSON export must include non-destructive crop settings');
assert(source.includes('...focusCrop(rl[O]),enabled:!0'), 'reselecting an image after JSON import must keep its crop settings');
assert(source.includes('q.scale??q.scalePercent'), 'legacy and exported JSON image width keys must both restore');
assert(source.includes('不再自動縮字'));
assert(source.includes('放大只向下延伸'));
assert(source.includes('上緣對齊大標題'));
assert(source.includes('V0.5.13_20260829'));

console.log('PASS: title-aligned crop, independent positioning, manual type, fixed rhythm, downward growth, and 45% image scaling work.');
