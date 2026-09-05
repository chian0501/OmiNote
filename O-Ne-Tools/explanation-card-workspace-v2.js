'use strict';
// The screenshot repair pass: shared editor nodes, no duplicate data or storage namespace.
(function installIntegratedWorkspace(){
  if(window.ONEExplanationWorkspace)return;
  const $=id=>document.getElementById(id),model=window.ONEExplanationSequenceModel;
  const overlay=window.ONEExplanationOverlayPilot,core=window.ONEExplanationFormatCore;
  if(!model||!overlay||!core)throw new Error('Integrated workspace requires sequence and overlay adapters.');
  const root=document.querySelector('.app-shell'),heading=document.querySelector('.app-header');
  const list=$('oneOverlayOutline').querySelector('.one-overlay-list');
  let fieldSession=null,pending=false,markerObserver=null;
  const plain=html=>{const node=document.createElement('div');node.innerHTML=sanitizeHtml(html);return node.textContent||'';};
  const bodies=()=>model.bodies(state);
  const isSequence=()=>state.mode!=='gallery'&&state.sequence?.enabled&&model.items(state).length>1;
  const safe=()=>!overlay.state().composing&&!fieldSession?.composing;
  const button=(text,action)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=action;return b;};
  document.body.classList.add('one-workspace-v2');

  function makeDialog(id,title){
    const dialog=document.createElement('dialog');dialog.id=id;dialog.className='one-workspace-dialog';
    const head=document.createElement('header'),h=document.createElement('strong');h.textContent=title;
    head.append(h,button('關閉',()=>dialog.close()));dialog.append(head);document.body.append(dialog);
    dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
    return dialog;
  }
  const projectDialog=makeDialog('oneProjectDialog','專案檔案與本機暫存');
  const dock=document.querySelector('.save-dock');projectDialog.append(dock);
  const actions=document.createElement('div');actions.className='one-project-actions';
  const save=button('暫存',()=>{if(!commitField()||!overlay.finish())return;document.querySelector('#quickSaveHost [data-action="save"]')?.click();});save.id='oneQuickSave';
  const saveStatus=document.createElement('span');saveStatus.id='oneSaveStatus';saveStatus.textContent='本機暫存';
  actions.append(saveStatus,save,button('專案檔案',()=>{if(commitField()&&overlay.finish())projectDialog.showModal();}),button('內容清單',()=>document.body.classList.toggle('one-outline-collapsed')),button('？',()=>helpDialog.showModal()));
  heading.append(actions);
  const helpDialog=makeDialog('oneHelpDialog','操作說明');
  const help=document.createElement('p');help.textContent='直接點字卡文字修改；左側清單可新增、排序、設定標記與小提醒。幕次與當幕圖片在成品下方。專案 ZIP 可繼續編輯，全部幕次 PNG ZIP 用於剪片。切換範本會重設文字，操作前會確認。';helpDialog.append(help);

  const strip=document.querySelector('.mode-strip');heading.after(strip);
  const settings=document.querySelector('.settings');const labels=$('labelSettings');if(labels)strip.append(labels);
  const editorHead=document.querySelector('.editor-head');editorHead.querySelector('strong').textContent='內容與累積出場';
  if(settings)settings.hidden=true;
  const legacy=$('contentCardSettings'),body=legacy.querySelector('.setting-body');
  const note=document.createElement('section');note.id='oneNoteEditor';note.className='one-note-editor';
  const noteTitle=document.createElement('strong');noteTitle.textContent='小提醒｜累積出場';note.append(noteTitle,body);$('oneOverlayOutline').after(note);
  const enableLabel=$('noteEnabled').closest('label');enableLabel.querySelector('span').textContent='加入小提醒';
  $('noteText').placeholder='輸入提醒內容，會依下方設定累積出現';
  const revealLabel=document.createElement('label');revealLabel.className='field';revealLabel.innerHTML='<span>出現時機</span><select id="oneNoteReveal" aria-label="小提醒出現時機"></select>';body.append(revealLabel);
  const noteStyle=document.createElement('details');noteStyle.className='one-note-style';noteStyle.innerHTML='<summary>提醒樣式</summary>';noteStyle.append($('noteColor').closest('.field-row'));body.append(noteStyle);
  const previous=document.createElement('label');previous.className='toggle-row';previous.innerHTML='<input id="oneNotePrevious" type="checkbox"><span>提醒獨立幕沿用前一幕左圖</span>';body.append(previous);
  $('oneNoteReveal').onchange=event=>{
    if(!commitField()||!overlay.finish())return;
    core.beginExternalInput();state.note.revealMode=event.target.value==='after'?'after':'with';
    state.note.revealBlockId=event.target.value==='after'?'':event.target.value;
    renderEditor();renderCanvas();refresh();
  };
  $('oneNotePrevious').onchange=event=>{state.note.usePreviousImage=event.target.checked;renderEditor();renderCanvas();};
  $('noteEnabled').addEventListener('change',()=>{if(state.note.enabled&&!state.note.text.trim())state.note.text='小提醒：請確認當次現場資訊。';renderEditor();renderCanvas();refresh();});
  $('noteText').addEventListener('input',()=>{if(!fieldSession?.composing){renderEditorIfCountChanged();schedule();}});
  let lastTotal=model.items(state).length;
  function renderEditorIfCountChanged(){const count=model.items(state).length;if(count!==lastTotal){lastTotal=count;renderEditor();}else syncSettings();}

  const panel=document.querySelector('.preview-panel'),footer=panel.querySelector('.export-bar');
  footer.before($('sequenceStrip'));
  $('sequenceImageControls').append($('openImageDrawer'));
  const exports=footer.querySelector('.export-actions');exports.append($('exportSequenceAll'));exports.classList.remove('single');
  const follow=document.createElement('label');follow.className='toggle-row one-follow';follow.innerHTML='<input type="checkbox" id="oneFollowPreview" checked><span>新增／編輯後續項目時跟隨到該幕</span>';$('sequenceStrip').append(follow);
  $('sequenceImageButton').hidden=true;
  const newNote=button('＋小提醒',()=>{if(!safe())return;state.note.enabled=true;state.note.text=state.note.text||'小提醒：請確認當次現場資訊。';renderEditor();renderCanvas();refresh();openField('note');});newNote.id='oneAddNote';noteTitle.after(newNote);

  function organizeToolbar(){
    const toolbar=$('wordToolbar'),row=toolbar.querySelector('.toolbar-row-primary');
    const secondary=toolbar.querySelector('.toolbar-row-secondary');
    if(!row||!secondary)return;
    $('stylePreset').hidden=true;$('stylePreset').setAttribute('aria-hidden','true');
    while(secondary.firstChild)row.append(secondary.firstChild);secondary.hidden=true;
    toolbar.dataset.integrated='1';
  }
  organizeToolbar();
  const templateSummary=$('contentTemplatePicker').querySelector('summary');
  templateSummary.title='切換範本會重設文字內容；操作前會確認。';
  const warning=document.createElement('small');warning.className='one-compact-warning';warning.textContent='換範本會重設文字';templateSummary.append(warning);

  function organizeFiles(){
    const packagePanel=dock.querySelector('[data-one-project-package-ui]');
    if(!packagePanel)return;
    const row=packagePanel.querySelector('.one-project-package__row');
    ['exportProject','importProjectBtn','exportJson','resetAll'].forEach(id=>{const el=$(id);if(el&&el.parentNode!==row)row.append(el);});
    const file=$('projectInput');if(file&&file.parentNode!==packagePanel)packagePanel.append(file);
    const old=dock.querySelector('.legacy-save-tools');if(old)old.hidden=true;
    const title=packagePanel.querySelector('.one-project-package__title');if(title)title.textContent='完整專案 ZIP／相容檔案';
    const reset=$('resetAll');reset.classList.add('one-danger');
  }
  organizeFiles();setTimeout(organizeFiles,300);
  const resetBefore=$('resetAll').onclick;$('resetAll').onclick=()=>{if(confirm('重設目前內容？尚未暫存的文字會被取代。'))resetBefore?.();};
  $('templateButtons').addEventListener('click',event=>{if(event.target.closest('[data-template]')&&!confirm('切換範本會重設文字內容；圖片保留。確定切換？')){event.preventDefault();event.stopImmediatePropagation();}},true);
  document.querySelectorAll('[data-card-mode]').forEach(b=>b.addEventListener('click',event=>{if(b.dataset.cardMode!==state.mode&&!confirm('切換模式會套用對應範本並重設文字。確定切換？')){event.preventDefault();event.stopImmediatePropagation();}},true));

  function defaultTitles(){
    const matchesDefault=state.templateId==='standard'&&plain(state.blocks[0]?.html)==='說明卡主標題';
    Object.values(TEMPLATES).forEach(t=>{const make=t.make;t.make=()=>make().map(item=>item.kind==='title'?{...item,html:`<span style="font-size:56px;font-weight:800;color:${BRAND.cream}">${esc(plain(item.html))}</span>`}:item);});
    // Simplified visible ABCD starter; imported historical content is never flattened.
    TEMPLATES.abcd.make=()=>[block('title','<span style="font-size:56px">選項比較一次看懂</span>'),block('subtitle','依序看懂四個選項'),...['第一個選項重點','第二個選項重點','第三個選項重點','第四個選項重點'].map((text,i)=>block('body',text,'ABCD'[i],true))];
    defaults.blocks=TEMPLATES.standard.make();
    if(matchesDefault)state.blocks[0].html=defaults.blocks[0].html;
  }
  defaultTitles();

  function organizeDrawer(){
    const scroll=$('imageDrawer').querySelector('.drawer-scroll');
    const previewSection=$('imageLivePreview').closest('.drawer-section');
    const controls=document.createElement('div');controls.className='one-drawer-controls';
    [...scroll.children].filter(el=>el!==previewSection).forEach(el=>controls.append(el));
    previewSection.classList.add('one-drawer-preview');scroll.append(controls,previewSection);scroll.classList.add('one-drawer-grid');
  }
  organizeDrawer();

  function decorateOutline(){
    for(const b of list.querySelectorAll('button[data-overlay-block]')){
      if(b.parentElement.classList.contains('one-outline-row'))continue;
      const id=b.dataset.overlayBlock,item=state.blocks.find(x=>x.id===id);if(!item)continue;
      const row=document.createElement('div');row.className='one-outline-row';row.dataset.id=id;b.before(row);row.append(b);
      if(item.kind!=='body')continue;
      const tools=document.createElement('div');tools.className='one-outline-actions';
      const mark=document.createElement('input');mark.type='checkbox';mark.checked=item.marker.enabled;mark.title='顯示左側標記';mark.setAttribute('aria-label','顯示左側標記');
      const input=document.createElement('input');input.className='one-outline-marker';input.value=item.marker.text;input.maxLength=18;input.placeholder='標記';input.hidden=!mark.checked;
      mark.onchange=()=>{if(!overlay.finish())return;core.beginExternalInput();const item=state.blocks.find(x=>x.id===id);item.marker.enabled=mark.checked;input.hidden=!mark.checked;renderEditor();renderCanvas();};
      input.oninput=()=>{const item=state.blocks.find(x=>x.id===id);if(item){item.marker.text=input.value.replace(/[\r\n]/g,' ');const original=$('wordPage').querySelector(`.edit-block[data-id="${CSS.escape(id)}"] .marker-input`);if(original)original.value=item.marker.text;renderCanvas();}};
      input.addEventListener('beforeinput',()=>core.beginExternalInput());
      tools.append(mark,input);
      for(const [text,act] of [['↑','up'],['↓','down'],['×','del']]){
        const action=button(text,()=>{if(!safe()||!commitField()||!overlay.finish())return;const source=$('wordPage').querySelector(`.edit-block[data-id="${CSS.escape(id)}"] [data-act="${act}"]`);source?.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));source?.click();schedule();});
        action.title={up:'往前一項',down:'往後一項',del:'刪除此項'}[act];tools.append(action);
      }
      row.append(tools);
    }
  }
  markerObserver=new MutationObserver(()=>{decorateOutline();});markerObserver.observe(list,{childList:true});decorateOutline();
  // Keep custom marker fields active; text edits may refresh the outline but must not steal focus.
  list.addEventListener('pointerdown',event=>{if(event.target.matches('input'))event.stopPropagation();},true);

  function refresh(){
    pending=false;
    for(const b of $('templateButtons').querySelectorAll('[data-template]'))b.hidden=['list','warning','gallery'].includes(b.dataset.template);
    const badge=$('contentTemplatePicker')?.querySelector('.ui-fold-badge');if(badge)badge.textContent='4 種範本';
    document.querySelector('[data-card-mode="content"] span').textContent='4 種範本＋圖文';
    document.querySelector('[data-card-mode="gallery"] span').textContent='標籤＋標題＋圖片';
    const picker=$('oneNoteReveal'),wanted=state.note.revealMode==='with'?(bodies().some(b=>b.id===state.note.revealBlockId)?state.note.revealBlockId:bodies().at(-1)?.id):'after';
    const signature=bodies().map(b=>b.id).join('|');
    if(picker.dataset.signature!==signature){picker.innerHTML='<option value="after">說明結束後，獨立一幕出現</option>'+bodies().map((b,i)=>`<option value="${esc(b.id)}">從第 ${i+1} 幕一起出現</option>`).join('');picker.dataset.signature=signature;}
    picker.value=wanted||'after';$('oneNotePrevious').checked=state.note.usePreviousImage!==false;previous.hidden=state.note.revealMode==='with';
    note.hidden=state.mode==='gallery';
    $('noteText').disabled=!state.note.enabled;picker.disabled=!state.note.enabled;
    const total=model.items(state).length,count=Number(state.sequence.visibleCount||1);
    const select=$('sequenceVisibleCount');[...select.options].forEach((opt,i)=>{const next=`第 ${i+1} 幕${model.items(state)[i]?.kind==='note'?'｜小提醒':''}`;if(opt.textContent!==next)opt.textContent=next;});
    $('exportSequenceAll').hidden=!isSequence();
    $('exportPng').textContent=isSequence()?`輸出目前第 ${count} 幕 PNG`:'輸出說明卡 PNG';
    if(isSequence()){
      $('exportSequenceAll').textContent=`輸出全部 ${total} 幕 PNG ZIP`;
      $('dimensionText').textContent=`${canvas.width} × ${canvas.height}px｜累積 ${count}／${total} 幕・固定尺寸`;
      $('sequenceImageTitle').textContent=`第 ${count} 幕${model.items(state)[count-1]?.kind==='note'?'（小提醒）':''}左圖`;
    }
    const noteText=document.querySelector('.export-bar p');if(noteText)noteText.textContent='透明 PNG；累積畫面固定尺寸。專案檔案請由頂部載入或保存。';
    const backupStatus=document.querySelector('#quickSaveHost .one-edit-backup__status');if(backupStatus&&backupStatus.textContent)$('oneSaveStatus').title=backupStatus.textContent;
    // Fit actual card geometry above the sequence/export dock, without changing output pixels.
    if(innerWidth>700){
      const stage=canvas.parentElement;
      const available=Math.max(180,innerHeight-stage.getBoundingClientRect().top-$('sequenceStrip').offsetHeight-footer.offsetHeight-40);
      const w=Math.min(stage.clientWidth-32,available*canvas.width/canvas.height),h=w*canvas.height/canvas.width;
      if(Math.abs(canvas.getBoundingClientRect().width-w)>.5){canvas.style.setProperty('width',w+'px','important');canvas.style.setProperty('height',h+'px','important');canvas.style.setProperty('max-height','none','important');}
    }else{canvas.style.removeProperty('width');canvas.style.removeProperty('height');}
    if(fieldSession&&!fieldSession.composing)positionField();
    decorateOutline();
  }
  function schedule(){if(!pending){pending=true;requestAnimationFrame(refresh);}}

  const fieldLayer=document.createElement('div');fieldLayer.id='oneInlineField';fieldLayer.hidden=true;canvas.parentElement.append(fieldLayer);
  function fieldGeometry(type,id){
    const l=layoutCard(canvas.getContext('2d'));
    if(type==='note'&&l.noteY!==null&&model.noteVisible(state))return{x:l.textX+82,y:l.noteY+15,w:l.textW-94,h:l.noteH-24,size:state.note.size,weight:600,color:BRAND.cream,lineHeight:state.note.size*1.36};
    const row=l.rows?.find(r=>r.block.id===id);if(type==='marker'&&row?.marker)return{x:l.textX,y:row.y,w:row.marker.width,h:row.height,size:row.marker.size,weight:800,color:BRAND.teal,lineHeight:row.marker.size*1.42};
    return null;
  }
  function positionField(){
    if(!fieldSession)return;
    const g=fieldGeometry(fieldSession.type,fieldSession.id);if(!g)return;
    const r=canvas.getBoundingClientRect(),p=canvas.parentElement.getBoundingClientRect(),sx=r.width/canvas.width,sy=r.height/canvas.height;
    Object.assign(fieldLayer.style,{left:(r.left-p.left+g.x*sx)+'px',top:(r.top-p.top+g.y*sy)+'px',width:g.w+'px',height:g.h+'px',transform:`scale(${sx},${sy})`});
    Object.assign(fieldSession.input.style,{fontSize:g.size+'px',fontWeight:String(g.weight),color:g.color,lineHeight:g.lineHeight+'px'});
  }
  function openField(type,id){
    if(!safe()||!overlay.finish()||!commitField())return false;
    if(type==='note'&&isSequence()&&!model.noteVisible(state)){
      const items=model.items(state),i=state.note.revealMode==='with'?bodies().findIndex(b=>b.id===state.note.revealBlockId):items.length-1;
      __ONE_V049__.activateStep(i<0?items.length-1:i);
    }
    const input=type==='note'?$('noteText'):$('wordPage').querySelector(`.edit-block[data-id="${CSS.escape(id)}"] .marker-input`);
    const g=fieldGeometry(type,id);if(!input||!g){$('noteText').focus();return false;}
    const anchor=document.createComment('inline field home');input.before(anchor);
    fieldSession={type,id,input,anchor,style:input.style.cssText,composing:false};
    fieldLayer.hidden=false;fieldLayer.append(input);input.classList.add('one-native-field');positionField();renderCanvas();input.focus({preventScroll:true});
    return true;
  }
  function commitField(){
    if(!fieldSession)return true;if(fieldSession.composing){toast('請先完成中文選字。',true);return false;}
    const old=fieldSession;fieldSession=null;
    if(old.type==='note')state.note.text=old.input.value;else{const item=state.blocks.find(b=>b.id===old.id);if(item)item.marker.text=old.input.value;}
    old.anchor.after(old.input);old.anchor.remove();old.input.classList.remove('one-native-field');old.input.style.cssText=old.style;fieldLayer.hidden=true;
    renderCanvas();schedule();return true;
  }
  canvas.addEventListener('click',event=>{
    if(state.mode==='gallery')return;
    const r=canvas.getBoundingClientRect(),x=(event.clientX-r.left)*canvas.width/r.width,y=(event.clientY-r.top)*canvas.height/r.height,l=layoutCard(canvas.getContext('2d'));
    if(model.noteVisible(state)&&l.noteY!==null&&x>=l.textX&&x<=l.textRight&&y>=l.noteY&&y<=l.noteY+l.noteH){event.stopImmediatePropagation();openField('note');return;}
    const visible=isSequence()?l.rows.slice(0,state.sequence.visibleCount):l.rows;
    const hit=visible.find(row=>row.marker&&x>=l.textX&&x<row.rowTextX&&y>=row.y&&y<=row.y+row.height);
    if(hit){event.stopImmediatePropagation();openField('marker',hit.block.id);}
  },true);
  document.addEventListener('input',event=>{if(fieldSession?.composing&&event.target===fieldSession.input)event.stopImmediatePropagation();},true);
  fieldLayer.addEventListener('compositionstart',()=>{if(fieldSession){core.beginExternalInput();fieldSession.composing=true;}});
  fieldLayer.addEventListener('compositionend',()=>{if(fieldSession){fieldSession.composing=false;fieldSession.input.dispatchEvent(new Event('input',{bubbles:true}));schedule();}});
  fieldLayer.addEventListener('beforeinput',()=>{if(fieldSession&&!fieldSession.composing)core.beginExternalInput();});
  fieldLayer.addEventListener('keydown',event=>{if(fieldSession&&(event.isComposing||fieldSession.composing||event.keyCode===229))return;if(event.key==='Escape'||(event.key==='Enter'&&!event.shiftKey)){event.preventDefault();commitField();}});
  document.addEventListener('pointerdown',event=>{if(fieldSession&&!fieldLayer.contains(event.target)){if(!commitField()){event.preventDefault();event.stopImmediatePropagation();}}},true);
  document.addEventListener('click',event=>{if(fieldSession&&!fieldLayer.contains(event.target))commitField();},true);

  const renderBefore=renderCanvas;
  renderCanvas=function(target=canvas){
    const context=target.getContext('2d'),fill=context.fillText;
    const g=fieldSession&&target===canvas?fieldGeometry(fieldSession.type,fieldSession.id):null;
    if(g)context.fillText=function(text,x,y,...rest){if(x>=g.x-.1&&x<=g.x+g.w+.1&&y>=g.y&&y<=g.y+g.h+12)return;return fill.call(this,text,x,y,...rest);};
    try{return renderBefore(target);}finally{context.fillText=fill;if(target===canvas)schedule();}
  };
  const editorBefore=renderEditor;renderEditor=function(){if(fieldSession&&!fieldSession.composing)commitField();const out=editorBefore();schedule();return out;};
  const loadBefore=loadImage;loadImage=function(file){if(file&&model.items(state)[Number(state.sequence?.visibleCount||1)-1]?.kind==='note')state.note.usePreviousImage=false;return loadBefore(file);};
  $('imageDrawer').addEventListener('input',event=>{if(model.items(state)[Number(state.sequence?.visibleCount||1)-1]?.kind==='note'&&event.target.matches('input'))state.note.usePreviousImage=false;},true);
  $('imageDrawer').addEventListener('click',event=>{if(model.items(state)[Number(state.sequence?.visibleCount||1)-1]?.kind==='note'&&event.target.closest('[data-fit],[data-image-align]'))state.note.usePreviousImage=false;},true);
  const priorAdd=$('addBlock').onclick;$('addBlock').onclick=event=>{if(!safe())return;priorAdd?.(event);if($('oneFollowPreview').checked&&isSequence()){const i=bodies().length-1;__ONE_V049__.activateStep(i);}schedule();};
  document.addEventListener('input',schedule);document.addEventListener('change',schedule);new ResizeObserver(schedule).observe(canvas);
  window.ONEExplanationWorkspace={version:'SCREENSHOT_REPAIR_V2_20260905',refresh,schedule,openField,commitField,fieldState:()=>fieldSession?{type:fieldSession.type,id:fieldSession.id}:null};
  const oldPayload=projectPayload;
  projectPayload=function(){const p=oldPayload();p.generator_version='SCREENSHOT_REPAIR_V2_20260905';p.status='CANDIDATE';p.extensions={...(p.extensions||{}),cumulative_note:1};return p;};
  window.__ONE_V049__.projectPayload=projectPayload;
  renderEditor();renderCanvas();refresh();
  document.title='O-Ne 說明卡｜截圖需求整合修正版（候選）';
  document.querySelector('.title-line h1').firstChild.textContent='O-Ne 說明卡 ';
  document.querySelector('.title-line h1 span').textContent='整合候選';
  $('oneOverlayStatus').textContent='點字卡改字；提醒已加入累積出場。';
})();
