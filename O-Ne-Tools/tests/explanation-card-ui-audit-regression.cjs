'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'explanation-card.html'),'utf8');
const js=fs.readFileSync(path.join(root,'explanation-card-ui-audit-v1.js'),'utf8');
const css=fs.readFileSync(path.join(root,'explanation-card-ui-audit-v1.css'),'utf8');

assert.doesNotThrow(()=>new Function(js),'UI audit organizer must parse');
assert(html.includes('explanation-card-ui-audit-v1.css?v=1'),'UI audit CSS must load');
assert(html.includes('explanation-card-ui-audit-v1.js?v=1'),'UI audit JS must load');
assert(html.indexOf('explanation-card-format-tools-v1.js?v=2')<html.indexOf('explanation-card-ui-audit-v1.js?v=1'),'UI audit must run after format tools exist');
assert(js.includes("primary.className='toolbar-row toolbar-row-primary'"),'toolbar must have one stable primary row');
assert(js.includes("secondary.className='toolbar-row toolbar-row-secondary'"),'toolbar must have one stable secondary row');
assert(js.includes("sequenceState.hidden=true"),'redundant sequence state pill must be removed from the visible UI');
assert(js.includes("sequenceImageButton.hidden=true"),'duplicate per-step image button must be hidden because the sticky toolbar owns that action');
assert(js.includes("imageSummary.hidden=true"),'duplicate image mode summary must be hidden');
assert(js.includes("modeBadge.hidden=true"),'uninformative selected badge must be hidden');
assert(js.includes("hint.hidden=true"),'duplicate selection hint must be hidden');
assert(css.includes('flex-wrap:nowrap'),'toolbar rows must not randomly wrap');
assert(css.includes('.sequence-image-controls{grid-template-columns:minmax(0,1fr) auto auto}'),'sequence controls must use the reduced stable grid');
assert(css.includes('.sequence-state,.sequence-image-button,.image-summary,.mode-badge{display:none!important}'),'duplicate-control cleanup must also be enforced in CSS');

console.log('PASS explanation-card UI audit regression');
