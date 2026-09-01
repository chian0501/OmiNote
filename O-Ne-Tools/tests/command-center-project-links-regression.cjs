const fs=require('fs');
const path=require('path');
const vm=require('vm');

const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'command-center.html'),'utf8');
const script=fs.readFileSync(path.join(root,'command-center-project-links-v1.js'),'utf8');
const css=fs.readFileSync(path.join(root,'command-center-project-links-v1.css'),'utf8');

function assert(value,message){if(!value)throw new Error(message)}

assert(html.includes('O-Ne Command Center V0.9.3'),'HTML version is not V0.9.3');
assert(html.includes('command-center-project-links-v1.js?v=0931'),'project-link script is not loaded');
assert(html.includes('command-center-project-links-v1.css?v=0930'),'project-link stylesheet is not loaded');
assert(html.includes('data-tab="projects">專案連結'),'project navigation label is unclear');
assert(script.includes("new Set(['drive.google.com','docs.google.com'])"),'Google host allowlist is missing');
assert(script.includes("url.protocol==='https:'"),'HTTPS validation is missing');
assert(script.includes("const HASH_PREFIX='#one-private-links='"),'one-click local bootstrap is missing');
assert(script.includes("history.replaceState(null,'',location.pathname+location.search)"),'private hash is not stripped');
assert(script.includes('rel="noopener noreferrer"'),'direct links are missing opener protection');
assert(script.includes('直接開啟 ${esc(FIELD_LABELS[field])}'),'placement direct link is missing');
assert(script.includes("$('#placeProject').oninput=updatePlace"),'placement event is not rebound to the enhanced renderer');
assert(script.includes("$('#projectSearch').oninput=renderProjects"),'project search is not rebound to the enhanced renderer');
assert(css.includes('.project-link-grid'),'project-link UI styles are missing');

const privateId=/https:\/\/(?:drive\.google\.com\/drive\/folders|docs\.google\.com\/document\/d)\/[A-Za-z0-9_-]{15,}/;
assert(!privateId.test(html+script+css),'private Drive/Docs ID leaked into public source');

new vm.Script(script,{filename:'command-center-project-links-v1.js'});
console.log('PASS command-center-project-links-regression');
