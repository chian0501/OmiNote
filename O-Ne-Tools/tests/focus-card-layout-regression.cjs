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
  ';this.__focusLayout={FOCUS_TEXT_LIMITS,FOCUS_LABEL_METRICS,focusTextLength,focusShrinkScale,focusEstimatedLineCount,focusVerticalMetrics,focusAutoHeight};',
  context,
  { filename: 'focus-card-layout.js' }
);

const layout = context.__focusLayout;
assert(layout, 'focus layout helpers must evaluate');
assert.strictEqual(layout.FOCUS_LABEL_METRICS.compactHeight, 26);
assert.strictEqual(layout.FOCUS_LABEL_METRICS.regularHeight, 32);
assert.strictEqual(layout.FOCUS_LABEL_METRICS.titleGap, 20);
assert.strictEqual(layout.focusEstimatedLineCount('第一行\n\n第二行', 50), 3, 'blank paragraphs must consume a rendered line');

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
const style = { textScale: 130 };
const imageSettings = {
  left: { enabled: true, element: {} },
  right: { enabled: false, element: null }
};
const scale = 882 / 1240;
const brokenParagraphHeight = layout.focusAutoHeight('body', content, label, style, imageSettings, scale);
const flattenedHeight = layout.focusAutoHeight(
  'body',
  { ...content, body: sample.replace(/\n/g, '') },
  label,
  style,
  imageSettings,
  scale
);
assert(
  brokenParagraphHeight > flattenedHeight + 80,
  'explicit line breaks and blank paragraphs must increase card height'
);

const textScale = 1.3;
const shrink = layout.focusShrinkScale(sample, layout.FOCUS_TEXT_LIMITS.body, 0.78);
const scaledText = textScale * shrink;
const charsPerLine = Math.max(14, Math.floor(38 * 0.72 / scaledText));
const expectedLines = layout.focusEstimatedLineCount(sample, charsPerLine);
const vertical = layout.focusVerticalMetrics('body', content, label, style, scale, false, false);
const fontSize = 29 * scaledText;
const lineHeight = 44 * scaledText;
const footerPadding = Math.min(26, Math.max(11, 13 / scale));
const firstBaseline = vertical.contentTop + fontSize * 0.8;
const renderableLines = Math.max(1, Math.floor((brokenParagraphHeight - footerPadding - firstBaseline) / lineHeight) + 1);
assert(renderableLines >= expectedLines, 'calculated card height must provide enough renderable lines');
assert(expectedLines > 5, 'fixture must exercise multi-paragraph wrapping');

const labelBottom = vertical.labelY + vertical.labelHeight;
const titleTop = vertical.titleBaseline - vertical.titleFont * 0.8;
const actualTitleGap = titleTop - labelBottom;
assert(Math.abs(actualTitleGap - vertical.labelTitleGap) < 0.001, 'title must use the dedicated label gap');
assert(actualTitleGap >= 20, 'label-to-title gap must be visibly wider than the former 12px gap');
assert(vertical.labelHeight < 43, 'regular label height must use the reduced vertical padding');

assert(!source.includes('Math.min(8,Math.floor((Xl-bodyBaseline)/Gl)+1)'), 'renderer must not cap body text at eight lines');
assert(source.includes('高度依換行、空白段落與內容自動加高，不再於外框直接截斷'));
assert(source.includes('V0.5.8_20260827'));

console.log('PASS: focus card grows for real line breaks and keeps the revised label spacing.');
