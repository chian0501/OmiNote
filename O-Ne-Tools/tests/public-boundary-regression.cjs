'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const runtimeFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'tests' || entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(?:html|js|json)$/i.test(entry.name) && !/^dialogue-assets-/.test(entry.name)) runtimeFiles.push(full);
  }
}
walk(root);

const forbidden = [
  /https?:\/\/(?:drive|docs)\.google\.com/i,
  /\b(?:master_psd_id|formal_source_folder|formal_(?:accept|abandon|preview|record|psd)_id|accept_psd_id|abandon_psd_id|reference_expression_folder_id)\b/i,
  /\b(?:folder_id|drive_id|preview_id|record_id|manifest_id|mapping_id|qa_id|psd_id|reference_png_id)\b/i,
  /["']1[A-Za-z0-9_-]{20,}["']/
];

const leaks = [];
for (const file of runtimeFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const approvedDirectMap = path.basename(file) === 'command-center-project-links-direct-v1.js';
  for (const [index, pattern] of forbidden.entries()) {
    if (approvedDirectMap && (index === 0 || index === 3)) continue;
    if (pattern.test(source)) leaks.push(path.relative(root, file) + ' matched ' + pattern);
  }
}
assert.deepStrictEqual(leaks, [], 'public runtime must not expose Drive/Docs identifiers outside the Omi-approved direct-link map');

const registry = JSON.parse(fs.readFileSync(path.join(root, 'one-tools-registry-v1.json'), 'utf8'));
assert.strictEqual(registry.public_boundary, 'semantic_references_only');
for (const tool of registry.tools.filter(item => item.status === 'ready')) {
  const serialized = JSON.stringify(tool);
  assert(!/google\.com|(?:drive|folder|psd|preview|record|manifest|mapping|qa)_id"/.test(serialized), tool.id + ' registry entry must remain public-safe');
}
const pointer = JSON.parse(fs.readFileSync(path.join(root, 'registry.json'), 'utf8'));
assert.strictEqual(pointer.status, 'DEPRECATED');
assert.strictEqual(pointer.canonical_registry, './one-tools-registry-v1.json');

console.log('PASS: public runtime is semantic-only except the tested Omi-approved Command Center direct-link map.');
