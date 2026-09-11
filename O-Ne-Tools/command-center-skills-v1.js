(()=>{
  'use strict';
  const D=window.ONE_CC_SKILLS_V1;
  if(!D)return;

  const $=s=>document.querySelector(s);
  const $$=s=>Array.from(document.querySelectorAll(s));
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=s=>String(s||'').trim().toLowerCase();
  let active='all';

  function matches(skill,q){
    if(!q)return true;
    return norm([skill.title,skill.desc,skill.when,skill.say,skill.audience,...(skill.keywords||[])].join(' ')).includes(q);
  }

  function card(skill){
    return `<article class="skill-card">
      <div class="skill-card-top">
        <span class="skill-status">已安裝</span>
        <span class="skill-audience">${esc(skill.audience)}</span>
      </div>
      <h4>${esc(skill.title)}</h4>
      <p class="skill-desc">${esc(skill.desc)}</p>
      <div class="skill-when"><b>適合：</b>${esc(skill.when)}</div>
      <div class="skill-say"><b>直接說：</b><span>${esc(skill.say)}</span></div>
      <div class="skill-actions">
        <button class="button secondary" data-copy-skill="${esc(skill.id)}">複製用法</button>
        <details class="skill-route"><summary>看內部承接</summary><small>${esc(skill.route)}</small></details>
      </div>
    </article>`;
  }

  function render(){
    const q=norm($('#skillSearch')?.value);
    const shown=D.userSkills.filter(s=>(active==='all'||s.category===active)&&matches(s,q));
    $('#skillInstalledCount').textContent=`${D.installedCount} / ${D.installedCount} 已安裝`;

    const groups=D.categories.map(cat=>{
      const list=shown.filter(s=>s.category===cat.id);
      if(!list.length)return '';
      return `<section class="skill-group">
        <div class="skill-group-head"><div><h3>${esc(cat.label)}</h3><p>${esc(cat.desc)}</p></div><span>${list.length} 個</span></div>
        <div class="skill-grid">${list.map(card).join('')}</div>
      </section>`;
    }).join('');

    $('#skillGroups').innerHTML=groups||'<div class="empty">找不到符合的 Skill。</div>';

    $('#skillGroups').querySelectorAll('[data-copy-skill]').forEach(btn=>{
      btn.addEventListener('click',async()=>{
        const s=D.userSkills.find(x=>x.id===btn.dataset.copySkill);
        if(!s)return;
        try{
          await navigator.clipboard.writeText(s.say);
          btn.textContent='已複製 ✓';
          setTimeout(()=>btn.textContent='複製用法',1200);
        }catch{
          btn.textContent='請手動複製';
          setTimeout(()=>btn.textContent='複製用法',1200);
        }
      });
    });
  }

  function renderOther(){
    $('#skillOther').innerHTML=D.otherSkills.map(s=>`<div class="other-skill-row">
      <div><b>${esc(s.title)}</b><p>${esc(s.desc)}</p></div><span>${esc(s.status)}</span>
    </div>`).join('');

    const total=D.internalRoles.reduce((n,r)=>n+r.count,0);
    $('#internalRoleSummary').innerHTML=`<p class="internal-intro">這 ${total} 個是系統後台用來分工的技能，不需要 Omi 或涅特自己挑。</p>
      <div class="role-summary">${D.internalRoles.map(r=>`<div><b>${esc(r.id)}</b><span>${esc(r.label)}</span><strong>${r.count}</strong></div>`).join('')}</div>`;
  }

  function init(){
    if(!$('#screen-skills'))return;
    $('#skillSearch').addEventListener('input',render);
    $$('[data-skill-filter]').forEach(btn=>btn.addEventListener('click',()=>{
      active=btn.dataset.skillFilter;
      $$('[data-skill-filter]').forEach(x=>x.classList.toggle('active',x===btn));
      render();
    }));
    render();
    renderOther();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();