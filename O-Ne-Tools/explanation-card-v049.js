'use strict';

(function installSequenceImages(){
  const VERSION='V0.4.9_20260903';
  const sequenceAssets=new Map();
  let activeSequenceBlockId=null;
  let activatingSequenceImage=false;
  let exportingSequence=false;

  defaults.sequence={...(defaults.sequence||{}),frames:[]};

  function contentBlocks(){
    return state.blocks.filter(item=>item.kind==='body');
  }

  function sequenceIsActive(){
    return state.mode==='content'&&Boolean(state.sequence&&state.sequence.enabled)&&contentBlocks().length>1;
  }

  function normalizeImageSettings(raw,fallback=defaults.image){
    const image={...clone(fallback||defaults.image),...(raw&&typeof raw==='object'?clone(raw):{})};
    image.fit=['contain','cover','free'].includes(image.fit)?image.fit:'cover';
    image.verticalAlign=['top','center','bottom'].includes(image.verticalAlign)?image.verticalAlign:'top';
    image.zoom=Math.round(clamp(image.zoom,image.fit==='cover'?100:25,300));
    image.offsetX=clamp(image.offsetX,-100,100);
    image.offsetY=clamp(image.offsetY,-100,100);
    image.freeZoom=Math.round(clamp(image.freeZoom||100,100,400));
    image.freePanX=clamp(image.freePanX||0,-100,100);
    image.freePanY=clamp(image.freePanY||0,-100,100);
    image.cropWidth=clamp(image.cropWidth??100,12,100);
    image.cropHeight=clamp(image.cropHeight??100,12,100);
    image.cropX=clamp(image.cropX??0,0,100-image.cropWidth);
    image.cropY=clamp(image.cropY??0,0,100-image.cropHeight);
    image.name=String(image.name||'');
    return image;
  }

  function normalizeSequenceFrames(rawFrames,blocks,fallbackImage){
    const source=Array.isArray(rawFrames)?rawFrames:[];
    const used=new Set();
    return blocks.map((item,index)=>{
      let frame=source.find(candidate=>candidate&&String(candidate.blockId||candidate.block_id||'')===item.id);
      if(frame)used.add(frame);
      if(!frame&&source[index]&&!used.has(source[index])){
        frame=source[index];
        used.add(frame);
      }
      return{
        blockId:item.id,
        image:normalizeImageSettings(frame&&frame.image,fallbackImage)
      };
    });
  }

  const cleanStateV048=cleanState;
  cleanState=function(raw){
    const next=cleanStateV048(raw);
    const blocks=next.blocks.filter(item=>item.kind==='body');
    const rawSequence=raw&&raw.sequence&&typeof raw.sequence==='object'?raw.sequence:{};
    next.sequence={
      ...next.sequence,
      frames:normalizeSequenceFrames(rawSequence.frames,blocks,next.image)
    };
    return next;
  };

  function reconcileSequenceFrames(){
    const blocks=contentBlocks();
    const existing=state.sequence&&Array.isArray(state.sequence.frames)?state.sequence.frames:[];
    state.sequence=state.sequence||{enabled:false,visibleCount:1,frames:[]};
    state.sequence.frames=normalizeSequenceFrames(existing,blocks,state.image);
    const valid=new Set(blocks.map(item=>item.id));
    for(const blockId of sequenceAssets.keys())if(!valid.has(blockId))sequenceAssets.delete(blockId);
    state.sequence.visibleCount=Math.round(clamp(state.sequence.visibleCount||blocks.length,1,Math.max(1,blocks.length)));
  }

  function currentRuntimeAsset(){
    if(!imageElement||!imageDataUrl)return null;
    return{
      name:String(state.image.name||'image'),
      dataUrl:String(imageDataUrl),
      mimeType:imageMimeType||((String(imageDataUrl).match(/^data:([^;]+);base64,/)||[])[1]||'image/png'),
      element:imageElement
    };
  }

  function cloneRuntimeAsset(asset){
    return asset?{name:asset.name,dataUrl:asset.dataUrl,mimeType:asset.mimeType,element:asset.element}:null;
  }

  function activeFrameIndex(){
    return Math.round(clamp((state.sequence&&state.sequence.visibleCount||1)-1,0,Math.max(0,contentBlocks().length-1)));
  }

  function frameByBlockId(blockId){
    reconcileSequenceFrames();
    return state.sequence.frames.find(frame=>frame.blockId===blockId)||null;
  }

  function currentFrame(){
    reconcileSequenceFrames();
    return state.sequence.frames[activeFrameIndex()]||null;
  }

  function saveActiveSequenceFrame(){
    if(activatingSequenceImage||!activeSequenceBlockId)return;
    const frame=frameByBlockId(activeSequenceBlockId);
    if(!frame)return;
    frame.image=normalizeImageSettings(state.image,state.image);
    const asset=currentRuntimeAsset();
    if(asset&&frame.image.name)sequenceAssets.set(activeSequenceBlockId,asset);
    else sequenceAssets.delete(activeSequenceBlockId);
  }

  function seedSequenceFramesFromCurrent(){
    reconcileSequenceFrames();
    const settings=normalizeImageSettings(state.image,state.image);
    const asset=currentRuntimeAsset();
    state.sequence.frames.forEach(frame=>{
      if(!frame.image.name)frame.image=clone(settings);
      if(asset&&!sequenceAssets.has(frame.blockId))sequenceAssets.set(frame.blockId,cloneRuntimeAsset(asset));
    });
  }

  function activateSequenceStep(index,{saveCurrent=true}={}){
    if(saveCurrent)saveActiveSequenceFrame();
    reconcileSequenceFrames();
    const blocks=contentBlocks();
    const safeIndex=Math.round(clamp(index,0,Math.max(0,blocks.length-1)));
    const frame=state.sequence.frames[safeIndex];
    const block=blocks[safeIndex];
    if(!frame||!block)return;
    activatingSequenceImage=true;
    state.sequence.visibleCount=safeIndex+1;
    state.image=normalizeImageSettings(frame.image,state.image);
    const asset=sequenceAssets.get(block.id);
    if(asset&&asset.name===state.image.name){
      imageElement=asset.element;
      imageDataUrl=asset.dataUrl;
      imageMimeType=asset.mimeType;
    }else{
      imageElement=null;
      imageDataUrl=null;
      imageMimeType=null;
    }
    activeSequenceBlockId=block.id;
    if($('explanationImage'))$('explanationImage').value='';
    syncSettings();
    activatingSequenceImage=false;
  }

  function configuredSequenceCount(){
    reconcileSequenceFrames();
    return state.sequence.frames.filter(frame=>{
      const asset=sequenceAssets.get(frame.blockId);
      return Boolean(asset&&asset.name===frame.image.name);
    }).length;
  }

  function missingSequenceSteps(){
    reconcileSequenceFrames();
    return state.sequence.frames.map((frame,index)=>({frame,index})).filter(({frame})=>{
      const asset=sequenceAssets.get(frame.blockId);
      return !(asset&&asset.name===frame.image.name);
    }).map(({index})=>index+1);
  }

  function renderSequenceImageUi(){
    const enabled=sequenceIsActive();
    const total=contentBlocks().length;
    const current=Math.round(clamp(state.sequence&&state.sequence.visibleCount||1,1,Math.max(1,total)));
    const controls=$('sequenceImageControls');
    if(controls)controls.hidden=!enabled;
    const title=$('sequenceImageTitle');
    if(title)title.textContent=`第 ${current} 項左圖`;
    const name=$('sequenceImageName');
    const frame=enabled?currentFrame():null;
    if(name)name.textContent=frame&&frame.image.name?frame.image.name:'尚未設定圖片';
    const status=$('sequenceImagesStatus');
    if(status)status.textContent=enabled?`圖片 ${configuredSequenceCount()}／${total} 已設定`:'逐步圖片未啟用';
    const imageButton=$('sequenceImageButton');
    if(imageButton)imageButton.textContent=frame&&frame.image.name?'調整這一項左圖':'設定這一項左圖';
    const exportAll=$('exportSequenceAll');
    if(exportAll){
      exportAll.disabled=!enabled||exportingSequence;
      if(!exportingSequence)exportAll.textContent=`一鍵輸出全部 ${total} 張`;
    }
    const toolbarImage=$('openImageDrawer');
    if(toolbarImage)toolbarImage.textContent=enabled?`🖼 第 ${current} 項左圖`:'🖼 左側圖片';
    const drawerTitle=$('imageDrawerTitle');
    if(drawerTitle)drawerTitle.textContent=enabled?`第 ${current} 項左圖`:'左側圖片';
    const drawerHelp=$('imageDrawerHelp');
    if(drawerHelp)drawerHelp.textContent=enabled?'這裡只會修改目前步驟；切換步驟後，圖片與裁切設定會各自保留。':'選圖、顯示方式與裁切集中在這裡；右側成品預覽會同步更新。';
  }

  const captureV048=capture;
  capture=function(){
    if(sequenceIsActive())saveActiveSequenceFrame();
    reconcileSequenceFrames();
    return captureV048();
  };

  const renderEditorV048=renderEditor;
  renderEditor=function(){
    if(sequenceIsActive())saveActiveSequenceFrame();
    renderEditorV048();
    reconcileSequenceFrames();
    if(sequenceIsActive()){
      const target=currentFrame();
      if(target&&target.blockId!==activeSequenceBlockId)activateSequenceStep(activeFrameIndex(),{saveCurrent:false});
    }else activeSequenceBlockId=null;
    renderSequenceImageUi();
  };

  const syncSettingsV048=syncSettings;
  syncSettings=function(){
    syncSettingsV048();
    renderSequenceImageUi();
  };

  const imageIntrinsicHeightV048=imageIntrinsicHeight;
  imageIntrinsicHeight=function(imageWidth){
    if(sequenceIsActive())return null;
    return imageIntrinsicHeightV048(imageWidth);
  };

  const renderCanvasV048=renderCanvas;
  renderCanvas=function(target=canvas){
    if(sequenceIsActive()&&!activatingSequenceImage)saveActiveSequenceFrame();
    const layout=renderCanvasV048(target);
    if(target===canvas)renderSequenceImageUi();
    return layout;
  };

  const applySnapshotV048=applySnapshot;
  applySnapshot=function(snapshot){
    saveActiveSequenceFrame();
    applySnapshotV048(snapshot);
    reconcileSequenceFrames();
    activeSequenceBlockId=null;
    if(sequenceIsActive())activateSequenceStep(activeFrameIndex(),{saveCurrent:false});
    renderEditor();
    renderCanvas();
  };

  function sequenceAssetPayload(frame,index){
    const asset=sequenceAssets.get(frame.blockId);
    if(!asset||asset.name!==frame.image.name)return null;
    const element=asset.element;
    return{
      block_id:frame.blockId,
      step:index+1,
      name:asset.name,
      mime_type:asset.mimeType||'image/png',
      data_url:asset.dataUrl,
      natural_width:element?(element.naturalWidth||element.width):null,
      natural_height:element?(element.naturalHeight||element.height):null
    };
  }

  const projectPayloadV048=projectPayload;
  projectPayload=function(){
    if(sequenceIsActive())saveActiveSequenceFrame();
    const payload=projectPayloadV048();
    payload.generator_version=VERSION;
    payload.data=capture();
    payload.assets=payload.assets||{};
    payload.assets.sequence_images=(state.sequence.frames||[]).map(sequenceAssetPayload);
    return payload;
  };

  function restoreSequenceAsset(asset,frame,index){
    return new Promise((resolve,reject)=>{
      if(!asset||!asset.data_url){resolve(false);return;}
      const image=new Image();
      image.onload=()=>{
        const blockId=String(asset.block_id||frame&&frame.blockId||contentBlocks()[index]&&contentBlocks()[index].id||'');
        if(!blockId){resolve(false);return;}
        const name=String(asset.name||frame&&frame.image&&frame.image.name||`step-${index+1}`);
        sequenceAssets.set(blockId,{name,dataUrl:String(asset.data_url),mimeType:asset.mime_type||'image/png',element:image});
        const target=frameByBlockId(blockId);
        if(target)target.image.name=name;
        resolve(true);
      };
      image.onerror=()=>reject(new Error(`第 ${index+1} 項左圖無法還原。`));
      image.src=String(asset.data_url);
    });
  }

  const SEQUENCE_PACKAGE_KEY='sequence-step:';

  function sequencePackageKey(blockId){
    return `${SEQUENCE_PACKAGE_KEY}${encodeURIComponent(String(blockId||''))}`;
  }

  function sequenceBlockIdFromPackageKey(key){
    const value=String(key||'');
    if(!value.startsWith(SEQUENCE_PACKAGE_KEY))return '';
    try{return decodeURIComponent(value.slice(SEQUENCE_PACKAGE_KEY.length));}
    catch(error){return '';}
  }

  function sequenceFileFromAsset(asset,index){
    const source=String(asset&&asset.data_url||'');
    const comma=source.indexOf(',');
    if(comma<0)throw new Error(`第 ${index+1} 項左圖資料不完整。`);
    const header=source.slice(0,comma);
    const body=source.slice(comma+1);
    const mimeType=String(asset.mime_type||(header.match(/^data:([^;,]+)/)||[])[1]||'image/png');
    let bytes;
    if(/;base64$/i.test(header)){
      const binary=atob(body);
      bytes=new Uint8Array(binary.length);
      for(let offset=0;offset<binary.length;offset++)bytes[offset]=binary.charCodeAt(offset);
    }else{
      bytes=new TextEncoder().encode(decodeURIComponent(body));
    }
    return new File([bytes],String(asset.name||`step-${index+1}.png`),{type:mimeType});
  }

  function sequenceDataUrlFromFile(file){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result||''));
      reader.onerror=()=>reject(new Error(`圖片 ${file&&file.name||''} 無法讀取。`));
      reader.readAsDataURL(file);
    });
  }

  function sequencePackageAssets(){
    if(!sequenceIsActive())return{excludeKeyPrefixes:[SEQUENCE_PACKAGE_KEY],assets:[]};
    saveActiveSequenceFrame();
    reconcileSequenceFrames();
    const assets=state.sequence.frames.map(sequenceAssetPayload).map((asset,index)=>asset?{
      key:sequencePackageKey(asset.block_id),
      index,
      file:sequenceFileFromAsset(asset,index)
    }:null).filter(Boolean);
    return{
      excludeKeys:['id:explanationImage'],
      excludeKeyPrefixes:[SEQUENCE_PACKAGE_KEY],
      assets
    };
  }

  async function restoreSequencePackageAsset(item){
    const blockId=sequenceBlockIdFromPackageKey(item&&item.key);
    if(!blockId||!item.file)return false;
    reconcileSequenceFrames();
    const frame=frameByBlockId(blockId);
    const index=state.sequence.frames.findIndex(candidate=>candidate.blockId===blockId);
    if(!frame||index<0)return false;
    const dataUrl=await sequenceDataUrlFromFile(item.file);
    await restoreSequenceAsset({
      block_id:blockId,
      name:item.file.name,
      mime_type:item.file.type||'image/png',
      data_url:dataUrl
    },frame,index);
    return true;
  }

  function installProjectPackageAdapter(attempt=0){
    const packageApi=window.ONEProjectPackage;
    if(!packageApi||typeof packageApi.setAssetAdapter!=='function'){
      if(attempt<20)setTimeout(()=>installProjectPackageAdapter(attempt+1),100);
      return;
    }
    packageApi.setAssetAdapter('explanation-card',{
      prepareExport:()=>{if(sequenceIsActive())saveActiveSequenceFrame();},
      exportAssets:sequencePackageAssets,
      beforeImport:()=>{sequenceAssets.clear();activeSequenceBlockId=null;},
      restoreAsset:restoreSequencePackageAsset,
      afterImport:()=>{
        activeSequenceBlockId=null;
        if(sequenceIsActive())activateSequenceStep(activeFrameIndex(),{saveCurrent:false});
        renderEditor();
        renderCanvas();
        renderCropper();
        renderImageLivePreview();
      }
    });
  }

  const loadProjectPayloadV048=loadProjectPayload;
  loadProjectPayload=async function(payload){
    await loadProjectPayloadV048(payload);
    sequenceAssets.clear();
    reconcileSequenceFrames();
    if(payload&&payload.schema==='o-ne.explanation-card.project.v1'){
      const assets=payload.assets||{};
      const sequenceList=Array.isArray(assets.sequence_images)?assets.sequence_images:[];
      if(sequenceList.length){
        await Promise.all(state.sequence.frames.map((frame,index)=>restoreSequenceAsset(sequenceList[index],frame,index)));
      }else if(sequenceIsActive()){
        const fallback=currentRuntimeAsset();
        if(fallback)state.sequence.frames.forEach(frame=>sequenceAssets.set(frame.blockId,cloneRuntimeAsset(fallback)));
      }
    }
    activeSequenceBlockId=null;
    if(sequenceIsActive())activateSequenceStep(activeFrameIndex(),{saveCurrent:false});
    renderEditor();
    renderCanvas();
    renderCropper();
    renderImageLivePreview();
    if(sequenceIsActive())toast(`專案檔載入完成：已還原 ${configuredSequenceCount()}／${contentBlocks().length} 張逐步左圖。`);
  };

  const exportPngV048=exportPng;
  exportPng=function(){
    if(!sequenceIsActive())return exportPngV048();
    saveActiveSequenceFrame();
    const frame=currentFrame();
    const asset=frame&&sequenceAssets.get(frame.blockId);
    if(!frame||!asset||asset.name!==frame.image.name){
      toast(`請先設定第 ${state.sequence.visibleCount} 項左圖。`,true);
      return;
    }
    const out=document.createElement('canvas');
    renderCanvas(out);
    out.toBlob(blob=>{
      if(!blob)return;
      const total=contentBlocks().length;
      const step=String(state.sequence.visibleCount).padStart(2,'0');
      download(blob,`說明卡-${titlePlain()}-STEP${step}-of-${String(total).padStart(2,'0')}.png`);
      toast(`第 ${state.sequence.visibleCount}／${total} 項已輸出；圖片與畫面尺寸都已固定。`);
    },'image/png');
  };

  function canvasToBlob(target){
    return new Promise((resolve,reject)=>target.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG 產生失敗。')),'image/png'));
  }

  async function exportAllSequencePngs(){
    if(!sequenceIsActive()||exportingSequence)return;
    saveActiveSequenceFrame();
    const missing=missingSequenceSteps();
    if(missing.length){
      toast(`請先設定第 ${missing.join('、')} 項左圖，再一次輸出。`,true);
      return;
    }
    const helper=window.ONEProjectPackage&&window.ONEProjectPackage.__test;
    if(!helper||typeof helper.makeZip!=='function'){
      toast('ZIP 輸出元件尚未完成載入，請稍後再按一次。',true);
      return;
    }
    const originalIndex=activeFrameIndex();
    const total=contentBlocks().length;
    const button=$('exportSequenceAll');
    exportingSequence=true;
    if(button){button.disabled=true;button.textContent='正在輸出…';}
    try{
      const entries=[];
      for(let index=0;index<total;index++){
        activateSequenceStep(index);
        const out=document.createElement('canvas');
        renderCanvas(out);
        const blob=await canvasToBlob(out);
        const step=String(index+1).padStart(2,'0');
        entries.push({name:`說明卡-${titlePlain()}-STEP${step}-of-${String(total).padStart(2,'0')}.png`,data:blob});
      }
      const zip=await helper.makeZip(entries);
      download(zip,`說明卡-${titlePlain()}-逐步畫面-${String(total).padStart(2,'0')}張.zip`);
      toast(`全部 ${total} 張已輸出：文字逐步增加、左圖逐步切換，尺寸完全一致。`);
    }catch(error){
      toast(error&&error.message||'逐步 PNG 輸出失敗。',true);
    }finally{
      activateSequenceStep(originalIndex);
      exportingSequence=false;
      renderEditor();
      renderCanvas();
    }
  }

  const exportProjectV048=exportProject;
  exportProject=function(){
    if(!sequenceIsActive())return exportProjectV048();
    const payload=projectPayload();
    const count=(payload.assets.sequence_images||[]).filter(Boolean).length;
    download(new Blob([JSON.stringify(payload)],{type:'application/json'}),`說明卡-${titlePlain()}-逐步畫面專案.onecard`);
    toast(`.onecard 已下載：包含 ${count} 張逐步左圖、各自裁切設定與全部文字。`);
  };

  exportJson=function(){
    const payload={
      schema:'o-ne.explanation-card.formal.v0.4.9',
      status:'READY',
      generator_version:VERSION,
      component:{
        width:CARD_WIDTH,
        height:lastLayout?lastLayout.height:MIN_HEIGHT,
        height_mode:state.mode==='gallery'?'gallery-layout-height':'richtext-measured-auto',
        rich_text:true,
        modes:['content','gallery'],
        content_sequence_progressive_reveal:true,
        content_sequence_per_step_image:true,
        content_sequence_per_step_crop_settings:true,
        content_sequence_height_independent_from_step_images:true,
        content_sequence_stable_left_image_frame:true,
        content_sequence_export_all_png_zip:true,
        content_sequence_project_zip_embeds_all_images:true,
        content_image_vertical_align:['top','center','bottom'],
        content_image_manual_zoom_range:[25,300],
        content_image_prevent_automatic_upscale_modes:['contain','free'],
        content_image_cover_auto_fill:true,
        gallery_layouts:['single','split','triple','hero-right','hero-bottom','grid'],
        gallery_images_max:4,
        gallery_per_image_free_crop:true,
        gallery_free_crop_unlocked_aspect:true,
        gallery_full_bleed_below_header:true,
        gallery_inner_frame:false,
        gallery_continuous_coffee_background:true,
        project_file_embeds_images:true
      },
      data:capture(),
      generated_at:new Date().toISOString()
    };
    download(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),`說明卡-${titlePlain()}-${state.mode==='gallery'?'純圖片字卡':'RichText'}.json`);
    toast('純設定 JSON 已匯出；逐步圖片本體請使用 .onecard。');
  };

  function installVersionUi(){
    document.title='O-Ne 說明卡生成器 V0.4.9 READY';
    const version=document.querySelector('.title-line h1 span');
    if(version)version.textContent='V0.4.9';
    const description=document.querySelector('.title-block p');
    if(description)description.textContent='正式版：每個步驟可綁定自己的左圖與裁切設定，全部畫面固定尺寸。';
    const status=document.querySelector('.status');
    if(status)status.textContent='V0.4.9 READY｜逐步圖文｜固定尺寸';
  }

  function installSequenceHandlers(){
    $('sequenceEnabled').onchange=event=>{
      const total=contentBlocks().length;
      saveActiveSequenceFrame();
      state.sequence.enabled=Boolean(event.target.checked)&&total>1;
      if(state.sequence.enabled){
        seedSequenceFramesFromCurrent();
        state.sequence.visibleCount=1;
        activeSequenceBlockId=null;
        activateSequenceStep(0,{saveCurrent:false});
        toast('逐步畫面已開啟：請依序設定每一項左圖，再一次輸出。');
      }else{
        activeSequenceBlockId=null;
        toast('已切回一般單張。');
      }
      renderEditor();
      renderCanvas();
    };
    $('sequenceVisibleCount').onchange=event=>{
      const total=contentBlocks().length;
      activateSequenceStep(Math.round(clamp(event.target.value,1,Math.max(1,total)))-1);
      renderEditor();
      renderCanvas();
    };
    $('sequenceImageButton').onclick=()=>openImageDrawer();
    $('exportSequenceAll').onclick=exportAllSequencePngs;
    $('removeImage').onclick=()=>{
      imageElement=null;
      imageDataUrl=null;
      imageMimeType=null;
      state.image.name='';
      if($('explanationImage'))$('explanationImage').value='';
      saveActiveSequenceFrame();
      syncSettings();
      renderCanvas();
      renderCropper();
      toast(sequenceIsActive()?`第 ${state.sequence.visibleCount} 項左圖已移除。`:'左側圖片已移除。');
    };
    $('exportPng').onclick=exportPng;
    $('exportJson').onclick=exportJson;
    $('exportProject').onclick=exportProject;
  }

  function runSequenceQa(){
    const previousState=clone(state);
    const previousAssets=new Map(sequenceAssets);
    const previousImage={element:imageElement,dataUrl:imageDataUrl,mimeType:imageMimeType,activeBlockId:activeSequenceBlockId};
    try{
      const blocks=TEMPLATES.steps.make();
      state=cleanState({...clone(defaults),mode:'content',templateId:'steps',blocks,sequence:{enabled:true,visibleCount:1,frames:[]}});
      const fakeColors=['#FD4537','#21A74D','#3F8FB7'];
      reconcileSequenceFrames();
      state.sequence.frames.forEach((frame,index)=>{
        const fake=document.createElement('canvas');
        fake.width=320+index*40;
        fake.height=180+index*70;
        const context=fake.getContext('2d');
        context.fillStyle=fakeColors[index];
        context.fillRect(0,0,fake.width,fake.height);
        frame.image={...normalizeImageSettings(defaults.image),name:`qa-step-${index+1}.png`,fit:index===1?'free':'cover',cropX:index===1?10:0,cropY:index===1?12:0,cropWidth:index===1?70:100,cropHeight:index===1?68:100};
        sequenceAssets.set(frame.blockId,{name:frame.image.name,dataUrl:fake.toDataURL('image/png'),mimeType:'image/png',element:fake});
      });
      activeSequenceBlockId=null;
      activateSequenceStep(0,{saveCurrent:false});
      renderEditor();
      const first=renderCanvas();
      activateSequenceStep(2);
      const final=renderCanvas();
      if(first.width!==final.width||first.height!==final.height||first.imageW!==final.imageW||first.imageH!==final.imageH)throw new Error('sequence image frame size changed');
      activateSequenceStep(1);
      if(state.image.name!=='qa-step-2.png'||state.image.fit!=='free'||state.image.cropWidth!==70)throw new Error('per-step crop settings did not return');
      const payload=projectPayload();
      if((payload.assets.sequence_images||[]).filter(Boolean).length!==3)throw new Error('project did not embed every step image');
      const packageAssets=sequencePackageAssets();
      if(packageAssets.assets.length!==3||packageAssets.assets.some((asset,index)=>asset.index!==index||!asset.key.startsWith(SEQUENCE_PACKAGE_KEY)))throw new Error('project ZIP did not collect every step image');
      $('qaResult').textContent='PASS｜per-step left image｜per-step crop memory｜stable full card and image frame｜onecard + project ZIP embed every sequence image｜export all ZIP';
      document.body.dataset.qa='pass';
    }catch(error){
      $('qaResult').textContent='FAIL｜'+error.message;
      document.body.dataset.qa='fail';
    }finally{
      state=cleanState(previousState);
      sequenceAssets.clear();
      previousAssets.forEach((asset,key)=>sequenceAssets.set(key,asset));
      imageElement=previousImage.element;
      imageDataUrl=previousImage.dataUrl;
      imageMimeType=previousImage.mimeType;
      activeSequenceBlockId=previousImage.activeBlockId;
      renderEditor();
      if(sequenceIsActive())activateSequenceStep(activeFrameIndex(),{saveCurrent:false});
      renderCanvas();
    }
  }

  state=cleanState(state);
  reconcileSequenceFrames();
  installVersionUi();
  installSequenceHandlers();
  installProjectPackageAdapter();
  renderEditor();
  if(sequenceIsActive())activateSequenceStep(activeFrameIndex(),{saveCurrent:false});
  renderCanvas();

  if(window.__ONE_V030__){
    window.__ONE_V030__.render=renderCanvas;
    window.__ONE_V030__.projectPayload=projectPayload;
    window.__ONE_V030__.loadProjectPayload=loadProjectPayload;
  }
  window.__ONE_V049__={
    version:VERSION,
    getState:()=>capture(),
    getSequenceAssets:()=>new Map(sequenceAssets),
    activateStep:index=>{activateSequenceStep(index);renderEditor();return renderCanvas();},
    projectPayload,
    loadProjectPayload,
    exportAllSequencePngs,
    runQa:runSequenceQa,
    __test:{normalizeImageSettings,normalizeSequenceFrames,missingSequenceSteps,sequencePackageKey,sequenceBlockIdFromPackageKey}
  };

  if(new URLSearchParams(location.search).get('qa')==='1')setTimeout(runSequenceQa,300);
})();
