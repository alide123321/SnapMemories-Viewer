/* trips.js — auto-detect travel away from home location(s). */
(function(){
  const AWAY_KM=120, MERGE_DAYS=3, MIN_ITEMS=3;
  let tripMaps={};

  function hav(a,b,c,d){
    const R=6371,r=Math.PI/180;
    const dx=(c-a)*r,dy=(d-b)*r;
    const x=Math.sin(dx/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(dy/2)**2;
    return 2*R*Math.asin(Math.sqrt(x));
  }

  function homeCenters(loc){
    const cells={};
    loc.forEach(m=>{const k=Math.round(m.lat*2)/2+','+Math.round(m.lng*2)/2;
      (cells[k]=cells[k]||[]).push(m);});
    const keys=Object.keys(cells).sort((a,b)=>cells[b].length-cells[a].length);
    const centers=[]; let cov=0;
    for(const k of keys){
      const pts=cells[k];
      centers.push([avg(pts,'lat'),avg(pts,'lng')]);
      cov+=pts.length;
      if(centers.length>=3 || cov/loc.length>=0.55) break;
    }
    return centers;
  }
  function avg(a,f){return a.reduce((s,m)=>s+m[f],0)/a.length;}
  function days(a,b){return Math.abs(b-a)/864e5;}

  function detect(){
    const loc=App.all().filter(m=>m.hasLoc).sort((a,b)=>a.iso<b.iso?-1:1);
    if(!loc.length) return [];
    const homes=homeCenters(loc);
    const away=loc.filter(m=>homes.every(h=>hav(m.lat,m.lng,h[0],h[1])>AWAY_KM));
    // group consecutive away items by time gap
    let trips=[],cur=null;
    away.forEach(m=>{
      if(cur && days(cur.items[cur.items.length-1].date,m.date)<=MERGE_DAYS){
        cur.items.push(m);
      }else{
        cur={items:[m]}; trips.push(cur);
      }
    });
    trips=trips.filter(t=>t.items.length>=MIN_ITEMS);
    trips.forEach(t=>{
      const pc={}; t.items.forEach(m=>{if(m.place)pc[m.place]=(pc[m.place]||0)+1;});
      t.place=Object.keys(pc).sort((a,b)=>pc[b]-pc[a])[0]||'Unknown';
      const cset=[...new Set(t.items.map(m=>m.country).filter(Boolean))];
      t.country=cset.join(', ');
      t.start=t.items[0].date; t.end=t.items[t.items.length-1].date;
      t.center=[avg(t.items,'lat'),avg(t.items,'lng')];
    });
    return trips.reverse(); // newest first
  }

  function tripMap(div,t){
    if(tripMaps[div.id]) return;
    const mp=L.map(div.id,{preferCanvas:true,scrollWheelZoom:false});
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      {maxZoom:19,subdomains:'abcd',attribution:'© OpenStreetMap, © CARTO'}).addTo(mp);
    const pts=t.items.map(m=>[m.lat,m.lng]);
    L.polyline(pts,{color:'#fffc00',weight:2,opacity:.6}).addTo(mp);
    t.items.forEach(m=>L.circleMarker([m.lat,m.lng],{radius:4,color:'#fffc00',fillOpacity:.8})
      .addTo(mp).on('click',()=>App.Lightbox.open(t.items,t.items.indexOf(m))));
    mp.fitBounds(L.latLngBounds(pts).pad(0.2));
    tripMaps[div.id]=mp;
    setTimeout(()=>mp.invalidateSize(),60);
  }

  App.register('trips',{
    render(){
      tripMaps={};
      const root=document.getElementById('view-trips');
      const trips=detect();
      root.innerHTML='';
      const head=document.createElement('div');head.className='section-title';
      head.innerHTML=`Trips <span class="subtle">${trips.length} detected — clusters of memories more than ${AWAY_KM} km from home</span>`;
      root.appendChild(head);
      App.setCount(trips.length);
      if(!trips.length){const e=document.createElement('div');e.className='empty';e.textContent='No trips detected.';root.appendChild(e);return;}
      trips.forEach((t,i)=>{
        const card=document.createElement('div'); card.className='trip';
        const span=App.fmtDateShort(t.start)+(days(t.start,t.end)>=1?' → '+App.fmtDateShort(t.end):'');
        const nights=Math.round(days(t.start,t.end));
        card.innerHTML=`<h3>${t.place}${t.country&&t.country!==t.place?' · '+t.country:''}</h3>`+
          `<div class="meta">${span} · ${t.items.length} memories${nights?` · ~${nights} day${nights>1?'s':''}`:''}</div>`+
          `<div class="tactions"><button class="t-photos">View photos</button><button class="t-map">Show route</button></div>`+
          `<div class="trip-map" id="tmap-${i}"></div>`;
        root.appendChild(card);
        card.querySelector('.t-photos').onclick=e=>{e.stopPropagation();App.Lightbox.open(t.items,0);};
        const mapDiv=card.querySelector('.trip-map');
        card.querySelector('.t-map').onclick=e=>{
          e.stopPropagation();
          const open=mapDiv.style.display==='block';
          mapDiv.style.display=open?'none':'block';
          if(!open) tripMap(mapDiv,t);
        };
      });
    }
  });
})();
