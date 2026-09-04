'use strict';

(function installExplanationFormatTools(){
  const PATCH='FORMAT_TOOLS_V2_20260904';
  const FONT_SIZES=[24,29,30,34,36,40,48,56,68];
  let copiedStyle=null;

  const $=id=>document.getElementById(id);

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

  function patchSanitizerAndCommands(){
    if(typeof sanitizeHtml!=='function'||typeof execRich!=='function')return false;
    if(!sanitizeHtml.__oneFormatPatched){
      const original=sanitizeHtml;
      const patched=function(html){return original(normalizeRichStyleKeywords(html));};
      patched.__oneFormatPatched=true;
      sanitizeHtml=patched;
    }
    execRich=function(cmd,value=null){
      if(!activeEditor)return;
      restoreSelection();
      document.execCommand('styleWithCSS',false,false);
      document.execCommand(cmd,false,value);
      saveSelection();
      syncActiveHtml();
      setTimeout(updateFormatUi,0);
    };
    return true;
  }

  function baseStyleForActive(){
    if(!activeEditor)return null;
    const kind=activeEditor.dataset&&activeEditor.dataset.kind||'body';
    const base=BASE_STYLE[kind]||BASE_STYLE.body;
    const wrap=activeEditor.closest('.edit-block');
    const blockState=wrap&&state&&Array.isArray(state.blocks)?state.blocks.find(item=>item.id===wrap.dataset.id):null;
    return{
      size:Number(base.size||29),weight:Number(base.weight||500),color:String(base.color||BRAND.cream),
      italic:false,underline:false,strike:false,align:blockState&&blockState.align||activeEditor.style.textAlign||'left'
    };
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

  function preserveTextSelection(control){
    if(!control||control.dataset.selectionGuard==='1')return;
    control.dataset.selectionGuard='1';
    control.addEventListener('pointerdown',event=>event.preventDefault());
  }

  function buildVisualFontSizePicker(){
    const select=$('fontSizeSelect');
    if(!select||$('fontSizeVisualPicker'))return;
    select.classList.add('is-compat-control');
    select.setAttribute('aria-hidden','true');
    select.tabIndex=-1;
    if($('stylePreset')&&$('stylePreset').options[0])$('stylePreset').options[0].textContent='文字樣式範本…';

    const picker=document.createElement('div');
    picker.className='font-size-visual-picker';
    picker.id='fontSizeVisualPicker';
    const current=document.createElement('button');
    current.type='button';
    current.className='font-size-current';
    current.id='fontSizeVisualButton';
    current.textContent='字級';
    current.title='顯示並套用實際字級';
    preserveTextSelection(current);

    const menu=document.createElement('div');
    menu.className='font-size-menu';
    menu.id='fontSizeVisualMenu';
    menu.hidden=true;
    FONT_SIZES.forEach(size=>{
      const button=document.createElement('button');
      button.type='button';
      button.className='font-size-option';
      button.dataset.size=String(size);
      button.innerHTML=`<span class="font-size-value">${size}px</span><span class="font-size-sample" style="font-size:${size}px">字 Aa</span>`;
      preserveTextSelection(button);
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

  function applyExactCopiedStyle(style){
    if(!activeEditor||!style)return false;
    let range=selectWholeIfCollapsed();
    if(!range)return false;
    document.execCommand('styleWithCSS',false,false);
    document.execCommand('removeFormat',false,null);
    saveSelection();
    range=restoreSelection();
    if(!range)return false;
    const span=document.createElement('span');
    span.style.fontSize=`${Math.round(style.size)}px`;
    span.style.fontWeight=String(Math.round(style.weight||500));
    span.style.color=style.color||BRAND.cream;
    if(style.italic)span.style.fontStyle='italic';
    const decoration=[];
    if(style.underline)decoration.push('underline');
    if(style.strike)decoration.push('line-through');
    if(decoration.length)span.style.textDecoration=decoration.join(' ');
    const fragment=range.extractContents();
    span.appendChild(fragment);
    range.insertNode(span);
    const after=document.createRange();
    after.selectNodeContents(span);
    const selection=window.getSelection();
    selection.removeAllRanges();
    selection.addRange(after);
    savedRange=after.cloneRange();
    if(style.align)setAlign(style.align);
    syncActiveHtml();
    return true;
  }

  function buildFormatPainter(){
    const picker=$('fontSizeVisualPicker');
    if(!picker||$('formatPainterGroup'))return;
    const group=document.createElement('div');
    group.className='format-painter-group';
    group.id='formatPainterGroup';
    const copy=document.createElement('button');
    copy.type='button';copy.className='tool-btn';copy.id='copyStyleBtn';copy.textContent='複製樣式';
    copy.title='複製字級、粗細、顏色、斜體、底線、刪除線與對齊';
    const apply=document.createElement('button');
    apply.type='button';apply.className='tool-btn';apply.id='applyStyleBtn';apply.textContent='套用樣式';
    apply.title='把已複製的文字樣式套到目前選取文字；不複製文字、序號或項目點';apply.disabled=true;
    preserveTextSelection(copy);preserveTextSelection(apply);
    copy.addEventListener('click',()=>{
      const info=currentStyleInfo();
      if(!info.style){if(typeof toast==='function')toast('先點一下要複製樣式的文字。',true);return;}
      if(info.mixed){if(typeof toast==='function')toast('這段有混合格式，請選單一樣式文字再複製。',true);return;}
      copiedStyle={...info.style};
      copy.classList.add('is-copied');copy.textContent='已複製';apply.disabled=false;
      apply.title=`套用：${formatLabel(copiedStyle)}`;
      if(typeof toast==='function')toast(`已複製樣式：${formatLabel(copiedStyle)}。`);
    });
    apply.addEventListener('click',()=>{
      if(!copiedStyle){if(typeof toast==='function')toast('目前還沒有複製樣式。',true);return;}
      if(!applyExactCopiedStyle(copiedStyle)){if(typeof toast==='function')toast('先選取要套用的文字。',true);return;}
      if(typeof toast==='function')toast(`已套用樣式：${formatLabel(copiedStyle)}。`);
      setTimeout(updateFormatUi,0);
    });
    group.append(copy,apply);
    picker.insertAdjacentElement('afterend',group);
  }

  function updateFormatUi(){
    const info=currentStyleInfo();
    const current=$('fontSizeVisualButton');
    const menu=$('fontSizeVisualMenu');
    if(current){
      if(info.mixed){current.textContent='混合字級';current.classList.add('is-mixed');current.title='目前選取包含不同字級';}
      else if(info.style){current.textContent=`${Math.round(info.style.size)} px`;current.classList.remove('is-mixed');current.title=`目前字級：${Math.round(info.style.size)}px`;}
      else{current.textContent='字級';current.classList.remove('is-mixed');}
    }
    if(menu)menu.querySelectorAll('[data-size]').forEach(button=>button.classList.toggle('is-active',!info.mixed&&info.style&&Number(button.dataset.size)===Math.round(info.style.size)));

    const styles=info.styles||[];
    const all=predicate=>styles.length>0&&styles.every(predicate);
    const any=predicate=>styles.some(predicate);
    const checks={
      bold:style=>Number(style.weight)>=700,
      italic:style=>style.italic,
      underline:style=>style.underline,
      strike:style=>style.strike
    };
    [[$('boldBtn'),'bold'],[$('italicBtn'),'italic'],[$('underlineBtn'),'underline'],[$('strikeBtn'),'strike']].forEach(([button,key])=>{
      if(!button)return;
      const full=all(checks[key]),partial=!full&&any(checks[key]);
      button.classList.toggle('is-format-active',full);
      button.classList.toggle('is-format-mixed',partial);
      button.setAttribute('aria-pressed',full?'true':partial?'mixed':'false');
      button.title=(key==='bold'?'粗體':key==='italic'?'斜體':key==='underline'?'底線':'刪除線')+(partial?'（部分套用）':'');
    });
  }

  function bindFormatState(){
    const page=$('wordPage');
    const toolbar=$('wordToolbar');
    if(!page)return;
    ['boldBtn','italicBtn','underlineBtn','strikeBtn','bulletBtn','clearBtn'].forEach(id=>preserveTextSelection($(id)));
    document.querySelectorAll('#wordToolbar [data-align],#wordToolbar .toolbar-swatch').forEach(preserveTextSelection);
    ['focusin','click','keyup','mouseup','input'].forEach(type=>page.addEventListener(type,()=>setTimeout(updateFormatUi,0)));
    if(toolbar)toolbar.addEventListener('click',()=>setTimeout(updateFormatUi,0));
    document.addEventListener('selectionchange',()=>{if(activeEditor)setTimeout(updateFormatUi,0);});
    setTimeout(updateFormatUi,0);
  }

  function init(){
    if(document.documentElement.dataset.explanationFormatTools===PATCH)return;
    if(!patchSanitizerAndCommands())return;
    buildVisualFontSizePicker();
    buildFormatPainter();
    bindFormatState();
    document.documentElement.dataset.explanationFormatTools=PATCH;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});
  else setTimeout(init,0);
})();
