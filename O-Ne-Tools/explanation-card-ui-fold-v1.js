'use strict';

(function installExplanationCardUiFold(){
  const VERSION='UI_FOLD_V1_20260904';
  const $=id=>document.getElementById(id);
  let templateObserver=null;
  let galleryObserver=null;

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
      });
    }));
  }

  function init(){
    buildTemplateFold();
    buildLabelFold();
    buildGalleryFold();
    bindModeSync();
    document.documentElement.dataset.explanationUiFold=VERSION;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
