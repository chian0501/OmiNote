function mountFallbackBackup(){if(window.ONEEditBackup)return;const host=$('quickSaveHost');if(!host)return;const key='one.edit-history.v1:explanation-card';let memory=[];const read=()=>{try{const v=JSON.parse(localStorage.getItem(key)||'[]').slice(0,5);memory=v;return v}catch(e){return memory.slice(0,5)}},write=h=>{memory=h.slice(0,5);try{localStorage.setItem(key,JSON.stringify(memory))}catch(e){}};const panel=document.createElement('section');panel.className='one-edit-backup';panel.setAttribute('data-one-backup-ui','');panel.innerHTML='<div class="one-edit-backup__title"><span>最近 5 次暫存</span><span class="one-edit-backup__badge">手動保存</span></div><div class="one-edit-backup__row is-manual"><select aria-label="最近暫存"></select><button type="button" data-action="save">暫存目前內容</button><button type="button" data-action="restore">還原</button><button type="button" data-action="load">載入存檔</button><button type="button" data-action="clear">清除</button></div><input type="file" accept="application/json,.json" hidden><div class="one-edit-backup__status"></div>';host.appendChild(panel);const sel=panel.querySelector('select'),status=panel.querySelector('.one-edit-backup__status'),file=panel.querySelector('input[type=file]');function refresh(){const h=read();sel.innerHTML=h.length?h.map((x,i)=>'<option value="'+i+'">第 '+(i+1)+' 次｜'+new Date(x.saved_at).toLocaleString('zh-TW',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})+'</option>').join(''):'<option value="">尚無暫存</option>';panel.querySelector('[data-action=restore]').disabled=!h.length;panel.querySelector('[data-action=clear]').disabled=!h.length}panel.querySelector('[data-action=save]').onclick=()=>{const snap=capture(),h=read().filter(x=>JSON.stringify(x.data)!==JSON.stringify(snap));h.unshift({saved_at:new Date().toISOString(),data:snap});write(h);refresh();status.textContent='已暫存，目前保留 '+read().length+'／5 次。'};panel.querySelector('[data-action=restore]').onclick=()=>{const h=read(),x=h[Number(sel.value)];if(x){applySnapshot(x.data);status.textContent='已還原選取暫存。'}};panel.querySelector('[data-action=load]').onclick=()=>file.click();file.onchange=e=>{const f=e.target.files&&e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{applySnapshot(fromJSON(JSON.parse(String(r.result))));status.textContent='存檔載入成功；若要留在最近 5 次，請按暫存目前內容。'}catch(err){status.textContent='載入失敗：'+err.message}file.value=''};r.readAsText(f,'utf-8')};panel.querySelector('[data-action=clear]').onclick=()=>{memory=[];try{localStorage.removeItem(key)}catch(e){}refresh();status.textContent='已清除暫存。'};refresh();status.textContent=read().length?'已讀到最近暫存，可直接還原。':'尚無暫存，完成一個版本後按「暫存目前內容」。'}
mountFallbackBackup();
if(window.ONEEditBackup){window.ONEEditBackup.mount({id:'explanation-card',saveMode:'manual',generatorVersion:'V0.4.9_20260903',host:$('quickSaveHost'),imageNote:true,getCanvas:()=>canvas,getTitle:s=>{const b=s&&s.blocks&&s.blocks.find(x=>x.kind==='title');return b?String(b.html).replace(/<[^>]+>/g,''):''},getStatus:()=>state&&state.mode==='gallery'?'純圖片字卡':state&&state.sequence&&state.sequence.enabled?'逐步圖文':'RichText',capture,apply:applySnapshot,fromJSON});setTimeout(()=>{const p=$('quickSaveHost').querySelector('.one-edit-backup');if(!p)return;const title=p.querySelector('.one-edit-backup__title span:first-child');if(title)title.textContent='快速暫存';const load=p.querySelector('[data-action=load]');if(load)load.textContent='載入舊 JSON';},0)}
window.__ONE_V030__={getState:()=>clone(state),getLayout:()=>layoutCard(canvas.getContext('2d')),applyTemplate:(id)=>applyTemplate(id,true),legacyToState,htmlToParagraphs,render:renderCanvas,openImageDrawer,renderCropper,hitCropTarget,updateFreeCropFromDrag,projectPayload,loadProjectPayload};
if(new URLSearchParams(location.search).get('qa')==='1')setTimeout(()=>{if(!window.__ONE_V040__)runQa()},40);

