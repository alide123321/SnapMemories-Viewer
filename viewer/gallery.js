/* gallery.js — virtualized (chunked) thumbnail grid + shared grid renderer. */
(function(){
  const CHUNK=120;

  function makeTile(m, list, idx, onClick){
    const t=document.createElement('div');
    t.className='tile';
    if(m.thumb){
      const img=document.createElement('img');
      img.loading='lazy'; img.decoding='async'; img.src=m.thumb; img.alt='';
      t.appendChild(img);
    } else {
      t.style.display='flex'; t.style.alignItems='center'; t.style.justifyContent='center';
      t.style.fontSize='30px'; t.textContent = m.type==='V'?'🎬':'🖼️';
    }
    if(m.type==='V'){
      const b=document.createElement('div'); b.className='badge';
      b.innerHTML='▶'+(m.dur!=null?' <span>'+App.fmtDur(m.dur)+'</span>':'');
      t.appendChild(b);
    }
    if(m.overlay){const c=document.createElement('div');c.className='cap';c.textContent='💬';t.appendChild(c);}
    const dt=document.createElement('div'); dt.className='dt';
    dt.innerHTML = App.fmtDateShort(m.date) + (m.place?'<span class="place">📍 '+m.place+'</span>':'');
    t.appendChild(dt);
    t.addEventListener('click',()=>onClick(list,idx));
    return t;
  }

  /* renders `list` into `container` with chunked infinite scroll */
  function renderGrid(container, list, onClick){
    container.innerHTML='';
    if(!list.length){
      const e=document.createElement('div'); e.className='empty';
      e.textContent='No memories match these filters.';
      container.appendChild(e); return;
    }
    const grid=document.createElement('div'); grid.className='grid';
    container.appendChild(grid);
    let shown=0;
    const sentinel=document.createElement('div'); sentinel.className='loadmore';
    container.appendChild(sentinel);

    function loadMore(){
      const end=Math.min(shown+CHUNK,list.length);
      const frag=document.createDocumentFragment();
      for(let i=shown;i<end;i++) frag.appendChild(makeTile(list[i],list,i,onClick));
      grid.appendChild(frag);
      shown=end;
      sentinel.textContent = shown<list.length ? `Loading… (${shown.toLocaleString()} / ${list.length.toLocaleString()})` : `${list.length.toLocaleString()} shown`;
      if(shown>=list.length) io.disconnect();
    }
    const io=new IntersectionObserver(es=>{if(es[0].isIntersecting)loadMore();},{rootMargin:'600px'});
    loadMore();
    io.observe(sentinel);
  }

  App.makeTile=makeTile;
  App.renderGrid=renderGrid;

  App.register('gallery',{
    render(){
      const list=App.getFiltered();
      App.setCount(list.length);
      renderGrid(document.getElementById('view-gallery'),list,(l,i)=>App.Lightbox.open(l,i));
    }
  });
})();
