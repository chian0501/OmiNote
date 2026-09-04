'use strict';

(function installExplanationCardUiFold(){
  const VERSION='UI_FOLD_V3_20260904';
  const $=id=>document.getElementById(id);
  let templateObserver=null;
  let galleryObserver=null;
  let wordPageObserver=null;

  function text(value){return String(value||'').replace(/\s+/g,' ').trim();}
  function nextFrame(fn){if(typeof requestAnimationFrame==='function')requestAnimationFrame(fn);else setTimeout(fn,0);}

  function foldSummary(title,metaId,badge){
    const summary=document.createElement('summary');
    summary.className='ui-fold-summary';
    summary.innerHTML=`<span class="ui-fold-summary-copy"><strong>${title}</strong><small id="${metaId}"></small></span>${badge?`<span class="ui-fold-badge">${badge}</span>`:''}`;
    return summary;
  }

  function updateTemplateSummary(){
    const target=$('contentTemplateSelection');
    if(!target)return;
    const active=document.querySelector('#templateButtons .template-btn.is-active');
    const state=window.__ONE_V030__&&typeof window.__ONE_V030__.getState==='function'?window.__ONE_V030__.getState():null;
    let label=active?text(active.textContent):'';
    if(!label&&state&&state.templateId){
      const candidate=document.querySelector(`#templateButtons [data-template="${CSS.escape(String(state.templateId))}"]`);
      if(candidate)label=text(candidate.textContent);
    }
    target.textContent=`目前：${label||'依目前內容'}`;
  }

  function buildTemplateFold(){
    const source=$('contentTemplatePicker');
    if(!source||source.tagName==='DETAILS')return;
    const parent=source.parentNode;
    if(!parent)return;
    const wasHidden=source.hidden;
    const oldHead=source.querySelector('.template-presets-head');
    const helper=text(oldHead&&oldHead.querySelector('small')&&oldHead.querySelector('small').textContent)||'先選範本再改字；切換範本會重設文字內容。';
    if(oldHead)oldHead.remove();

    const details=document.createElement('details');
    details.id='contentTemplatePicker';
    details.className='template-presets ui-fold-panel content-template-fold';
    details.dataset.uiFold='content-template';
    details.hidden=wasHidden;
    details.open=false;

    source.removeAttribute('id');
    source.removeAttribute('aria-labelledby');
    source.hidden=false;
    source.classList.remove('template-presets');
    source.classList.add('ui-fold-body');

    const summary=foldSummary('一般說明｜設計範本','contentTemplateSelection','6 種範本');
    const help=document.createElement('p');
    help.className='ui-fold-help';
    help.textContent=helper;
    source.insertBefore(help,source.firstChild);

    parent.insertBefore(details,source);
    details.append(summary,source);

    const buttons=$('templateButtons');
    if(buttons){
      buttons.addEventListener('click',()=>nextFrame(updateTemplateSummary));
      templateObserver=new MutationObserver(updateTemplateSummary);
      templateObserver.observe(buttons,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-pressed']});
    }
    updateTemplateSummary();
  }

  function labelColorName(){
    const select=$('labelColor');
    if(!select)return '';
    const option=select.options&&select.options[select.selectedIndex];
    const raw=text(option&&option.textContent);
    return raw.split(/[｜|]/)[0]||raw;
  }

  function updateLabelSummary(){
    const target=$('labelSettingsSelection');
    if(!target)return;
    const label=text($('labelText')&&$('labelText').value)||'GET!';
    const color=labelColorName();
    target.textContent=color?`${label}｜${color}`:label;
  }

  function buildLabelFold(){
    if($('labelSettings'))return;
    const controls=document.querySelector('.settings > .label-controls');
    if(!controls||!controls.parentNode)return;
    const settings=controls.parentNode;
    const helper=text(controls.querySelector('.label-controls-copy small')&&controls.querySelector('.label-controls-copy small').textContent)||'標籤與標題共用同一條水平中線。';
    const details=document.createElement('details');
    details.id='labelSettings';
    details.className='setting ui-fold-panel label-setting';
    details.dataset.uiFold='label';
    details.open=false;
    const summary=foldSummary('卡片標籤','labelSettingsSelection','');
    const help=document.createElement('p');
    help.className='ui-fold-help label-fold-help';
    help.textContent=helper;
    settings.insertBefore(details,controls);
    details.append(summary,help,controls);
    const copy=controls.querySelector('.label-controls-copy');
    if(copy)copy.setAttribute('aria-hidden','true');
    const labelText=$('labelText');
    const labelColor=$('labelColor');
    if(labelText)labelText.addEventListener('input',updateLabelSummary);
    if(labelColor)labelColor.addEventListener('change',updateLabelSummary);
    updateLabelSummary();
  }

  function galleryLabelFromButton(button){
    if(!button)return '';
    const spans=button.querySelectorAll('span');
    return text(spans.length?spans[spans.length-1].textContent:button.textContent);
  }

  function updateGalleryProxy(){
    const original=$('galleryLayouts');
    const proxy=$('galleryLayoutsProxy');
    if(!original||!proxy)return;
    const active=original.querySelector('[data-gallery-layout].is-active')||original.querySelector('[data-gallery-layout][aria-pressed="true"]');
    const activeId=active&&active.dataset.galleryLayout;
    proxy.querySelectorAll('[data-gallery-layout]').forEach(button=>{
      const on=button.dataset.galleryLayout===activeId;
      button.classList.toggle('is-active',on);
      button.setAttribute('aria-pressed',on?'true':'false');
    });
    const summary=$('galleryLayoutSelection');
    if(summary)summary.textContent=`目前：${galleryLabelFromButton(active)||'單張大圖'}`;
    const sourceHint=$('galleryLayoutHint');
    const hint=$('galleryLayoutHintProxy');
    if(hint&&sourceHint)hint.textContent=text(sourceHint.textContent);
  }

  function buildGalleryFold(attempt=0){
    if($('galleryLayoutPicker'))return true;
    const original=$('galleryLayouts');
    const editor=$('galleryEditor');
    const modeStrip=document.querySelector('.mode-strip');
    if(!original||!editor||!modeStrip){
      if(attempt<30)setTimeout(()=>buildGalleryFold(attempt+1),80);
      return false;
    }

    original.classList.add('gallery-layouts-original');
    original.setAttribute('aria-hidden','true');

    const head=editor.querySelector('.gallery-editor-head');
    if(head){
      const title=head.querySelector('strong');
      const helper=head.querySelector('small');
      if(title)title.textContent='圖片內容';
      if(helper)helper.textContent='依上方選定版面放入圖片；每張都能獨立調整顯示方式與裁切。';
    }
    const sourceHint=$('galleryLayoutHint');
    if(sourceHint)sourceHint.classList.add('is-proxy-source');
    const meta=editor.querySelector('.gallery-layout-meta');
    if(meta)meta.classList.add('is-compact-meta');

    const details=document.createElement('details');
    details.id='galleryLayoutPicker';
    details.className='template-presets ui-fold-panel gallery-layout-picker';
    details.dataset.uiFold='gallery-layout';
    details.open=false;
    const summary=foldSummary('純圖片字卡｜圖片排版','galleryLayoutSelection','6 種版面');
    const body=document.createElement('div');
    body.className='ui-fold-body';
    const help=document.createElement('p');
    help.className='ui-fold-help';
    help.textContent='先選版面，再編輯標題與圖片。版面選擇固定放在模式下方，不會跑到編輯區中段。';
    const proxy=document.createElement('div');
    proxy.id='galleryLayoutsProxy';
    proxy.className='gallery-layouts gallery-layouts-proxy';
    original.querySelectorAll('[data-gallery-layout]').forEach(button=>{
      const clone=button.cloneNode(true);
      clone.removeAttribute('id');
      clone.addEventListener('click',event=>{
        event.preventDefault();
        const target=original.querySelector(`[data-gallery-layout="${clone.dataset.galleryLayout}"]`);
        if(target)target.click();
        nextFrame(updateGalleryProxy);
      });
      proxy.appendChild(clone);
    });
    const hint=document.createElement('p');
    hint.id='galleryLayoutHintProxy';
    hint.className='ui-fold-help gallery-layout-hint-proxy';
    body.append(help,proxy,hint);
    details.append(summary,body);

    const contentPicker=$('contentTemplatePicker');
    if(contentPicker&&contentPicker.parentNode===modeStrip)contentPicker.insertAdjacentElement('afterend',details);
    else modeStrip.appendChild(details);

    galleryObserver=new MutationObserver(updateGalleryProxy);
    galleryObserver.observe(original,{subtree:true,attributes:true,attributeFilter:['class','aria-pressed']});
    if(sourceHint)galleryObserver.observe(sourceHint,{subtree:true,childList:true,characterData:true});
    updateGalleryProxy();
    return true;
  }

  function bindModeSync(){
    document.querySelectorAll('[data-card-mode]').forEach(button=>button.addEventListener('click',()=>{
      nextFrame(()=>{
        updateTemplateSummary();
        updateGalleryProxy();
        updateFontSizeDisplay();
      });
    }));
  }

  function installCompactItemDefaults(){
    if(typeof TEMPLATES==='undefined'||typeof block!=='function')return;
    const emphasize=value=>typeof styled==='function'?styled(value,'section'):value;
    TEMPLATES.steps.make=()=>[
      block('title','照這幾步走就好'),
      block('subtitle','第一次去也能快速跟上'),
      block('body',emphasize('先找到入口'),'01',true),
      block('body',emphasize('接著完成第二步'),'02',true),
      block('body',emphasize('最後確認'),'03',true)
    ];
    TEMPLATES.list.make=()=>[
      block('title','這裡先記住 3 件事'),
      block('subtitle','不需要左欄標記'),
      block('body','<ul><li>第一個真正重要的重點</li></ul>'),
      block('body','<ul><li>第二個觀眾會想知道的資訊</li></ul>'),
      block('body','<ul><li>第三個結論或建議</li></ul>')
    ];
  }

  function installCompactItemStyles(){
    if($('explanationCardItemRowPatch'))return;
    const style=document.createElement('style');
    style.id='explanationCardItemRowPatch';
    style.textContent=`
      .toolbar-heading{align-items:center}
      .toolbar-history{display:flex;align-items:center;gap:6px;flex:0 0 auto;margin-left:auto}
      .toolbar-history .tool-btn{height:32px;min-width:34px}
      .toolbar-heading .image-trigger{margin-left:0}
      .marker-input:disabled{display:none!important}
      .marker-control:has(.marker-input:disabled){min-width:28px;padding-right:4px;border-right:0}
      .marker-control:has(.marker-input:disabled) input[type=checkbox]{margin:7px 0}
      #wordPage .rich ul{margin:0;padding-left:1.3em;list-style:disc outside}
      #wordPage .rich li{display:list-item;margin:0;padding:0}
      #wordPage .rich li::marker{color:#29A6A7}
      .size-select option{font-variant-numeric:tabular-nums}
      @media(max-width:700px){
        .toolbar-heading{flex-wrap:wrap}
        .toolbar-heading>div:not(.toolbar-history){min-width:220px;flex:1}
        .toolbar-history{margin-left:0}
      }
    `;
    document.head.appendChild(style);
  }

  function moveHistoryControls(){
    const toolbar=$('wordToolbar');
    const heading=toolbar&&toolbar.querySelector('.toolbar-heading');
    if(!toolbar||!heading||heading.querySelector('.toolbar-history'))return;
    const undo=toolbar.querySelector('[data-cmd="undo"]');
    const redo=toolbar.querySelector('[data-cmd="redo"]');
    if(!undo||!redo)return;
    const group=document.createElement('div');
    group.className='toolbar-history';
    group.setAttribute('aria-label','復原與重做');
    group.append(undo,redo);
    const image=$('openImageDrawer');
    if(image&&image.parentNode===heading)heading.insertBefore(group,image);
    else heading.appendChild(group);
    const divider=[...toolbar.children].find(el=>el.classList&&el.classList.contains('tool-divider'));
    if(divider)divider.remove();
  }

  function normalizeMarkerUi(){
    document.querySelectorAll('#wordPage .marker-input').forEach(input=>{input.placeholder='標記';});
    const tip=document.querySelector('.word-tip');
    if(tip)tip.textContent='年份／字母／序號範本會自動帶左側標記；重點清單會自動帶項目符號。新增一項時會沿用目前範本的結構。';
    updateAddButtonLabel();
    nextFrame(updateFontSizeDisplay);
  }

  function bindMarkerObserver(){
    const page=$('wordPage');
    if(!page)return;
    normalizeMarkerUi();
    wordPageObserver=new MutationObserver(normalizeMarkerUi);
    wordPageObserver.observe(page,{subtree:true,childList:true});
  }

  function bodyBlocks(){
    if(typeof state==='undefined'||!state||!Array.isArray(state.blocks))return[];
    return state.blocks.filter(item=>item.kind==='body');
  }

  function htmlIsSingleBullet(html){
    const host=document.createElement('div');
    host.innerHTML=String(html||'');
    const children=[...host.children];
    return children.length===1&&children[0].tagName==='UL'&&children[0].children.length===1&&children[0].children[0].tagName==='LI';
  }

  function detectAddPattern(){
    const bodies=bodyBlocks();
    const templateId=typeof state!=='undefined'&&state?String(state.templateId||''):'';
    if(templateId==='steps')return{kind:'sequence'};
    if(templateId==='timeline')return{kind:'timeline'};
    if(templateId==='abcd')return{kind:'letters'};
    if(templateId==='list')return{kind:'bullet'};
    if(!bodies.length)return{kind:'plain'};
    if(bodies.every(item=>item.marker&&item.marker.enabled&&/^\d{2}$/.test(String(item.marker.text||'').trim())))return{kind:'sequence'};
    if(bodies.every(item=>item.marker&&item.marker.enabled&&/^[A-Z]$/.test(String(item.marker.text||'').trim())))return{kind:'letters'};
    if(bodies.every(item=>item.marker&&item.marker.enabled&&(/年$/.test(String(item.marker.text||'').trim())||String(item.marker.text||'').trim()==='年份')))return{kind:'timeline'};
    if(bodies.every(item=>!item.marker?.enabled&&htmlIsSingleBullet(item.html)))return{kind:'bullet'};
    return{kind:'plain'};
  }

  function nextSequenceMarker(){
    const nums=bodyBlocks().map(item=>parseInt(String(item.marker&&item.marker.text||''),10)).filter(Number.isFinite);
    return String((nums.length?Math.max(...nums):0)+1).padStart(2,'0');
  }

  function nextLetterMarker(){
    const codes=bodyBlocks().map(item=>String(item.marker&&item.marker.text||'').trim()).filter(value=>/^[A-Z]$/.test(value)).map(value=>value.charCodeAt(0));
    return String.fromCharCode(Math.min(90,(codes.length?Math.max(...codes):64)+1));
  }

  function addStructuredBodyBlock(){
    if(typeof state==='undefined'||typeof block!=='function'||typeof renderEditor!=='function'||typeof renderCanvas!=='function')return;
    if(state.blocks.length>=MAX_BLOCKS){if(typeof toast==='function')toast('最多 12 個文字段落。',true);return;}
    const pattern=detectAddPattern();
    const emphasize=value=>typeof styled==='function'?styled(value,'section'):value;
    let added;
    if(pattern.kind==='sequence')added=block('body',emphasize('新增步驟'),nextSequenceMarker(),true);
    else if(pattern.kind==='letters')added=block('body',emphasize('新增選項'),nextLetterMarker(),true);
    else if(pattern.kind==='timeline')added=block('body','新增時間點','年份',true);
    else if(pattern.kind==='bullet')added=block('body','<ul><li>新增重點</li></ul>');
    else added=block('body','新增一段說明內容');
    state.blocks.push(added);
    state.templateId='custom';
    renderEditor();
    renderCanvas();
    updateAddButtonLabel();
    nextFrame(updateFontSizeDisplay);
  }

  function updateAddButtonLabel(){
    const button=$('addBlock');
    if(!button)return;
    const kind=detectAddPattern().kind;
    button.textContent=kind==='sequence'?`＋ 新增下一步（${nextSequenceMarker()}）`:kind==='letters'?`＋ 新增下一項（${nextLetterMarker()}）`:kind==='timeline'?'＋ 新增時間點（年份）':kind==='bullet'?'＋ 新增重點（•）':'＋ 新增一般段落';
  }

  function baseFontSize(){
    if(typeof activeEditor==='undefined'||!activeEditor)return null;
    const kind=activeEditor.dataset&&activeEditor.dataset.kind||'body';
    if(typeof BASE_STYLE!=='undefined'&&BASE_STYLE[kind]&&BASE_STYLE[kind].size)return Number(BASE_STYLE[kind].size);
    return kind==='title'?68:kind==='subtitle'?34:29;
  }

  function fontSizeAtNode(node){
    if(typeof activeEditor==='undefined'||!activeEditor)return null;
    let element=node&&node.nodeType===1?node:node&&node.parentElement;
    while(element&&element!==activeEditor){
      const size=parseFloat(element.style&&element.style.fontSize||'');
      if(Number.isFinite(size)&&size>0)return Math.round(size);
      element=element.parentElement;
    }
    const own=parseFloat(activeEditor.style&&activeEditor.style.fontSize||'');
    return Number.isFinite(own)&&own>0?Math.round(own):baseFontSize();
  }

  function rangeFontSize(range){
    if(!range||typeof activeEditor==='undefined'||!activeEditor||!activeEditor.contains(range.commonAncestorContainer))return baseFontSize();
    if(range.collapsed)return fontSizeAtNode(range.startContainer);
    const sizes=new Set();
    const walker=document.createTreeWalker(activeEditor,NodeFilter.SHOW_TEXT);
    let node;
    while((node=walker.nextNode())){
      if(!String(node.nodeValue||'').trim())continue;
      let intersects=false;
      try{intersects=range.intersectsNode(node);}catch(error){intersects=false;}
      if(intersects){const size=fontSizeAtNode(node);if(size)sizes.add(size);if(sizes.size>1)return'mixed';}
    }
    return sizes.size===1?[...sizes][0]:fontSizeAtNode(range.commonAncestorContainer);
  }

  function currentFontSize(){
    if(typeof activeEditor==='undefined'||!activeEditor)return null;
    const selection=window.getSelection&&window.getSelection();
    if(selection&&selection.rangeCount){
      const range=selection.getRangeAt(0);
      if(activeEditor.contains(range.commonAncestorContainer))return rangeFontSize(range);
    }
    if(typeof savedRange!=='undefined'&&savedRange&&activeEditor.contains(savedRange.commonAncestorContainer))return rangeFontSize(savedRange);
    return baseFontSize();
  }

  function ensureFontSizeOption(select,value,label){
    if(!select)return;
    let option=[...select.options].find(item=>item.value===String(value));
    if(!option){option=document.createElement('option');option.value=String(value);select.appendChild(option);}
    option.textContent=label;
    return option;
  }

  function updateFontSizeDisplay(){
    const select=$('fontSizeSelect');
    if(!select)return;
    [...select.options].forEach(option=>{
      if(option.value&&option.value!=='mixed')option.textContent=`${option.value} px`;
    });
    const size=currentFontSize();
    if(size==='mixed'){
      ensureFontSizeOption(select,'mixed','混合字級');
      select.value='mixed';
      select.title='目前選取：混合字級';
      return;
    }
    const numeric=Math.round(Number(size)||0);
    if(numeric>0){
      ensureFontSizeOption(select,numeric,`${numeric} px`);
      select.value=String(numeric);
      select.title=`目前字級：${numeric}px`;
    }else{
      select.value='';
      if(select.options[0])select.options[0].textContent='字級';
      select.title='字級';
    }
  }

  function bindFontSizeReadout(){
    const select=$('fontSizeSelect');
    const page=$('wordPage');
    const toolbar=$('wordToolbar');
    if(!select||!page)return;
    if(select.options[0])select.options[0].textContent='字級';
    [...select.options].forEach(option=>{if(option.value)option.textContent=`${option.value} px`;});
    select.onchange=event=>{
      const value=Number(event.target.value);
      if(Number.isFinite(value)&&value>0&&typeof applyInlineStyle==='function')applyInlineStyle({size:value});
      nextFrame(updateFontSizeDisplay);
    };
    ['focusin','click','keyup','mouseup','input'].forEach(type=>page.addEventListener(type,()=>nextFrame(updateFontSizeDisplay)));
    if(toolbar)toolbar.addEventListener('click',()=>nextFrame(updateFontSizeDisplay));
    document.addEventListener('selectionchange',()=>{
      if(typeof activeEditor!=='undefined'&&activeEditor&&document.activeElement===activeEditor)nextFrame(updateFontSizeDisplay);
    });
    nextFrame(updateFontSizeDisplay);
  }

  function bindStructuredAdd(){
    const button=$('addBlock');
    if(!button)return;
    button.onclick=addStructuredBodyBlock;
    updateAddButtonLabel();
  }

  function init(){
    installCompactItemDefaults();
    installCompactItemStyles();
    buildTemplateFold();
    buildLabelFold();
    buildGalleryFold();
    bindModeSync();
    moveHistoryControls();
    bindMarkerObserver();
    bindStructuredAdd();
    bindFontSizeReadout();
    document.documentElement.dataset.explanationUiFold=VERSION;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
