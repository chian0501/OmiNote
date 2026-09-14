(()=>{
  'use strict';

  const D=window.ONE_CC_V1;
  const list=document.querySelector('#projectList');
  if(!D||!list)return;

  const STORE='one.cc.v13.openProjectGroups';
  let arranging=false;

  function readOpen(){
    try{return new Set(JSON.parse(localStorage.getItem(STORE)||'[]'))}
    catch{return new Set()}
  }
  function writeOpen(set){localStorage.setItem(STORE,JSON.stringify([...set]))}

  function groupFor(id){
    for(const group of D.projectGroups||[]){
      if(new RegExp(group.pattern).test(id))return group;
    }
    return {id:'other',label:'其他',caption:'',pattern:'.*'};
  }

  function remember(details){
    const open=readOpen();
    if(details.open)open.add(details.dataset.projectGroup);
    else open.delete(details.dataset.projectGroup);
    writeOpen(open);
  }

  function regroup(){
    if(arranging)return;
    const flat=Array.from(list.children).filter(node=>node.matches?.('.project-item[data-project]'));
    if(!flat.length)return;

    arranging=true;
    const query=(document.querySelector('#findSearch')?.value||'').trim();
    const saved=readOpen();
    const groups=[];
    const map=new Map();

    flat.forEach(button=>{
      const group=groupFor(button.dataset.project||'');
      if(!map.has(group.id)){
        const row={group,buttons:[]};
        map.set(group.id,row);
        groups.push(row);
      }
      map.get(group.id).buttons.push(button);
    });

    list.innerHTML='';
    groups.forEach(({group,buttons})=>{
      const details=document.createElement('details');
      details.className='project-group';
      details.dataset.projectGroup=group.id;
      const hasActive=buttons.some(button=>button.classList.contains('active'));
      details.open=Boolean(query)||hasActive||saved.has(group.id);

      const summary=document.createElement('summary');
      summary.innerHTML=`<span class="project-group-main"><b>${group.label}</b><small>${group.caption||''}</small></span><span class="project-group-count">${buttons.length} 個</span>`;

      const body=document.createElement('div');
      body.className='project-group-list';
      buttons.forEach(button=>body.appendChild(button));

      details.append(summary,body);
      details.addEventListener('toggle',()=>remember(details));
      list.appendChild(details);
    });
    arranging=false;
  }

  const observer=new MutationObserver(()=>regroup());
  observer.observe(list,{childList:true});
  regroup();
})();