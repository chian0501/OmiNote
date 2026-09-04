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

assert(js.includes("TEMPLATES.steps.make=()=>["),'step template must be overridden by the compact one-line variant');
assert(js.includes("block('body',emphasize('先找到入口'),'01',true)"),'step rows must stay separate and keep the 01 marker');
assert(!js.includes("補充要做什麼與辨識點。"),'step defaults must not inject a second explanatory line');
assert(js.includes("TEMPLATES.list.make=()=>["),'list template must use separate body blocks');
assert(js.includes("block('body','第一個真正重要的重點')"),'first list item must be its own block');
assert(js.includes("block('body','第二個觀眾會想知道的資訊')"),'second list item must be its own block');
assert(js.includes("block('body','第三個結論或建議')"),'third list item must be its own block');
assert(js.includes("input.placeholder='標記'"),'generic marker placeholder must not imply every row is a year row');
assert(js.includes(".marker-input:disabled{display:none!important}"),'unused marker input must disappear instead of occupying every row');
assert(js.includes("group.className='toolbar-history'"),'undo and redo must be grouped with the toolbar heading instead of taking a row alone');
assert(js.includes("group.append(undo,redo)"),'undo and redo must move together');
assert(js.includes("heading.insertBefore(group,image)"),'history controls must sit beside the image action in the editor heading');

console.log('explanation-card UI fold regression: PASS');
