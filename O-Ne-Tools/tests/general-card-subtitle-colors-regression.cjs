'use strict';
const assert = require('assert');
const colors = require('../general-card-subtitle-colors.js');
const text = '總花費｜NT$1,280';
const yellow = [{ start: 4, end: 12, color: '#FFBE37' }];
assert.deepStrictEqual(colors.apply(text, [], 4, 12, '#FFBE37'), yellow);
assert.deepStrictEqual(colors.normalize(text, undefined), []);
assert.deepStrictEqual(colors.normalize(text, JSON.parse(JSON.stringify(yellow))), yellow);
assert.deepStrictEqual(colors.apply(text, yellow, 7, 12, '#FDF3E7'), [{ start: 4, end: 7, color: '#FFBE37' }]);
assert.deepStrictEqual(colors.remap(text, '今日' + text, yellow), [{ start: 6, end: 14, color: '#FFBE37' }]);
assert.deepStrictEqual(colors.remap(text, '總花費｜NT$980', yellow), [{ start: 4, end: 10, color: '#FFBE37' }]);
assert.deepStrictEqual(colors.remap(text, '總花費｜', yellow), []);
assert.deepStrictEqual(colors.remap(text, text, yellow), yellow);
assert.throws(() => colors.normalize(text, [{ start: 0, end: 99, color: '#FFBE37' }]));
assert.throws(() => colors.normalize(text, [{ start: 0, end: 2, color: 'url(javascript:evil)' }]));
assert.throws(() => colors.apply('價😀錢', [], 1, 2, '#FFBE37'));
assert.deepStrictEqual(colors.apply('價😀錢', [], 1, 3, '#FFBE37'), [{ start: 1, end: 3, color: '#FFBE37' }]);
const calls = [], ctx = { canvas: { height: 127 }, fillText: (t,x,y) => calls.push(['text',t,x,y]),
  measureText: t => ({width: t.length * 10}), save: () => {}, restore: () => {}, beginPath: () => {},
  rect: (x,y,w,h) => calls.push(['clip',x,y,w,h]), clip: () => {} };
colors.draw(ctx, text, yellow, 34, 92);
assert.deepStrictEqual(calls, [['text',text,34,92],['clip',74,0,80,127],['text',text,34,92]]);
console.log('PASS: selection, partial reset, legacy data, JSON round-trip, text edits, invalid imports, emoji, shaped canvas line');
