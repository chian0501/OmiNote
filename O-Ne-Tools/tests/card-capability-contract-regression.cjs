'use strict';
/**
 * O-Ne Tools: native capability / asset compatibility contract.
 * This is a STRUCTURAL gate, not a substitute for Chromium functional,
 * PNG pixel, old-project restore or visual QA.
 * Approved main at UI workbench branching is the immutable baseline.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');

const nativeHtmlSha = {
  'general-card.html': '2bbbb0a01ff8fd539c58d68685179da7117d6573',
  'trigger-card.html': '73ef1835da438835004e4b120883e08dbd2f6eac',
  'persistent-card.html': '84de408b6d213aea6705febd05c6add12d287e1f',
  'effect-card.html': '942480609f1917e734d9102f0e40d5cdb541ffd5',
  'move-card.html': 'f00e9b339484c4618e2373e0ca9b852621b75995',
  'choice-card.html': '31e29c279cf9e9237f5c4a8a910d28e4aadbe201',
  'challenge-card.html': '5d7800cc29c713ec3b3f2cbb3d8204a189363701',
  'dialogue-card-v135.html': 'e807d1d108d0f8f411c524481ebf86ae4c1e91f2',
  'rating-card.html': '17395bbbb1972a69bce48618fa42a8e26c739a42',
  'focus-card.html': '67991457ceb1bed32a14dfe6a8339b1f78599c2e',
  'thumbnail-frame.html': '0c1eade7b977968df5034894349df0ed0f430d7a',
  'settlement-card.html': '50c32332debb41e2e934926302f2cb265ee3c27f'
};
const required = [
  ['一般卡','general-card.html',['id="mode"','id="subtitleColor"','applySubtitleColor','clearSubtitleColors','id="customLabel"']],
  ['觸發卡','trigger-card.html',['id="state"','id="progress"','drawSuccessIcon','drawFailIcon']],
  ['常駐卡','persistent-card.html',['id="taskSize"','id="progressSize"','id="saveHistory"','id="restoreHistory"','id="loadJson"']],
  ['效果卡','effect-card.html',['id="stateText"','id="atmosphereSelect"','id="decorSelect"','drawAtmosphere','id="decorDensity"']],
  ['移動卡','move-card.html',['id="downloadWhite"','id="downloadOrange"','id="downloadBoth"','stations.length<8','stations.length>2']],
  ['選項卡','choice-card.html',['id="addOption"','id="allDim"','id="allBright"','id="downloadSet"','options.length>20']],
  ['挑戰卡','challenge-card.html',['id="prefix"','id="emphasis"','id="suffix"','id="yesText"','id="noText"','id="modeSeg"','id="selectSeg"','BLOCKED']],
  ['對話卡','dialogue-card-v135.html',['id="leftCharacter"','id="rightCharacter"','id="leftExpression"','id="rightExpression"','id="swap"','const EXPRESSIONS=','REQUIRED_ASSET_COUNT']],
  ['評分卡','rating-card.html',['id="addRating"','id="leftProductVisible"','id="rightProductVisible"','id="cropLeftProduct"','id="cropRightProduct"','id="reviewText"','id="priceText"','最多 8 項']],
  ['焦點卡','focus-card.html',['一般內文','步驟','項目','focus-card-sequence-v1.js','card-image-editor-v1.js']],
  ['焦點序列','focus-card-sequence-v1.js',["const KEYS = ['left', 'right', 'third', 'fourth']",'exportFrames','exportPackage','stack-left','grid-right']],
  ['說明卡','explanation-card-portable-v049.html',['id="contentMode"','id="galleryMode"','MAX_GALLERY_IMAGES=10','const GALLERY_LAYOUTS=','id="galleryAddImage"','id="galleryBatch"','id="contentTemplatePicker"','.onecard']],
  ['縮圖品牌框','thumbnail-frame.html',['id="coverMode"','id="containMode"','id="cornerText"','id="cornerImageInput"','id="zoom"','id="positionX"','id="download"']],
  ['片尾結算卡','settlement-card.html',['id="leftMode"','id="addRow"','id="catsVisible"','id="subscribeVisible"','id="showGuides"','id="nextUpload"','id="downloadPng"']]
];

function read(file) { return fs.readFileSync(path.join(root,file),'utf8'); }
function blobHash(s) {
  return crypto.createHash('sha1').update('blob ' + Buffer.byteLength(s) + '\0').update(s).digest('hex');
}
const registry = JSON.parse(read('one-tools-registry-v1.json'));
const ready = registry.tools.filter(item => item.status === 'ready' && item.href);
assert.equal(ready.length,13,'Thirteen ready makers, separate from five planned tools');
for (const [name,file,tokens] of required) {
  const source = read(file);
  for (const token of tokens) assert(source.includes(token),name+' missing '+token);
  if (nativeHtmlSha[file]) {
    const mainVersion = source
      .replace('card-workspace-v1.js?v=1700','card-workspace-v1.js?v=1500')
      .replace('card-workspace-v1.css?v='+(file==='focus-card.html'?'1710':'1700'),
               'card-workspace-v1.css?v='+(file==='focus-card.html'?'1510':'1500'));
    assert.equal(blobHash(mainVersion),nativeHtmlSha[file],
      name+': original native HTML, canvas renderer and controls must remain unchanged except shared-UI asset version');
    assert(source.includes('card-workspace-v1.js?v=1700'),name+' missing upgraded shared shell');
  }
  console.log('STRUCTURE PASS:',name,file);
}
const dialogueEntry=read('dialogue-card.html');
assert(dialogueEntry.includes('dialogue-card-v135.html'),'Dialogue entry must retain canonical redirect');
const explanationEntry=read('explanation-card.html');
assert(explanationEntry.includes('explanation-card-portable-v049.html'),'Explanation must retain dedicated editor');
assert(read('card-workspace-v1.js').includes('function makeStepNavigator'),'New step navigation missing');
assert(read('card-workspace-v1.js').includes('function makeSectionJump'),'New setting jump missing');
assert(read('card-workspace-v1.js').includes('function trackUnsaved'),'New unsaved notification missing');
console.log('STRUCTURAL CONTRACT PASS: 13 ready tools, 14 capability groups, 12 untouched native renderers, redirects and new shell present.');
