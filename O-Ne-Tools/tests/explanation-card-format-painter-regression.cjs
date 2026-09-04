'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'explanation-card.html'),'utf8');
const js=fs.readFileSync(path.join(root,'explanation-card-format-tools-v1.js'),'utf8');
const css=fs.readFileSync(path.join(root,'explanation-card-format-tools-v1.css'),'utf8');

assert.doesNotThrow(()=>new Function(js),'format tools must parse');
assert(html.includes('explanation-card-format-tools-v1.css?v=2'),'static format CSS must load with a cache-safe key');
assert(html.includes('explanation-card-format-tools-v1.js?v=2'),'format tools JS must load with a cache-safe key');
assert(html.indexOf('explanation-card-ui-fold-v1.js?v=3')<html.indexOf('explanation-card-format-tools-v1.js?v=2'),'format tools must load after the fold/runtime compatibility layer');
assert(/styleWithCSS'\s*,\s*false\s*,\s*false/.test(js),'rich text commands must use semantic formatting');
assert(js.includes('normalizeRichStyleKeywords'),'font-weight keyword normalization must exist');
assert(js.includes('font-size-sample'),'visual font-size samples must exist');
assert(js.includes('style="font-size:${size}px"'),'font-size samples must render at the real px size');
assert(js.includes("select.setAttribute('aria-hidden','true')"),'legacy font select must not remain as a duplicate UI control');
assert(js.includes("copy.textContent='複製樣式'"),'copy style button must exist');
assert(js.includes("apply.textContent='套用樣式'"),'apply style button must exist');
assert(js.includes('applyExactCopiedStyle'),'copied style must be applied as one exact style instead of toggle chains');
assert(js.includes("button.classList.toggle('is-format-mixed',partial)"),'partially formatted selections must have a mixed visual state');
assert(js.includes("control.addEventListener('pointerdown',event=>event.preventDefault())"),'format controls must preserve the current text selection');
assert(css.includes('.font-size-menu'),'visual font-size menu styles must be static to avoid a late layout jump');
assert(css.includes('.tool-btn.is-format-mixed'),'mixed format state must be styled');

console.log('PASS explanation-card format painter regression');
