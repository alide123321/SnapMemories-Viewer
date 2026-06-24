/* lightbox.js — full-resolution viewer with overlay compositing + metadata. */
(function(){
  const box=document.getElementById('lightbox');
  const stage=document.getElementById('lb-stage');
  const meta=document.getElementById('lb-meta');
  const delBtn=document.getElementById('lb-delete');
  let list=[], idx=0, pendingDel=false, delTimer=null;

  function resetDel(){
    pendingDel=false; if(delTimer){clearTimeout(delTimer);delTimer=null;}
    delBtn.textContent='🗑 Delete'; delBtn.classList.remove('confirm');
  }

  function render(){
    resetDel();
    const m=list[idx];
    stage.innerHTML='';
    let mainEl;
    if(m.type==='V'){
      mainEl=document.createElement('video');
      mainEl.src=m.file; mainEl.controls=true; mainEl.autoplay=true; mainEl.playsInline=true; mainEl.loop=false;
    }else{
      mainEl=document.createElement('img'); mainEl.className='main'; mainEl.src=m.file; mainEl.alt='';
    }
    if(m.type!=='V') mainEl.className='main';
    stage.appendChild(mainEl);
    if(m.overlay){
      const ov=document.createElement('img'); ov.className='ov'; ov.src=m.overlay; ov.alt='';
      stage.appendChild(ov);
    }
    const bits=[`<span><span class="k">Date</span>${App.fmtDate(m.date)}</span>`,
                `<span><span class="k">Type</span>${m.type==='V'?'Video'+(m.dur!=null?' · '+App.fmtDur(m.dur):''):'Photo'}</span>`];
    if(m.place) bits.push(`<span><span class="k">Place</span>${m.place}${m.country&&m.country!==m.place?' · '+m.country:''}</span>`);
    if(m.hasLoc){
      bits.push(`<span><span class="k">Coords</span>${m.lat.toFixed(5)}, ${m.lng.toFixed(5)}</span>`);
      bits.push(`<button id="lb-map">Show on map</button>`);
    }
    bits.push(`<span class="subtle" style="margin-left:auto">${idx+1} / ${list.length}</span>`);
    meta.innerHTML=bits.join('');
    if(m.hasLoc) document.getElementById('lb-map').onclick=()=>{close();App.switchView('map');App.Map.focus(m.lat,m.lng);};
  }

  function open(l,i){list=l;idx=i;box.classList.remove('hidden');render();}
  function close(){resetDel();box.classList.add('hidden');stage.innerHTML='';}
  function step(d){idx=(idx+d+list.length)%list.length;render();}

  function doDelete(){
    const m=list[idx];
    if(!pendingDel){
      pendingDel=true;
      delBtn.textContent='Confirm delete?'; delBtn.classList.add('confirm');
      delTimer=setTimeout(resetDel,4000);
      return;
    }
    resetDel();
    App.deleteMemory(m.id);
    list.splice(idx,1);                 // drop from the current lightbox list
    if(!list.length){ close(); return; }
    if(idx>=list.length) idx=list.length-1;
    render();
  }
  delBtn.onclick=doDelete;

  document.getElementById('lb-close').onclick=close;
  document.getElementById('lb-prev').onclick=()=>step(-1);
  document.getElementById('lb-next').onclick=()=>step(1);
  box.addEventListener('click',e=>{if(e.target===box)close();});
  document.addEventListener('keydown',e=>{
    if(box.classList.contains('hidden'))return;
    if(e.key==='Escape'){ if(pendingDel) resetDel(); else close(); }
    else if(e.key==='ArrowLeft')step(-1);
    else if(e.key==='ArrowRight')step(1);
    else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();doDelete();}
  });

  App.Lightbox={open,close};
})();
