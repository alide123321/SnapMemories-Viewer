/* map.js — world map of located memories. Tiles (Carto/OSM) are the only network call. */
(function(){
  let map=null, clusters=null, heat=null, mode='cluster', located=[], firstFit=true;

  function ensureMap(){
    if(map) return;
    map=L.map('map',{preferCanvas:true}).setView([30,10],2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{
      maxZoom:19, subdomains:'abcd',
      attribution:'© OpenStreetMap, © CARTO'
    }).addTo(map);
    clusters=L.markerClusterGroup({chunkedLoading:true, spiderfyOnMaxZoom:true, maxClusterRadius:50});
    map.addLayer(clusters);
  }

  function popupContent(m){
    const wrap=document.createElement('div'); wrap.className='mappop';
    if(m.thumb){
      const img=document.createElement('img'); img.src=m.thumb; img.alt='';
      img.onclick=()=>App.Lightbox.open(located, m._idx);
      wrap.appendChild(img);
    }
    const d=document.createElement('div'); d.className='mp-dt';
    d.textContent=App.fmtDateShort(m.date)+(m.place?' · '+m.place:'');
    wrap.appendChild(d);
    return wrap;
  }

  function build(){
    ensureMap();
    located=App.getFiltered().filter(m=>m.hasLoc);
    located.forEach((m,i)=>m._idx=i);
    App.setCount(located.length);

    clusters.clearLayers();
    if(heat){map.removeLayer(heat);heat=null;}

    if(mode==='cluster'){
      const markers=located.map(m=>{
        const mk=L.marker([m.lat,m.lng]);
        mk.bindPopup(()=>popupContent(m),{minWidth:140});
        return mk;
      });
      clusters.addLayers(markers);
    } else {
      heat=L.heatLayer(located.map(m=>[m.lat,m.lng,0.6]),{radius:18,blur:22,maxZoom:12});
      map.addLayer(heat);
    }
    if(firstFit && located.length){
      const b=L.latLngBounds(located.map(m=>[m.lat,m.lng]));
      map.fitBounds(b.pad(0.1));
      firstFit=false;
    }
  }

  document.getElementById('map-mode-cluster').onclick=()=>{mode='cluster';setBtns();build();};
  document.getElementById('map-mode-heat').onclick=()=>{mode='heat';setBtns();build();};
  function setBtns(){
    document.getElementById('map-mode-cluster').classList.toggle('active',mode==='cluster');
    document.getElementById('map-mode-heat').classList.toggle('active',mode==='heat');
  }

  App.register('map',{
    render(){build();},
    onShow(){ensureMap();setTimeout(()=>map.invalidateSize(),60);}
  });

  App.Map={
    focus(lat,lng){
      ensureMap();
      if(App.current()!=='map') App.switchView('map');
      mode='cluster';setBtns();
      setTimeout(()=>{map.invalidateSize();map.setView([lat,lng],15);},80);
    }
  };
})();
