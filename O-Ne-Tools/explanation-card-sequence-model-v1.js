'use strict';
// Optional candidate adapter. Original blocks and note remain the serialization source.
(function(global){
  const NOTE_ID='__one_cumulative_note__';
  const bodies=source=>(source.blocks||[]).filter(item=>item.kind==='body');
  const hasNote=source=>Boolean(source.note?.enabled&&String(source.note.text||'').trim());
  function separate(source){return hasNote(source)&&source.note.revealMode!=='with';}
  function items(source){const rows=bodies(source);return separate(source)?[...rows,{id:NOTE_ID,kind:'note',html:'',marker:{enabled:false,text:''}}]:rows;}
  function noteVisible(source){
    if(!hasNote(source))return false;
    if(!source.sequence?.enabled)return true;
    const rows=bodies(source);
    const index=rows.findIndex(item=>item.id===source.note.revealBlockId);
    const first=separate(source)?rows.length+1:(index<0?rows.length:index+1);
    return Number(source.sequence.visibleCount||1)>=Math.max(1,first);
  }
  const inheritsImage=source=>separate(source)&&source.note.usePreviousImage!==false;
  global.ONEExplanationSequenceModel={version:'CUMULATIVE_NOTE_V1_20260905',NOTE_ID,bodies,hasNote,separate,items,noteVisible,inheritsImage};
})(window);
