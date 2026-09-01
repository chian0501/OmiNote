'use strict';

(function installGalleryMode(){
  const VERSION='V0.4.5_20260901';
  const GALLERY_LAYOUTS={
    single:{label:'單張大圖',count:1,hint:'一張圖放滿圖片區；可搭配「大圖 820px」接近 16:9。'},
    split:{label:'左右雙圖',count:2,hint:'兩張圖左右等寬，適合前後、A／B 或台日對照。'},
    triple:{label:'三張並排',count:3,hint:'三張圖片等寬並排；每張都可獨立完整顯示、填滿裁切或自由拉框裁切。'},
    'hero-right':{label:'左大右二',count:3,hint:'主圖放左側，右側上下各一張補充細節。'},
    'hero-bottom':{label:'上大下二',count:3,hint:'主圖橫跨上方，下方兩張補充步驟或局部。'},
    grid:{label:'四格拼圖',count:4,hint:'四張圖等分，適合流程、商品或多角度整理。'}
  };
  const GALLERY_HEIGHTS=[520,650,820];
  const slotDefault=()=>({name:'',fit:'cover',focusX:0,focusY:0,cropX:0,cropY:0,cropWidth:100,cropHeight:100});
  const galleryDefault=()=>({layout:'single',height:650,gap:12,slots:Array.from({length:4},slotDefault)});
  const galleryAssets=Array(4).fill(null);
  const galleryCropDrags=Array(4).fill(null);
  let lastContentTemplateId='standard';

  function normalizeGallery(raw){
    const source=raw&&typeof raw==='object'?raw:{};
    const layout=Object.prototype.hasOwnProperty.call(GALLERY_LAYOUTS,source.layout)?source.layout:'single';
    const height=GALLERY_HEIGHTS.includes(Number(source.height))?Number(source.height):650;
    const gap=Math.round(clamp(source.gap??12,0,28));
    const slots=Array.from({length:4},(_,index)=>{
      const item=Array.isArray(source.slots)&&source.slots[index]&&typeof source.slots[index]==='object'?source.slots[index]:{};
      const cropWidth=clamp(item.cropWidth??100,4,100);
      const cropHeight=clamp(item.cropHeight??100,4,100);
      return{
        name:String(item.name||''),
        fit:['contain','cover','free'].includes(item.fit)?item.fit:'cover',
        focusX:clamp(item.focusX??0,-100,100),
        focusY:clamp(item.focusY??0,-100,100),
        cropX:clamp(item.cropX??0,0,100-cropWidth),
        cropY:clamp(item.cropY??0,0,100-cropHeight),
        cropWidth,
        cropHeight
      };
    });
    return{layout,height,gap,slots};
  }

  defaults.mode='content';
  defaults.gallery=galleryDefault();
  TEMPLATES.gallery={
    label:'純圖片字卡',
    make:()=>[block('title','圖片重點一次看懂')]
  };

  const cleanStateV038=cleanState;
  cleanState=function(raw){
    const next=cleanStateV038(raw);
    next.mode=raw&&raw.mode==='gallery'?'gallery':'content';
    if(raw&&raw.templateId==='gallery')next.mode='gallery';
    next.gallery=normalizeGallery(raw&&raw.gallery);
    return next;
  };

  const applyTemplateV038=applyTemplate;
  applyTemplate=function(id,force=false){
    if(!TEMPLATES[id])return applyTemplateV038(id,force);
    if(id!=='gallery')lastContentTemplateId=id;
    const keep={
      label:clone(state.label),
      note:clone(state.note),
      image:clone(state.image),
      gallery:normalizeGallery(state.gallery)
    };
    state={
      ...clone(defaults),
      templateId:id,
      mode:id==='gallery'?'gallery':'content',
      blocks:TEMPLATES[id].make(),
      ...keep
    };
    activeEditor=null;
    savedRange=null;
    renderEditor();
    renderCanvas();
    toast(`已套用「${TEMPLATES[id].label}」內容版型`);
  };

  function createGalleryEditor(){
    if($('galleryEditor'))return;
    const section=document.createElement('section');
    section.id='galleryEditor';
    section.className='gallery-editor';
    section.hidden=true;
    section.innerHTML=`
      <div class="gallery-editor-head">
        <div><strong>圖片排版</strong><small>圖片直接鋪滿字卡下半部；切換排版不會刪除已選圖片。</small></div>
        <span class="gallery-count" id="galleryCount">0／1 張</span>
      </div>
      <div class="gallery-layouts" id="galleryLayouts"></div>
      <div class="gallery-layout-meta">
        <label class="field"><span>圖片區高度</span><select id="galleryHeight"><option value="520">精簡｜520px</option><option value="650">標準｜650px</option><option value="820">大圖｜820px</option></select></label>
        <div class="gallery-layout-hint" id="galleryLayoutHint"></div>
      </div>
      <div class="gallery-slots" id="gallerySlots"></div>`;
    const pageWrap=document.querySelector('.word-page-wrap');
    if(pageWrap)pageWrap.insertAdjacentElement('afterend',section);
    else $('editorScroll').appendChild(section);

    const layoutHost=$('galleryLayouts');
    Object.entries(GALLERY_LAYOUTS).forEach(([id,meta])=>{
      const button=document.createElement('button');
      button.type='button';
      button.className='gallery-layout-btn';
      button.dataset.galleryLayout=id;
      button.innerHTML=`<span class="layout-mini ${id}">${Array.from({length:meta.count},()=>'<i></i>').join('')}</span><span>${meta.label}</span>`;
      layoutHost.appendChild(button);
    });

    section.addEventListener('click',event=>{
      const layoutButton=event.target.closest('[data-gallery-layout]');
      if(layoutButton){
        state.gallery.layout=layoutButton.dataset.galleryLayout;
        state.templateId='gallery';
        renderGalleryEditor();
        renderCanvas();
        return;
      }
      const uploadButton=event.target.closest('[data-gallery-upload]');
      if(uploadButton){
        const input=section.querySelector(`input[data-gallery-file="${uploadButton.dataset.galleryUpload}"]`);
        if(input)input.click();
        return;
      }
      const removeButton=event.target.closest('[data-gallery-remove]');
      if(removeButton){
        const index=Number(removeButton.dataset.galleryRemove);
        galleryAssets[index]=null;
        state.gallery.slots[index]=slotDefault();
        renderGalleryEditor();
        renderCanvas();
        return;
      }
      const resetCropButton=event.target.closest('[data-gallery-crop-reset]');
      if(resetCropButton){
        const index=Number(resetCropButton.dataset.galleryCropReset);
        Object.assign(state.gallery.slots[index],{cropX:0,cropY:0,cropWidth:100,cropHeight:100});
        renderGalleryEditor();
        renderCanvas();
      }
    });

    section.addEventListener('change',event=>{
      const target=event.target;
      if(target.id==='galleryHeight'){
        state.gallery.height=GALLERY_HEIGHTS.includes(Number(target.value))?Number(target.value):650;
        renderCanvas();
        return;
      }
      if(target.matches('[data-gallery-file]')){
        const index=Number(target.dataset.galleryFile);
        loadGalleryImage(index,target.files&&target.files[0]);
        return;
      }
      if(target.matches('[data-gallery-fit]')){
        const index=Number(target.dataset.galleryFit);
        state.gallery.slots[index].fit=['contain','cover','free'].includes(target.value)?target.value:'cover';
        renderGalleryEditor();
        renderCanvas();
      }
    });

    section.addEventListener('input',event=>{
      const target=event.target;
      if(target.matches('[data-gallery-focus-x]')){
        state.gallery.slots[Number(target.dataset.galleryFocusX)].focusX=clamp(target.value,-100,100);
        renderCanvas();
      }else if(target.matches('[data-gallery-focus-y]')){
        state.gallery.slots[Number(target.dataset.galleryFocusY)].focusY=clamp(target.value,-100,100);
        renderCanvas();
      }
    });
  }

  function activeAsset(index){
    const asset=galleryAssets[index];
    const slot=state.gallery&&state.gallery.slots&&state.gallery.slots[index];
    return asset&&slot&&asset.name===slot.name?asset:null;
  }

  function galleryCropGeometry(index,target){
    const asset=activeAsset(index);
    if(!asset)return null;
    const image=asset.element;
    const sourceWidth=image.naturalWidth||image.width;
    const sourceHeight=image.naturalHeight||image.height;
    const canvasWidth=target.width||640;
    const canvasHeight=target.height||360;
    const scale=Math.min((canvasWidth-36)/sourceWidth,(canvasHeight-36)/sourceHeight);
    const imageWidth=sourceWidth*scale;
    const imageHeight=sourceHeight*scale;
    const imageX=(canvasWidth-imageWidth)/2;
    const imageY=(canvasHeight-imageHeight)/2;
    const slot=state.gallery.slots[index];
    const crop={
      x:imageX+imageWidth*slot.cropX/100,
      y:imageY+imageHeight*slot.cropY/100,
      w:imageWidth*slot.cropWidth/100,
      h:imageHeight*slot.cropHeight/100
    };
    return{asset,image,sourceWidth,sourceHeight,canvasWidth,canvasHeight,imageX,imageY,imageWidth,imageHeight,crop};
  }

  function galleryCropHandlePoints(rect){
    return{
      nw:[rect.x,rect.y],n:[rect.x+rect.w/2,rect.y],ne:[rect.x+rect.w,rect.y],
      e:[rect.x+rect.w,rect.y+rect.h/2],se:[rect.x+rect.w,rect.y+rect.h],
      s:[rect.x+rect.w/2,rect.y+rect.h],sw:[rect.x,rect.y+rect.h],w:[rect.x,rect.y+rect.h/2]
    };
  }

  function galleryCropCursor(target){
    return{nw:'nwse-resize',se:'nwse-resize',ne:'nesw-resize',sw:'nesw-resize',n:'ns-resize',s:'ns-resize',e:'ew-resize',w:'ew-resize',move:'move'}[target]||'crosshair';
  }

  function galleryCropHit(index,target,point){
    const geometry=galleryCropGeometry(index,target);
    if(!geometry)return null;
    const handles=galleryCropHandlePoints(geometry.crop);
    const radius=18;
    for(const [name,[x,y]] of Object.entries(handles)){
      if(Math.abs(point.x-x)<=radius&&Math.abs(point.y-y)<=radius)return name;
    }
    const rect=geometry.crop;
    return point.x>=rect.x&&point.x<=rect.x+rect.w&&point.y>=rect.y&&point.y<=rect.y+rect.h?'move':null;
  }

  function galleryCropPoint(event,target){
    const bounds=target.getBoundingClientRect();
    return{
      x:(event.clientX-bounds.left)*target.width/bounds.width,
      y:(event.clientY-bounds.top)*target.height/bounds.height
    };
  }

  function galleryCropAfterDrag(targetName,start,px,py){
    const minimum=4;
    let{x,y,w,h}=start;
    if(targetName==='move'){
      x=clamp(x+px,0,100-w);
      y=clamp(y+py,0,100-h);
    }else{
      if(targetName.includes('w')){
        const nextX=clamp(x+px,0,x+w-minimum);
        w=w+(x-nextX);
        x=nextX;
      }
      if(targetName.includes('e'))w=clamp(w+px,minimum,100-x);
      if(targetName.includes('n')){
        const nextY=clamp(y+py,0,y+h-minimum);
        h=h+(y-nextY);
        y=nextY;
      }
      if(targetName.includes('s'))h=clamp(h+py,minimum,100-y);
    }
    return{x,y,w,h};
  }

  function updateGalleryCropFromDrag(index,targetName,start,deltaX,deltaY,target){
    const geometry=galleryCropGeometry(index,target);
    if(!geometry)return;
    const next=galleryCropAfterDrag(targetName,start,deltaX/geometry.imageWidth*100,deltaY/geometry.imageHeight*100);
    Object.assign(state.gallery.slots[index],{cropX:next.x,cropY:next.y,cropWidth:next.w,cropHeight:next.h});
    renderGalleryCropper(index,target);
    renderCanvas();
  }

  function renderGalleryCropper(index,target){
    const context=target.getContext('2d');
    const geometry=galleryCropGeometry(index,target);
    context.clearRect(0,0,target.width,target.height);
    context.fillStyle='#090d12';
    context.fillRect(0,0,target.width,target.height);
    const readout=target.closest('.gallery-free-crop')?.querySelector('[data-gallery-crop-readout]');
    if(!geometry){
      context.fillStyle='#9aa7b3';
      context.font='700 22px "Noto Sans TC",sans-serif';
      context.textAlign='center';
      context.textBaseline='middle';
      context.fillText('先選擇圖片，再調整裁切框',target.width/2,target.height/2);
      if(readout)readout.textContent='尚未選圖';
      return;
    }
    const{image,sourceWidth,sourceHeight,imageX,imageY,imageWidth,imageHeight,crop}=geometry;
    context.globalAlpha=.34;
    context.drawImage(image,0,0,sourceWidth,sourceHeight,imageX,imageY,imageWidth,imageHeight);
    context.globalAlpha=1;
    context.save();
    context.beginPath();
    context.rect(crop.x,crop.y,crop.w,crop.h);
    context.clip();
    context.drawImage(image,0,0,sourceWidth,sourceHeight,imageX,imageY,imageWidth,imageHeight);
    context.restore();
    context.strokeStyle=BRAND.teal;
    context.lineWidth=4;
    context.strokeRect(crop.x,crop.y,crop.w,crop.h);
    context.strokeStyle='rgba(253,243,231,.34)';
    context.lineWidth=1;
    context.beginPath();
    context.moveTo(crop.x+crop.w/3,crop.y);
    context.lineTo(crop.x+crop.w/3,crop.y+crop.h);
    context.moveTo(crop.x+crop.w*2/3,crop.y);
    context.lineTo(crop.x+crop.w*2/3,crop.y+crop.h);
    context.moveTo(crop.x,crop.y+crop.h/3);
    context.lineTo(crop.x+crop.w,crop.y+crop.h/3);
    context.moveTo(crop.x,crop.y+crop.h*2/3);
    context.lineTo(crop.x+crop.w,crop.y+crop.h*2/3);
    context.stroke();
    for(const [name,[x,y]] of Object.entries(galleryCropHandlePoints(crop))){
      const size=name.length===2?15:13;
      context.fillStyle=BRAND.cream;
      context.fillRect(x-size/2,y-size/2,size,size);
      context.strokeStyle=BRAND.teal;
      context.lineWidth=2;
      context.strokeRect(x-size/2,y-size/2,size,size);
    }
    const slot=state.gallery.slots[index];
    if(readout)readout.textContent=`X ${Math.round(slot.cropX)}%｜Y ${Math.round(slot.cropY)}%｜W ${Math.round(slot.cropWidth)}%｜H ${Math.round(slot.cropHeight)}%`;
  }

  function bindGalleryCropper(index,target){
    target.addEventListener('pointerdown',event=>{
      if(!activeAsset(index)||state.gallery.slots[index].fit!=='free')return;
      const point=galleryCropPoint(event,target);
      const hit=galleryCropHit(index,target,point);
      if(!hit)return;
      const slot=state.gallery.slots[index];
      galleryCropDrags[index]={target:hit,point,start:{x:slot.cropX,y:slot.cropY,w:slot.cropWidth,h:slot.cropHeight}};
      target.setPointerCapture?.(event.pointerId);
      target.style.cursor=galleryCropCursor(hit);
      event.preventDefault();
    });
    target.addEventListener('pointermove',event=>{
      const point=galleryCropPoint(event,target);
      const drag=galleryCropDrags[index];
      if(!drag){
        target.style.cursor=galleryCropCursor(galleryCropHit(index,target,point));
        return;
      }
      updateGalleryCropFromDrag(index,drag.target,drag.start,point.x-drag.point.x,point.y-drag.point.y,target);
      event.preventDefault();
    });
    const end=event=>{
      galleryCropDrags[index]=null;
      target.style.cursor='crosshair';
      if(event&&target.hasPointerCapture?.(event.pointerId))target.releasePointerCapture(event.pointerId);
    };
    target.addEventListener('pointerup',end);
    target.addEventListener('pointercancel',end);
  }

  function renderGalleryEditor(){
    const host=$('galleryEditor');
    if(!host)return;
    state.gallery=normalizeGallery(state.gallery);
    const meta=GALLERY_LAYOUTS[state.gallery.layout];
    host.querySelectorAll('[data-gallery-layout]').forEach(button=>{
      const active=button.dataset.galleryLayout===state.gallery.layout;
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-pressed',active?'true':'false');
    });
    $('galleryHeight').value=String(state.gallery.height);
    $('galleryLayoutHint').textContent=meta.hint;
    const filled=Array.from({length:meta.count},(_,index)=>Boolean(activeAsset(index))).filter(Boolean).length;
    $('galleryCount').textContent=`${filled}／${meta.count} 張`;
    const slots=$('gallerySlots');
    galleryCropDrags.fill(null);
    slots.innerHTML='';
    for(let index=0;index<meta.count;index++){
      const item=state.gallery.slots[index];
      const asset=activeAsset(index);
      const card=document.createElement('section');
      card.className='gallery-slot';
      const adjustment=item.fit==='free'?'調整自由裁切':item.fit==='cover'?'調整圖片焦點':'';
      card.innerHTML=`
        <div class="gallery-slot-head"><strong>圖片 ${index+1}</strong><span title="${esc(item.name||'尚未選圖')}">${esc(item.name||'尚未選圖')}</span></div>
        <div class="gallery-slot-main">
          <div class="gallery-thumb">${asset?`<img alt="" src="${asset.dataUrl}">`:'<div class="gallery-thumb-empty">尚未選圖</div>'}</div>
          <div class="gallery-slot-body">
            <div class="gallery-slot-actions">
              <button class="small-btn" type="button" data-gallery-upload="${index}">${asset?'替換圖片':'選擇圖片'}</button>
              <button class="small-btn" type="button" data-gallery-remove="${index}" ${asset?'':'disabled'}>移除</button>
              <input hidden type="file" accept="image/png,image/jpeg,image/webp" data-gallery-file="${index}">
            </div>
            <label class="gallery-fit-control"><span>顯示方式</span><select class="fit-select" data-gallery-fit="${index}" ${asset?'':'disabled'}><option value="cover" ${item.fit==='cover'?'selected':''}>填滿裁切</option><option value="contain" ${item.fit==='contain'?'selected':''}>完整顯示（可能留邊）</option><option value="free" ${item.fit==='free'?'selected':''}>自由裁切</option></select></label>
          </div>
        </div>
        ${adjustment?`<details class="gallery-slot-adjust" ${item.fit==='free'?'open':''}><summary>${adjustment}</summary>${item.fit==='cover'?`<div class="gallery-focus-controls"><label><span>水平焦點</span><input type="range" min="-100" max="100" value="${item.focusX}" data-gallery-focus-x="${index}"></label><label><span>垂直焦點</span><input type="range" min="-100" max="100" value="${item.focusY}" data-gallery-focus-y="${index}"></label></div>`:`<div class="gallery-free-crop"><div class="gallery-free-crop-head"><span>拖框移動；拖四邊或四角改範圍</span><button type="button" data-gallery-crop-reset="${index}">重設</button></div><canvas width="640" height="360" data-gallery-crop-canvas="${index}" aria-label="圖片 ${index+1} 自由裁切框"></canvas><small data-gallery-crop-readout></small><small>裁切範圍會完整顯示且不變形。</small></div>`}</details>`:''}`;
      slots.appendChild(card);
      const cropper=card.querySelector('[data-gallery-crop-canvas]');
      if(cropper){
        bindGalleryCropper(index,cropper);
        renderGalleryCropper(index,cropper);
      }
    }
  }

  function updateModeUi(){
    const galleryMode=state.mode==='gallery';
    if(!galleryMode&&state.templateId!=='custom'&&state.templateId!=='gallery')lastContentTemplateId=state.templateId;
    document.body.classList.toggle('gallery-mode',galleryMode);
    if($('galleryEditor'))$('galleryEditor').hidden=!galleryMode;
    document.querySelectorAll('[data-card-mode]').forEach(button=>{
      const active=button.dataset.cardMode===(galleryMode?'gallery':'content');
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-pressed',active?'true':'false');
    });
    if($('contentTemplatePicker'))$('contentTemplatePicker').hidden=galleryMode;
    if($('contentCardSettings'))$('contentCardSettings').hidden=galleryMode;
    if($('toolbarTitle'))$('toolbarTitle').textContent=galleryMode?'編輯標題':'編輯文字';
    if($('toolbarHelp'))$('toolbarHelp').textContent=galleryMode?'只保留標題需要的字級、顏色與對齊工具。':'先反白要修改的文字，再選格式；沒有反白時會套用目前段落。';
    if($('openImageDrawer'))$('openImageDrawer').textContent='🖼 左側圖片';
    const exportNote=document.querySelector('.export-bar p');
    if(exportNote)exportNote.textContent=galleryMode?'透明 PNG；圖片直接鋪滿標題下方，不另加內框。':'透明 PNG；高度依文字換行、段落與提醒框自動計算。';
    if(galleryMode)renderGalleryEditor();
  }

  const renderEditorV038=renderEditor;
  renderEditor=function(){
    renderEditorV038();
    updateModeUi();
  };

  const syncSettingsV038=syncSettings;
  syncSettings=function(){
    syncSettingsV038();
    if(state.mode==='gallery')renderGalleryEditor();
  };

  function loadGalleryImage(index,file){
    if(!file)return;
    if(!/^image\//.test(file.type)){
      toast('請選擇 PNG、JPG 或 WebP。',true);
      return;
    }
    const reader=new FileReader();
    reader.onload=()=>{
      const dataUrl=String(reader.result);
      const image=new Image();
      image.onload=()=>{
        galleryAssets[index]={name:file.name,dataUrl,mimeType:file.type||'image/png',element:image};
        state.gallery.slots[index]={...slotDefault(),name:file.name};
        renderGalleryEditor();
        renderCanvas();
        toast(`圖片 ${index+1} 已載入。`);
      };
      image.onerror=()=>toast('圖片格式無法開啟。',true);
      image.src=dataUrl;
    };
    reader.readAsDataURL(file);
  }

  function galleryRects(layout,x,y,w,h,gap){
    if(layout==='split'){
      const half=(w-gap)/2;
      return[{x,y,w:half,h},{x:x+half+gap,y,w:half,h}];
    }
    if(layout==='triple'){
      const third=(w-gap*2)/3;
      return[
        {x,y,w:third,h},
        {x:x+third+gap,y,w:third,h},
        {x:x+(third+gap)*2,y,w:third,h}
      ];
    }
    if(layout==='hero-right'){
      const left=Math.round((w-gap)*.66),right=w-gap-left,half=(h-gap)/2;
      return[{x,y,w:left,h},{x:x+left+gap,y,w:right,h:half},{x:x+left+gap,y:y+half+gap,w:right,h:half}];
    }
    if(layout==='hero-bottom'){
      const top=Math.round((h-gap)*.62),bottom=h-gap-top,half=(w-gap)/2;
      return[{x,y,w,h:top},{x,y:y+top+gap,w:half,h:bottom},{x:x+half+gap,y:y+top+gap,w:half,h:bottom}];
    }
    if(layout==='grid'){
      const halfW=(w-gap)/2,halfH=(h-gap)/2;
      return[
        {x,y,w:halfW,h:halfH},{x:x+halfW+gap,y,w:halfW,h:halfH},
        {x,y:y+halfH+gap,w:halfW,h:halfH},{x:x+halfW+gap,y:y+halfH+gap,w:halfW,h:halfH}
      ];
    }
    return[{x,y,w,h}];
  }

  function galleryCropSource(slot,imageWidth,imageHeight){
    const cropWidth=clamp(slot.cropWidth??100,4,100);
    const cropHeight=clamp(slot.cropHeight??100,4,100);
    const cropX=clamp(slot.cropX??0,0,100-cropWidth);
    const cropY=clamp(slot.cropY??0,0,100-cropHeight);
    return{
      sx:imageWidth*cropX/100,
      sy:imageHeight*cropY/100,
      sw:imageWidth*cropWidth/100,
      sh:imageHeight*cropHeight/100
    };
  }

  function layoutGalleryCard(context){
    const outer=28,headerTop=30,labelH=48,bottomEdge=3;
    context.font='800 32px "Noto Sans TC","Microsoft JhengHei",sans-serif';
    const labelW=Math.max(150,context.measureText(state.label.text||'GET!').width+40);
    const title=state.blocks.find(item=>item.kind==='title')||block('title','');
    const titleX=outer+labelW+24;
    const titleW=CARD_WIDTH-outer-titleX;
    const titleLayout=layoutRich(context,htmlToParagraphs(title.html,'title'),titleW);
    const headerH=Math.max(labelH,titleLayout.height);
    const labelY=headerTop+(headerH-labelH)/2;
    const titleY=headerTop+Math.max(0,(labelH-titleLayout.height)/2);
    const dividerY=headerTop+headerH+18;
    const galleryY=dividerY+3;
    const galleryX=3;
    const galleryW=CARD_WIDTH-6;
    const galleryH=state.gallery.height;
    const height=Math.ceil(galleryY+galleryH+bottomEdge);
    const rects=galleryRects(state.gallery.layout,galleryX,galleryY,galleryW,galleryH,state.gallery.gap);
    return{width:CARD_WIDTH,height,labelX:outer,labelY,labelW,labelH,title,titleX,titleY,titleW,titleLayout,dividerX:outer,dividerW:CARD_WIDTH-outer*2,dividerY,galleryX,galleryY,galleryW,galleryH,bottomEdge,rects};
  }

  function drawGallerySlot(context,rect,index){
    const slot=state.gallery.slots[index];
    const asset=activeAsset(index);
    context.save();
    context.beginPath();
    context.rect(rect.x,rect.y,rect.w,rect.h);
    context.clip();
    context.fillStyle='#151a18';
    context.fillRect(rect.x,rect.y,rect.w,rect.h);
    if(asset){
      const image=asset.element;
      const iw=image.naturalWidth||image.width;
      const ih=image.naturalHeight||image.height;
      if(slot.fit==='contain'){
        const scale=Math.min(rect.w/iw,rect.h/ih);
        const dw=iw*scale,dh=ih*scale;
        context.drawImage(image,0,0,iw,ih,rect.x+(rect.w-dw)/2,rect.y+(rect.h-dh)/2,dw,dh);
      }else if(slot.fit==='free'){
        const source=galleryCropSource(slot,iw,ih);
        const scale=Math.min(rect.w/source.sw,rect.h/source.sh);
        const dw=source.sw*scale,dh=source.sh*scale;
        context.drawImage(image,source.sx,source.sy,source.sw,source.sh,rect.x+(rect.w-dw)/2,rect.y+(rect.h-dh)/2,dw,dh);
      }else{
        const scale=Math.max(rect.w/iw,rect.h/ih);
        const dw=iw*scale,dh=ih*scale;
        const fx=(slot.focusX+100)/200,fy=(slot.focusY+100)/200;
        const dx=rect.x-(dw-rect.w)*fx,dy=rect.y-(dh-rect.h)*fy;
        context.drawImage(image,0,0,iw,ih,dx,dy,dw,dh);
      }
    }else{
      context.fillStyle='rgba(245,238,228,.62)';
      context.font='700 24px "Noto Sans TC",sans-serif';
      context.textAlign='center';
      context.textBaseline='middle';
      context.fillText(`選擇圖片 ${index+1}`,rect.x+rect.w/2,rect.y+rect.h/2);
    }
    context.restore();
  }

  function renderGalleryCanvas(target=canvas){
    const context=target.getContext('2d');
    const layout=layoutGalleryCard(context);
    lastLayout=layout;
    target.width=layout.width;
    target.height=layout.height;
    context.clearRect(0,0,layout.width,layout.height);
    cutCornerPath(context,3,3,layout.width-6,layout.height-6,30);
    context.fillStyle='rgba(31,23,19,.80)';
    context.fill();

    context.save();
    cutCornerPath(context,3,3,layout.width-6,layout.height-6,30);
    context.clip();
    layout.rects.forEach((rect,index)=>drawGallerySlot(context,rect,index));
    context.restore();

    context.font='800 32px "Noto Sans TC","Microsoft JhengHei",sans-serif';
    context.fillStyle=state.label.color;
    context.beginPath();
    context.roundRect(layout.labelX,layout.labelY,layout.labelW,layout.labelH,8);
    context.fill();
    context.fillStyle=state.label.textColor;
    context.textAlign='left';
    context.textBaseline='middle';
    context.fillText(state.label.text||'GET!',layout.labelX+20,layout.labelY+layout.labelH/2);
    context.textBaseline='alphabetic';
    drawRich(context,layout.titleLayout,layout.titleX,layout.titleY,layout.titleW,layout.title.align);
    context.strokeStyle=BRAND.teal;
    context.lineWidth=3;
    context.beginPath();
    context.moveTo(layout.dividerX,layout.dividerY);
    context.lineTo(layout.dividerX+layout.dividerW,layout.dividerY);
    context.stroke();
    cutCornerPath(context,3,3,layout.width-6,layout.height-6,30);
    context.lineWidth=3;
    context.strokeStyle=BRAND.cream;
    context.stroke();

    if(target===canvas){
      $('dimensionText').textContent=`${layout.width} × ${layout.height}px｜純圖片・${GALLERY_LAYOUTS[state.gallery.layout].label}`;
    }
    return layout;
  }

  const renderCanvasV038=renderCanvas;
  renderCanvas=function(target=canvas){
    return state.mode==='gallery'?renderGalleryCanvas(target):renderCanvasV038(target);
  };

  const applySnapshotV038=applySnapshot;
  applySnapshot=function(snapshot){
    if(!snapshot||snapshot.mode!=='gallery')return applySnapshotV038(snapshot);
    const next=cleanState(snapshot);
    state=next;
    galleryAssets.forEach((asset,index)=>{
      if(asset&&asset.name!==state.gallery.slots[index].name)galleryAssets[index]=null;
    });
    activeEditor=null;
    savedRange=null;
    renderEditor();
    renderCanvas();
  };

  function galleryAssetPayload(asset,index){
    if(!asset||asset.name!==state.gallery.slots[index].name)return null;
    const image=asset.element;
    return{
      name:asset.name,
      mime_type:asset.mimeType||'image/png',
      data_url:asset.dataUrl,
      natural_width:image?(image.naturalWidth||image.width):null,
      natural_height:image?(image.naturalHeight||image.height):null
    };
  }

  const projectPayloadV038=projectPayload;
  projectPayload=function(){
    const payload=projectPayloadV038();
    payload.status='READY';
    payload.generator_version=VERSION;
    payload.data=capture();
    payload.assets=payload.assets||{};
    payload.assets.gallery=galleryAssets.map(galleryAssetPayload);
    return payload;
  };

  function restoreGalleryAsset(asset,index){
    return new Promise((resolve,reject)=>{
      if(!asset||!asset.data_url){
        galleryAssets[index]=null;
        resolve(false);
        return;
      }
      const image=new Image();
      image.onload=()=>{
        galleryAssets[index]={name:String(asset.name||state.gallery.slots[index].name||`image-${index+1}`),dataUrl:String(asset.data_url),mimeType:asset.mime_type||'image/png',element:image};
        state.gallery.slots[index].name=galleryAssets[index].name;
        resolve(true);
      };
      image.onerror=()=>reject(new Error(`專案檔內的圖片 ${index+1} 無法還原。`));
      image.src=String(asset.data_url);
    });
  }

  loadProjectPayload=async function(payload){
    if(payload&&payload.schema==='o-ne.explanation-card.project.v1'){
      state=cleanState(payload.data||{});
      await restoreProjectImage(payload.assets&&payload.assets.image);
      const gallery=payload.assets&&Array.isArray(payload.assets.gallery)?payload.assets.gallery:[];
      await Promise.all(Array.from({length:4},(_,index)=>restoreGalleryAsset(gallery[index],index)));
      activeEditor=null;
      savedRange=null;
      renderEditor();
      renderCanvas();
      if(state.mode!=='gallery'){
        renderCropper();
        renderImageLivePreview();
      }
      const count=galleryAssets.filter(Boolean).length;
      toast(count?`專案檔載入完成：已還原 ${count} 張拼圖圖片與全部設定。`:'專案檔載入完成。');
      return;
    }
    state=cleanState(fromJSON(payload));
    imageElement=null;
    imageDataUrl=null;
    imageMimeType=null;
    galleryAssets.fill(null);
    activeEditor=null;
    savedRange=null;
    renderEditor();
    renderCanvas();
    toast('舊 JSON 已載入；純設定檔不含圖片本體。');
  };

  function missingGallerySlots(){
    if(state.mode!=='gallery')return[];
    const count=GALLERY_LAYOUTS[state.gallery.layout].count;
    return Array.from({length:count},(_,index)=>index).filter(index=>!activeAsset(index));
  }

  exportPng=function(){
    const missing=missingGallerySlots();
    if(missing.length){
      toast(`請先補齊圖片 ${missing.map(index=>index+1).join('、')}，再輸出 PNG。`,true);
      return;
    }
    const out=document.createElement('canvas');
    renderCanvas(out);
    out.toBlob(blob=>{
      if(!blob)return;
      download(blob,`說明卡-${titlePlain()}-${state.mode==='gallery'?'純圖片字卡':'RichText'}.png`);
      toast('PNG 已輸出。');
    },'image/png');
  };

  exportProject=function(){
    const payload=projectPayload();
    const count=(payload.assets.gallery||[]).filter(Boolean).length+(payload.assets.image?1:0);
    download(new Blob([JSON.stringify(payload)],{type:'application/json'}),`說明卡-${titlePlain()}-專案.onecard`);
    toast(count?`專案檔已下載：共內嵌 ${count} 張圖片與全部設定。`:'專案檔已下載；目前沒有內嵌圖片。');
  };

  exportJson=function(){
    const payload={
      schema:'o-ne.explanation-card.formal.v0.4.5',
      status:'CANDIDATE',
      generator_version:VERSION,
      component:{
        width:CARD_WIDTH,
        height:lastLayout?lastLayout.height:MIN_HEIGHT,
        height_mode:state.mode==='gallery'?'gallery-layout-height':'richtext-measured-auto',
        rich_text:true,
        modes:['content','gallery'],
        gallery_layouts:Object.keys(GALLERY_LAYOUTS),
        gallery_images_max:4,
        gallery_per_image_free_crop:true,
        gallery_free_crop_unlocked_aspect:true,
        gallery_full_bleed_below_header:true,
        gallery_inner_frame:false,
        project_file_embeds_images:true
      },
      data:capture(),
      generated_at:new Date().toISOString()
    };
    download(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),`說明卡-${titlePlain()}-${state.mode==='gallery'?'純圖片字卡':'RichText'}.json`);
    toast('純設定 JSON 已匯出；圖片本體請使用 .onecard 專案檔。');
  };

  function organizeSaveTools(){
    const host=$('quickSaveHost');
    if(!host)return false;
    const backup=host.querySelector('[data-one-backup-ui]');
    if(backup){
      const title=backup.querySelector('.one-edit-backup__title span:first-child');
      const badge=backup.querySelector('.one-edit-backup__badge');
      const load=backup.querySelector('[data-action="load"]');
      if(title)title.textContent='快速暫存';
      if(badge)badge.textContent='本機 5 次';
      if(load)load.textContent='載入舊 JSON';
    }
    const pkg=host.querySelector('[data-one-project-package-ui]');
    if(pkg){
      const title=pkg.querySelector('.one-project-package__title');
      if(title)title.textContent='完整專案 ZIP';
      const note=pkg.querySelector('.one-project-package__note');
      if(note)note.textContent='包含目前 PNG、編輯設定與已置入圖片，適合跨裝置搬移。';
    }
    const batch=host.querySelector('[data-one-batch-render-ui]');
    if(batch&&!batch.closest('.save-tool-details')){
      const details=document.createElement('details');
      details.className='save-tool-details batch-tools';
      const summary=document.createElement('summary');
      summary.textContent='批次出圖（最多 20 份）';
      batch.parentNode.insertBefore(details,batch);
      details.append(summary,batch);
    }
    return Boolean(backup&&pkg&&batch);
  }

  function organizeAiGuide(){
    const guide=document.querySelector('[data-one-ai-json-guide="explanation-card"]');
    if(!guide||guide.classList.contains('is-compact'))return Boolean(guide);
    const head=guide.querySelector('.one-ai-json-guide__head');
    if(!head)return false;
    const details=document.createElement('details');
    details.className='ai-guide-details';
    const summary=document.createElement('summary');
    const title=head.querySelector('strong');
    const badge=head.querySelector('.one-ai-json-guide__badge');
    summary.innerHTML=`<strong>${esc(title?title.textContent:'AI JSON 格式')}</strong><span>${esc(badge?badge.textContent:'進階')}</span>`;
    head.remove();
    while(guide.firstChild)details.appendChild(guide.firstChild);
    details.insertBefore(summary,details.firstChild);
    guide.appendChild(details);
    guide.classList.add('is-compact');
    return true;
  }

  function organizeUi(){
    organizeSaveTools();
    organizeAiGuide();
  }

  function installVersionUi(){
    document.title='O-Ne 說明卡生成器 V0.4.5 CANDIDATE';
    const version=document.querySelector('.title-line h1 span');
    if(version)version.textContent='V0.4.5';
    const badge=document.querySelector('.title-line .badge');
    if(badge){badge.textContent='CANDIDATE';badge.classList.remove('is-ready');badge.classList.add('is-candidate');}
    const description=document.querySelector('.title-block p');
    if(description)description.textContent='候選版：恢復原有一般說明範本為常駐入口；滿版圖片字卡與精簡工具流程維持不變。';
    const status=document.querySelector('.status');
    if(status)status.textContent='V0.4.5 CANDIDATE｜一般範本直接可見';
  }

  function runGalleryQa(){
    const previousState=clone(state);
    const previousAssets=galleryAssets.slice();
    try{
      const fake=document.createElement('canvas');
      fake.width=1600;
      fake.height=900;
      const fakeContext=fake.getContext('2d');
      fakeContext.fillStyle='#3F8FB7';
      fakeContext.fillRect(0,0,fake.width,fake.height);
      state=cleanState({
        ...clone(defaults),
        mode:'content',
        templateId:'standard',
        blocks:TEMPLATES.standard.make()
      });
      renderEditor();
      const templatePicker=$('contentTemplatePicker');
      if(templatePicker.hidden||templatePicker.tagName==='DETAILS'||$('templateButtons').children.length<6)throw new Error('visible content template picker');
      state=cleanState({
        ...clone(defaults),
        mode:'gallery',
        templateId:'gallery',
        blocks:TEMPLATES.gallery.make(),
        gallery:{layout:'single',height:820,slots:Array.from({length:4},(_,index)=>({...slotDefault(),name:`qa-${index+1}.png`}))}
      });
      galleryAssets.forEach((_,index)=>galleryAssets[index]={name:`qa-${index+1}.png`,dataUrl:'data:image/png;base64,AA==',mimeType:'image/png',element:fake});
      renderEditor();
      const single=renderCanvas();
      if(single.rects.length!==1||single.height<900)throw new Error('single gallery layout');
      if(single.galleryX!==3||single.galleryW!==CARD_WIDTH-6)throw new Error('gallery full bleed width');
      if(single.galleryY-single.dividerY>3)throw new Error('gallery header seam');
      state.gallery.layout='triple';
      state.gallery.slots[0]={...state.gallery.slots[0],fit:'free',cropX:10,cropY:12,cropWidth:64,cropHeight:70};
      const triple=renderCanvas();
      if(triple.rects.length!==3)throw new Error('triple gallery layout');
      if(Math.abs((triple.labelY+triple.labelH/2)-(triple.titleY+triple.titleLayout.height/2))>.01)throw new Error('gallery header alignment');
      if(triple.height-(triple.galleryY+triple.galleryH)>4)throw new Error('gallery bottom band');
      const crop=galleryCropSource(state.gallery.slots[0],1600,900);
      if(crop.sx!==160||crop.sy!==108||crop.sw!==1024||crop.sh!==630)throw new Error('independent free crop source');
      state.gallery.layout='grid';
      const grid=renderCanvas();
      if(grid.rects.length!==4)throw new Error('grid gallery layout');
      const project=projectPayload();
      if(!project.assets.gallery||project.assets.gallery.filter(Boolean).length!==4)throw new Error('gallery project assets');
      if(project.data.gallery.slots[0].fit!=='free'||project.data.gallery.slots[0].cropWidth!==64)throw new Error('gallery crop project settings');
      if(!document.body.classList.contains('gallery-mode'))throw new Error('gallery editor mode');
      if(!$('galleryMode').classList.contains('is-active')||!$('contentTemplatePicker').hidden)throw new Error('mode picker hierarchy');
      const saveDock=document.querySelector('.save-dock');
      if(!saveDock||saveDock.parentElement!==$('editorScroll')||saveDock!==$('editorScroll').lastElementChild)throw new Error('save tools below editor');
      organizeUi();
      $('qaResult').textContent='PASS｜visible content templates｜gallery layouts｜full bleed image body｜no inner frame｜free crop｜compact mode UI｜save tools below editor｜header alignment｜project assets';
      document.body.dataset.qa='pass';
    }catch(error){
      $('qaResult').textContent='FAIL｜'+error.message;
      document.body.dataset.qa='fail';
    }finally{
      state=cleanState(previousState);
      galleryAssets.forEach((_,index)=>galleryAssets[index]=previousAssets[index]);
      renderEditor();
      renderCanvas();
    }
  }

  createGalleryEditor();
  state=cleanState(state);
  installVersionUi();
  $('contentMode').onclick=()=>{if(state.mode==='gallery')applyTemplate(lastContentTemplateId||'standard',true);};
  $('galleryMode').onclick=()=>{if(state.mode!=='gallery')applyTemplate('gallery',true);};
  renderEditor();
  renderCanvas();
  organizeUi();
  setTimeout(organizeUi,80);
  setTimeout(organizeUi,260);

  $('exportPng').onclick=exportPng;
  $('exportJson').onclick=exportJson;
  $('exportProject').onclick=exportProject;
  $('projectInput').onchange=event=>importProjectFile(event.target.files&&event.target.files[0]);

  if(window.__ONE_V030__){
    window.__ONE_V030__.render=renderCanvas;
    window.__ONE_V030__.applyTemplate=id=>applyTemplate(id,true);
    window.__ONE_V030__.projectPayload=projectPayload;
    window.__ONE_V030__.loadProjectPayload=loadProjectPayload;
  }
  window.__ONE_V040__={
    version:VERSION,
    layouts:GALLERY_LAYOUTS,
    getState:()=>clone(state),
    getAssets:()=>galleryAssets.slice(),
    applyTemplate:id=>applyTemplate(id,true),
    setGalleryLayout:id=>{if(GALLERY_LAYOUTS[id]){state.mode='gallery';state.gallery.layout=id;renderEditor();return renderCanvas();}},
    render:renderCanvas,
    projectPayload,
    loadProjectPayload,
    runQa:runGalleryQa
  };

  if(new URLSearchParams(location.search).get('qa')==='1')setTimeout(runGalleryQa,120);
})();
