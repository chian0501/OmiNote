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
    'FOCUS_TEXT_LIMITS,FOCUS_LABEL_METRICS,FOCUS_TYPE_METRICS,FOCUS_CROP_ASPECT,FOCUS_FREE_CROP_MIN,' +
    'focusTextLength,focusEstimatedLineCount,focusMeasuredLineCount,focusTypography,' +
    'focusImageLayout,focusCrop,focusFreeCropEdit,focusFreeCropAction,focusImageDisplayHeight,focusImageDrawRect,focusImageHeight,focusVerticalMetrics,focusImageTop,' +
    'focusRowMetrics,focusAutoHeight,focusLabelMetrics' +
  '};',
  context,
  { filename: 'focus-card-layout.js' }
);

const layout = context.__focusLayout;
assert(layout, 'focus layout helpers must evaluate');
assert.strictEqual(layout.FOCUS_LABEL_METRICS.regularHeight, 48);
assert.strictEqual(layout.FOCUS_LABEL_METRICS.titleGap, 24);
assert.strictEqual(layout.FOCUS_TYPE_METRICS.contentLineHeight, 1.45);
assert.strictEqual(layout.FOCUS_CROP_ASPECT, 16 / 9);
assert.strictEqual(layout.FOCUS_FREE_CROP_MIN, 12);
assert.strictEqual(
  layout.focusEstimatedLineCount('第一行\n\n第二行', 50),
  3,
  'blank paragraphs must consume a rendered line'
);
assert.strictEqual(
  layout.focusMeasuredLineCount('梅田到 HARUKA｜跟著 5 步走', 713, 56, 6, 800),
  2,
  'mixed CJK, Latin and digits must use measured-width wrapping instead of optimistic character counts'
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

for (const mode of ['stack-left', 'stack-right', 'pair-left', 'pair-right']) {
  const grouped = layout.focusImageLayout('body', { ...largeImage, placement: mode, right: narrowImage.left });
  const textLeft = mode.endsWith('left') ? grouped.innerLeft + grouped.groupWidth + grouped.gap : 86;
  const textRight = mode.endsWith('left') ? 1240 - grouped.innerRight : 1240 - grouped.innerRight - grouped.groupWidth - grouped.gap;
  assert.strictEqual(grouped.textWidth, textRight - textLeft, 'auto-height wrapping must use the actual grouped renderer text width');
}

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
  { fit: 'cover', zoom: 300, offsetX: -100, offsetY: 100, cropX: 0, cropY: 0, cropWidth: 100, cropHeight: 100 },
  'crop values must be clamped before render and restore'
);

const freeCropAsset = {
  enabled: true,
  element: { naturalWidth: 1600, naturalHeight: 900 },
  fit: 'free',
  cropX: 25,
  cropY: 20,
  cropWidth: 50,
  cropHeight: 60
};
assert.strictEqual(
  layout.focusImageDisplayHeight(freeCropAsset, 320),
  216,
  'free crop display height must follow the selected source rectangle ratio'
);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(layout.focusImageDrawRect(freeCropAsset, 0, 12, 320, 216))),
  { x: 0, y: 12, width: 320, height: 216, sourceX: 400, sourceY: 180, sourceWidth: 800, sourceHeight: 540 },
  'free crop render must draw only the selected source rectangle'
);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(layout.focusFreeCropEdit({ fit: 'free' }, 'se', -25, -40))),
  { fit: 'free', zoom: 100, offsetX: 0, offsetY: 0, cropX: 0, cropY: 0, cropWidth: 75, cropHeight: 60 },
  'dragging a corner must resize width and height without locking aspect ratio'
);
const movedFreeCrop = layout.focusFreeCropEdit({ ...freeCropAsset, element: undefined }, 'move', 40, 40);
assert.strictEqual(movedFreeCrop.cropX, 50, 'free crop movement must clamp to the right image edge');
assert.strictEqual(movedFreeCrop.cropY, 40, 'free crop movement must clamp to the bottom image edge');
assert.strictEqual(layout.focusFreeCropAction(freeCropAsset, 25, 20), 'nw', 'corner hit testing must expose resize handles');
assert.strictEqual(layout.focusFreeCropAction(freeCropAsset, 50, 50), 'move', 'crop interior must move the selection');
assert.strictEqual(layout.focusFreeCropAction(freeCropAsset, 2, 2), '', 'outside pointers must not move the crop');

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

