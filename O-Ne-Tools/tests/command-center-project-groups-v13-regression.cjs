const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..');
const data=fs.readFileSync(path.join(root,'command-center-v1-data.js'),'utf8');
const direct=fs.readFileSync(path.join(root,'command-center-project-links-direct-v1.js'),'utf8');
const patch=fs.readFileSync(path.join(root,'command-center-project-patch-v13.js'),'utf8');
const groups=fs.readFileSync(path.join(root,'command-center-project-groups-v1.js'),'utf8');
const groupCss=fs.readFileSync(path.join(root,'command-center-project-groups-v1.css'),'utf8');
const html=fs.readFileSync(path.join(root,'command-center.html'),'utf8');
function ok(value,message){if(!value)throw new Error(message)}

const box={window:{}};vm.createContext(box);vm.runInContext(data,box);vm.runInContext(direct,box);vm.runInContext(patch,box);
const D=box.window.ONE_CC_V1;
const added=D.projects.find(project=>project.id==='26TW-04-1');
ok(D.projects.length===10,'project count must be 10');
ok(Boolean(added),'26TW-04-1 missing');
ok(added.name==='3COINS 商品開箱心得','new project name mismatch');
ok(Object.keys(added.links).length===7,'new project must have seven shortcuts');
ok(D.projectGroups.length===3,'project group count');
ok(D.projectGroups.map(group=>group.id).join(',')==='tw,jp,cru','project group order');
const linkCount=D.projects.reduce((sum,project)=>sum+D.linkFields.filter(([key])=>Boolean(project.links[key])).length,0);
ok(linkCount===68,'project shortcut count must be 68');
ok(D.version==='V1.3 CANDIDATE','candidate version marker');
ok(D.designRevision==='PROJECT_GROUPS_V1','design revision marker');

ok(html.includes('V1.3 CANDIDATE'),'HTML candidate marker');
ok(html.includes('id="projectStat">10'),'project stat placeholder');
ok(html.includes('id="linkStat">68'),'link stat placeholder');
ok(html.includes('影片專案｜折疊分類'),'folded project label');
ok(html.includes('command-center-project-groups-v1.css?v=130c1'),'project group stylesheet wired');
ok(html.indexOf('command-center-v1-data.js')<html.indexOf('command-center-project-links-direct-v1.js'),'base data must load before direct map');
ok(html.indexOf('command-center-project-links-direct-v1.js')<html.indexOf('command-center-project-patch-v13.js'),'direct map must load before project patch');
ok(html.indexOf('command-center-project-patch-v13.js')<html.indexOf('command-center-v1.js'),'project patch must load before app init');
ok(html.indexOf('command-center-v1.js')<html.indexOf('command-center-project-groups-v1.js'),'project groups must load after app init');

ok(groups.includes('MutationObserver'),'group renderer must survive project-list rerenders');
ok(groups.includes("one.cc.v13.openProjectGroups"),'group open state must be local-only');
ok(groups.includes("Boolean(query)||hasActive||saved.has(group.id)"),'search/selected project must reveal its category');
ok(groupCss.includes('.project-group>summary'),'group summary styles missing');
ok(groupCss.includes('@media(max-width:560px)'),'mobile group styles missing');

const publicSafe=[patch,groups,groupCss].join('\n');
ok(!/https?:\/\/(?:drive|docs)\.google\.com/i.test(publicSafe),'new non-whitelist files must not contain Drive/Docs URLs');
ok(!/["']1[A-Za-z0-9_-]{20,}["']/.test(publicSafe),'new non-whitelist files must not contain Drive IDs');

console.log(JSON.stringify({projects:D.projects.length,links:linkCount,groups:D.projectGroups.map(group=>group.label),newProject:added.id,privacy:'PASS',status:'CANDIDATE'},null,2));
