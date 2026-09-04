'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'explanation-card.html'),'utf8');
const js=fs.readFileSync(path.join(root,'explanation-card-ui-fold-v1.js'),'utf8');
const css=fs.readFileSync(path.join(root,'explanation-card-ui-fold-v1.css'),'utf8');

assert.doesNotThrow(()=>new Function(js),'UI fold enhancer must parse');
assert(html.includes('explanation-card-ui-fold-v1.css?v=1'),'fold CSS must load');
assert(html.includes('explanation-card-ui-fold-v1.js?v=1'),'fold JS must load');
assert(html.indexOf('explanation-card-v049.js?v=0491')<html.indexOf('explanation-card-ui-fold-v1.js?v=1'),'fold enhancer must run after existing V0.4.9 runtime');
assert(js.includes("details.id='labelSettings'"),'label controls must be wrapped in a native details control');
assert(js.includes("details.open=false"),'new fold controls must start collapsed');
assert(js.includes("details.id='contentTemplatePicker'"),'general templates must keep the canonical picker id after folding');
assert(js.includes("details.id='galleryLayoutPicker'"),'gallery layouts must get a matching fold panel');
assert(js.includes("contentPicker.insertAdjacentElement('afterend',details)"),'gallery layout picker must share the same mode-section placement as general templates');
assert(js.includes("original.classList.add('gallery-layouts-original')"),'old mid-editor layout buttons must be hidden instead of duplicated visually');
assert(js.includes("target.click()"),'gallery proxy buttons must continue to use the existing layout behavior');
assert(js.includes("title.textContent='圖片內容'"),'gallery editor heading must stop duplicating layout selection');
assert(css.includes('.gallery-layouts-original{display:none!important}'),'old layout selector must stay visually hidden');
assert(css.includes('.settings>.label-setting'),'label fold must align with the settings section');
assert(css.includes('.gallery-editor-head small{font-size:10px'),'tiny gallery helper text must be normalized for legibility');

console.log('explanation-card UI fold regression: PASS');
