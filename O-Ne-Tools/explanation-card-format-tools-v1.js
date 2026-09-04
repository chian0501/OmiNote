'use strict';

(function installExplanationFormatCore(){
  const CORE='FORMAT_CORE_V3_20260904';
  const FONT_SIZES=[24,29,30,34,36,40,48,56,68];
  const $=id=>document.getElementById(id);
  const deepClone=value=>JSON.parse(JSON.stringify(value));
  const STRUCTURAL=new Set(['UL','OL','LI','P','DIV']);
  let copiedStyle=null;
  let undoStack=[];
  let redoStack=[];
  let historyRestoring=false;
  let typingTimer=null;
  let typingBurst=false;
  let fontMenu=null;
  let pendingStructureFocus=null;

  function baseStyleForKind(kind){
    const base=(typeof BASE_STYLE!=='undefined'&&BASE_STYLE[kind])||((typeof BASE_STYLE!=='undefined'&&BASE_STYLE.body)||{size:29,weight:500,color:'#FDF3E7'});
    return{size:Number(base.size||29),weight:Number(base.weight||500),color:String(base.color||'#FDF3E7'),italic:false,underline:false,strike:false};
  }

  function baseStyleForEditor(editor=activeEditor){
    if(!editor)return baseStyleForKind('body');
    return baseStyleForKind((editor.dataset&&editor.dataset.kind)||'body');
  }

  function normalizedWeight(raw,fallback){
    const text=String(raw||'').toLowerCase();
    if(text==='bold'||text==='bolder')return 800;
    if(text==='normal'||text==='lighter')return 500;
    const value=parseInt(text,10);
    return Number.isFinite(value)&&value>0?value:fallback;
  }

  function styleFromElement(el,inherited){
    const style={...inherited};
    if(!el||el.nodeType!==1)return style;
    const tag=el.tagName;
    if(tag==='B'||tag==='STRONG')style.weight=800;
    if(tag==='I'||tag==='EM')style.italic=true;
    if(tag==='U')style.underline=true;
    if(tag==='S'||tag==='STRIKE')style.strike=true;
    const size=parseFloat(el.style&&el.style.fontSize||'');
    if(Number.isFinite(size)&&size>=18&&size<=90)style.size=Math.round(size);
    const weight=normalizedWeight(el.style&&el.style.fontWeight,style.weight);
    if(weight)style.weight=weight;
    const color=el.style&&el.style.color;
    if(color)style.color=color;
    const italic=String(el.style&&el.style.fontStyle||'').toLowerCase();
    if(italic==='italic')style.italic=true;
    else if(italic==='normal')style.italic=false;
    const decoration=String(el.style&&((el.style.textDecorationLine||el.style.textDecoration)||'')).toLowerCase();
    if(decoration){
      style.underline=/underline/.test(decoration);
      style.strike=/line-through/.test(decoration);
    }
    return style;
  }

  function styleSignature(style){
    return[Math.round(style.size||29),Math.round(style.weight||500),String(style.color||''),style.italic?1:0,style.underline?1:0,style.strike?1:0].join('|');
  }

  function applyStyleToSpan(span,style){
    span.className='one-rich-run';
    span.dataset.oneRun='1';
    span.style.fontSize=`${Math.round(style.size||29)}px`;
    span.style.fontWeight=String(Math.round(style.weight||500));
    span.style.color=style.color||'#FDF3E7';
    span.style.fontStyle=style.italic?'italic':'normal';
    const decorations=[];
    if(style.underline)decorations.push('underline');
    if(style.strike)decorations.push('line-through');
    span.style.textDecoration=decorations.length?decorations.join(' '):'none';
    return span;
  }

  function createRun(text,style){
    const span=applyStyleToSpan(document.createElement('span'),style);
    span.textContent=text;
    return span;
  }

  function appendRun(parent,text,style){
    if(text==='')return;
    const previous=parent.lastChild;
    if(previous&&previous.nodeType===1&&previous.matches('span[data-one-run="1"]')&&styleSignature(styleFromElement(previous,style))===styleSignature(style)){
      previous.textContent+=text;
      return;
    }
    parent.appendChild(createRun(text,style));
  }

  function explicitStylePatch(el){
    const patch={};
    if(!el||el.nodeType!==1)return patch;
    const tag=el.tagName;
    if(tag==='B'||tag==='STRONG')patch.weight=800;
    if(tag==='I'||tag==='EM')patch.italic=true;
    if(tag==='U')patch.underline=true;
    if(tag==='S'||tag==='STRIKE')patch.strike=true;
    const size=parseFloat(el.style&&el.style.fontSize||'');
    if(Number.isFinite(size)&&size>=18&&size<=90)patch.size=Math.round(size);
    const rawWeight=String(el.style&&el.style.fontWeight||'').trim();
    if(rawWeight)patch.weight=normalizedWeight(rawWeight,500);
    const color=el.style&&el.style.color;if(color)patch.color=color;
    const rawItalic=String(el.style&&el.style.fontStyle||'').toLowerCase();
    if(rawItalic==='italic')patch.italic=true;else if(rawItalic==='normal')patch.italic=false;
    const decoration=String(el.style&&((el.style.textDecorationLine||el.style.textDecoration)||'')).toLowerCase();
    if(decoration){
      if(decoration==='none'){patch.underline=false;patch.strike=false;}
      else{
        if(/underline/.test(decoration))patch.underline=true;
        if(/line-through/.test(decoration))patch.strike=true;
      }
    }
    return patch;
  }

  function appendCanonicalChildren(source,parent,inherited,locked={}){
    [...source.childNodes].forEach(child=>{
      if(child.nodeType===Node.TEXT_NODE){appendRun(parent,child.nodeValue||'',inherited);return;}
      if(child.nodeType!==Node.ELEMENT_NODE)return;
      if(child.tagName==='BR'){parent.appendChild(document.createElement('br'));return;}
      const patch=explicitStylePatch(child),nextStyle={...inherited},nextLocked={...locked};
      Object.entries(patch).forEach(([key,value])=>{
        // Legacy V0.4.x formatting wrapped the newest style OUTSIDE the old run.
        // Keep the first explicit value for each property so migration restores the user's latest intended style.
        if(!nextLocked[key]){nextStyle[key]=value;nextLocked[key]=true;}
      });
      if(STRUCTURAL.has(child.tagName)){
        const clone=document.createElement(child.tagName.toLowerCase());
        appendCanonicalChildren(child,clone,nextStyle,nextLocked);
        parent.appendChild(clone);
        return;
      }
      appendCanonicalChildren(child,parent,nextStyle,nextLocked);
    });
  }

  function mergeCanonicalSpans(container){
    [...container.children].forEach(child=>{if(STRUCTURAL.has(child.tagName))mergeCanonicalSpans(child);});
    let node=container.firstChild;
    while(node){
      const next=node.nextSibling;
      if(node.nodeType===1&&next&&next.nodeType===1&&node.matches('span[data-one-run="1"]')&&next.matches('span[data-one-run="1"]')){
        const a=styleFromElement(node,baseStyleForEditor());
        const b=styleFromElement(next,baseStyleForEditor());
        if(styleSignature(a)===styleSignature(b)){
          node.textContent+=next.textContent;
          next.remove();
          continue;
        }
      }
      node=node.nextSibling;
    }
  }

  function textLength(node){
    if(!node)return 0;
    if(node.nodeType===Node.TEXT_NODE)return(node.nodeValue||'').length;
    let total=0;[...node.childNodes].forEach(child=>{total+=textLength(child);});return total;
  }

  function pointOffset(root,container,offset){
    let total=0,found=false;
    function walk(node){
      if(found)return;
      if(node===container){
        if(node.nodeType===Node.TEXT_NODE)total+=Math.max(0,Math.min(offset,(node.nodeValue||'').length));
        else for(let i=0;i<Math.min(offset,node.childNodes.length);i++)total+=textLength(node.childNodes[i]);
        found=true;return;
      }
      if(node.nodeType===Node.TEXT_NODE){total+=(node.nodeValue||'').length;return;}
      for(const child of node.childNodes){walk(child);if(found)return;}
    }
    walk(root);
    return total;
  }

  function pointAtOffset(root,offset){
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    let node,last=null,total=0;
    while((node=walker.nextNode())){
      last=node;
      const length=(node.nodeValue||'').length;
      if(offset<=total+length)return{node,offset:Math.max(0,offset-total)};
      total+=length;
    }
    if(last)return{node:last,offset:(last.nodeValue||'').length};
    return{node:root,offset:0};
  }

  function rangeForEditor(editor){
    if(!editor)return null;
    const selection=window.getSelection&&window.getSelection();
    if(selection&&selection.rangeCount){
      const range=selection.getRangeAt(0);
      if(editor.contains(range.commonAncestorContainer))return range.cloneRange();
    }
    if(typeof savedRange!=='undefined'&&savedRange&&editor.contains(savedRange.commonAncestorContainer))return savedRange.cloneRange();
    return null;
  }

  function offsetsForRange(editor,range){
    if(!editor||!range)return null;
    return{
      start:pointOffset(editor,range.startContainer,range.startOffset),
      end:pointOffset(editor,range.endContainer,range.endOffset),
      collapsed:range.collapsed
    };
  }

  function restoreOffsets(editor,offsets){
    if(!editor||!offsets)return null;
    const max=textLength(editor);
    const start=Math.max(0,Math.min(offsets.start,max));
    const end=Math.max(start,Math.min(offsets.end,max));
    const a=pointAtOffset(editor,start),b=pointAtOffset(editor,end);
    const range=document.createRange();
    range.setStart(a.node,a.offset);range.setEnd(b.node,b.offset);
    const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
    savedRange=range.cloneRange();
    return range;
  }

  function canonicalizeEditor(editor,{preserveSelection=true,sync=true}={}){
    if(!editor)return null;
    const range=preserveSelection?rangeForEditor(editor):null;
    const offsets=range?offsetsForRange(editor,range):null;
    const source=editor.cloneNode(true);
    editor.innerHTML='';
    appendCanonicalChildren(source,editor,baseStyleForEditor(editor));
    mergeCanonicalSpans(editor);
    if(offsets)restoreOffsets(editor,offsets);
    if(sync){
      const wrap=editor.closest('.edit-block');
      const blockState=wrap&&typeof state!=='undefined'&&state&&Array.isArray(state.blocks)?state.blocks.find(item=>item.id===wrap.dataset.id):null;
      if(blockState)blockState.html=sanitizeHtml(editor.innerHTML);
    }
    return offsets;
  }

  function canonicalizeAllEditors(){
    document.querySelectorAll('#wordPage .rich').forEach(editor=>canonicalizeEditor(editor,{preserveSelection:editor===activeEditor,sync:true}));
  }

  function currentBlockId(){
    const wrap=activeEditor&&activeEditor.closest('.edit-block');
    return wrap&&wrap.dataset.id||null;
  }

  function mutationOffsets(editor){
    const current=offsetsForRange(editor,rangeForEditor(editor));
    const length=textLength(editor);
    if(!current||current.collapsed)return{start:0,end:length,collapsed:false,wholeBlock:true};
    return{...current,wholeBlock:false};
  }

  function runRecords(editor){
    const records=[];let cursor=0;
    editor.querySelectorAll('span[data-one-run="1"]').forEach(span=>{
      const node=span.firstChild;
      if(!node||node.nodeType!==Node.TEXT_NODE)return;
      const length=(node.nodeValue||'').length;
      records.push({span,node,start:cursor,end:cursor+length,style:styleFromElement(span,baseStyleForEditor(editor))});
      cursor+=length;
    });
    return records;
  }

  function stylesForOffsets(editor,offsets,{caretOnly=false}={}){
    const records=runRecords(editor);
    if(!records.length)return[baseStyleForEditor(editor)];
    if(caretOnly||!offsets||offsets.collapsed){
      const pos=offsets?offsets.start:0;
      let record=records.find(item=>pos>=item.start&&pos<item.end);
      if(!record)record=records.find(item=>item.end===pos)||records[records.length-1];
      return[record.style];
    }
    const matches=records.filter(item=>item.end>offsets.start&&item.start<offsets.end);
    return(matches.length?matches:records).map(item=>item.style);
  }

  function mutateStyle(style,patch){
    const next={...style};
    if(patch.size!=null)next.size=Math.max(18,Math.min(90,Math.round(Number(patch.size)||next.size)));
    if(patch.weight!=null)next.weight=Math.round(Number(patch.weight)||next.weight);
    if(patch.color)next.color=String(patch.color);
    if(patch.italic!=null)next.italic=Boolean(patch.italic);
    if(patch.underline!=null)next.underline=Boolean(patch.underline);
    if(patch.strike!=null)next.strike=Boolean(patch.strike);
    return next;
  }

  function replaceRunSegment(record,from,to,newStyle){
    const text=record.node.nodeValue||'';
    const localStart=Math.max(0,from-record.start),localEnd=Math.min(text.length,to-record.start);
    if(localStart<=0&&localEnd>=text.length){applyStyleToSpan(record.span,newStyle);return;}
    const fragment=document.createDocumentFragment();
    if(localStart>0)fragment.appendChild(createRun(text.slice(0,localStart),record.style));
    if(localEnd>localStart)fragment.appendChild(createRun(text.slice(localStart,localEnd),newStyle));
    if(localEnd<text.length)fragment.appendChild(createRun(text.slice(localEnd),record.style));
    record.span.replaceWith(fragment);
  }

  function syncAfterMutation(editor,offsets){
    mergeCanonicalSpans(editor);
    restoreOffsets(editor,offsets);
    if(typeof syncActiveHtml==='function')syncActiveHtml();
    updateFormatUi();
  }

  function applyPatch(patch,{toggle=null,replaceAll=false}={}){
    if(!activeEditor)return false;
    canonicalizeEditor(activeEditor,{preserveSelection:true,sync:true});
    const offsets=mutationOffsets(activeEditor);
    if(offsets.end<=offsets.start)return false;
    beginMutation();
    let effectivePatch={...patch};
    if(toggle){
      const styles=stylesForOffsets(activeEditor,offsets);
      if(toggle==='bold')effectivePatch.weight=styles.every(style=>Number(style.weight)>=700)?baseStyleForEditor(activeEditor).weight:800;
      if(toggle==='italic')effectivePatch.italic=!styles.every(style=>style.italic);
      if(toggle==='underline')effectivePatch.underline=!styles.every(style=>style.underline);
      if(toggle==='strike')effectivePatch.strike=!styles.every(style=>style.strike);
    }
    const base=baseStyleForEditor(activeEditor);
    const records=runRecords(activeEditor);
    records.filter(item=>item.end>offsets.start&&item.start<offsets.end).forEach(record=>{
      const next=replaceAll?mutateStyle(base,effectivePatch):mutateStyle(record.style,effectivePatch);
      replaceRunSegment(record,offsets.start,offsets.end,next);
    });
    syncAfterMutation(activeEditor,offsets);
    return true;
  }

  function toggleBullet(){
    if(!activeEditor)return false;
    canonicalizeEditor(activeEditor,{preserveSelection:true,sync:true});
    beginMutation();
    const significant=[...activeEditor.childNodes].filter(node=>!(node.nodeType===Node.TEXT_NODE&&!String(node.nodeValue||'').trim()));
    if(significant.length===1&&significant[0].nodeType===Node.ELEMENT_NODE&&significant[0].tagName==='UL'){
      const ul=significant[0],fragment=document.createDocumentFragment();
      [...ul.children].forEach((li,index)=>{
        while(li.firstChild)fragment.appendChild(li.firstChild);
        if(index<ul.children.length-1)fragment.appendChild(document.createElement('br'));
      });
      activeEditor.innerHTML='';activeEditor.appendChild(fragment);
    }else{
      const ul=document.createElement('ul'),li=document.createElement('li');
      while(activeEditor.firstChild)li.appendChild(activeEditor.firstChild);
      ul.appendChild(li);activeEditor.appendChild(ul);
    }
    canonicalizeEditor(activeEditor,{preserveSelection:false,sync:true});
    const full={start:0,end:textLength(activeEditor),collapsed:false};restoreOffsets(activeEditor,full);
    if(typeof syncActiveHtml==='function')syncActiveHtml();
    updateFormatUi();return true;
  }

  function clearFormat(){return applyPatch({}, {replaceAll:true});}

  function activeStyleInfo({caretOnlyWhenCollapsed=true}={}){
    if(!activeEditor)return{styles:[],unique:[],mixed:false,style:null,offsets:null};
    const range=rangeForEditor(activeEditor);
    const offsets=range?offsetsForRange(activeEditor,range):{start:0,end:textLength(activeEditor),collapsed:true};
    const styles=stylesForOffsets(activeEditor,offsets,{caretOnly:caretOnlyWhenCollapsed&&offsets.collapsed});
    const unique=[...new Map(styles.map(style=>[styleSignature(style),style])).values()];
    return{styles,unique,mixed:unique.length>1,style:unique[0]||baseStyleForEditor(activeEditor),offsets};
  }

  function blockAlign(){
    const wrap=activeEditor&&activeEditor.closest('.edit-block');
    const blockState=wrap&&state&&Array.isArray(state.blocks)?state.blocks.find(item=>item.id===wrap.dataset.id):null;
    return blockState&&blockState.align||activeEditor&&activeEditor.style.textAlign||'left';
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
    control.addEventListener('pointerdown',event=>{saveSelection();event.preventDefault();});
  }

  function positionFontMenu(){
    const button=$('fontSizeVisualButton');
    if(!button||!fontMenu||fontMenu.hidden)return;
    const rect=button.getBoundingClientRect();
    const width=Math.min(270,Math.max(220,window.innerWidth-16));
    fontMenu.style.width=`${width}px`;
    fontMenu.style.left=`${Math.max(8,Math.min(rect.left,window.innerWidth-width-8))}px`;
    fontMenu.style.top='8px';
    const menuHeight=Math.min(fontMenu.scrollHeight,Math.max(180,window.innerHeight-16));
    const below=rect.bottom+8,above=rect.top-menuHeight-8;
    fontMenu.style.top=`${below+menuHeight<=window.innerHeight-8?below:Math.max(8,above)}px`;
  }

  function closeFontMenu(){if(fontMenu)fontMenu.hidden=true;}
  function openFontMenu(){if(!fontMenu)return;fontMenu.hidden=false;requestAnimationFrame(positionFontMenu);}

  function buildVisualFontPicker(){
    const select=$('fontSizeSelect');
    if(!select||$('fontSizeVisualPicker'))return;
    select.classList.add('is-compat-control');select.setAttribute('aria-hidden','true');select.tabIndex=-1;
    const picker=document.createElement('div');picker.className='font-size-visual-picker';picker.id='fontSizeVisualPicker';
    const current=document.createElement('button');current.type='button';current.className='font-size-current';current.id='fontSizeVisualButton';current.textContent='字級';current.title='顯示並套用實際字級';
    preserveTextSelection(current);
    fontMenu=document.createElement('div');fontMenu.className='font-size-menu';fontMenu.id='fontSizeVisualMenu';fontMenu.hidden=true;
    FONT_SIZES.forEach(size=>{
      const button=document.createElement('button');button.type='button';button.className='font-size-option';button.dataset.size=String(size);
      button.innerHTML=`<span class="font-size-value">${size}px</span><span class="font-size-sample" style="font-size:${size}px">字 Aa</span>`;
      preserveTextSelection(button);
      button.addEventListener('click',event=>{event.preventDefault();applyPatch({size});closeFontMenu();updateFormatUi();});
      fontMenu.appendChild(button);
    });
    current.addEventListener('click',event=>{event.preventDefault();fontMenu.hidden?openFontMenu():closeFontMenu();});
    picker.appendChild(current);select.insertAdjacentElement('afterend',picker);document.body.appendChild(fontMenu);
    document.addEventListener('pointerdown',event=>{if(!picker.contains(event.target)&&!fontMenu.contains(event.target))closeFontMenu();});
    window.addEventListener('resize',positionFontMenu);window.addEventListener('scroll',positionFontMenu,true);
  }

  function buildFormatPainter(){
    const picker=$('fontSizeVisualPicker');if(!picker||$('formatPainterGroup'))return;
    const group=document.createElement('div');group.className='format-painter-group';group.id='formatPainterGroup';
    const copy=document.createElement('button');copy.type='button';copy.className='tool-btn';copy.id='copyStyleBtn';copy.textContent='複製樣式';copy.title='複製字級、粗細、顏色、斜體、底線、刪除線與對齊';
    const apply=document.createElement('button');apply.type='button';apply.className='tool-btn';apply.id='applyStyleBtn';apply.textContent='套用樣式';apply.title='套用已複製的文字樣式；不複製文字、序號或項目點';apply.disabled=true;
    preserveTextSelection(copy);preserveTextSelection(apply);
    copy.addEventListener('click',()=>{
      const info=activeStyleInfo({caretOnlyWhenCollapsed:true});
      if(!info.style){toast('先點一下要複製樣式的文字。',true);return;}
      if(info.mixed){toast('這段有混合格式，請選單一樣式文字再複製。',true);return;}
      copiedStyle={...info.style,align:blockAlign()};copy.classList.add('is-copied');copy.textContent='已複製';apply.disabled=false;apply.title=`套用：${formatLabel(copiedStyle)}`;toast(`已複製樣式：${formatLabel(copiedStyle)}。`);
    });
    apply.addEventListener('click',()=>{
      if(!copiedStyle){toast('目前還沒有複製樣式。',true);return;}
      if(!applyPatch(copiedStyle,{replaceAll:true})){toast('先選取要套用的文字。',true);return;}
      if(copiedStyle.align)setAlignCore(copiedStyle.align,false);
      toast(`已套用樣式：${formatLabel(copiedStyle)}。`);
    });
    group.append(copy,apply);picker.insertAdjacentElement('afterend',group);
  }

  function updateFormatUi(){
    const info=activeStyleInfo({caretOnlyWhenCollapsed:true});
    const current=$('fontSizeVisualButton');
    if(current){
      if(info.mixed){current.textContent='混合字級';current.classList.add('is-mixed');current.title='目前選取包含不同字級';}
      else if(info.style){current.textContent=`${Math.round(info.style.size)} px`;current.classList.remove('is-mixed');current.title=`目前字級：${Math.round(info.style.size)}px`;}
      else{current.textContent='字級';current.classList.remove('is-mixed');}
    }
    if(fontMenu)fontMenu.querySelectorAll('[data-size]').forEach(button=>button.classList.toggle('is-active',!info.mixed&&info.style&&Number(button.dataset.size)===Math.round(info.style.size)));
    const styles=info.styles||[];
    const all=fn=>styles.length>0&&styles.every(fn),any=fn=>styles.some(fn);
    const checks={bold:style=>Number(style.weight)>=700,italic:style=>style.italic,underline:style=>style.underline,strike:style=>style.strike};
    [[$('boldBtn'),'bold'],[$('italicBtn'),'italic'],[$('underlineBtn'),'underline'],[$('strikeBtn'),'strike']].forEach(([button,key])=>{
      if(!button)return;const full=all(checks[key]),partial=!full&&any(checks[key]);
      button.classList.toggle('is-format-active',full);button.classList.toggle('is-format-mixed',partial);button.setAttribute('aria-pressed',full?'true':partial?'mixed':'false');
    });
    document.querySelectorAll('#wordToolbar [data-align]').forEach(button=>button.classList.toggle('is-format-active',button.dataset.align===blockAlign()));
  }

  function snapshot(){
    canonicalizeAllEditors();
    return{templateId:String(state&&state.templateId||'custom'),blocks:deepClone(state&&state.blocks||[]),activeBlockId:currentBlockId()};
  }

  function snapshotKey(value){return JSON.stringify({templateId:value.templateId,blocks:value.blocks});}
  function pushUnique(stack,snap){
    if(!snap)return;
    if(stack.length&&snapshotKey(stack[stack.length-1])===snapshotKey(snap)){stack[stack.length-1].activeBlockId=snap.activeBlockId;return;}
    stack.push(snap);if(stack.length>80)stack.shift();
  }
  function beginMutation(){
    if(historyRestoring)return;
    pushUnique(undoStack,snapshot());
    redoStack=[];
  }

  function focusBlock(id,{selectAll=false}={}){
    const editor=id?document.querySelector(`.edit-block[data-id="${CSS.escape(id)}"] .rich`):document.querySelector('#wordPage .rich');
    if(!editor)return;setActive(editor);editor.focus();const end=textLength(editor);restoreOffsets(editor,selectAll?{start:0,end,collapsed:false}:{start:end,end,collapsed:true});updateFormatUi();
  }

  function restoreSnapshot(snap){
    if(!snap)return false;
    historyRestoring=true;
    state.templateId=snap.templateId;
    state.blocks=deepClone(snap.blocks);
    const page=$('wordPage');
    const currentIds=page?[...page.querySelectorAll('.edit-block')].map(node=>node.dataset.id):[];
    const nextIds=state.blocks.map(item=>item.id);
    const sameStructure=currentIds.length===nextIds.length&&nextIds.every((id,index)=>id===currentIds[index]);
    if(sameStructure){
      state.blocks.forEach(blockState=>{
        const wrap=page.querySelector(`.edit-block[data-id="${CSS.escape(blockState.id)}"]`);
        const rich=wrap&&wrap.querySelector('.rich');
        if(rich){rich.innerHTML=sanitizeHtml(blockState.html);rich.style.textAlign=blockState.align||'left';}
      });
      activeEditor=null;savedRange=null;
      canonicalizeAllEditors();
      if(typeof renderTemplateButtons==='function')renderTemplateButtons();
      if(typeof syncSettings==='function')syncSettings();
      renderCanvas();
    }else{
      if(page)page.innerHTML='';
      activeEditor=null;savedRange=null;
      renderEditor();renderCanvas();
    }
    historyRestoring=false;
    requestAnimationFrame(()=>focusBlock(snap.activeBlockId));
    return true;
  }

  function undo(){
    if(!undoStack.length){toast('沒有更早的文字版本。');return;}
    const current=snapshot();const previous=undoStack.pop();pushUnique(redoStack,current);restoreSnapshot(previous);
  }
  function redo(){
    if(!redoStack.length){toast('沒有更新的文字版本。');return;}
    const current=snapshot();const next=redoStack.pop();pushUnique(undoStack,current);restoreSnapshot(next);
  }

  function setAlignCore(align,record=true){
    if(!activeEditor)return;if(record)beginMutation();
    const wrap=activeEditor.closest('.edit-block'),blockState=wrap&&state.blocks.find(item=>item.id===wrap.dataset.id);if(!blockState)return;
    blockState.align=align;activeEditor.style.textAlign=align;renderCanvas();updateFormatUi();
  }

  function patchGlobalCommands(){
    applyInlineStyle=function(style){return applyPatch(style||{});};
    execRich=function(cmd){
      if(cmd==='bold')return applyPatch({}, {toggle:'bold'});
      if(cmd==='italic')return applyPatch({}, {toggle:'italic'});
      if(cmd==='underline')return applyPatch({}, {toggle:'underline'});
      if(cmd==='strikeThrough')return applyPatch({}, {toggle:'strike'});
      if(cmd==='insertUnorderedList')return toggleBullet();
      if(cmd==='removeFormat')return clearFormat();
      if(cmd==='undo')return undo();
      if(cmd==='redo')return redo();
      return false;
    };
    setAlign=function(align){return setAlignCore(align,true);};
    const originalRender=renderEditor;
    renderEditor=function(){
      const prior=currentBlockId();originalRender();canonicalizeAllEditors();renderCanvas();
      if(prior&&!historyRestoring)requestAnimationFrame(()=>{const editor=document.querySelector(`.edit-block[data-id="${CSS.escape(prior)}"] .rich`);if(editor)setActive(editor);updateFormatUi();});
    };
  }

  function bindCoreControls(){
    const style=$('stylePreset');
    if(style)style.onchange=event=>{const preset=STYLE_PRESETS[event.target.value];if(preset)applyPatch(preset);event.target.value='';};
    const compat=$('fontSizeSelect');
    if(compat)compat.onchange=event=>{const value=Number(event.target.value);if(Number.isFinite(value)&&value>0)applyPatch({size:value});};
    [[$('boldBtn'),'bold'],[$('italicBtn'),'italic'],[$('underlineBtn'),'underline'],[$('strikeBtn'),'strikeThrough'],[$('bulletBtn'),'insertUnorderedList'],[$('clearBtn'),'removeFormat']].forEach(([button,cmd])=>{if(button)button.onclick=()=>execRich(cmd);});
    document.querySelectorAll('#wordToolbar [data-cmd]').forEach(button=>button.onclick=()=>execRich(button.dataset.cmd));
    document.querySelectorAll('#wordToolbar [data-align]').forEach(button=>button.onclick=()=>setAlignCore(button.dataset.align,true));
    const colors=(typeof BRAND_LIST!=='undefined'?BRAND_LIST:[]).map(item=>item[1]);
    document.querySelectorAll('#toolbarSwatches .toolbar-swatch').forEach((button,index)=>{button.onclick=()=>applyPatch({color:colors[index]||button.style.backgroundColor});});
  }

  function bindEvents(){
    const page=$('wordPage'),toolbar=$('wordToolbar');if(!page)return;
    ['boldBtn','italicBtn','underlineBtn','strikeBtn','bulletBtn','clearBtn'].forEach(id=>preserveTextSelection($(id)));
    document.querySelectorAll('#wordToolbar [data-align],#wordToolbar .toolbar-swatch').forEach(preserveTextSelection);
    ['focusin','click','keyup','mouseup'].forEach(type=>page.addEventListener(type,()=>requestAnimationFrame(updateFormatUi)));
    page.addEventListener('beforeinput',()=>{
      if(historyRestoring)return;
      if(!typingBurst){beginMutation();typingBurst=true;}
      clearTimeout(typingTimer);typingTimer=setTimeout(()=>{typingBurst=false;},600);
    });
    page.addEventListener('input',()=>requestAnimationFrame(updateFormatUi));
    page.addEventListener('focusout',event=>{const editor=event.target.closest&&event.target.closest('.rich');if(editor)canonicalizeEditor(editor,{preserveSelection:false,sync:true});});
    document.addEventListener('selectionchange',()=>{if(activeEditor)requestAnimationFrame(updateFormatUi);});
    if(toolbar)toolbar.addEventListener('click',()=>requestAnimationFrame(updateFormatUi));
    const structuralTarget=event=>event.target.closest&&event.target.closest('#addBlock,[data-act="up"],[data-act="down"],[data-act="del"],#templateButtons .template-btn');
    document.addEventListener('pointerdown',event=>{
      const target=structuralTarget(event);if(!target)return;
      beginMutation();
      const block=target.closest('.edit-block');pendingStructureFocus={kind:target.id==='addBlock'?'add':target.dataset.act||'template',id:block&&block.dataset.id||null};
    },true);
    document.addEventListener('click',event=>{
      const target=structuralTarget(event);if(!target)return;
      setTimeout(()=>{
        if(!pendingStructureFocus)return;
        if(pendingStructureFocus.kind==='add'){
          const bodies=[...document.querySelectorAll('#wordPage .rich[data-kind="body"]')];const editor=bodies[bodies.length-1];if(editor){const id=editor.closest('.edit-block').dataset.id;focusBlock(id);}
        }else if(pendingStructureFocus.id){focusBlock(pendingStructureFocus.id);}
        pendingStructureFocus=null;
      },0);
    },true);
  }

  function init(){
    if(document.documentElement.dataset.explanationFormatCore===CORE)return;
    if(typeof renderEditor!=='function'||typeof sanitizeHtml!=='function'||typeof state==='undefined')return;
    patchGlobalCommands();
    canonicalizeAllEditors();
    buildVisualFontPicker();
    buildFormatPainter();
    bindCoreControls();
    bindEvents();
    updateFormatUi();
    document.documentElement.dataset.explanationFormatCore=CORE;
    document.documentElement.dataset.explanationFormatTools='single-core';
    window.ONEExplanationFormatCore={version:CORE,normalize:canonicalizeAllEditors,refresh:updateFormatUi,undo,redo,history:()=>({undo:undoStack.length,redo:redoStack.length})};
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});
  else setTimeout(init,0);
})();
