/* O-Ne shared AI JSON format guide + Canonical import — V1.4.0 */
(function (global) {
  'use strict';

  var VERSION = '1.4.0';
  var CANONICAL_SCHEMA = 'o-ne.card.canonical.v1';
  var mounted = Object.create(null);

  var META = {
    'general-card': { name:'一般卡', code:'GENERAL-CARD', version:'V1.2.1', file:'一般卡-臨空城華盛頓飯店-HERE.card.json', native:{ generator_version:'V1.2.1_20260826' }, values:['mode：HERE／GET／COST／CUSTOM','HERE=地點定位；GET=獲得；COST=花費；CUSTOM=自訂標籤'] },
    'trigger-card': { name:'觸發卡', code:'TRIGGER-CARD', version:'V1.0.2', file:'觸發卡-機場煙火-EVENT.card.json', native:{ generator_version:'V1.0.2_20260826' }, values:['state：EVENT／DONE／FAIL','progress 例如 0/1、1/1'] },
    'persistent-card': { name:'常駐卡', code:'PERSISTENT-MISSION', version:'V1.1.2', file:'常駐卡-準備返台-MISSION.card.json', native:{ target_version:'1.2', generator_version:'V1.1.2_20260827' }, values:['state：MISSION／DONE／FAIL','字級由 appearance.tool.task_font_size／progress_font_size 控制'] },
    'effect-card': { name:'效果卡', code:'STA-02', version:'V0.3.1', file:'效果卡-好吃到爆-BUFF.card.json', native:{ target_schema:'o-ne.effect-card.formal.v0.3.1', target_version:'0.3.1', generator_version:'V0.3.1_20260826', renderer_status:'FORMAL' }, values:['state 建議 BUFF／DEBUFF','preset／text_style／decoration／atmosphere 放 appearance.tool'] },
    'move-card': { name:'移動卡', code:'NAV-01', version:'V1.0.7', file:'移動卡-一蘭到關西機場-white.card.json', native:{ generator_version:'V1.0.7_20260826' }, values:['stations 必須 2–8 站','segments 數量必須等於 stations 數量 − 1','segment.style：solid／dashed'] },
    'choice-card': { name:'選項卡', code:'SELECT-CARD', version:'V1.0.1', file:'選項卡-交通工具-高亮選項.card.json', native:{ generator_version:'V1.0.1_20260826' }, values:['options 使用 content.items','item.state：BRIGHT／DIM；可以同時多項 BRIGHT'] },
    'challenge-card': { name:'挑戰卡', code:'CHALLENGE-CARD', version:'V0.1.1', file:'挑戰卡-接受挑戰-YES.card.json', native:{ target_schema:'o-ne.challenge-card.ready.v0.1.1', generator_version:'V0.1.1_20260826', renderer_status:'READY' }, values:['card.mode：accept／abandon','content.confirmation.selected：yes／no','prefix／emphasis／suffix／YES／NO 文字放 content.confirmation'] },
    'dialogue-card': { name:'對話卡', code:'DIALOGUE-CARD', version:'V1.3.8', file:'對話卡-Omi疑惑-涅特無奈.card.json', native:{ generator_version:'V1.3.8_20260906' }, values:['character：NONE／Omi／NieTe／Kuma／Nomi／NPC','表情：一般／大笑／驚訝／生氣／委屈哭／疑惑／無奈'] },
    'rating-card': { name:'評分卡', code:'COL-02', version:'V1.3.1', file:'評分卡-燒肉力丸-補給品鑑定.card.json', image:true, native:{ target_schema:'o-ne.rating-card.ready.v1.3.1', generator_version:'V1.3.1_20260826', renderer_status:'READY' }, values:['content.items 1–8 項；type=score 填 score，type=text 填 result','content.price.badge／text 對應金額','圖片只記 assets 引用；完整搬移使用專案 ZIP'] },
    'focus-card': { name:'焦點內容卡', code:'FOCUS-CARD', version:'V0.6.0', file:'焦點卡-道頓堀觀光船-body.card.json', image:true, native:{ target_schema:'o-ne.focus-card.ready.v0.6.0', renderer_status:'READY' }, values:['card.mode：body／list／steps','自由裁切放 assets.crop；fit 可 contain／cover／free','累積狀態統一放 sequence；完整圖片交付使用專案 ZIP'] },
    'explanation-card': { name:'說明卡', code:'EXPLANATION-CARD', version:'V0.4.9', file:'說明卡-退稅流程-逐步圖文.card.json', image:true, native:{ target_schema:'o-ne.explanation-card.formal.v0.4.9', generator_version:'V0.4.9_20260903', renderer_status:'READY' }, values:['card.mode：content／gallery','逐步圖文以 content.body 的 block id 綁 sequence.steps.content_refs','每一步左圖各自放 assets，asset slot 與 sequence.steps.asset_slots 對應','image.verticalAlign 對應 assets.vertical_align：top／center／bottom','自由裁切使用 crop.x／y／width／height；cover 仍會自動放大到填滿左欄','版型 single／split／triple／hero-right／hero-bottom／grid 放 appearance.tool','逐步輸出不改卡片尺寸與左圖框；完整 project.zip 可保存每一步左圖；.onecard 僅舊專案相容'] },
    'thumbnail-frame': { name:'縮圖品牌框', code:'THUMBNAIL-FRAME', version:'V1.2.6', file:'縮圖品牌框-封面名稱-含底圖.card.json', image:true, native:{ target_schema:'o-ne.thumbnail-frame.ready.v1.2.6', generator_version:'V1.2.6_20260826', renderer_status:'READY' }, values:['canvas.width／height 為畫布尺寸','底圖放 assets background；角標設定放 appearance.tool.corner','完整圖片交付使用專案 ZIP'] },
    'settlement-card': { name:'片尾結算卡', code:'QST-03', version:'V0.1.3', file:'片尾結算卡-大阪任務結算-提問.card.json', image:true, native:{ target_schema:'o-ne.settlement-card.ready.v0.1.3', generator_version:'0.1.3', renderer_status:'READY' }, values:['content.items 支援 1–8 列','row icon 可 check／list／location／star／plus／money／count／time／question／heart／none／custom','背景、左側圖、subscribe 圖只記 assets；完整交付使用專案 ZIP'] }
  };

  var COMPONENTS = {
    'trigger-card':'TRIGGER-CARD','persistent-card':'PERSISTENT-MISSION','effect-card':'STA-02','move-card':'NAV-01','choice-card':'SELECT-CARD','challenge-card':'CHALLENGE-CARD','dialogue-card':'DIALOGUE-CARD','rating-card':'COL-02','focus-card':'FOCUS-CARD','explanation-card':'EXPLANATION-CARD','thumbnail-frame':'THUMBNAIL-FRAME','settlement-card':'QST-03'
  };

  function clone(v){ return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function merge(a,b){ var out=clone(a||{}); Object.keys(b||{}).forEach(function(k){ out[k]=(out[k]&&typeof out[k]==='object'&&!Array.isArray(out[k])&&b[k]&&typeof b[k]==='object'&&!Array.isArray(b[k]))?merge(out[k],b[k]):clone(b[k]); }); return out; }
  function base(toolId){
    var meta=META[toolId]||{};
    return {
      schema:CANONICAL_SCHEMA,schema_version:'1.0',tool_id:toolId,
      card:{component_id:COMPONENTS[toolId]||null,mode:null,variant:null,state:null},
      canvas:{width:null,height:null},
      content:{label:{enabled:false,text:''},title:'',subtitle:'',body:[],items:[],progress:'',question:'',confirmation:null,dialogue:null,route:null,price:null,review:'',summary:'',next_text:''},
      appearance:{placement:null,panel_opacity:null,accent_color:null,card_size:null,width_px:null,title_size:null,content_size:null,tool:{}},
      assets:[],sequence:{enabled:false,mode:'single',current_step:1,effect:'none',steps:[]},
      native:{target_schema:(meta.native||{}).target_schema||null,target_version:(meta.native||{}).target_version||null,generator_version:(meta.native||{}).generator_version||null,passthrough:(meta.native||{}).renderer_status?{status:(meta.native||{}).renderer_status}:{}},
      meta:{status:'DRAFT',source:'chatgpt',source_note:''}
    };
  }
  function ex(toolId,patch){ return merge(base(toolId),patch||{}); }
  function asset(slot,name,fit,crop,transform,vertical){ return {slot:slot,visible:true,source:{kind:name?'file':'none',name:name||'',ref:null},fit:fit||'contain',crop:crop||{x:0,y:0,width:100,height:100},transform:transform||{zoom:100,offset_x:0,offset_y:0,scale:1},vertical_align:vertical||null}; }

  var EXAMPLES = {
    'general-card': ex('general-card',{card:{component_id:'HERE-01',mode:'HERE',variant:'HERE',state:null},content:{label:{enabled:true,text:'HERE',color:'#29A6A7',text_color:'#FFFFFF',custom:false},title:'臨空城華盛頓飯店',subtitle:'計畫外多住的一晚'}}),
    'trigger-card': ex('trigger-card',{card:{state:'EVENT'},content:{title:'機場居然看得到煙火？！',subtitle:'關西機場意外解鎖隱藏事件',progress:'0/1'}}),
    'persistent-card': ex('persistent-card',{card:{state:'MISSION'},content:{title:'準備返台',progress:'0/1'},appearance:{tool:{task_font_size:21,progress_font_size:20,font_size_mode:'manual',tool:'persistent-card'}}}),
    'effect-card': ex('effect-card',{card:{state:'BUFF'},content:{title:'好吃到爆！',subtitle:'幸福感 +999'},appearance:{accent_color:'#FFBE37',title_size:42,content_size:22,tool:{preset:'delicious',text_style:'white',decoration:'delicious',decoration_density:'standard',decoration_visible:true,atmosphere:'none',content_visible:true}}}),
    'move-card': ex('move-card',{card:{state:'white'},content:{title:'一蘭 → 關西機場',route:{stations:['一蘭','飯店拿行李','梅田','大阪站（JR）','關西機場'],segments:[{name:'步行',style:'solid'},{name:'移動',style:'solid'},{name:'步行',style:'solid'},{name:'JR',style:'solid'}]}}}),
    'choice-card': ex('choice-card',{content:{title:'關西國際機場 (KIX) → 住宿飯店',question:'選擇的交通工具？',items:[{id:'item-1',index:1,text:'關空特急 HARUKA',state:'DIM'},{id:'item-2',index:2,text:'南海電鐵',state:'BRIGHT'}]}}),
    'challenge-card': ex('challenge-card',{card:{mode:'accept'},content:{confirmation:{prefix:'確認',emphasis:'接受',suffix:'挑戰任務？',yes:'YES',no:'NO',selected:'yes'}},appearance:{tool:{visual_rules:{panel_fill_opacity:.8,select_label_locked:true}}}}),
    'dialogue-card': ex('dialogue-card',{content:{dialogue:{left:{character:'Omi',expression:'疑惑',name:'Omi'},right:{character:'NieTe',expression:'無奈',name:'Nie Te'},text:'你不是說走這條比較快嗎？'}}}),
    'rating-card': ex('rating-card',{content:{label:{enabled:true,text:'補給品鑑定',size_px:32},title:'燒肉力丸 道頓堀店',subtitle:'大阪・道頓堀',items:[{id:'item-1',label:'好吃度',type:'score',score:4.8},{id:'item-2',label:'CP 值',type:'score',score:4.5},{id:'item-3',label:'結論',type:'text',result:'值得再訪'}],price:{badge:'金額',text:'一人 5000 日圓'},review:'上菜速度快，牛舌好吃'},appearance:{width_px:1856,tool:{layout:{mode:'none',requested_width_px:1856},image_adjustments:{background:{visible:false,scale:1,x:0,y:0},product:{position:'none',size_percent:28},left_product:{visible:false},right_product:{visible:false}}}}}),
    'focus-card': ex('focus-card',{card:{mode:'body'},content:{label:{enabled:false,text:'',position:'above',background:'#29A6A7',color:'#FFFFFF'},title:'道頓堀觀光船',body:[{id:'body-1',type:'paragraph',text:'從河面看道頓堀招牌，是另一種視角。',level:1,emphasis:false}]},appearance:{placement:'centerLower',accent_color:'#29A6A7',card_size:'large',width_px:882,title_size:56,content_size:36,tool:{component:{placement:'centerLower'},style:{accentColor:'#29A6A7',cardSize:'large',customWidth:882,titleSize:56,contentSize:36},images_meta:{placement:'right',scale:32}}},assets:[asset('right','道頓堀.png','free',{x:12,y:8,width:76,height:68},{zoom:100,offset_x:0,offset_y:0,scale:1})]}),
    'explanation-card': ex('explanation-card',{card:{mode:'content',variant:'steps'},content:{label:{enabled:true,text:'兌換',color:'#FFBE37',textColor:'#1F1713'},title:'退稅流程',subtitle:'三步驟',body:[{id:'step-1',type:'paragraph',text:'先結帳',level:1,emphasis:false},{id:'step-2',type:'paragraph',text:'再辦退稅',level:1,emphasis:false},{id:'step-3',type:'paragraph',text:'確認退款',level:1,emphasis:false}]},assets:[asset('step-1','步驟1.png','free',{x:8,y:10,width:70,height:82},{zoom:100,offset_x:0,offset_y:0,scale:1},'center'),asset('step-2','步驟2.png','contain',null,{zoom:110,offset_x:2,offset_y:3,scale:1},'bottom'),asset('step-3','步驟3.png','cover',null,{zoom:100,offset_x:0,offset_y:0,scale:1},'center')],sequence:{enabled:true,mode:'accumulate',current_step:1,effect:'none',steps:[{id:'step-1',content_refs:['step-1'],asset_slots:['step-1'],states:[],effects:[]},{id:'step-2',content_refs:['step-2'],asset_slots:['step-2'],states:[],effects:[]},{id:'step-3',content_refs:['step-3'],asset_slots:['step-3'],states:[],effects:[]}]},appearance:{tool:{component:{placement:'centerLower'},data_extras:{templateId:'steps'}}}}),
    'thumbnail-frame': ex('thumbnail-frame',{canvas:{width:1920,height:1080},appearance:{tool:{source_image:{embedded:false,present:false,mode:'cover',zoom_percent:100,position_x:0,position_y:0,background_color:'#000000'},corner:{content:'logo',position:'top-right',text:'',text_color:'#FFFFFF',custom_image_embedded:false,custom_image_present:false}}},assets:[asset('background','', 'cover')]}),
    'settlement-card': ex('settlement-card',{content:{title:'大阪任務結算',subtitle:'DAY 5 RESULT',items:[{id:'item-1',icon:'check',title:'任務進度',value:'100%',accent:false},{id:'item-2',icon:'star',title:'今日 MVP',value:'燒肉力丸',accent:true}],summary:'本日任務完成',next_text:'下一集：返台危機',question:'你最想挑戰哪一個？'},appearance:{tool:{viewer_question:{hint:'留言告訴我們',text:'你最想挑戰哪一個？'},assets_meta:{background:{visible:true,source:'formal',file_name:'正式背景',scale:1,x:0,y:0},left_panel:{mode:'question',file_name:'尚未上傳',scale:1,x:0,y:0},subscribe:{visible:false,file_name:'尚未上傳',scale:1,x:0,y:0}}}},assets:[asset('background','正式背景','contain')]})
  };

  var GUIDES = {};
  Object.keys(META).forEach(function(id){ var m=clone(META[id]); m.example=clone(EXAMPLES[id]); GUIDES[id]=m; });

  function ensureCanonicalRuntime(callback){
    if(global.ONE_CARD_CANONICAL){ if(callback) callback(); return; }
    if(typeof document==='undefined') return;
    var existing=document.getElementById&&document.getElementById('one-card-canonical-v1');
    if(existing){ if(callback) existing.addEventListener&&existing.addEventListener('load',callback,{once:true}); return; }
    if(document.readyState==='loading' && typeof document.write==='function'){
      document.write('<script id="one-card-canonical-v1" src="./card-canonical-v1.js?v=100"></'+'script>');
      if(callback) callback();
      return;
    }
    if(document.createElement && document.head){
      var s=document.createElement('script'); s.id='one-card-canonical-v1'; s.src='./card-canonical-v1.js?v=100'; s.onload=function(){ if(callback) callback(); }; document.head.appendChild(s);
    }
  }

  function prepareImport(toolId, parsed){
    if(!parsed || typeof parsed!=='object') return parsed;
    if(parsed.schema!==CANONICAL_SCHEMA) return parsed;
    if(parsed.tool_id!==toolId) throw new Error('這份 Canonical JSON 屬於其他工具（'+(parsed.tool_id||'未知')+'）。');
    if(!global.ONE_CARD_CANONICAL) throw new Error('Canonical adapter 尚未載入。');
    var errors=global.ONE_CARD_CANONICAL.validate(parsed);
    if(errors.length) throw new Error('Canonical JSON 驗證失敗：'+errors.join('、'));
    var nativePayload=global.ONE_CARD_CANONICAL.toNative(parsed);
    var rendererStatus=parsed.native&&parsed.native.passthrough&&parsed.native.passthrough.status;
    if(rendererStatus && nativePayload && nativePayload.status==='DRAFT') nativePayload.status=rendererStatus;
    return nativePayload;
  }

  function aiPrompt(guide){
    var imageNote=guide.image?'\n9. 圖片位元不放進 Canonical JSON；完整圖片與可編輯專案請使用 O-Ne 專案 ZIP。':'';
    if(guide===GUIDES['explanation-card']) imageNote+='\n10. 逐步說明卡的每一步左圖以 assets＋sequence 綁定；.onecard 只保留舊專案相容。';
    return [
      '你要製作 O-Ne「'+guide.name+'」的 Canonical JSON 設定檔。',
      '請使用統一 schema：'+CANONICAL_SCHEMA+'。不要改成各工具舊版 Native JSON。',
      '',
      '交付規則：',
      '1. 請回傳 UTF-8 的 .json 檔，建議檔名：'+guide.file,
      '2. 如果目前介面不能直接建立附件，就只輸出「純 JSON 原文」。',
      '3. 不要使用 ```json 程式碼框，不要在 JSON 前後加說明、標題、註解或 Markdown。',
      '4. JSON 必須可被 JSON.parse() 直接解析。',
      '5. schema 固定 '+CANONICAL_SCHEMA+'；schema_version 固定 1.0。',
      '6. tool_id 固定 '+Object.keys(GUIDES).find(function(id){return GUIDES[id]===guide;})+'。',
      '7. meta.status 固定 DRAFT；不得自行寫 FORMAL 或 APPROVED。',
      '8. 不知道的事實不要猜；保留空值或使用我提供的資料。'+imageNote,
      '',
      '此卡型重要限制：',
      guide.values.map(function(v){return '- '+v;}).join('\n'),
      '',
      'Canonical JSON 範例：',
      JSON.stringify(guide.example,null,2)
    ].join('\n');
  }

  function copyText(text){
    if(global.navigator&&global.navigator.clipboard&&global.navigator.clipboard.writeText) return global.navigator.clipboard.writeText(text);
    if(typeof document==='undefined') return Promise.resolve(false);
    var t=document.createElement('textarea'); t.value=text; document.body.appendChild(t); t.select(); var ok=document.execCommand&&document.execCommand('copy'); t.remove(); return Promise.resolve(ok);
  }
  function downloadJson(file,obj){
    if(typeof document==='undefined' || typeof Blob==='undefined') return;
    var blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json;charset=utf-8'}),a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=file; a.click(); global.setTimeout(function(){URL.revokeObjectURL(a.href);},1000);
  }
  function panelFor(id,guide){
    var panel=document.createElement('section'); panel.className='one-ai-json-guide'; panel.setAttribute('data-one-ai-json-guide',id);
    panel.innerHTML='<div class="one-ai-json-guide__title">給 AI 的 JSON 格式 <span>Canonical V1</span></div>'+
      '<div class="one-ai-json-guide__note">AI 只產生 <b>'+CANONICAL_SCHEMA+'</b>；工具會自動轉成原生格式。舊 Native JSON 仍可直接載入。</div>'+
      '<div class="one-ai-json-guide__values">'+guide.values.map(function(v){return '<div>• '+String(v).replace(/</g,'&lt;')+'</div>';}).join('')+'</div>'+
      '<div class="one-ai-json-guide__buttons"><button type="button" data-action="prompt">複製完整 AI 指令</button><button type="button" data-action="example">複製 JSON 範例</button><button type="button" data-action="download">下載 JSON 範例</button></div>'+
      '<details><summary>JSON 範例｜需要時再展開</summary><pre></pre></details><div class="one-ai-json-guide__status"></div>';
    var pre=panel.querySelector('pre'); if(pre) pre.textContent=JSON.stringify(guide.example,null,2);
    var status=panel.querySelector('.one-ai-json-guide__status');
    panel.querySelector('[data-action="prompt"]').onclick=function(){copyText(aiPrompt(guide)).then(function(){if(status)status.textContent='已複製完整 Canonical AI 指令';});};
    panel.querySelector('[data-action="example"]').onclick=function(){copyText(JSON.stringify(guide.example,null,2)).then(function(){if(status)status.textContent='已複製 Canonical JSON 範例';});};
    panel.querySelector('[data-action="download"]').onclick=function(){downloadJson(guide.file,guide.example);if(status)status.textContent='已下載 Canonical JSON 範例';};
    return panel;
  }
  function insertBelowPreview(panel){
    var id=panel.getAttribute('data-one-ai-json-guide')||'tool';
    var utilities=document.querySelectorAll?document.querySelectorAll('[data-one-project-package-ui],[data-one-backup-ui],[data-one-batch-render-ui]'):[];
    var utilityAnchor=utilities&&utilities.length?utilities[utilities.length-1]:null;
    if(global.ONEAfterEditDock){global.ONEAfterEditDock.place(id,panel,{anchor:utilityAnchor});return;}
    var host=document.querySelector&&document.querySelector('.workspace,.grid,.app');
    if(host&&host.appendChild)host.appendChild(panel);else if(document.body)document.body.appendChild(panel);
  }
  function mountGuide(id){
    if(mounted[id]||!GUIDES[id]||typeof document==='undefined')return mounted[id]||null;
    var panel=panelFor(id,GUIDES[id]); insertBelowPreview(panel); mounted[id]=panel; return panel;
  }

  function wrapMounts(){
    if(global.ONEEditBackup&&global.ONEEditBackup.mount&&!global.ONEEditBackup.__aiJsonGuideWrapped){
      var originalEditMount=global.ONEEditBackup.mount;
      global.ONEEditBackup.mount=function(config){
        var next=config||{};
        if(config&&config.id&&GUIDES[config.id]){
          next=Object.assign({},config);
          var originalFrom=config.fromJSON;
          next.fromJSON=function(parsed){var nativePayload=prepareImport(config.id,parsed);return originalFrom?originalFrom(nativePayload):nativePayload;};
        }
        var api=originalEditMount(next);
        if(config&&config.id&&GUIDES[config.id])global.setTimeout(function(){mountGuide(config.id);},0);
        return api;
      };
      global.ONEEditBackup.__aiJsonGuideWrapped=true;
    }
    if(global.ONEProjectPackage&&global.ONEProjectPackage.mount&&!global.ONEProjectPackage.__aiJsonGuideWrapped){
      var originalProjectMount=global.ONEProjectPackage.mount;
      global.ONEProjectPackage.mount=function(config){var api=originalProjectMount(config);if(config&&config.id&&GUIDES[config.id])global.setTimeout(function(){mountGuide(config.id);},0);return api;};
      global.ONEProjectPackage.__aiJsonGuideWrapped=true;
    }
  }

  function installPersistentImport(){
    if(typeof document==='undefined'||!document.addEventListener||global.__onePersistentCanonicalImport)return;
    global.__onePersistentCanonicalImport=true;
    document.addEventListener('change',function(event){
      var target=event.target;
      if(!target||target.id!=='jsonFile'||!document.body||document.body.getAttribute('data-one-card-workspace')!=='persistent')return;
      var file=target.files&&target.files[0];if(!file)return;
      event.preventDefault();event.stopImmediatePropagation();
      if(file.size>256*1024){if(global.showImportError)global.showImportError('檔案超過 256 KB');target.value='';return;}
      Promise.resolve(file.text()).then(function(raw){
        var parsed=JSON.parse(raw),nativePayload=prepareImport('persistent-card',parsed);
        if(typeof global.parseImportPayload!=='function'||typeof global.applySnapshot!=='function')throw new Error('常駐卡匯入器尚未就緒');
        var snapshot=global.parseImportPayload(nativePayload);global.applySnapshot(snapshot);
        if(typeof global.refreshHistory==='function')global.refreshHistory('JSON 載入成功；目前尚未暫存，需要保留時請按「暫存目前內容」');
      }).catch(function(error){if(global.showImportError)global.showImportError(error&&error.name==='SyntaxError'?'JSON 格式錯誤':(error&&error.message?error.message:'無法讀取檔案'));}).finally(function(){target.value='';});
    },true);
  }

  global.ONEAIJsonGuide={version:VERSION,schema:CANONICAL_SCHEMA,guides:GUIDES,mount:mountGuide,prompt:function(id){return GUIDES[id]?aiPrompt(GUIDES[id]):'';},example:function(id){return GUIDES[id]?clone(GUIDES[id].example):null;},prepareImport:prepareImport,wrapProjectPackage:wrapMounts,__test:{prepareImport:prepareImport}};
  ensureCanonicalRuntime(function(){wrapMounts();});
  wrapMounts();installPersistentImport();
})(window);
