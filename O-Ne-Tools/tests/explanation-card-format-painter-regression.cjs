'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const src=fs.readFileSync(path.join(root,'explanation-card-v038-5.js'),'utf8');
function must(re,msg){if(!re.test(src))throw new Error(msg);}
must(/styleWithCSS'\s*,\s*false\s*,\s*false/,'rich text commands must use semantic formatting');
must(/normalizeRichStyleKeywords/,'font-weight keyword normalization must exist');
must(/font-size-sample/,'visual font-size samples must exist');
must(/fontSizeVisualMenu/,'visual font-size picker must exist');
must(/copyStyleBtn/,'copy style button must exist');
must(/applyStyleBtn/,'apply style button must exist');
must(/複製樣式/,'copy style label must exist');
must(/套用樣式/,'apply style label must exist');
console.log('PASS explanation-card format painter regression');
