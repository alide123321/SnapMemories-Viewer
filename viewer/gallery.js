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
      const ph=document.createElement('div'); ph.className='ph';
      ph.innerHTML=App.icon(m.type==='V'?'video':'image',34);
      t.appendChild(ph);
    }
    if(m.type==='V'){
      const b=document.createElement('div'); b.className='badge';
      b.innerHTML=App.icon('play',12)+(m.dur!=null?'<span>'+App.fmtDur(m.dur)+'</span>':'');
      t.appendChild(b);
    }
    if(m.overlay){const c=document.createElement('div');c.className='cap';c.innerHTML=App.icon('message',14);t.appendChild(c);}
    const dt=document.createElement('div'); dt.className='dt';
    dt.innerHTML = '<div>'+App.fmtDateShort(m.date)+'</div>' +
      (m.place?'<span class="place">'+App.icon('pin',11)+'<span>'+m.place+'</span></span>':'');
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
