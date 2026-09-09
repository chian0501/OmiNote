(()=>{
  'use strict';
  const D=window.ONE_CC_V1;
  if(!D)throw new Error('ONE_CC_V1 missing');
  const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
  const STORE={pin:'one.cc.v1.pinned',recent:'one.cc.v1.recent',selected:'one.cc.v1.selectedProject'};
  const safeParse=(v,fallback)=>{try{return JSON.parse(v)}catch{return fallback}};
  const load=(k,f)=>safeParse(localStorage.getItem(k)||'',f);
  const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize=s=>String(s||'').trim().toLowerCase();
  let selected=D.projects.find(p=>p.id===localStorage.getItem(STORE.selected))||null;
  let activeAudience='all';
  let tools=[];
  let toolError='';
  let toastTimer;

  function toast(text){const t=$('#toast');t.textContent=text;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),1800)}
  function setSelected(project){selected=project||null;if(selected)localStorage.setItem(STORE.selected,selected.id);else localStorage.removeItem(STORE.selected);renderProjectList();renderProjectDetail();syncProjectSelectors();renderAiContext()}
  function projectHay(p){return normalize([p.id,p.name,...p.aliases,...p.keywords,'母專案 影片總控 企劃 素材 長片 shorts 縮圖'].join(' '))}
  function assetHay(a){return normalize([a.name,a.group,...a.keywords].join(' '))}
  function isPinned(key){return load(STORE.pin,[]).includes(key)}
  function togglePin(key){let arr=load(STORE.pin,[]);arr=arr.includes(key)?arr.filter(x=>x!==key):[key,...arr].slice(0,24);save(STORE.pin,arr);renderQuick();renderProjectDetail();renderAssets()}
  function addRecent(item){let arr=load(STORE.recent,[]).filter(x=>!(x.kind===item.kind&&x.id===item.id&&x.label===item.label));arr.unshift({...item,ts:Date.now()});save(STORE.recent,arr.slice(0,12));renderQuick()}
  function wireTrackedLinks(root=document){root.querySelectorAll('[data-track-url]').forEach(a=>{a.addEventListener('click',()=>addRecent({kind:a.dataset.kind,id:a.dataset.id,label:a.dataset.label,url:a.href}))})}

  function renderQuick(){
    const pins=load(STORE.pin,[]), rec=load(STORE.recent,[]);
    const wrap=$('#quickStrip');
    const items=[];
    pins.slice(0,5).forEach(key=>{
      const [kind,id]=key.split(':');
      if(kind==='project'){const p=D.projects.find(x=>x.id===id);if(p)items.push(`<button class="quick-chip" data-quick-project="${esc(p.id)}">★ ${esc(p.name)}</button>`)}
      if(kind==='asset'){const a=D.shared.find(x=>x.id===id);if(a)items.push(`<a class="quick-chip" href="${esc(a.url)}" target="_blank" rel="noopener noreferrer" data-track-url data-kind="asset" data-id="${esc(a.id)}" data-label="${esc(a.name)}">★ ${esc(a.name)}</a>`)}
    });
    rec.slice(0,5).forEach(r=>items.push(`<a class="quick-chip" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer" data-track-url data-kind="${esc(r.kind)}" data-id="${esc(r.id)}" data-label="${esc(r.label)}">最近｜${esc(r.label)}</a>`));
    wrap.innerHTML=items.length?items.join(''):'<span class="quick-chip" style="cursor:default">釘選與最近使用會留在這台瀏覽器</span>';
    wrap.querySelectorAll('[data-quick-project]').forEach(b=>b.onclick=()=>{const p=D.projects.find(x=>x.id===b.dataset.quickProject);if(p)setSelected(p)});
    wireTrackedLinks(wrap);
  }

  function renderProjectList(){
    const q=normalize($('#findSearch').value);
    const list=D.projects.filter(p=>!q||projectHay(p).includes(q));
    $('#projectList').innerHTML=list.length?list.map(p=>`<button class="project-item ${selected?.id===p.id?'active':''}" data-project="${esc(p.id)}"><b>${esc(p.name)}</b><small>${esc(p.id)}｜${esc(p.aliases[0]||'')}</small></button>`).join(''):'<div class="empty">找不到專案，換一個 ID、地點或題材。</div>';
    $('#projectList').querySelectorAll('[data-project]').forEach(b=>b.onclick=()=>setSelected(D.projects.find(p=>p.id===b.dataset.project)));
  }

  function renderProjectDetail(){
    const box=$('#projectDetail');
    if(!selected){box.innerHTML='<div class="empty"><b>先選一個影片專案</b><br>第二步就能直接開素材、長片、Shorts 或其他入口。</div>';return}
    const pinKey=`project:${selected.id}`;
    const links=D.linkFields.map(([key,label])=>{
      const url=selected.links[key], ex=selected.exceptions?.[key];
      if(url)return `<a class="direct" href="${esc(url)}" target="_blank" rel="noopener noreferrer" data-track-url data-kind="project" data-id="${esc(selected.id)}" data-label="${esc(selected.name+'｜'+label)}"><b>${esc(label)}</b><span>開啟 ↗</span></a>`;
      return `<div class="direct missing" aria-disabled="true"><b>${esc(label)}</b><span>${esc(ex||'未設定')}</span></div>`;
    }).join('');
    const notes=Object.entries(selected.exceptions||{}).map(([k,v])=>`<div class="exception">${esc(Object.fromEntries(D.linkFields)[k])}：${esc(v)}</div>`).join('');
    box.innerHTML=`<div class="project-title"><div><div class="id">${esc(selected.id)}</div><h3>${esc(selected.name)}</h3></div><button class="pin ${isPinned(pinKey)?'on':''}" id="pinProject">${isPinned(pinKey)?'★ 已釘選':'☆ 釘選'}</button></div><div class="links-grid">${links}</div>${notes}`;
    $('#pinProject').onclick=()=>togglePin(pinKey);wireTrackedLinks(box);
  }

  function renderAssets(){
    const q=normalize($('#findSearch').value);
    const arr=D.shared.filter(a=>!q||assetHay(a).includes(q));
    $('#assetCount').textContent=`${arr.length} / ${D.shared.length}`;
    $('#assetGrid').innerHTML=arr.length?arr.map(a=>{const key=`asset:${a.id}`;return `<article class="asset"><div class="group">${esc(a.group)}</div><h4>${esc(a.name)}</h4><p>${esc(a.keywords.join('、'))}</p><div class="asset-actions"><a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer" data-track-url data-kind="asset" data-id="${esc(a.id)}" data-label="${esc(a.name)}">開啟 ↗</a><button class="pin ${isPinned(key)?'on':''}" data-pin-asset="${esc(a.id)}">${isPinned(key)?'★':'☆'}</button></div></article>`}).join(''):'<div class="empty">找不到共用素材。</div>';
    $('#assetGrid').querySelectorAll('[data-pin-asset]').forEach(b=>b.onclick=()=>togglePin(`asset:${b.dataset.pinAsset}`));wireTrackedLinks($('#assetGrid'));
  }

  function renderFind(){renderProjectList();renderProjectDetail();renderAssets();renderQuick()}

  async function loadTools(){
    try{
      const res=await fetch('./one-tools-registry-v1.json?v=2370',{cache:'no-store'});if(!res.ok)throw new Error(`HTTP ${res.status}`);
      const registry=await res.json();tools=(registry.tools||[]).filter(t=>t.status==='ready'&&t.href);toolError='';
    }catch(e){toolError=e.message;tools=[]}
    renderTools();
  }
  function renderTools(){
    const q=normalize($('#toolSearch').value);
    const shown=tools.filter(t=>!q||normalize([t.name,t.family,t.group,t.desc,(t.features||[]).join(' ')].join(' ')).includes(q));
    const count=$('#toolCount');count.textContent=toolError?'讀取失敗':`${tools.length} / 13`;
    count.className='pill '+(tools.length===13&&!toolError?'':'candidate');
    $('#toolGrid').innerHTML=toolError?`<div class="empty">Registry 讀取失敗：${esc(toolError)}</div>`:shown.length?shown.map(t=>`<article class="tool"><span class="status">READY</span><div class="group">${esc(t.group||'Maker Tool')}</div><h4>${esc(t.name)}</h4><p>${esc(t.desc||t.family||'')}</p><div class="tool-actions"><a href="${esc(t.href)}" target="_blank" rel="noopener noreferrer">開啟工具 ↗</a></div></article>`).join(''):'<div class="empty">找不到工具。</div>';
  }

  function syncProjectSelectors(){
    const selects=[$('#aiProject'),$('#manageProject')];
    selects.forEach(sel=>{const before=selected?.id||sel.value;sel.innerHTML='<option value="">選擇影片專案</option>'+D.projects.map(p=>`<option value="${esc(p.id)}">${esc(p.id)}｜${esc(p.name)}</option>`).join('');sel.value=before||''});
  }
  function renderAiContext(){
    const p=selected||D.projects.find(x=>x.id===$('#aiProject').value);
    $('#aiContext').textContent=p?`目前專案：${p.id}｜${p.name}`:'影片型 AI 工作需要先選一個專案；系統型工具檢查／資料夾整理可直接使用。';
  }
  function renderAi(){
    const q=normalize($('#aiSearch').value);
    const shown=D.aiActions.filter(a=>(activeAudience==='all'||a.audience.includes(activeAudience)||a.audience.includes('all'))&&(!q||normalize([a.title,a.desc,...a.keywords].join(' ')).includes(q)));
    $('#aiCount').textContent=`${shown.length} / 18`;
    $('#aiGrid').innerHTML=shown.map(a=>`<article class="ai-card"><div class="group">${a.scope==='video'?'影片工作':'系統工作'}</div><h4>${esc(a.title)}</h4><p>${esc(a.desc)}</p><div class="ai-actions"><button class="button primary" data-ai="${esc(a.id)}">產生指令</button></div></article>`).join('');
    $('#aiGrid').querySelectorAll('[data-ai]').forEach(b=>b.onclick=()=>buildPrompt(b.dataset.ai));
  }
  function buildPrompt(id){
    const action=D.aiActions.find(a=>a.id===id);if(!action)return;
    const p=D.projects.find(x=>x.id===$('#aiProject').value)||selected;
    if(action.scope==='video'&&!p){toast('先選一個影片專案');$('#aiProject').focus();return}
    const context=p?`目前專案：${p.name}（${p.id}）\nselected_video_id=${p.id}\nselected_project_name=${p.name}\n母專案入口=${p.links.root}\n請先依 O-Ne 正式規則讀取這支影片的唯一企劃卡、營運主資料與任務必要工作流，再執行：\n\n`:'';
    $('#promptTitle').textContent=action.title;
    $('#promptText').value=context+action.prompt;
    $('#promptBox').hidden=false;
    $('#promptBox').scrollIntoView({behavior:'smooth',block:'nearest'});
  }

  const placementMap={card:['p02','片中字卡／動畫'],music:['p02','本片音樂音效'],edit:['p03','剪輯工程'],review:['p03','毛片／審片／Pilot／RC'],export:['p03','長片正式出帶'],cover:['thumb','縮圖'],metadata:['root','長片上架文案'],cc:['root','長片字幕 CC'],shorts:['p04','Shorts 成品／文案／字幕']};
  function renderPlacement(){
    const p=D.projects.find(x=>x.id===$('#manageProject').value)||selected;
    if(!p){$('#placeResult').innerHTML='先選一個影片專案。';return}
    const [field,label]=placementMap[$('#placeType').value];const url=p.links[field];const ex=p.exceptions?.[field];
    $('#placeResult').innerHTML=`<b>${esc(p.id)}｜${esc(p.name)}</b><br>建議位置：${esc(label)}${url?`<br><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">直接開啟 ↗</a>`:`<br><span class="privacy-warn">${esc(ex||'此入口尚未設定')}</span>`}<br><small>Command Center 只提供位置，不會自動搬檔或回寫。</small>`;
  }
  function renderNaming(){
    const p=D.projects.find(x=>x.id===$('#manageProject').value)||selected;
    if(!p){$('#nameResult').textContent='先選一個影片專案。';return}
    const clean=s=>String(s||'').trim().replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,'_').replace(/_+/g,'_');
    const parts=[p.id,clean($('#nameType').value),clean($('#nameTopic').value),clean($('#nameVer').value),clean($('#nameStatus').value)].filter(Boolean);
    $('#nameResult').textContent=parts.join('-');
  }

  function switchTab(id){
    $$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));$$('.screen').forEach(s=>s.classList.toggle('active',s.id===`screen-${id}`));
    if(id==='tools'&&!tools.length&&!toolError)loadTools();
  }

  function init(){
    $('#projectStat').textContent=D.projects.length;$('#linkStat').textContent=D.projects.reduce((n,p)=>n+D.linkFields.filter(([k])=>Boolean(p.links[k])).length,0);$('#sharedStat').textContent=D.shared.length;
    $$('.tab').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
    $('#findSearch').oninput=()=>{renderProjectList();renderAssets()};$('#clearSearch').onclick=()=>{$('#findSearch').value='';renderFind()};
    $('#toolSearch').oninput=renderTools;
    $('#aiSearch').oninput=renderAi;$$('[data-audience]').forEach(b=>b.onclick=()=>{activeAudience=b.dataset.audience;$$('[data-audience]').forEach(x=>x.classList.toggle('active',x===b));renderAi()});
    $('#aiProject').onchange=e=>{const p=D.projects.find(x=>x.id===e.target.value)||null;setSelected(p)};
    $('#copyPrompt').onclick=async()=>{await navigator.clipboard.writeText($('#promptText').value);toast('指令已複製')};
    $('#manageProject').onchange=e=>{const p=D.projects.find(x=>x.id===e.target.value)||null;setSelected(p);renderPlacement();renderNaming()};
    $('#placeType').onchange=renderPlacement;['nameType','nameTopic','nameVer','nameStatus'].forEach(id=>$('#'+id).oninput=renderNaming);
    syncProjectSelectors();renderFind();renderAi();renderAiContext();renderPlacement();renderNaming();loadTools();
    document.documentElement.dataset.ccVersion=D.version;document.documentElement.dataset.projectLinks=String(D.projects.reduce((n,p)=>n+D.linkFields.filter(([k])=>Boolean(p.links[k])).length,0));document.documentElement.dataset.sharedLinks=String(D.shared.length);document.documentElement.dataset.aiActions=String(D.aiActions.length);
  }
  init();
})();