const mixedTitleContent = {
  ...content,
  title: '梅田到 HARUKA｜跟著 5 步走',
  items: [
    '01｜梅田站 M16：北側 → 出口 3A',
    '02｜跟著「JR線／大阪駅」走到 JR 大阪站',
    '03｜進 JR 後找「うめきた地下口」',
    '04｜下到 B2 地下月台區',
    '05｜依照現場標示找到 HARUKA 月台'
  ]
};
const mixedTitleLayout = layout.focusImageLayout('steps', largeImage);
const mixedTitleVertical = layout.focusVerticalMetrics('steps', mixedTitleContent, label, style, scale, false, false, mixedTitleLayout.textWidth);
const mixedTitleRows = layout.focusRowMetrics('steps', mixedTitleContent.items, style, scale, mixedTitleLayout.textWidth);
const mixedTitleHeight = layout.focusAutoHeight('steps', mixedTitleContent, label, style, largeImage, scale);
assert(mixedTitleVertical.titleLines >= 2, 'user example title must reserve both rendered lines');
assert(
  mixedTitleHeight >= mixedTitleVertical.contentTop + mixedTitleRows.totalHeight,
  'mixed-language title and all five rows must remain inside the auto-height border'
);

const vertical = layout.focusVerticalMetrics('body', content, label, style, scale, false, false, 520);
const labelBottom = vertical.labelY + vertical.labelHeight;
const titleTop = vertical.titleBaseline - vertical.titleFont * 0.8;
assert(Math.abs(titleTop - labelBottom - vertical.labelTitleGap) < 0.001, 'label-to-title gap must be dedicated and stable');
assert.strictEqual(vertical.labelHeight, 48, 'label uses the explanation card native capsule height');
const longLabel = { ...label, position: 'before', text: 'MISSION CLEAR' };
const longBefore = layout.focusVerticalMetrics('body', content, longLabel, style, scale, false, false, 520);
const availableTitleWidth = 520 - layout.focusLabelMetrics(longLabel).width - longBefore.gap;
assert.strictEqual(longBefore.titleLines, layout.focusMeasuredLineCount(content.title, availableTitleWidth, style.titleSize, 6, 800), 'label-before mode must reserve the actual capsule width when measuring the title');
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
assert(/const p(?:2)?=f\+focusImageTop\(B,ht\)/.test(source), 'renderer must use the title-aligned image anchor');
assert(source.includes('zl=ul?focusImageTop(j,W)+ul+'), 'auto height must use the same title-aligned image anchor');
assert(!source.includes('const p=f+ht.labelY'), 'renderer must not align the image to the label top');
assert(source.includes('Kh(s,X.left'), 'renderer must pass the full left image crop state');
assert(source.includes('Kh(s,X.right'), 'renderer must pass the full right image crop state');
assert(source.includes('max:"45"'), 'image control must allow 45% width');
const cropEditor = fs.readFileSync(path.join(root, 'card-image-editor-v1.js'), 'utf8');
assert(cropEditor.includes('>16:9<'), 'shared editor keeps fixed aspect crop');
assert(cropEditor.includes('自由裁切'), 'shared editor exposes free crop');
assert(cropEditor.includes('拖曳選取框與邊角'), 'crop editor explains direct manipulation');
assert(cropEditor.includes("'pointermove'"), 'crop editor handles drag movement');
assert(source.includes('ONECardImageEditor.open'), 'focus card opens the shared crop editor');
assert(source.includes('...focusCrop(fl.left)'), 'manual history must capture left crop settings');
assert(source.includes('...focusCrop(fl.right)'), 'manual history must capture right crop settings');
assert(source.includes('...focusCrop(q),embeddedInPngOnly'), 'JSON export must include non-destructive crop settings');
assert(source.includes('...focusCrop(rl[O]),enabled:true'), 'reselecting an image after JSON import must keep its crop settings');
assert(source.includes('q.scale??q.scalePercent'), 'legacy and exported JSON image width keys must both restore');
assert(source.includes('不再自動縮字'));
assert(source.includes('放大只向下延伸'));
assert(source.includes('上緣對齊大標題'));
assert(source.includes('canvas-measured-content-driven'));
assert(source.includes('.app-shell:has(.canvas-stage.is-component)'));
assert(source.includes('V0.5.15_20260829'));

console.log('PASS: measured mixed-language wrapping, title-aligned fixed/free crop, manual type, fixed rhythm, downward growth, and 45% image scaling work.');