(function installExplanationFormatTools(){
  const PATCH='FORMAT_TOOLS_V1_20260904';
  const FONT_SIZES=[24,29,30,34,36,40,48,56,68];
  let copiedStyle=null;

  function normalizeRichStyleKeywords(html){
    const host=document.createElement('div');
    host.innerHTML=String(html||'');
    host.querySelectorAll('span').forEach(span=>{
      const raw=String(span.style.fontWeight||'').toLowerCase();
      if(raw==='bold'||raw==='bolder')span.style.fontWeight='800';
      else if(raw==='normal'||raw==='lighter')span.style.fontWeight='500';
    });
    return host.innerHTML;
  }

  const sanitizeHtmlBeforeFormatTools=sanitizeHtml;
  sanitizeHtml=function(html){return sanitizeHtmlBeforeFormatTools(normalizeRichStyleKeywords(html));};

  execRich=function(cmd,value=null){
    if(!activeEditor)return;
    restoreSelection();
    document.execCommand('styleWithCSS',false,false);
    document.execCommand(cmd,false,value);
    saveSelection();
    syncActiveHtml();
    setTimeout(updateFormatUi,0);
  };

  function baseStyleForActive(){
    if(!activeEditor)return null;
    const kind=activeEditor.dataset&&activeEditor.dataset.kind||'body';
    const base=BASE_STYLE[kind]||BASE_STYLE.body;
    const id=activeEditor.closest('.edit-block')&&activeEditor.closest('.edit-block').dataset.id;
    const blockState=state&&Array.isArray(state.blocks)?state.blocks.find(item=>item.id===id):null;
    return{size:Number(base.size||29),weight:Number(base.weight||500),color:String(base.color||BRAND.cream),italic:false,underline:false,strike:false,align:blockState&&blockState.align||activeEditor.style.textAlign||'left'};
  }

  function readStyleAtNode(node){
    const style=baseStyleForActive();
    if(!style||!activeEditor)return style;
    let element=node&&node.nodeType===1?node:node&&node.parentElement;
    const path=[];
    while(element&&element!==activeEditor){path.unshift(element);element=element.parentElement;}
    path.forEach(el=>{
      const tag=el.tagName;
      if(tag==='B'||tag==='STRONG')style.weight=800;
      if(tag==='I'||tag==='EM')style.italic=true;
      if(tag==='U')style.underline=true;
      if(tag==='S'||tag==='STRIKE')style.strike=true;
      const fs=parseFloat(el.style&&el.style.fontSize||'');
      if(Number.isFinite(fs)&&fs>0)style.size=Math.round(fs);
      const fwRaw=String(el.style&&el.style.fontWeight||'').toLowerCase();
      const fw=parseInt(fwRaw,10);
      if(fwRaw==='bold'||fwRaw==='bolder')style.weight=800;
      else if(fwRaw==='normal'||fwRaw==='lighter')style.weight=500;
      else if(Number.isFinite(fw)&&fw>0)style.weight=fw;
      const color=el.style&&el.style.color;
      if(color)style.color=color;
      const fontStyle=String(el.style&&el.style.fontStyle||'').toLowerCase();
      if(fontStyle==='italic')style.italic=true;
      if(fontStyle==='normal')style.italic=false;
      const td=String(el.style&&((el.style.textDecorationLine||el.style.textDecoration)||'')).toLowerCase();
      if(td){style.underline=/underline/.test(td);style.strike=/line-through/.test(td);}
    });
    return style;
  }

  function currentRange(){
    if(!activeEditor)return null;
    const selection=window.getSelection&&window.getSelection();
    if(selection&&selection.rangeCount){
      const range=selection.getRangeAt(0);
      if(activeEditor.contains(range.commonAncestorContainer))return range.cloneRange();
    }
    if(savedRange&&activeEditor.contains(savedRange.commonAncestorContainer))return savedRange.cloneRange();
    return null;
  }

  function stylesForRange(range){
    if(!activeEditor)return[];
    if(!range||range.collapsed)return[readStyleAtNode(range?range.startContainer:activeEditor)];
    const styles=[];
    const walker=document.createTreeWalker(activeEditor,NodeFilter.SHOW_TEXT);
    let node;
    while((node=walker.nextNode())){
      if(!String(node.nodeValue||'').trim())continue;
      let intersects=false;
      try{intersects=range.intersectsNode(node);}catch(error){intersects=false;}
      if(intersects)styles.push(readStyleAtNode(node));
    }
    return styles.length?styles:[readStyleAtNode(range.startContainer)];
  }

  function styleSignature(style){
    return[style.size,style.weight,String(style.color),style.italic?1:0,style.underline?1:0,style.strike?1:0,style.align].join('|');
  }

  function currentStyleInfo(){
    const range=currentRange();
    const styles=stylesForRange(range);
    const unique=[...new Map(styles.map(item=>[styleSignature(item),item])).values()];
    return{range,styles,unique,mixed:unique.length>1,style:unique[0]||baseStyleForActive()};
  }

  function formatLabel(style){
    if(!style)return'未取得樣式';
    const extras=[];
    if(Number(style.weight)>=700)extras.push('粗體');
    if(style.italic)extras.push('斜體');
    if(style.underline)extras.push('底線');
    if(style.strike)extras.push('刪除線');
    return`${Math.round(style.size)}px${extras.length?'｜'+extras.join('／'):''}`;
  }

  function installFormatCss(){
    if(document.getElementById('explanationFormatToolsStyle'))return;
    const style=document.createElement('style');
    style.id='explanationFormatToolsStyle';
    style.textContent=`
      #fontSizeSelect{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important}
      .font-size-visual-picker{position:relative;display:inline-flex;align-items:center}
      .font-size-current{height:36px;min-width:82px;padding:0 10px;border:1px solid #415467;border-radius:6px;background:#111c27;color:#f1eee9;font-size:12px;font-weight:800;cursor:pointer}
      .font-size-current.is-mixed{color:#ffd978}
      .font-size-menu{position:absolute;top:calc(100% + 7px);left:0;z-index:90;width:220px;max-height:430px;overflow:auto;padding:7px;border:1px solid #405467;border-radius:8px;background:#0d151f;box-shadow:0 14px 36px rgba(0,0,0,.42)}
      .font-size-menu[hidden]{display:none}
      .font-size-option{width:100%;display:grid;grid-template-columns:54px 1fr;align-items:center;gap:10px;padding:7px 9px;border:0;border-bottom:1px solid #263544;background:transparent;color:#f1eee9;text-align:left;cursor:pointer}
      .font-size-option:last-child{border-bottom:0}
      .font-size-option:hover,.font-size-option.is-active{background:#12383d}
      .font-size-value{font-size:11px;color:#8fe0d7;font-variant-numeric:tabular-nums}
      .font-size-sample{display:block;line-height:1;white-space:nowrap;color:#fdf3e7;font-weight:700}
      .format-painter-group{display:inline-flex;align-items:center;gap:5px}
      .format-painter-group .tool-btn{width:auto;min-width:66px;padding:0 8px;font-size:11px;font-weight:800}
      .format-painter-group .tool-btn.is-copied{border-color:#ffbe37;background:#3b2d12;color:#ffd978}
      .format-painter-group .tool-btn:disabled{opacity:.38;cursor:not-allowed}
      .tool-btn.is-format-active{border-color:#29a6a7!important;background:#12383d!important;color:#9ff1e7!important}
      @media(max-width:700px){.font-size-menu{width:min(220px,80vw)}.format-painter-group .tool-btn{min-width:58px;padding:0 6px}}
    `;
    document.head.appendChild(style);
  }

  function buildVisualFontSizePicker(){
    const select=$('fontSizeSelect');
    if(!select||document.getElementById('fontSizeVisualPicker'))return;
    const picker=document.createElement('div');
    picker.className='font-size-visual-picker';
    picker.id='fontSizeVisualPicker';
    const current=document.createElement('button');
    current.type='button';
    current.className='font-size-current';
    current.id='fontSizeVisualButton';
    current.textContent='字級';
    current.title='顯示並套用實際字級';
    const menu=document.createElement('div');
    menu.className='font-size-menu';
    menu.id='fontSizeVisualMenu';
    menu.hidden=true;
    FONT_SIZES.forEach(size=>{
      const button=document.createElement('button');
      button.type='button';
      button.className='font-size-option';
      button.dataset.size=String(size);
      button.innerHTML=`<span class="font-size-value">${size}px</span><span class="font-size-sample" style="font-size:${size}px">Aa 字</span>`;
      button.addEventListener('click',event=>{
        event.preventDefault();
        if(typeof applyInlineStyle==='function')applyInlineStyle({size});
        menu.hidden=true;
        setTimeout(updateFormatUi,0);
      });
      menu.appendChild(button);
    });
    current.addEventListener('click',event=>{event.preventDefault();menu.hidden=!menu.hidden;});
    picker.append(current,menu);
    select.insertAdjacentElement('afterend',picker);
    document.addEventListener('pointerdown',event=>{if(!picker.contains(event.target))menu.hidden=true;});
  }

  function buildFormatPainter(){
    const picker=document.getElementById('fontSizeVisualPicker');
    if(!picker||document.getElementById('formatPainterGroup'))return;
    const group=document.createElement('div');
    group.className='format-painter-group';
    group.id='formatPainterGroup';
    const copy=document.createElement('button');
    copy.type='button';
    copy.className='tool-btn';
    copy.id='copyStyleBtn';
    copy.textContent='複製樣式';
    copy.title='複製字級、粗細、顏色、斜體、底線、刪除線與對齊';
    const apply=document.createElement('button');
    apply.type='button';
    apply.className='tool-btn';
    apply.id='applyStyleBtn';
    apply.textContent='套用樣式';
    apply.title='把已複製的文字樣式套到目前選取文字；不複製文字、序號或項目點';
    apply.disabled=true;
    copy.addEventListener('click',()=>{
      const info=currentStyleInfo();
      if(!info.style){if(typeof toast==='function')toast('先點一下要複製樣式的文字。',true);return;}
      if(info.mixed){if(typeof toast==='function')toast('這段有混合格式，請選單一樣式文字再複製。',true);return;}
      copiedStyle={...info.style};
      copy.classList.add('is-copied');
      copy.textContent='已複製';
      apply.disabled=false;
      apply.title=`套用：${formatLabel(copiedStyle)}`;
      if(typeof toast==='function')toast(`已複製樣式：${formatLabel(copiedStyle)}。`);
    });
    apply.addEventListener('click',()=>{
      if(!copiedStyle){if(typeof toast==='function')toast('目前還沒有複製樣式。',true);return;}
      if(!activeEditor){if(typeof toast==='function')toast('先選取要套用的文字。',true);return;}
      const range=selectWholeIfCollapsed();
      if(!range)return;
      document.execCommand('styleWithCSS',false,false);
      document.execCommand('removeFormat',false,null);
      saveSelection();
      wrapSelectionStyle({size:copiedStyle.size,weight:copiedStyle.weight,color:copiedStyle.color});
      if(copiedStyle.italic)execRich('italic');
      if(copiedStyle.underline)execRich('underline');
      if(copiedStyle.strike)execRich('strikeThrough');
      if(copiedStyle.align)setAlign(copiedStyle.align);
      syncActiveHtml();
      if(typeof toast==='function')toast(`已套用樣式：${formatLabel(copiedStyle)}。`);
      setTimeout(updateFormatUi,0);
    });
    group.append(copy,apply);
    picker.insertAdjacentElement('afterend',group);
  }

  function updateFormatUi(){
    const info=currentStyleInfo();
    const current=document.getElementById('fontSizeVisualButton');
    const menu=document.getElementById('fontSizeVisualMenu');
    if(current){
      if(info.mixed){current.textContent='混合字級';current.classList.add('is-mixed');current.title='目前選取包含不同字級';}
      else if(info.style){current.textContent=`${Math.round(info.style.size)} px`;current.classList.remove('is-mixed');current.title=`目前字級：${Math.round(info.style.size)}px`;}else{current.textContent='字級';current.classList.remove('is-mixed');}
    }
    if(menu){
      menu.querySelectorAll('[data-size]').forEach(button=>button.classList.toggle('is-active',!info.mixed&&info.style&&Number(button.dataset.size)===Math.round(info.style.size)));
    }
    const styles=info.styles||[];
    const all=predicate=>styles.length>0&&styles.every(predicate);
    const states={bold:all(style=>Number(style.weight)>=700),italic:all(style=>style.italic),underline:all(style=>style.underline),strike:all(style=>style.strike)};
    const buttons=[[$('boldBtn'),'bold'],[$('italicBtn'),'italic'],[$('underlineBtn'),'underline'],[$('strikeBtn'),'strike']];
    buttons.forEach(([button,key])=>{if(!button)return;button.classList.toggle('is-format-active',states[key]);button.setAttribute('aria-pressed',states[key]?'true':'false');});
  }

  function bindFormatState(){
    const page=$('wordPage');
    const toolbar=$('wordToolbar');
    if(!page)return;
    ['focusin','click','keyup','mouseup','input'].forEach(type=>page.addEventListener(type,()=>setTimeout(updateFormatUi,0)));
    if(toolbar)toolbar.addEventListener('click',()=>setTimeout(updateFormatUi,0));
    document.addEventListener('selectionchange',()=>{if(activeEditor)setTimeout(updateFormatUi,0);});
    setTimeout(updateFormatUi,0);
  }

  function init(){
    if(document.documentElement.dataset.explanationFormatTools===PATCH)return;
    installFormatCss();
    buildVisualFontSizePicker();
    buildFormatPainter();
    bindFormatState();
    document.documentElement.dataset.explanationFormatTools=PATCH;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});
  else setTimeout(init,0);
})();
