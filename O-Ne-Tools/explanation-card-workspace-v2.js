'use strict';
/* Screenshot repair pass. One canonical block list; reminder is a real reveal item.
   Old note.enabled is migrated once, then disabled to avoid duplicate legacy output.
   Plain note.text is a derived compatibility mirror, never a second editor store. */
(function installWorkspace(){
  if(window.ONEExplanationWorkspace)return;
  const $=id=>document.getElementById(id), body=()=>state.blocks.filter(b=>b.kind==='body');
  const noteBlock=()=>state.blocks.find(b=>b.id===state.note?.blockId);
  const plain=html=>{const el=document.createElement('div');el.innerHTML=sanitizeHtml(html||'');return el.textContent||'';};
  const finish=()=>window.ONEExplanationOverlayPilot?.finish()!==false;
  const checkpoint=()=>window.ONEExplanationFormatCore.beginExternalInput();
  let uiPending=0,loading=false,localDirty=false;
  function migrate(next){
    if(next.note?.enabled&&!next.note.blockId){
      const n=block('body',`<span style="font-size:${next.note.size||24}px;font-weight:600">${esc(next.note.text||'小提醒：請在這裡輸入提醒內容').replace(/\n/g,'<br>')}</span>`);
      next.blocks.push(n);next.note.blockId=n.id;next.note.inheritImage=true;next.note.enabled=false;
    }
    if(next.note?.blockId)next.note.enabled=false;
    return next;
  }
  const oldClean=cleanState;
  cleanState=function(raw){
    // A legacy card may already contain MAX_BLOCKS plus its former global note.
    // Clean the regular blocks with the existing limit, then reinsert the single note
    // by stable ID so saving/loading never truncates an existing last paragraph.
    const noteId=raw?.note?.blockId,index=Array.isArray(raw?.blocks)?raw.blocks.findIndex(b=>String(b.id)===String(noteId)):-1;
    if(noteId&&index>=0){
      const source=raw.blocks[index],regular=raw.blocks.filter((b,i)=>i!==index);
      const next=oldClean({...raw,blocks:regular});
      const safe=oldClean({...raw,blocks:[{...source,kind:'body'}],note:{enabled:false}}).blocks[0];
      next.blocks.splice(Math.min(index,next.blocks.length),0,safe);next.note.enabled=false;
      const frames=raw.sequence?.frames||[];
      next.sequence.frames=next.blocks.filter(b=>b.kind==='body').map(b=>{
        const known=frames.find(f=>String(f.blockId||f.block_id)===b.id)||next.sequence.frames.find(f=>f.blockId===b.id);
        return known?{...clone(known),blockId:b.id}:{blockId:b.id,image:clone(next.image)};
      });
      const total=next.blocks.filter(b=>b.kind==='body').length;
      next.sequence.enabled=Boolean(raw.sequence?.enabled)&&total>1;
      next.sequence.visibleCount=Math.round(clamp(raw.sequence?.visibleCount??total,1,Math.max(1,total)));
      return next;
    }
    return migrate(oldClean(raw));
  };
  // New cards only: do not mutate the shared base size used by old unstyled projects.
  Object.entries(TEMPLATES).forEach(([key,t])=>{const make=t.make;t.make=()=>make().map(b=>b.kind==='title'?{...b,html:`<span style="font-size:56px;font-weight:800;color:${BRAND.cream}">${b.html}</span>`}:b);});
  const newTitle=html=>`<span style="font-size:56px;font-weight:800;color:${BRAND.cream}">${html}</span>`;
  if(state.templateId==='standard'&&plain(state.blocks[0]?.html)==='說明卡主標題'&&!state.image.name){let saved=false;try{saved=JSON.parse(localStorage.getItem('one.edit-history.v1:explanation-card')||'[]').length>0;}catch(e){}if(!saved){state.blocks[0].html=newTitle('說明卡主標題');const initial=$('wordPage').querySelector('.rich[data-kind=title]');if(initial)initial.innerHTML=state.blocks[0].html;}}
  defaults.blocks=TEMPLATES.standard.make();
  migrate(state);
  function syncNote(){
    const n=noteBlock();
    if(n){state.note.enabled=false;state.note.text=plain(n.html);state.note.lastHtml=n.html;}
  }
  function inheritImage(){
    const items=body(),i=items.findIndex(b=>b.id===state.note?.blockId);
    if(i>0&&state.note.inheritImage!==false&&state.sequence?.enabled)
      window.__ONE_V049__?.copyStepImage(items[i].id,items[i-1].id);
  }
  const originalLayout=layoutCard;
  layoutCard=function(ctx){
    syncNote();const l=originalLayout(ctx),n=noteBlock();
    if(!n)return l;
    let y=l.rows[0]?.y||l.dividerY+25;
    l.rows.forEach(r=>{
      r.y=y;
      if(r.block.id===n.id){
        const rich=layoutRich(ctx,htmlToParagraphs(n.html,'body'),l.textW-94);
        r.isNote=true;r.rich={lines:[],height:0};r.height=Math.max(68,rich.height+28);
        l.inlineNote={id:n.id,kind:'body',isNote:true,x:l.textX+82,y:y+10,w:l.textW-94,h:rich.height,rich,align:n.align,boxY:y,boxH:r.height};
      }
      y+=r.height+13;
    });
    const oldHeight=l.height;
    l.height=Math.ceil(Math.max(MIN_HEIGHT,y+25,l.imageAutoHeight?oldHeight:0));
    l.imageH=l.height-l.imageY-28;l.noteY=null;
    return l;
  };
  sequenceRows=function(rows){
    const visible=new Set((state.sequence?.enabled?body().slice(0,state.sequence.visibleCount):body()).map(b=>b.id));
    return rows.filter(r=>!r.isNote&&visible.has(r.block.id));
  };
  function drawReminder(c,l){
    const n=l.inlineNote;if(!n)return;
    const index=body().findIndex(b=>b.id===n.id);
    if(state.sequence?.enabled&&index>=state.sequence.visibleCount)return;
    c.save();c.strokeStyle=state.note.color||BRAND.teal;c.lineWidth=2.5;c.fillStyle='rgba(67,58,53,.36)';
    c.beginPath();c.roundRect(l.textX,n.boxY,l.textW,n.boxH,8);c.fill();c.stroke();
    c.beginPath();c.arc(l.textX+40,n.boxY+n.boxH/2,23,0,Math.PI*2);c.stroke();
    c.fillStyle=state.note.color||BRAND.teal;c.font='800 30px "Noto Sans TC",sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('!',l.textX+40,n.boxY+n.boxH/2+1);c.restore();
    drawRich(c,n.rich,n.x,n.y,n.w,n.align);
  }
  const originalRender=renderCanvas;
  renderCanvas=function(target=canvas){
    inheritImage();const l=originalRender(target);
    if(state.mode!=='gallery')drawReminder(target.getContext('2d'),l);
    if(target===canvas){
      if(state.mode!=='gallery')$('dimensionText').textContent=state.sequence?.enabled?`${l.width} × ${l.height}px｜第 ${state.sequence.visibleCount}／${body().length} 幕・固定尺寸`:`${l.width} × ${l.height}px｜全部內容`;
      queueUi();
    }
    return l;
  };
  const originalTemplateButtons=renderTemplateButtons;
  renderTemplateButtons=function(){originalTemplateButtons();document.querySelectorAll('#templateButtons [data-template="list"],#templateButtons [data-template="warning"],#templateButtons [data-template="gallery"]').forEach(b=>b.remove());};
  const originalEditor=renderEditor;
  renderEditor=function(){migrate(state);const result=originalEditor();queueUi();return result;};
  const oldApply=applyTemplate;
  applyTemplate=function(id,force=false){
    if(!force&&!confirm('切換範本會重設目前文字，是否繼續？'))return;
    if(!finish())return;
    oldApply(id,true);state.note={...state.note,enabled:false,blockId:null};queueUi();
  };
  const oldLoad=loadProjectPayload;
  loadProjectPayload=async function(payload){loading=true;try{return await oldLoad(payload);}finally{loading=false;syncNote();queueUi();}};
  if(window.__ONE_V049__)window.__ONE_V049__.loadProjectPayload=loadProjectPayload;
  if(window.__ONE_V030__)window.__ONE_V030__.loadProjectPayload=loadProjectPayload;

  function markDirty(){localDirty=true;if($('oneSaveState'))$('oneSaveState').textContent='有修改・尚未暫存';}
  const page=$('wordPage');
  // Look up live state by stable ID. Old closures must not keep editing pre-undo objects.
  page.addEventListener('input',event=>{
    const el=event.target,wrap=el.closest('.edit-block');if(!wrap||event.isComposing||window.ONEExplanationOverlayPilot?.state().composing)return;
    const b=state.blocks.find(b=>b.id===wrap.dataset.id);if(!b)return;
    if(el.matches('.rich'))b.html=sanitizeHtml(el.innerHTML);
    else if(el.matches('.marker-input'))b.marker.text=el.value.replace(/[\r\n]/g,' ');
    else return;
    event.stopImmediatePropagation();state.templateId='custom';syncNote();renderTemplateButtons();renderCanvas();window.ONEExplanationFormatCore.refresh();markDirty();
  },true);
  page.addEventListener('change',event=>{
    if(!event.target.matches('.marker-control input[type="checkbox"]'))return;
    const wrap=event.target.closest('.edit-block'),b=state.blocks.find(b=>b.id===wrap.dataset.id);if(!b)return;
    event.stopImmediatePropagation();b.marker.enabled=event.target.checked;const input=wrap.querySelector('.marker-input');input.disabled=!b.marker.enabled;wrap.classList.toggle('has-marker',b.marker.enabled);renderCanvas();markDirty();
  },true);
  // After adding an ordinary item, show that item's real frame (including its image).
  $('addBlock').addEventListener('click',()=>setTimeout(()=>{
    const b=body().at(-1);if(!b)return;
    if(state.sequence.enabled)window.__ONE_V049__.activateStep(body().length-1);
    window.ONEExplanationOverlayPilot?.open(b.id);queueUi();markDirty();
  },40));

  function toggleReminder(on){
    if(!finish())return;checkpoint();
    const old=noteBlock();
    if(on&&!old){
      const n=block('body',state.note.lastHtml||`<span style="font-size:24px;font-weight:600">${esc(state.note.text||'小提醒：請在這裡輸入提醒內容')}</span>`);
      state.blocks.push(n);state.note.blockId=n.id;state.note.enabled=false;state.note.inheritImage=true;
      if(body().length>1&&!state.sequence.enabled){$('sequenceEnabled').checked=true;$('sequenceEnabled').dispatchEvent(new Event('change',{bubbles:true}));}
      renderEditor();if(state.sequence.enabled)window.__ONE_V049__.activateStep(body().length-1);renderCanvas();
      window.ONEExplanationOverlayPilot?.open(n.id);
    }else if(!on&&old){state.note.lastHtml=old.html;state.blocks=state.blocks.filter(b=>b.id!==old.id);renderEditor();renderCanvas();}
    markDirty();queueUi();
  }
  function mountReminder(){
    const settings=$('contentCardSettings');settings.hidden=true;settings.classList.add('one-replaced');
    const tools=document.createElement('section');tools.id='oneReminderTools';
    tools.innerHTML='<label class="one-reminder-toggle"><input type="checkbox" id="oneReminderEnabled">小提醒也列入累積</label><div id="oneReminderDetail"><button type="button" id="oneEditReminder">編輯提醒文字</button><label><input type="checkbox" id="oneReminderInherit" checked>沿用前一幕左圖</label><small id="oneReminderOrder"></small><details><summary>提醒樣式</summary><div id="oneReminderStyle"></div></details></div>';
    $('oneOverlayOutline')?.after(tools)||page.parentElement.appendChild(tools);
    $('oneReminderEnabled').onchange=e=>toggleReminder(e.target.checked);
    $('oneEditReminder').onclick=()=>{const n=noteBlock();if(n)window.ONEExplanationOverlayPilot.open(n.id);};
    $('oneReminderInherit').onchange=e=>{state.note.inheritImage=e.target.checked;renderCanvas();markDirty();};
    for(const id of ['noteColor','noteSize'])$('oneReminderStyle').appendChild($(id).closest('label'));
    $('noteSize').onchange=event=>{
      const n=noteBlock();if(!n||!finish())return;checkpoint();
      const size=Number(event.target.value),root=document.createElement('div');root.innerHTML=sanitizeHtml(n.html);
      const walk=node=>{for(const child of [...node.childNodes]){if(child.nodeType===3){const span=document.createElement('span');span.style.fontSize=size+'px';child.replaceWith(span);span.append(child);}else if(child.nodeType===1){if(child.tagName==='SPAN')child.style.fontSize=size+'px';walk(child);}}};
      walk(root);n.html=sanitizeHtml(root.innerHTML);state.note.size=size;renderEditor();renderCanvas();markDirty();
    };
    // Original controls remain as compatibility bindings but are not a parallel editor.
    $('noteEnabled').onchange=e=>toggleReminder(e.target.checked);
  }
  function rowAction(id,action){
    if(!finish())return;checkpoint();const index=state.blocks.findIndex(b=>b.id===id);
    if(index<2)return;
    if(action==='up')moveBodyBlock(index,-1);else if(action==='down')moveBodyBlock(index,1);else if(action==='del')deleteBlock(index);
    markDirty();queueUi();
  }
  function decorateOutline(list,open){
    list.querySelectorAll('[data-overlay-block]').forEach(button=>{
      const b=state.blocks.find(b=>b.id===button.dataset.overlayBlock);if(!b||b.kind!=='body')return;
      const row=document.createElement('div');row.className='one-structure-row';button.before(row);row.append(button);
      if(b.id!==state.note?.blockId){
        const check=document.createElement('input');check.type='checkbox';check.checked=b.marker.enabled;check.title='顯示左側標記（不是隱藏此項）';check.setAttribute('aria-label','顯示左側標記');
        const marker=document.createElement('input');marker.className='one-structure-marker';marker.value=b.marker.text||'';marker.placeholder='標記';marker.maxLength=18;marker.hidden=!b.marker.enabled;marker.setAttribute('aria-label','編輯這一項的標記');
        check.onchange=()=>{const live=state.blocks.find(x=>x.id===b.id);if(!live)return;checkpoint();live.marker.enabled=check.checked;marker.hidden=!check.checked;const w=page.querySelector(`[data-id="${CSS.escape(b.id)}"]`);if(w){w.querySelector('input[type=checkbox]').checked=check.checked;w.querySelector('.marker-input').disabled=!check.checked;}renderCanvas();markDirty();};
        marker.addEventListener('beforeinput',checkpoint);
        marker.oninput=()=>{const live=state.blocks.find(x=>x.id===b.id);if(live){live.marker.text=marker.value;const mi=page.querySelector(`[data-id="${CSS.escape(b.id)}"] .marker-input`);if(mi)mi.value=marker.value;renderCanvas();markDirty();}};
        row.prepend(check,marker);
      }
      const actions=document.createElement('div');actions.className='one-structure-actions';
      for(const [act,label] of [['up','↑'],['down','↓'],['del','×']]){const btn=document.createElement('button');btn.type='button';btn.textContent=label;btn.title=act==='del'?'刪除此項':act==='up'?'往前移':'往後移';btn.onclick=()=>rowAction(b.id,act);actions.append(btn);}
      row.append(actions);
    });
  }
  function mountProjectBar(){
    const bar=document.createElement('section');bar.id='oneProjectBar';bar.setAttribute('data-one-workspace-managed','');
    bar.innerHTML='<strong>說明卡工作台 <small>整合候選 V2</small></strong><span id="oneSaveState">本機暫存・不會自動上傳</span><button type="button" id="oneSaveNow">暫存</button><details id="oneProjectMenu"><summary>專案／存檔</summary><div class="one-popover" id="oneProjectFiles"></div></details><details id="oneExtraMenu"><summary>更多工具</summary><div class="one-popover" id="oneExtraTools"></div></details><details id="oneHelpMenu"><summary>？</summary><div class="one-popover">點畫布文字直接編輯；選單行內文後可改格式。內容清單可增刪、排序、編輯標記。每幕左圖各自保存；小提醒也是一個累積項目。下載完整專案 ZIP 可保留圖片與設定。</div></details>';
    document.querySelector('.app-header').after(bar);
    const project=$('oneProjectFiles');
    const quick=$('quickSaveHost');if(quick)project.append(quick);
    const pkg=document.querySelector('[data-one-project-package-ui]');if(pkg)project.append(pkg);
    const legacy=document.querySelector('.legacy-save-tools');if(legacy){legacy.open=true;project.append(legacy);legacy.querySelector('summary').hidden=true;}
    const actions=legacy?.querySelector('.project-actions'),mainActions=pkg?.querySelector('.one-project-package__actions')||pkg?.querySelector('.one-project-package__row');
    if(actions&&mainActions){mainActions.append(...actions.children);actions.remove();if(legacy)legacy.hidden=true;}
    document.querySelectorAll('.save-dock').forEach(n=>n.hidden=true);
    document.querySelectorAll('.one-after-edit-dock').forEach(n=>n.hidden=true);
    $('oneSaveNow').onclick=()=>{if(!finish())return;$('quickSaveHost')?.querySelector('[data-action="save"]')?.click();localDirty=false;const msg=$('quickSaveHost')?.querySelector('.one-edit-backup__status')?.textContent||'';$('oneSaveState').textContent=msg.includes('失敗')?msg:'已暫存於此瀏覽器';};
    const reset=$('resetAll'),oldReset=reset.onclick;reset.onclick=()=>{if(confirm('確定重設目前內容？未暫存的修改將消失。')){finish();oldReset();markDirty();}};
    for(const sel of ['[data-one-batch-render-ui]','.one-batch-render','.one-ai-json-guide']){const n=document.querySelector(sel);if(n&&!$('oneExtraTools').contains(n))$('oneExtraTools').append(n);}
    const batch=document.querySelector('details.batch-tools,details.batch-render-setting');if(batch){const content=document.querySelector('[data-one-batch-render-ui]');if(content&&!batch.contains(content))batch.append(content);$('oneExtraTools').append(batch);}
    bar.querySelectorAll(':scope > details').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)bar.querySelectorAll(':scope > details').forEach(other=>{if(other!==d)other.open=false;});}));
    document.addEventListener('pointerdown',e=>{if(!bar.contains(e.target))bar.querySelectorAll(':scope > details').forEach(d=>d.open=false);});
  }
  function compactToolbar(){
    const oldPreset=$('stylePreset'),oldCompat=$('fontSizeSelect');
    const toolbar=$('wordToolbar'),row=document.createElement('div');row.className='one-format-row';
    for(const id of ['boldBtn','italicBtn','underlineBtn','strikeBtn','fontSizeVisualPicker','toolbarSwatches'])if($(id))row.append($(id));
    toolbar.querySelectorAll('[data-align]').forEach(n=>row.append(n));
    for(const id of ['bulletBtn','clearBtn','formatPainterGroup'])if($(id))row.append($(id));
    toolbar.append(row);toolbar.querySelectorAll('.toolbar-row').forEach(n=>n.remove());
    const old=oldPreset;if(old){old.hidden=true;toolbar.append(old);}
    const compat=oldCompat;if(compat){for(const o of compat.options){const v=parseInt(o.value,10);if(Number.isFinite(v)){o.value=String(v);o.textContent=v+' px';}}compat.hidden=true;toolbar.append(compat);}
    const heading=toolbar.querySelector('.toolbar-heading');if(heading){heading.querySelectorAll('small').forEach(n=>n.hidden=true);}
  }
  function imageDialog(){
    const scroll=document.querySelector('#imageDrawer .drawer-scroll'),view=document.querySelector('.image-live-wrap')?.closest('.drawer-section');if(!scroll||!view)return;
    const grid=document.createElement('div');grid.className='one-image-grid';
    scroll.before(grid);grid.append(scroll,view);view.classList.add('one-image-result');
  }
  function mountAfterOverlay(){
    document.body.classList.add('one-workspace-v2');
    const controls=document.querySelector('.one-overlay-controls');if(controls){controls.querySelector('strong').textContent='直接在字卡上編輯';$('oneOverlayStatus').textContent='內容與圖片都在畫布上點選；原有編輯區可切回。';}
    document.querySelector('.editor-head strong').textContent='模式與內容清單';
    document.querySelectorAll('.editor-head small,.mode-strip .step-heading small').forEach(n=>n.hidden=true);
    $('contentMode').innerHTML='<b>一般說明</b><span>4 種範本＋圖文</span>';
    $('galleryMode').innerHTML='<b>純圖片字卡</b><span>標籤＋標題＋圖片</span>';
    document.querySelectorAll('#contentTemplatePicker .ui-fold-badge').forEach(n=>n.textContent='4 種範本');
    const picker=$('contentTemplatePicker'),help=picker?.querySelector('.ui-fold-help');if(help){help.textContent='切換會重設文字';picker.querySelector('summary').append(help);const title=picker.querySelector('summary strong');if(title)title.textContent='設計範本';}
    compactToolbar();mountProjectBar();mountReminder();imageDialog();
    const strip=$('sequenceStrip');document.querySelector('.preview-panel').after(strip);
    $('sequenceImageButton').hidden=true;$('sequenceImageControls').append($('openImageDrawer'));
    // In single-card mode the image action still belongs next to the preview.
    strip.append($('openImageDrawer'));
    const resetFormat=$('fontSizeSelect');if(resetFormat)for(const o of resetFormat.options){const v=parseInt(o.value,10);if(Number.isFinite(v)){o.value=String(v);o.textContent=v+' px';}}
    const preview=canvas;preview.addEventListener('dragover',e=>{e.preventDefault();preview.classList.add('one-dragover');});preview.addEventListener('dragleave',()=>preview.classList.remove('one-dragover'));
    preview.addEventListener('drop',e=>{
      e.preventDefault();preview.classList.remove('one-dragover');if(!finish())return;
      const file=e.dataTransfer?.files?.[0];if(!file||!/^image\//.test(file.type))return;
      const r=preview.getBoundingClientRect(),x=(e.clientX-r.left)*preview.width/r.width,y=(e.clientY-r.top)*preview.height/r.height,l=lastLayout;
      if(state.mode==='gallery'){
        const i=l.rects.findIndex(a=>x>=a.x&&x<=a.x+a.w&&y>=a.y&&y<=a.y+a.h);const input=document.querySelector(`[data-gallery-file="${i}"]`);if(i<0||!input)return;
        const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));
      }else if(x>=l.imageX&&x<=l.imageX+l.imageW&&y>=l.imageY&&y<=l.imageY+l.imageH){disableNoteInheritance();loadImage(file);}
      markDirty();
    });
    renderEditor();renderCanvas();queueUi();
    // The shared shell mounts some optional tools after initial rendering.
    setTimeout(()=>{for(const sel of ['.one-batch-render','.one-ai-json-guide']){const n=document.querySelector(sel);if(n&&!$('oneExtraTools').contains(n))$('oneExtraTools').append(n);}queueUi();},500);
  }
  function disableNoteInheritance(){const current=body()[state.sequence?.visibleCount-1];if(state.sequence.enabled&&current?.id===state.note?.blockId)state.note.inheritImage=false;}
  document.addEventListener('change',e=>{if(e.target.id==='explanationImage')disableNoteInheritance();},true);
  document.addEventListener('input',e=>{if(e.target.closest('#imageDrawer'))disableNoteInheritance();},true);
  document.addEventListener('click',e=>{if(e.target.closest('[data-fit],[data-image-align],#resetFreeCrop,#centerFreeCrop'))disableNoteInheritance();},true);
  function queueUi(){if(!uiPending)uiPending=requestAnimationFrame(refreshUi);}
  function refreshUi(){
    uiPending=0;if(!$('oneReminderEnabled'))return;
    const stage=canvas.parentElement;const available=Math.max(210,innerHeight-stage.getBoundingClientRect().top-200);const desired=Math.min(stage.clientWidth-28,available*canvas.width/canvas.height);if(desired>0&&Math.abs(canvas.getBoundingClientRect().width-desired)>1)canvas.style.width=desired+'px';
    const n=noteBlock(),items=body();$('oneReminderEnabled').checked=Boolean(n);$('oneReminderDetail').hidden=!n;$('oneReminderInherit').checked=state.note?.inheritImage!==false;
    if(n)$('oneReminderOrder').textContent=`第 ${items.findIndex(b=>b.id===n.id)+1}／${items.length} 項；可在清單上下移動，出現後持續保留。`;
    $('oneReminderTools').hidden=state.mode==='gallery';
    const select=$('sequenceVisibleCount');[...select.options].forEach((o,i)=>o.textContent=`第 ${i+1} 幕${items[i]?.id===state.note?.blockId?'・小提醒':''}`);
    const current=state.sequence?.enabled?state.sequence.visibleCount:items.length;
    if($('exportPng'))$('exportPng').textContent=state.sequence?.enabled?`輸出第 ${current} 幕 PNG`:'輸出說明卡 PNG';
    if($('exportSequenceAll')&&!$('exportSequenceAll').disabled)$('exportSequenceAll').textContent=`輸出全部 ${items.length} 幕 PNG ZIP`;
    page.querySelectorAll('.edit-block').forEach(w=>{
      const b=state.blocks.find(b=>b.id===w.dataset.id);w.classList.toggle('one-reminder-block',b?.id===state.note?.blockId);
      if(b&&b.kind==='body'){const mi=w.querySelector('.marker-input');if(mi){mi.placeholder='標記';mi.disabled=!b.marker.enabled;mi.hidden=!b.marker.enabled;}w.classList.toggle('has-marker',b.marker.enabled);}
    });
    const text=document.querySelector('.sequence-toggle small');if(text)text.textContent='說明與提醒依清單順序累積；每一幕都有自己的左圖。';
    if(state.mode==='gallery'){const p=document.querySelector('.export-bar p');if(p)p.textContent='透明 PNG；整組圖片與外框、標題分隔線保留 28px 內距。';}
  }
  window.ONEExplanationWorkspace={version:'SCREENSHOT_REPAIR_V2_20260905',galleryInset:28,mountAfterOverlay,decorateOutline,toggleReminder,noteBlock,refresh:queueUi};
})();
