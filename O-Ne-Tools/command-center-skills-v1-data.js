(()=>{
  'use strict';

  const CATEGORIES=[
    {id:'planning',label:'企劃／剪輯',desc:'把題目、故事、剪輯與反方檢查先搞清楚。'},
    {id:'visual',label:'視覺／包裝',desc:'處理縮圖、人物一致性與 O-Ne UI。'},
    {id:'publish',label:'發布／多語',desc:'處理上架文案、字幕與跨平台版本。'},
    {id:'qc',label:'成片／驗收',desc:'上傳前把影片技術與字幕問題抓乾淨。'}
  ];

  const USER_SKILLS=[
    {
      id:'one-roughcut-reference-workflow',
      title:'O-Ne 長片與 Shorts 腳本初剪',
      category:'planning',
      audience:'涅特常用',
      desc:'研究參考片、整理素材，做到 Script、Paper Edit、Cutlist 或可靠的 Review 層。',
      when:'有參考片、毛片、素材或想先把剪輯邏輯整理清楚時。',
      say:'用這批素材先做 Paper Edit／Cutlist，能做到哪一層就做到哪一層。',
      route:'one-roughcut-reference-workflow',
      keywords:['腳本','初剪','Paper Edit','Cutlist','Review','參考片','剪輯']
    },
    {
      id:'second-opinion',
      title:'O-Ne 反方總編',
      category:'planning',
      audience:'Omi＋涅特',
      desc:'專門挑企劃、剪輯、動畫、CTA 與人物互動的盲點，不負責把原稿整份重做。',
      when:'你覺得「這版真的對嗎？」、想找盲點或需要第二意見時。',
      say:'反方總編看這版，先抓最重要的三個問題。',
      route:'目前沒有專屬技能，直接請 AI 做反方檢查',
      keywords:['反方總編','盲點','第二意見','CTA','動畫','企劃','剪輯']
    },
    {
      id:'one-thumbnail-design',
      title:'O-Ne 標題 × 縮圖 × 前30秒',
      category:'visual',
      audience:'Omi 常用',
      desc:'把標題、縮圖、前 3 秒與前 30 秒綁成同一個觀眾承諾，避免各講各的。',
      when:'影片包裝要重做、CTR 不理想，或開頭和縮圖承諾對不起來時。',
      say:'重新做這支片的標題、縮圖、前3秒和前30秒聯動。',
      route:'one-thumbnail-design、one-opening-hook、one-publishing-copy',
      keywords:['標題','縮圖','前30秒','前3秒','包裝','CTR','鉤子']
    },
    {
      id:'one-character-look-lock',
      title:'O-Ne 角色一致性鎖定',
      category:'visual',
      audience:'Omi 常用',
      desc:'鎖住 Omi／涅特真人或 Q 版的臉、髮型、服裝、配件與同支影片造型，避免人物越生越像遠房親戚。',
      when:'縮圖、生圖、Q 版、動畫前置圖或角色長相開始飄掉時。',
      say:'這次先鎖住我跟涅特的臉、服裝和配件，再做後續圖片。',
      route:'one-character-look-lock、one-identity-protection',
      keywords:['角色','鎖臉','人物一致','Q版','服裝','動畫','縮圖']
    },
    {
      id:'one-video-cards-ui',
      title:'O-Ne 字卡與 UI',
      category:'visual',
      audience:'Omi 常用',
      desc:'字卡與固定 UI 一律用 O-Ne Tools 製作，先選對卡種，不重畫共用元件。',
      when:'要做字卡、說明卡、icon、HUD、路線卡或不知道該用哪一種正式 UI 時。',
      say:'幫我用 O-Ne Tools 做這張字卡，先確認該用哪張卡，不要自己重設計。',
      route:'one-video-cards-ui',
      keywords:['UI','字卡','說明卡','icon','HUD','路線','母版']
    },
    {
      id:'one-publishing-copy',
      title:'O-Ne 發布文案',
      category:'publish',
      audience:'Omi 常用',
      desc:'處理長片／Shorts 的標題、說明欄、章節、SEO、Hashtags、置頂留言與上架設定。',
      when:'影片準備上架、需要完整文案包，或要整理九區 Shorts 文案時。',
      say:'幫這支長片／Shorts 做完整上架文案，先做繁中版本。',
      route:'one-publishing-copy',
      keywords:['發布','上架','文案','SEO','說明欄','章節','置頂留言','九區']
    },
    {
      id:'one-transcript-subtitle-qc',
      title:'O-Ne 多語字幕與 CC',
      category:'publish',
      audience:'Omi＋涅特',
      desc:'以最新版繁中為主版，做已啟用語言的自然在地化字幕與 CC，並處理 SRT 技術檢查。',
      when:'繁中字幕定稿後，要做香港繁中、簡中、英文、日文或條件式韓文版本時。',
      say:'這版繁中 SRT 更新了，把已啟用語言的字幕同步並做 QC。',
      route:'one-transcript-subtitle-qc、one-platform-content-strategy',
      keywords:['字幕','CC','多語','SRT','英文','日文','簡中','香港繁中','韓文']
    },
    {
      id:'one-platform-layout-adaptation',
      title:'O-Ne Shorts 跨平台適配',
      category:'publish',
      audience:'Omi＋涅特',
      desc:'把既有 Shorts 轉成 IG、Facebook、TikTok、Threads 等平台需要的版本，處理 CTA、裁切、安全區與必要封面。',
      when:'YouTube Shorts 已完成，要做其他社群平台版本時。',
      say:'把這批 Shorts 做成 IG／FB／TikTok 版，先照平台最新規格適配。',
      route:'one-platform-layout-adaptation、one-platform-content-strategy',
      keywords:['Shorts','跨平台','IG','Reels','Facebook','TikTok','Threads','社群版']
    },
    {
      id:'one-shorts-final-av-qa',
      title:'O-Ne 成片技術與字幕 QC',
      category:'qc',
      audience:'涅特常用',
      desc:'完整檢查準備上傳的最終影片，抓黑格、夾幀、短鏡頭、卡頓、音訊與中文字幕錯字／分行問題。',
      when:'影片真的要上傳之前，做最後一輪技術驗片時。',
      say:'檢查這支準備上傳的最終成片，抓黑格、夾幀、跳幀與中文字幕問題。',
      route:'one-shorts-final-av-qa',
      keywords:['成片','QC','黑格','夾幀','跳幀','字幕','音訊','上傳前']
    }
  ];

  window.ONE_CC_SKILLS_V1={
    version:'V1.2',
    categories:CATEGORIES,
    userSkills:USER_SKILLS
  };
})();