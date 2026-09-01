(()=>{
  'use strict';

  const STORAGE_KEY='one.cc.privateLinks';
  const HASH_PREFIX='#one-private-links=';
  const SAFE_HOSTS=new Set(['drive.google.com','docs.google.com']);
  const FIELD_LABELS=Object.fromEntries(PRIVATE_FIELDS);
  const PLACE_FIELDS={card:'p02',music:'p02',edit:'p03',review:'p03',export:'p03',cover:'p03',metadata:'p03',cc:'p03',shorts:'p04'};

  function safeUrl(value){
    if(typeof value!=='string'||!value.trim())return '';
    try{
      const url=new URL(value.trim());
      return url.protocol==='https:'&&SAFE_HOSTS.has(url.hostname)?url.href:'';
    }catch{return ''}
  }

  function sanitizeProjects(source){
    const safe={};
    if(!source||typeof source!=='object'||Array.isArray(source))return safe;
    for(const project of PROJECTS){
      const input=source[project.id];
      if(!input||typeof input!=='object'||Array.isArray(input))continue;
      const row={};
      for(const [key] of PRIVATE_FIELDS){
        const url=safeUrl(input[key]);
        if(url)row[key]=url;
      }
      if(Object.keys(row).length)safe[project.id]=row;
    }
    return safe;
  }

  const DIRECT_LINKS=sanitizeProjects(window.ONECommandCenterDirectLinks||{});

  function readCustomLinks(){return sanitizeProjects(readLinks())}
  function readSafeLinks(){
    const custom=readCustomLinks();
    const merged={};
    for(const project of PROJECTS){
      const row={...(DIRECT_LINKS[project.id]||{}),...(custom[project.id]||{})};
      if(Object.keys(row).length)merged[project.id]=row;
    }
    return merged;
  }
  function linkCount(all=readSafeLinks()){return Object.values(all).reduce((sum,row)=>sum+Object.keys(row).length,0)}
  function updateLinkCount(all=readSafeLinks()){
    const badge=$('#projectLinkCount');
    if(badge)badge.textContent=`${linkCount(all)} PROJECT LINKS`;
  }

  function downloadLinks(){
    const payload={version:'o-ne.command-center.private-links.v1',projects:readSafeLinks()};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const anchor=document.createElement('a');
    anchor.href=URL.createObjectURL(blob);
    anchor.download='O-Ne_Command_Center_PrivateLinks.json';
    anchor.click();
    setTimeout(()=>URL.revokeObjectURL(anchor.href),1000);
  }

  function decodeBootstrap(value){
    const base64=value.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(value.length/4)*4,'=');
    const bytes=Uint8Array.from(atob(base64),char=>char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function importProjects(payload){
    const source=payload&&payload.projects&&typeof payload.projects==='object'?payload.projects:payload;
    const safe=sanitizeProjects(source);
    if(!Object.keys(safe).length)throw new Error('找不到可用的 Google Drive／Docs 專案連結');
    saveLinks({...readCustomLinks(),...safe});
    return safe;
  }

  function switchToProjects(){
    const tab=$('.tab[data-tab="projects"]');
    if(tab)tab.click();
  }

  function importHash(){
    if(!location.hash.startsWith(HASH_PREFIX))return false;
    try{
      const payload=decodeBootstrap(location.hash.slice(HASH_PREFIX.length));
      const imported=importProjects(payload);
      const preferred=payload.selected&&PROJECTS.find(project=>project.id===payload.selected);
      selectedProject=preferred||PROJECTS.find(project=>imported[project.id])||PROJECTS[0];
      history.replaceState(null,'',location.pathname+location.search);
      renderProjects();
      renderProjectPanel();
      switchToProjects();
      toast(`已載入 ${linkCount(imported)} 個專案連結`);
      return true;
    }catch(error){
      history.replaceState(null,'',location.pathname+location.search);
      toast(`連結載入失敗：${error.message}`);
      return false;
    }
  }

  renderProjects=function(){
    const q=$('#projectSearch').value.trim().toLowerCase();
    const all=readSafeLinks();
    const list=PROJECTS.filter(project=>!q||[project.name,project.id,project.stage,...project.keywords].join(' ').toLowerCase().includes(q));
    $('#projectList').innerHTML=list.length?list.map(project=>{
      const count=Object.keys(all[project.id]||{}).length;
      return `<button class="project-item ${selectedProject?.id===project.id?'on':''}" data-pid="${project.id}"><b>${esc(project.name)} <span style="color:#8fd4c8">${project.id}</span></b><small><span>${esc(project.stage)}</span><span class="project-link-state ${count?'ready':''}">${count?`${count} 個連結`:'未設定'}</span></small><div class="chips">${project.keywords.map(keyword=>`<span class="chip">${esc(keyword)}</span>`).join('')}</div></button>`;
    }).join(''):'<div class="project-empty-state"><b>找不到專案</b><span>換一個地點、集數或關鍵字。</span></div>';
    $$('[data-pid]').forEach(button=>button.onclick=()=>{
      selectedProject=PROJECTS.find(project=>project.id===button.dataset.pid);
      renderProjects();
      renderProjectPanel();
      if(window.matchMedia('(max-width:1050px)').matches){
        requestAnimationFrame(()=>$('#projectPanel').scrollIntoView({behavior:'smooth',block:'start'}));
      }
    });
    updateLinkCount(all);
  };

  renderProjectPanel=function(){
    const panel=$('#projectPanel');
    if(!selectedProject){
      panel.innerHTML='<div class="project-empty-state"><b>先選左邊的專案</b><span>選好後，這裡會出現可直接點開的專案入口。</span></div>';
      return;
    }
    const all=readSafeLinks();
    const links=all[selectedProject.id]||{};
    const configured=Object.keys(links).length;
    panel.innerHTML=`<div class="project-summary"><div><div class="meta"><span class="group">PROJECT LINKS</span><span class="badge">${esc(selectedProject.stage)}</span></div><div class="title">${esc(selectedProject.name)}</div><div class="path">VIDEO ID：${selectedProject.id}</div></div><div class="chips">${selectedProject.keywords.map(keyword=>`<span class="chip">${esc(keyword)}</span>`).join('')}</div></div><div class="project-link-section"><h3>直接開啟</h3><div class="small">已提供 ${configured}／${PRIVATE_FIELDS.length} 個入口；需登入有權限的 Google 帳號。</div><div class="project-link-grid">${PRIVATE_FIELDS.map(([key,label])=>links[key]?`<a class="project-link" href="${esc(links[key])}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`:`<span class="project-link missing">${esc(label)}</span>`).join('')}</div></div><details class="project-link-editor"><summary>自訂／備份連結（選用）</summary><div class="project-link-editor-body"><div class="project-link-help">上方正式入口已可直接使用。只有需要在這台裝置暫時覆蓋連結時才編輯；自訂值只存本機，不會改動公開正式入口。</div><div class="private-grid">${PRIVATE_FIELDS.map(([key,label])=>`<div><label>${esc(label)}</label><input class="field" data-priv="${key}" value="${esc(links[key]||'')}" placeholder="貼上 Google Drive／Docs 連結"></div>`).join('')}</div><div class="actions"><button class="btn ai" id="privSave">儲存本機自訂</button><button class="btn" id="privExport">匯出備份 JSON</button><button class="btn" id="privImport">載入備份 JSON</button><input id="privFile" type="file" accept="application/json,.json" hidden><button class="btn" id="privClear">恢復正式入口</button></div><div class="small" id="privMsg"></div></div></details>`;

    $('#privSave').onclick=()=>{
      const next={};
      const invalid=[];
      $$('[data-priv]').forEach(input=>{
        const raw=input.value.trim();
        const url=safeUrl(raw);
        if(raw&&!url)invalid.push(FIELD_LABELS[input.dataset.priv]);
        if(url)next[input.dataset.priv]=url;
      });
      if(invalid.length){$('#privMsg').textContent=`未儲存：${invalid.join('、')} 不是有效的 Google Drive／Docs HTTPS 網址。`;return}
      const merged=readCustomLinks();
      if(Object.keys(next).length)merged[selectedProject.id]=next;else delete merged[selectedProject.id];
      saveLinks(merged);
      renderProjects();
      renderProjectPanel();
      toast('專案連結已儲存');
    };
    $('#privClear').onclick=()=>{
      const merged=readCustomLinks();
      delete merged[selectedProject.id];
      saveLinks(merged);
      renderProjects();
      renderProjectPanel();
      toast('已恢復本案正式入口');
    };
    $('#privExport').onclick=downloadLinks;
    $('#privImport').onclick=()=>$('#privFile').click();
    $('#privFile').onchange=async event=>{
      const file=event.target.files[0];
      if(!file)return;
      const message=$('#privMsg');
      try{
        if(file.size>262144)throw new Error('檔案超過 256 KB');
        const imported=importProjects(JSON.parse(await file.text()));
        renderProjects();
        renderProjectPanel();
        toast(`已載入 ${linkCount(imported)} 個專案連結`);
      }catch(error){message.textContent=`載入失敗：${error.message}`}
      finally{event.target.value=''}
    };
  };

  updatePlace=function(){
    const project=findProject($('#placeProject').value);
    if(!project){
      $('#placeSelected').textContent='請先搜尋／選專案。';
      $('#placePath').textContent='';
      $('#placeRule').textContent='';
      return;
    }
    const type=$('#placeType').value;
    const leaf=paths[type].replaceAll('{ID}',project.id);
    const field=PLACE_FIELDS[type];
    const url=(readSafeLinks()[project.id]||{})[field];
    $('#placeSelected').innerHTML=`已選：<b>${esc(project.name)}</b>｜VIDEO ID：<b>${project.id}</b>`;
    $('#placePath').textContent=`${project.name}（${project.id}） → ${leaf}`;
    $('#placeRule').innerHTML=`<div>${type==='card'||type==='music'?'字卡／動畫與本片選用音樂音效都放 02_素材；不要塞進 03_長片。':'系統只提供正式入口，不會自動搬檔。'}</div>${url?`<a class="place-direct-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">直接開啟 ${esc(FIELD_LABELS[field])} ↗</a>`:`<div class="place-missing-link">此專案尚未提供「${esc(FIELD_LABELS[field])}」正式入口。</div>`}`;
  };

  window.ONECommandCenterProjectLinks={safeUrl,sanitizeProjects,decodeBootstrap,linkCount,readSafeLinks};
  if(!selectedProject)selectedProject=PROJECTS[0]||null;
  $('#projectSearch').oninput=renderProjects;
  $('#placeProject').oninput=updatePlace;
  $('#placeType').onchange=updatePlace;
  renderProjects();
  renderProjectPanel();
  updatePlace();
  importHash();
})();
