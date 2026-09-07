'use strict';
const assert = require('node:assert/strict');
const seq = require('../focus-card-sequence-v1.js');
const c = { title: '示範', items: ['甲', '乙', '丙', '丁'] };
assert.equal(seq.sequence(c, 'steps').enabled, false);
c.sequence = seq.sequence(c, 'steps'); c.sequence.enabled = true;
const images = { placement: 'grid-left', scale: 45 };
for (let step = 1; step <= 4; step++) {
  c.sequence.step = step;
  assert.deepEqual(seq.KEYS.map(k => seq.stateFor(c, 'steps', images, k).state),
    seq.KEYS.map((k,i) => i < step - 1 ? 'dim' : i === step - 1 ? 'focus' : 'hidden'));
}
assert.equal(seq.sequence(c, 'body').enabled, false);
c.sequence.imageMode = 'all'; c.sequence.step = 2;
assert.deepEqual(seq.KEYS.map(k => seq.stateFor(c, 'steps', images, k).state), ['show','focus','show','show']);
c.sequence.imageMode = 'single';
assert.deepEqual(seq.KEYS.map(k => seq.stateFor(c, 'steps', images, k).state), ['hidden','focus','hidden','hidden']);
c.sequence.frames[1].states[3] = 'focus'; c.sequence.frames[1].effects[3] = 'badge';
const moved = seq.reorder(c, [1,0,2,3], 'steps');
assert.equal(moved.items[0], '乙'); assert.equal(moved.sequence.step, 1);
assert.equal(moved.sequence.frames[0].states[3], 'focus'); assert.equal(moved.sequence.frames[0].effects[3], 'badge');
for (const placement of ['triple-top-left','triple-side-right','grid-left']) {
  const layout = seq.gridLayout('steps', { ...images, placement });
  const boxes = seq.gridBoxes(placement, layout.groupWidth);
  assert.ok(layout.textWidth >= 410);
  boxes.forEach(a => { assert.ok(a.w>0 && a.h>0 && a.x+a.w<=layout.groupWidth+.01);
    boxes.filter(b=>b!==a).forEach(b=>assert.ok(a.x+a.w<=b.x || b.x+b.w<=a.x || a.y+a.h<=b.y || b.y+b.h<=a.y)); });
  assert.equal(seq.gridHeight({placement},layout.groupWidth),Math.max(...boxes.map(b=>b.y+b.h)));
}
const snapshot={mode:'steps',content:{steps:c},label:{},style:{},images};
assert.equal(seq.validate(snapshot),snapshot);
const invalid=structuredClone(snapshot);invalid.content.steps.sequence.step=9;
assert.throws(()=>seq.validate(invalid),/累積幕/);
invalid.content.steps.sequence.step=1;invalid.content.steps.sequence.frames[0].states[0]='invalid';
assert.throws(()=>seq.validate(invalid),/圖片狀態/);
console.log('PASS: sequence visibility, legacy defaults, explicit overrides, frame reordering, nonoverlapping fixed grids and malformed state rejection.');
