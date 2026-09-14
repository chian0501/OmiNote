(()=>{
  'use strict';

  const D=window.ONE_CC_V1;
  if(!D)throw new Error('ONE_CC_V1 missing');

  const links=(window.ONECommandCenterDirectLinks||{})['26TW-04-1']||{};
  const project={
    id:'26TW-04-1',
    name:'3COINS 商品開箱心得',
    aliases:['3COINS 商品開箱','3COINS 開箱','商品開箱心得'],
    keywords:['3COINS','商品開箱','實買心得','台日價差','開箱'],
    links:{...links}
  };

  if(!D.projects.some(item=>item.id===project.id)){
    const after=D.projects.findIndex(item=>item.id==='26TW-03-1');
    D.projects.splice(after>=0?after+1:D.projects.length,0,project);
  }

  D.projectGroups=[
    {id:'tw',label:'🇹🇼 台灣',caption:'2026',pattern:'^26TW-'},
    {id:'jp',label:'🇯🇵 日本',caption:'2026',pattern:'^26JP-'},
    {id:'cru',label:'🚢 郵輪',caption:'2025–2026',pattern:'CRU-'}
  ];
  D.version='V1.3 CANDIDATE';
  D.designRevision='PROJECT_GROUPS_V1';
})();