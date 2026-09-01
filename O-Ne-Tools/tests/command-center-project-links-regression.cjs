const crypto=require('crypto');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'command-center.html'),'utf8');
const directSource=fs.readFileSync(path.join(root,'command-center-project-links-direct-v1.js'),'utf8');
const script=fs.readFileSync(path.join(root,'command-center-project-links-v1.js'),'utf8');
const css=fs.readFileSync(path.join(root,'command-center-project-links-v1.css'),'utf8');

function assert(value,message){if(!value)throw new Error(message)}

assert(html.includes('O-Ne Command Center V0.9.4'),'HTML version is not V0.9.4');
assert(html.includes('command-center-project-links-direct-v1.js?v=0940'),'direct project-link map is not loaded');
assert(html.includes('command-center-project-links-v1.js?v=0940'),'project-link script is not loaded');
assert(html.includes('command-center-project-links-v1.css?v=0940'),'project-link stylesheet is not loaded');
assert(html.indexOf('command-center-project-links-direct-v1.js')<html.indexOf('command-center-project-links-v1.js'),'direct map must load before the project-link controller');
assert(html.includes('data-tab="projects">專案連結'),'project navigation label is unclear');
assert(html.includes('47 PROJECT LINKS'),'direct-link count is not visible in HTML');
assert(script.includes("new Set(['drive.google.com','docs.google.com'])"),'Google host allowlist is missing');
assert(script.includes("url.protocol==='https:'"),'HTTPS validation is missing');
assert(script.includes('window.ONECommandCenterDirectLinks||{}'),'direct project map is not consumed');
assert(script.includes("const HASH_PREFIX='#one-private-links='"),'legacy one-click local bootstrap is missing');
assert(script.includes("history.replaceState(null,'',location.pathname+location.search)"),'private hash is not stripped');
assert(script.includes('rel="noopener noreferrer"'),'direct links are missing opener protection');
assert(script.includes('直接開啟 ${esc(FIELD_LABELS[field])}'),'placement direct link is missing');
assert(script.includes("$('#placeProject').oninput=updatePlace"),'placement event is not rebound to the enhanced renderer');
assert(script.includes("$('#projectSearch').oninput=renderProjects"),'project search is not rebound to the enhanced renderer');
assert(script.includes("scrollIntoView({behavior:'smooth',block:'start'})"),'mobile project selection does not reveal the link panel');
assert(css.includes('.project-link-grid'),'project-link UI styles are missing');

const sandbox={window:{}};
vm.runInNewContext(directSource,sandbox,{filename:'command-center-project-links-direct-v1.js'});
const direct=sandbox.window.ONECommandCenterDirectLinks;
const projectIds=['26JP-01-4','26JP-01-3','26JP-01-2','26JP-01-1','26TW-01-1','26TW-02-1','26TW-03-1','26CRU-01-1'];
const fields=new Set(['root','brief','p01','p02','p03','p04']);
assert(JSON.stringify(Object.keys(direct))===JSON.stringify(projectIds),'direct map project order or IDs changed');
assert(Object.values(direct).reduce((sum,row)=>sum+Object.keys(row).length,0)===47,'direct map must contain exactly 47 links');
assert(Object.keys(direct['26JP-01-1']).length===5&&!direct['26JP-01-1'].brief,'USJ must remain at five verified links without an invented brief');
for(const [projectId,row] of Object.entries(direct)){
  for(const [field,value] of Object.entries(row)){
    assert(fields.has(field),`${projectId} contains an unsupported direct-link field`);
    const url=new URL(value);
    assert(url.protocol==='https:'&&['drive.google.com','docs.google.com'].includes(url.hostname),`${projectId}.${field} is not an approved Google HTTPS URL`);
  }
}
const digest=crypto.createHash('sha256').update(JSON.stringify(direct)).digest('hex');
assert(digest==='cadee48dcf2381a318d6cc09769fbd6714ecca5678dc364010bcca3ce5d99ed2','verified direct-link map changed');

const privateId=/https:\/\/(?:drive\.google\.com\/drive\/folders|docs\.google\.com\/document\/d)\/[A-Za-z0-9_-]{15,}/;
assert(!privateId.test(html+script+css),'Drive/Docs ID escaped the approved direct-link map');

new vm.Script(directSource,{filename:'command-center-project-links-direct-v1.js'});
new vm.Script(script,{filename:'command-center-project-links-v1.js'});
console.log('PASS command-center-project-links-regression');
