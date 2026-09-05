'use strict';

// Opt-in pilot. Reuses the existing editable DOM, state, renderer and format history.
// No second Rich Text implementation and no persistence/schema migration.
(function installOverlayPilot(){
  if(window.ONEExplanationOverlayPilot)return;
  const $=id=>document.getElementById(id);
  if(!window.ONEExplanationFormatCore?.beginExternalInput || typeof renderCanvas!=='function' || typeof layoutCard!=='function')
    throw new Error('Overlay pilot requires the existing FORMAT_CORE_V3 editor.');
  const page=$('wordPage'),preview=$('previewCanvas'),toolbar=$('wordToolbar');
  if(!page||!preview||!toolbar)throw new Error('Overlay pilot: editor or preview is missing.');
  const core=window.ONEExplanationFormatCore;
  const home=document.createComment('overlay: original wordPage location');
  page.before(home);
  const toolbarHome=document.createComment('overlay: original toolbar location');
  toolbar.before(toolbarHome);
  const stage=preview.parentElement;
  const layer=document.createElement('div');layer.id='oneOverlayLayer';
  stage.classList.add('one-overlay-stage');stage.appendChild(layer);
  const controls=document.createElement('div');controls.className='one-overlay-controls';
  controls.innerHTML='<strong>原位改字 <small>PILOT</small></strong><span id="oneOverlayStatus" role="status">點成品文字即可編輯；原版功能仍保留。</span><button type="button" id="oneOverlayDone">完成編輯</button><button type="button" id="oneOverlayFallback">原編輯區</button>';
  const panel=preview.closest('.preview-panel')||stage;
  panel.before(controls);controls.after(toolbar);
  const details=document.createElement('details');details.id='oneOverlayOutline';details.open=true;
  const summary=document.createElement('summary');summary.textContent='內容清單｜選取尚未顯示的項目';
  const list=document.createElement('div');list.className='one-overlay-list';
  details.append(summary,list);home.parentNode.insertBefore(details,home);
  let session=null,composing=false,settling=false,rebuilding=false,enabled=true,refreshToken=0;
  const paintLayouts=new WeakMap();
  const baseLayout=layoutCard,baseDraw=drawRich,baseRender=renderCanvas,baseEditor=renderEditor;
  const status=message=>{$('oneOverlayStatus').textContent=message;};
  const currentBlocks=()=>state.blocks||[];
  const bodyBlocks=()=>currentBlocks().filter(b=>b.kind==='body');
  const hasSequence=()=>state.mode!=='gallery'&&state.sequence?.enabled&&bodyBlocks().length>1;
  const visibleIds=()=>new Set((hasSequence()?bodyBlocks().slice(0,state.sequence.visibleCount):bodyBlocks()).map(b=>b.id));
  const plain=html=>{const el=document.createElement('div');el.innerHTML=sanitizeHtml(html);return el.textContent||'';};

  function targets(layout){
    if(!layout||state.mode==='gallery')return [];
    const result=[];
    for(const kind of ['title','subtitle']){
      const b=currentBlocks().find(item=>item.kind===kind),rich=layout[kind+'Layout'];
      if(b&&rich?.lines?.length)result.push({id:b.id,kind,x:layout.textX,y:layout[kind+'Y'],w:layout.textW,h:rich.height,rich,align:b.align});
    }
    const visible=visibleIds();
    for(const row of layout.rows||[])if(visible.has(row.block.id))
      result.push({id:row.block.id,kind:'body',x:row.rowTextX,y:row.y,w:row.rowTextW,h:row.rich.height,rich:row.rich,align:row.block.align});
    return result;
  }
  function supported(target){return target?.rich?.lines?.length===1;}
  function geometry(){return layoutCard(preview.getContext('2d'));}
  function targetFor(id,layout=geometry()){return targets(layout).find(t=>t.id===id);}
  function richFor(id){return page.querySelector(`.edit-block[data-id="${CSS.escape(id)}"] .rich`);}
  function tellComposition(){status('請先完成中文選字，再切換項目、套格式或輸出。');}
  function syncCurrent(){
    if(!session||composing||settling)return;
    const item=currentBlocks().find(b=>b.id===session.id);
    if(item){item.html=sanitizeHtml(session.rich.innerHTML);state.templateId='custom';}
  }
  function clearSessionStyles(old){
    old.wrap.classList.remove('one-overlay-active');old.wrap.style.cssText=old.wrapStyle;
    old.rich.style.cssText=old.richStyle;
    const item=currentBlocks().find(b=>b.id===old.id);
    if(item)old.rich.style.textAlign=item.align||'left';
  }
  function detach(){
    if(!session)return;
    const old=session;session=null;
    clearSessionStyles(old);home.after(page);page.classList.remove('one-overlay-page');
    page.hidden=enabled;
  }
  function finish(){
    if(composing||settling){tellComposition();return false;}
    if(!session)return true;
    syncCurrent();
    detach();core.normalize();renderCanvas();refreshOutline();
    status('已同步內容；輸出仍使用原本 Canvas。');
    return true;
  }
  function showOriginal(id){
    if(!finish())return false;
    enabled=false;document.body.classList.remove('one-overlay-pilot');
    page.hidden=false;details.hidden=true;toolbarHome.after(toolbar);
    $('oneOverlayFallback').textContent='回到原位編輯';
    if(id){const rich=richFor(id);rich?.scrollIntoView({block:'center'});rich?.focus();}
    status('原編輯區已展開。多行段落與非本輪範圍沿用原版。');return true;
  }
  function enable(){
    enabled=true;document.body.classList.add('one-overlay-pilot');page.hidden=true;details.hidden=false;
    controls.after(toolbar);$('oneOverlayFallback').textContent='原編輯區';refreshOutline();renderCanvas();
  }
  function moveCaret(editor,point){
    editor.focus({preventScroll:true});
    let range=point&&document.caretRangeFromPoint?.(point.x,point.y);
    if(!range||!editor.contains(range.commonAncestorContainer)){
      range=document.createRange();range.selectNodeContents(editor);range.collapse(false);
    }
    const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);saveSelection();
  }
  function open(id,point){
    if(composing||settling){tellComposition();return false;}
    if(session?.id===id)return true;
    if(!finish())return false;
    if(!enabled)enable();
    const bodyIndex=bodyBlocks().findIndex(b=>b.id===id);
    if(hasSequence()&&bodyIndex>=state.sequence.visibleCount){
      // Use the real sequence API: changing only visibleCount would desynchronise its image.
      if(!window.__ONE_V049__){status('請先用原版幕次選單切換到這一項。');return false;}
      window.__ONE_V049__.activateStep(bodyIndex);
    }
    const target=targetFor(id),rich=richFor(id);
    if(!target||!rich){if(rich)showOriginal(id);status('此內容不在目前成品上；請在原編輯區輸入，或先確認幕次。');return false;}
    if(!supported(target)){showOriginal(id);status('本次 Pilot 先驗證單行文字；多行內容保留在原編輯區，不改寫格式。');return false;}
    const wrap=rich.closest('.edit-block');
    session={id,rich,wrap,wrapStyle:wrap.style.cssText,richStyle:rich.style.cssText};
    page.hidden=false;page.classList.add('one-overlay-page');layer.appendChild(page);
    wrap.classList.add('one-overlay-active');setActive(rich);
    renderCanvas();position(target);moveCaret(rich,point);core.refresh();
    status('原位編輯中｜Enter 完成；中文選字中的 Enter 不會關閉；Ctrl/Cmd+Z 復原。');
    return true;
  }
  function position(target){
    if(!session||!target)return;
    const rect=preview.getBoundingClientRect(),parent=stage.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    const sx=rect.width/preview.width,sy=rect.height/preview.height;
    Object.assign(layer.style,{left:(rect.left-parent.left+stage.scrollLeft)+'px',top:(rect.top-parent.top+stage.scrollTop)+'px',width:preview.width+'px',height:preview.height+'px',transform:`scale(${sx},${sy})`});
    // Never replace editable nodes or move their baseline during an IME composition.
    if(composing||settling)return;
    const {wrap,rich}=session,base=getBase(target.kind),line=target.rich.lines[0];
    Object.assign(wrap.style,{left:target.x+'px',top:target.y+'px',width:target.w+'px',height:Math.max(target.h,30)+'px'});
    Object.assign(rich.style,{fontFamily:'"Noto Sans TC","Microsoft JhengHei",sans-serif',fontSize:base.size+'px',fontWeight:String(base.weight),color:base.color,lineHeight:line.height+'px',textAlign:target.align||'left',width:target.w+'px',transform:'none'});
    // Measure a detached clone, not the active range, to align native DOM and Canvas baselines.
    const clone=rich.cloneNode(true);clone.removeAttribute('contenteditable');clone.className='one-overlay-measure';
    Object.assign(clone.style,{position:'fixed',left:'-10000px',top:'0',visibility:'hidden',padding:'0',margin:'0',whiteSpace:'pre-wrap',wordBreak:'break-all',border:'0'});
    const probe=document.createElement('span');probe.style.cssText='display:inline-block;width:0;height:0;padding:0;margin:0;vertical-align:baseline';
    (clone.querySelector('li')||clone).appendChild(probe);document.body.appendChild(clone);
    const domBaseline=probe.getBoundingClientRect().top-clone.getBoundingClientRect().top;clone.remove();
    rich.style.transform=`translateY(${line.height*.78-domBaseline}px)`;
    if(target.rich.lines.length>1)status('內容已超過單行；完成後請縮短文案，或改用原編輯區。內容不會被刪除。');
  }
  function refreshOutline(){
    if(composing||settling)return;
    const visible=visibleIds(),signature=JSON.stringify(currentBlocks().map(b=>[b.id,b.kind,plain(b.html),visible.has(b.id)]));
    if(list.dataset.signature===signature)return;list.dataset.signature=signature;list.replaceChildren();
    currentBlocks().forEach(b=>{
      const button=document.createElement('button');button.type='button';button.dataset.overlayBlock=b.id;
      const prefix=b.kind==='title'?'主標':b.kind==='subtitle'?'副標':`${bodyBlocks().findIndex(x=>x.id===b.id)+1}${visible.has(b.id)?'':'・後續幕'}`;
      button.textContent=`${prefix}｜${plain(b.html)||'（空白）'}`;button.title=button.textContent;
      button.addEventListener('click',()=>open(b.id));list.appendChild(button);
    });
    const add=document.createElement('button');add.type='button';add.textContent='＋新增一項';
    add.addEventListener('click',()=>{
      if(!finish())return;
      const source=$('addBlock');if(!source)return;
      source.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));source.click();
      const id=bodyBlocks().at(-1)?.id;setTimeout(()=>{refreshOutline();if(id)open(id);},30);
    });list.appendChild(add);
  }
  function refresh(){
    refreshToken=0;
    if(session&&!page.contains(session.rich)){session=null;home.after(page);page.classList.remove('one-overlay-page');page.hidden=enabled;}
    if(enabled&&state.mode==='gallery'){showOriginal();return;}
    if(session){const target=targetFor(session.id);if(target&&!supported(target)&&!composing&&!settling){const id=session.id;showOriginal(id);status('文字已超過單行，已保留內容並切回原編輯區。');return;}if(target)position(target);}
    refreshOutline();
  }
  function schedule(){if(!refreshToken)refreshToken=requestAnimationFrame(refresh);}

  layoutCard=function(context){const result=baseLayout(context);paintLayouts.set(context,result);return result;};
  drawRich=function(context,layout,x,y,width,align){
    const target=session&&targets(paintLayouts.get(context)).find(item=>item.id===session.id);
    if(session&&context.canvas===preview&&target?.rich===layout){
      // Keep bullets, but avoid double text. Export canvases always receive the full text.
      return baseDraw(context,{...layout,lines:layout.lines.map(line=>({...line,runs:[]}))},x,y,width,align);
    }
    return baseDraw(context,layout,x,y,width,align);
  };
  renderCanvas=function(target=preview){
    // Detached export canvases otherwise lose inherited zh-Hant glyph selection.
    // Reuse the document language for preview, PNG and ZIP without changing layout.
    if(!target.hasAttribute('lang'))target.lang=document.documentElement.lang||'zh-Hant';
    const result=baseRender(target);if(target===preview){if(session)position(targetFor(session.id,result));schedule();}return result;};
  renderEditor=function(){
    // Structural/import callers may already have replaced state. Never sync stale DOM back into it.
    rebuilding=true;
    try{
      if(session){detach();composing=false;settling=false;}
      const result=baseEditor();page.hidden=enabled&&!session;schedule();return result;
    }finally{rebuilding=false;}
  };

  preview.addEventListener('click',event=>{
    if(!enabled)return;
    const rect=preview.getBoundingClientRect(),x=(event.clientX-rect.left)*preview.width/rect.width,y=(event.clientY-rect.top)*preview.height/rect.height;
    const layout=geometry(),hit=targets(layout).find(t=>x>=t.x&&x<=t.x+t.w&&y>=t.y&&y<=t.y+Math.max(t.h,30));
    if(hit){event.preventDefault();open(hit.id,{x:event.clientX,y:event.clientY});return;}
    if(state.mode!=='gallery'&&x>=layout.imageX&&x<=layout.imageX+layout.imageW&&y>=layout.imageY&&y<=layout.imageY+layout.imageH){if(finish())$('openImageDrawer')?.click();return;}
    finish();
  });
  document.addEventListener('compositionstart',event=>{
    if(!session||event.target!==session.rich)return;
    core.beginExternalInput();composing=true;status('中文選字中…');
  },true);
  document.addEventListener('compositionend',event=>{
    if(!session||event.target!==session.rich)return;
    composing=false;settling=true;
    setTimeout(()=>{settling=false;if(session){syncCurrent();renderCanvas();core.refresh();}},0);
  },true);
  for(const type of ['beforeinput','input','focusout'])document.addEventListener(type,event=>{
    if(rebuilding&&type==='focusout'){event.stopImmediatePropagation();return;}
    if(!session||event.target!==session.rich)return;
    if(composing||settling||event.isComposing)event.stopImmediatePropagation();
  },true);
  page.addEventListener('input',()=>{if(session&&!composing&&!settling){syncCurrent();renderCanvas();}});
  document.addEventListener('keydown',event=>{
    if(!session)return;
    if(composing||settling||event.isComposing||event.keyCode===229){event.stopPropagation();return;}
    if(event.target!==session.rich&&!session.rich.contains(event.target))return;
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){
      event.preventDefault();event.stopImmediatePropagation();event.shiftKey?core.redo():core.undo();schedule();return;
    }
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){
      event.preventDefault();event.stopImmediatePropagation();core.redo();schedule();return;
    }
    if(event.key==='Enter'||event.key==='Escape'){event.preventDefault();event.stopPropagation();finish();}
  },true);
  const inToolbar=node=>toolbar.contains(node)||$('fontSizeVisualMenu')?.contains(node);
  document.addEventListener('pointerdown',event=>{
    if(!session||page.contains(event.target))return;
    if(composing||settling){event.preventDefault();event.stopImmediatePropagation();tellComposition();return;}
    if(inToolbar(event.target)||controls.contains(event.target))return;
    finish();
  },true);
  document.addEventListener('click',event=>{
    if(!session)return;
    if(composing||settling){if(!page.contains(event.target)){event.preventDefault();event.stopImmediatePropagation();tellComposition();}return;}
    // Commit before PNG, project ZIP, JSON, backup or sequence actions consume state/canvas.
    if(!page.contains(event.target)&&!inToolbar(event.target)&&!controls.contains(event.target))finish();
  },true);
  $('oneOverlayDone').addEventListener('click',finish);
  $('oneOverlayFallback').addEventListener('click',()=>enabled?showOriginal():enable());
  new ResizeObserver(schedule).observe(preview);window.addEventListener('resize',schedule);
  window.addEventListener('scroll',schedule,true);
  new MutationObserver(schedule).observe(page,{childList:true,subtree:true});
  document.addEventListener('change',schedule);document.addEventListener('input',schedule);
  document.fonts?.ready.then(schedule);
  window.ONEExplanationOverlayPilot={version:'OVERLAY_PILOT_V1_20260905',open,finish,showOriginal,enable,
    state:()=>({enabled,activeBlockId:session?.id||null,composing:composing||settling}),
    targets:()=>targets(geometry()).map(({rich,...target})=>({...target,supported:supported({rich})}))};
  document.title='說明卡｜原位編輯 PILOT（未發布）';
  const badge=document.querySelector('.title-line .badge');
  if(badge){badge.textContent='PILOT';badge.classList.remove('is-ready');}
  const liveStatus=document.querySelector('.app-header .status');
  if(liveStatus)liveStatus.textContent='候選樣品｜未合併／未部署';
  enable();
})();
