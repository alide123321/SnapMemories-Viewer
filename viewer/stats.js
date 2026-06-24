/* stats.js — overview dashboard (computed locally from all memories). */
(function(){
  let charts=[];
  const ACC='#fffc00', ACC2='#7ec8ff', GRID='#2a2a36', TXT='#9a9aa8';

  function card(big,lbl){return `<div class="card"><div class="big">${big}</div><div class="lbl">${lbl}</div></div>`;}
  function chartBox(id,title){return `<div class="chartbox"><h3>${title}</h3><canvas id="${id}"></canvas></div>`;}

  function bar(id,labels,data,color){
    const ctx=document.getElementById(id);
    charts.push(new Chart(ctx,{type:'bar',
      data:{labels,datasets:[{data,backgroundColor:color||ACC,borderRadius:4}]},
      options:{plugins:{legend:{display:false}},
        scales:{x:{ticks:{color:TXT},grid:{display:false}},
                y:{ticks:{color:TXT},grid:{color:GRID}}}}}));
  }

  function calendar(container,year,byDay){
    const wrap=document.createElement('div'); wrap.className='cal-wrap';
    const head=document.createElement('h3'); head.textContent='Activity in ';
    const sel=document.createElement('select');
    container._years.forEach(y=>sel.add(new Option(y,y)));
    sel.value=year; head.appendChild(sel);
    wrap.appendChild(head);
    const cal=document.createElement('div'); cal.className='cal';
    const start=new Date(Date.UTC(year,0,1));
    const startDow=start.getUTCDay();
    let max=1; Object.keys(byDay).forEach(k=>{if(k.startsWith(year+'-'))max=Math.max(max,byDay[k]);});
    let col=document.createElement('div'); col.className='cal-col';
    for(let p=0;p<startDow;p++){const c=document.createElement('div');c.className='cal-cell';c.style.visibility='hidden';col.appendChild(c);}
    const d=new Date(start);
    while(d.getUTCFullYear()===+year){
      const key=d.toISOString().slice(0,10);
      const n=byDay[key]||0;
      const cell=document.createElement('div'); cell.className='cal-cell';
      if(n){const a=0.18+0.82*(n/max);cell.style.background=`rgba(255,252,0,${a.toFixed(2)})`;
        cell.title=`${key}: ${n}`;}
      col.appendChild(cell);
      if(d.getUTCDay()===6){cal.appendChild(col);col=document.createElement('div');col.className='cal-col';}
      d.setUTCDate(d.getUTCDate()+1);
    }
    cal.appendChild(col);
    wrap.appendChild(cal);
    container.appendChild(wrap);
    sel.onchange=()=>{wrap.remove();calendar(container,sel.value,byDay);};
  }

  App.register('stats',{
    render(){
      charts.forEach(c=>c.destroy()); charts=[];
      const M=App.all();
      const root=document.getElementById('view-stats');
      const photos=M.filter(m=>m.type==='I').length, videos=M.length-photos;
      const loc=M.filter(m=>m.hasLoc);
      const places=new Set(loc.map(m=>m.place).filter(Boolean));
      const countries=new Set(loc.map(m=>m.country).filter(Boolean));
      const sorted=[...M].sort((a,b)=>a.iso<b.iso?-1:1);
      const first=sorted[0].date, last=sorted[sorted.length-1].date;
      const byDay={}; M.forEach(m=>{const k=m.iso.slice(0,10);byDay[k]=(byDay[k]||0)+1;});
      let busy='',busyN=0; Object.entries(byDay).forEach(([k,n])=>{if(n>busyN){busyN=n;busy=k;}});

      const years=[...new Set(M.map(m=>m.year))].sort((a,b)=>a-b);
      const byYear=years.map(y=>M.filter(m=>m.year===y).length);
      const byMonth=Array(12).fill(0); M.forEach(m=>byMonth[m.month-1]++);
      const byWd=Array(7).fill(0); M.forEach(m=>byWd[m.weekday]++);
      const byHour=Array(24).fill(0); M.forEach(m=>byHour[m.hour]++);
      const pc={}; loc.forEach(m=>{if(m.place)pc[m.place]=(pc[m.place]||0)+1;});
      const topP=Object.keys(pc).sort((a,b)=>pc[b]-pc[a]).slice(0,12);

      root.innerHTML =
        '<div class="cards">'+
        card(M.length.toLocaleString(),'Total memories')+
        card(photos.toLocaleString(),'Photos')+
        card(videos.toLocaleString(),'Videos')+
        card(App.fmtDateShort(first).replace(/,.*/,'')+' → '+last.getUTCFullYear(),'Span ('+(last.getUTCFullYear()-first.getUTCFullYear())+'+ yrs)')+
        card(loc.length.toLocaleString(),'Geotagged')+
        card(places.size.toLocaleString(),'Places')+
        card(countries.size.toLocaleString(),'Countries')+
        card(busyN+' on '+busy,'Busiest day')+
        '</div>'+
        '<div class="charts">'+
        chartBox('c-year','Memories per year')+
        chartBox('c-month','By month of year')+
        chartBox('c-wd','By day of week')+
        chartBox('c-hour','By hour (UTC)')+
        chartBox('c-type','Photos vs videos')+
        chartBox('c-place','Top places')+
        '</div>'+
        '<div id="cal-host"></div>';

      bar('c-year',years,byYear);
      bar('c-month',App.MONTHS,byMonth,ACC2);
      bar('c-wd',App.WD,byWd,ACC2);
      bar('c-hour',[...Array(24).keys()],byHour,ACC2);
      charts.push(new Chart(document.getElementById('c-type'),{type:'doughnut',
        data:{labels:['Photos','Videos'],datasets:[{data:[photos,videos],backgroundColor:[ACC,ACC2]}]},
        options:{plugins:{legend:{labels:{color:TXT}}}}}));
      charts.push(new Chart(document.getElementById('c-place'),{type:'bar',
        data:{labels:topP,datasets:[{data:topP.map(p=>pc[p]),backgroundColor:ACC,borderRadius:4}]},
        options:{indexAxis:'y',plugins:{legend:{display:false}},
          scales:{x:{ticks:{color:TXT},grid:{color:GRID}},y:{ticks:{color:TXT},grid:{display:false}}}}}));

      const host=document.getElementById('cal-host');
      host._years=[...years].reverse();
      calendar(host,years[years.length-1],byDay);
      App.setCount(M.length);
    }
  });
})();
