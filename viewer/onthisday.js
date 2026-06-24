/* onthisday.js — memories from today's calendar date across all years. */
(function(){
  App.register('onthisday',{
    render(){
      const root=document.getElementById('view-onthisday');
      const now=new Date();
      const mo=now.getMonth()+1, da=now.getDate();
      const hits=App.all().filter(m=>m.month===mo&&m.day===da)
                          .sort((a,b)=>a.iso<b.iso?1:-1);
      root.innerHTML='';
      const head=document.createElement('div'); head.className='section-title';
      head.innerHTML=`On This Day — ${App.MONTHS[mo-1]} ${da} <span class="subtle">${hits.length} ${hits.length===1?'memory':'memories'} across the years</span>`;
      root.appendChild(head);
      App.setCount(hits.length);
      if(!hits.length){
        const e=document.createElement('div');e.className='empty';
        e.textContent='No memories were captured on this calendar day.';root.appendChild(e);return;
      }
      const byYear={}; hits.forEach(m=>(byYear[m.year]=byYear[m.year]||[]).push(m));
      Object.keys(byYear).sort((a,b)=>b-a).forEach(y=>{
        const t=document.createElement('div'); t.className='section-title';
        t.innerHTML=`${y} <span class="subtle">${byYear[y].length}</span>`;
        root.appendChild(t);
        const grid=document.createElement('div'); grid.className='grid';
        byYear[y].forEach((m,i)=>grid.appendChild(App.makeTile(m,byYear[y],i,(l,ix)=>App.Lightbox.open(l,ix))));
        root.appendChild(grid);
      });
    }
  });
})();
