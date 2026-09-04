'use strict';

(function installExplanationUiAudit(){
  const PATCH='UI_AUDIT_V1_20260904';
  const $=id=>document.getElementById(id);

  function ensureHistoryInHeading(){
    const toolbar=$('wordToolbar'),heading=toolbar&&toolbar.querySelector('.toolbar-heading');
    if(!toolbar||!heading)return;
    let group=heading.querySelector('.toolbar-history');
    if(!group){
      const undo=toolbar.querySelector('[data-cmd="undo"]'),redo=toolbar.querySelector('[data-cmd="redo"]');
      if(undo&&redo){group=document.createElement('div');group.className='toolbar-history';group.setAttribute('aria-label','復原與重做');group.append(undo,redo);}
    }
    if(group&&group.parentNode!==heading){
      const image=$('openImageDrawer');
      if(image&&image.parentNode===heading)heading.insertBefore(group,image);else heading.appendChild(group);
    }
  }

  function organizeToolbar(attempt=0){
    const toolbar=$('wordToolbar');
    const fontPicker=$('fontSizeVisualPicker');
    const painter=$('formatPainterGroup');
    if(!toolbar||!fontPicker||!painter){if(attempt<40)setTimeout(()=>organizeToolbar(attempt+1),40);return;}
    if(toolbar.dataset.uiAuditOrganized==='1')return;
    ensureHistoryInHeading();

    toolbar.querySelectorAll(':scope > .tool-divider').forEach(node=>node.remove());
    const primary=document.createElement('div');primary.className='toolbar-row toolbar-row-primary';
    const secondary=document.createElement('div');secondary.className='toolbar-row toolbar-row-secondary';
    const inline=document.createElement('div');inline.className='toolbar-control-group toolbar-inline-group';
    const paragraph=document.createElement('div');paragraph.className='toolbar-control-group toolbar-paragraph-group';

    [$('boldBtn'),$('italicBtn'),$('underlineBtn'),$('strikeBtn')].filter(Boolean).forEach(el=>inline.appendChild(el));
    [...toolbar.querySelectorAll('[data-align]'),$('bulletBtn'),$('clearBtn')].filter(Boolean).forEach(el=>paragraph.appendChild(el));

    const style=$('stylePreset'),compat=$('fontSizeSelect'),swatches=$('toolbarSwatches');
    if(style)primary.appendChild(style);
    if(inline.childNodes.length)primary.appendChild(inline);
    if(compat)primary.appendChild(compat);
    primary.appendChild(fontPicker);
    if(swatches)secondary.appendChild(swatches);
    if(paragraph.childNodes.length)secondary.appendChild(paragraph);
    secondary.appendChild(painter);
    toolbar.append(primary,secondary);

    const hint=$('selectionHint');if(hint)hint.hidden=true;
    const help=$('toolbarHelp');if(help)help.textContent='先選文字，再調樣式；沒有反白時會套用目前段落。';
    toolbar.dataset.uiAuditOrganized='1';
  }

  function removeVisibleDuplicates(){
    const sequenceState=$('sequenceState');if(sequenceState)sequenceState.hidden=true;
    const sequenceImageButton=$('sequenceImageButton');if(sequenceImageButton)sequenceImageButton.hidden=true;
    const imageSummary=document.querySelector('.image-summary');if(imageSummary)imageSummary.hidden=true;
    const modeBadge=$('modeStatusBadge');if(modeBadge)modeBadge.hidden=true;
    const hint=$('selectionHint');if(hint)hint.hidden=true;
  }

  function init(){
    if(document.documentElement.dataset.explanationUiAudit===PATCH)return;
    removeVisibleDuplicates();
    organizeToolbar();
    document.documentElement.dataset.explanationUiAudit=PATCH;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});
  else setTimeout(init,0);
})();
