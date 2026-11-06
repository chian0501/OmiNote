'use strict';
/* Card guide: the registry is the one place people and AI decide which card to use. */
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const registry = require(path.join(root, 'one-tools-registry-v1.json'));
const canonical = require(path.join(root, 'card-canonical-v1.js'));
const ready = registry.tools.filter(tool => tool.status === 'ready');
assert.equal(ready.length, 13);

const guide = registry.card_guide;
assert.equal(guide.exchange_schema, 'o-ne.card.canonical.v1');
assert(guide.decision_order.length >= 3, 'decision_order must exist');
for (const item of guide.tie_breaks) {
  assert(item.case && item.rule, 'tie break needs case and rule');
  assert(['approved', 'interim'].includes(item.status), item.case + ' status');
}

const seen = new Set();
for (const tool of ready) {
  assert(tool.tool_id, tool.id + ' needs tool_id');
  assert(!seen.has(tool.tool_id), tool.tool_id + ' duplicated');
  seen.add(tool.tool_id);
  assert(canonical.toolIds.includes(tool.tool_id), tool.tool_id + ' must be a Canonical tool');
  const g = tool.guide;
  assert(g && g.summary, tool.id + ' needs guide.summary');
  for (const key of ['aliases', 'use_when', 'avoid_when', 'modes', 'limits', 'references']) {
    assert(Array.isArray(g[key]), tool.id + ' guide.' + key + ' must be an array');
  }
  assert(g.aliases.length && g.use_when.length, tool.id + ' needs aliases and use_when');
  assert(Array.isArray(g.fields.required) && g.fields.required.length, tool.id + ' needs required fields');
  assert(['component', 'fullcanvas'].includes(g.output.kind) && /^\d+x\d+$/.test(g.output.size), tool.id + ' output');
  assert.equal(typeof g.needs_image, 'boolean');
  for (const ref of g.references) assert(/^https:\/\/youtu\.be\//.test(ref.url), tool.id + ' reference');
}

const general = ready.find(tool => tool.id === 'general').guide.modes;
for (const mode of general) {
  const native = canonical.toNative(canonical.canonical('general-card', { card: { mode: mode.mode }, content: { title: 'A' } }));
  assert.equal(native.component_id === undefined ? null : native.component_id, mode.component_id, mode.mode + ' component_id must match the adapter');
}

// Words people actually use must lead to the right card.
const expected = {
  COST: 'general', 花費: 'general', 地點: 'general', 現在在哪: 'general', 交通: 'move', 食物: 'rating',
  開箱: 'rating', 總結: 'settlement', 歷史: 'explanation', 傳說: 'explanation', 提問: 'focus', 吵架: 'dialogue',
  比較: 'focus', 突發: 'trigger', 任務: 'persistent', 氛圍: 'effect', 要不要: 'challenge', 縮圖: 'thumbnail-frame', 選哪個: 'choice'
};
for (const [word, id] of Object.entries(expected)) {
  const hits = ready.filter(tool => tool.guide.aliases.includes(word)).map(tool => tool.id);
  assert(hits.includes(id), word + ' must lead to ' + id + ', got ' + hits.join(','));
}
for (const word of ['價格', '好吃']) {
  const hits = ready.filter(tool => tool.guide.aliases.concat(tool.desc).join(' ').includes(word));
  assert(hits.length >= 2, word + ' has two valid cards');
}

console.log('PASS: card guide covers 13 tools, modes match the adapter, common words reach the right card.');
