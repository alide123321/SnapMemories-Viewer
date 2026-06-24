/* deleted.js — "Deleted Memories" queue. Items here are hidden from every other
   view and queued for the on-disk move performed by apply_deletions.py.
   Nothing is touched on disk until you Export the list and run Apply Deletions. */
(function(){

  function exportList(){
    const ids=App.deletedIds();
    if(!ids.length){ alert('Nothing to export — the deletion queue is empty.'); return; }
    const blob=new Blob([JSON.stringify(ids,null,0)],{type:'application/json'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='snapmemories-deletions.json';
    document.body.appendChild(a); a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},0);
  }

  function tile(m){
    const t=document.createElement('div'); t.className='tile';
    if(m.thumb){
      const img=document.createElement('img');
      img.loading='lazy'; img.decoding='async'; img.src=m.thumb; img.alt='';
      t.appendChild(img);
    } else {
      const ph=document.createElement('div'); ph.className='ph';
      ph.innerHTML=App.icon(m.type==='V'?'video':'image',34);
      t.appendChild(ph);
    }
    const dt=document.createElement('div'); dt.className='dt';
    dt.innerHTML = '<div>'+App.fmtDateShort(m.date)+'</div>' +
      (m.place?'<span class="place">'+App.icon('pin',11)+'<span>'+m.place+'</span></span>':'');
    t.appendChild(dt);
    const rb=document.createElement('button'); rb.className='restore-btn';
    rb.innerHTML=App.icon('restore',13)+'<span>Restore</span>';
    rb.onclick=e=>{ e.stopPropagation(); App.restoreMemory(m.id); };
    t.appendChild(rb);
    return t;
  }

  App.register('deleted',{
    render(){
      const root=document.getElementById('view-deleted');
      const items=App.deletedItems();
      App.setCount(items.length);
      root.innerHTML='';

      const head=document.createElement('div'); head.className='section-title';
      head.innerHTML=`Deleted Memories <span class="subtle">${items.length} queued — hidden everywhere, not yet moved on disk</span>`;
      root.appendChild(head);

      const help=document.createElement('div'); help.className='del-help';
      help.innerHTML =
        'These are hidden from every view but still on disk. To physically move them into a '+
        '<b>Deleted Memories</b> folder: click <b>Export deletion list</b>, then double-click '+
        '<b>Apply Deletions.cmd</b> in your SnapMemories folder. You can <b>Restore</b> any item here '+
        'before you do that.';
      root.appendChild(help);

      const bar=document.createElement('div'); bar.className='del-actions';
      const exp=document.createElement('button'); exp.className='btn btn-primary';
      exp.innerHTML=App.icon('download',16)+'<span>Export deletion list</span>'; exp.onclick=exportList;
      exp.disabled=!items.length;
      bar.appendChild(exp);
      root.appendChild(bar);

      if(!items.length){
        const e=document.createElement('div'); e.className='empty';
        e.textContent='No memories queued for deletion.';
        root.appendChild(e); return;
      }
      const grid=document.createElement('div'); grid.className='grid';
      items.forEach(m=>grid.appendChild(tile(m)));
      root.appendChild(grid);
    }
  });
})();
