/* core.js — data model, filters, routing. All data is local; nothing is uploaded. */
window.App = (function () {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const WD = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  let M = [];                 // normalized memories
  const views = {};           // name -> {render, onShow, onHide}
  let current = 'gallery';

  /* ---- soft-delete queue (persisted locally; applied to disk by apply_deletions.py) ---- */
  const DEL_KEY = 'snapmem.deleted';
  let deleted = new Set();
  try { deleted = new Set(JSON.parse(localStorage.getItem(DEL_KEY) || '[]')); } catch (e) {}
  function saveDeleted(){ try { localStorage.setItem(DEL_KEY, JSON.stringify([...deleted])); } catch(e){} }
  function updateDeletedBadge(){
    const b=document.getElementById('nav-deleted'); if(!b) return;
    const n=deleted.size; b.textContent = n ? `Deleted (${n})` : 'Deleted';
  }
  function deleteMemory(id){ deleted.add(id); saveDeleted(); updateDeletedBadge(); refresh(); }
  function restoreMemory(id){ deleted.delete(id); saveDeleted(); updateDeletedBadge(); refresh(); }
  function deletedItems(){ return M.filter(m=>deleted.has(m.id)); }
  function deletedIds(){ return [...deleted]; }
  function deletedCount(){ return deleted.size; }

  const state = {
    type:'', year:'', place:'', from:'', to:'',
    overlay:false, located:false, sort:'desc'
  };

  function normalize(raw) {
    return (raw || []).map(r => {
      const t = r.t, d = new Date(r.d);
      return {
        id:r.i, type:t, iso:r.d, date:d,
        year:d.getUTCFullYear(), month:d.getUTCMonth()+1, day:d.getUTCDate(),
        weekday:d.getUTCDay(), hour:d.getUTCHours(),
        file:'../memories/'+r.i+'-main.'+(t==='V'?'mp4':'jpg'),
        overlay:r.o ? '../memories/'+r.i+'-overlay.png' : null,
        thumb:r.th ? '../thumbs/'+r.i+'.jpg' : null,
        hasLoc:(r.la!==undefined), lat:r.la, lng:r.lo,
        place:r.p||'', country:r.c||'', dur:r.dv
      };
    });
  }

  /* ---- inline SVG icons (Lucide-style, inherit currentColor) ---- */
  const ICONS = {
    ghost:'<path d="M12 2a8 8 0 0 0-8 8v11l3-2 2.5 2 2.5-2 2.5 2 2.5-2 3 2V10a8 8 0 0 0-8-8Z"/><circle cx="9" cy="10.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="10.5" r="1.1" fill="currentColor" stroke="none"/>',
    video:'<rect x="2" y="6" width="13" height="12" rx="2"/><path d="m15 10 6-3v10l-6-3"/>',
    image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
    message:'<path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z"/>',
    pin:'<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    trash:'<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    restore:'<path d="M3 12a9 9 0 1 0 9-9 9.7 9.7 0 0 0-6.7 2.7L3 8"/><path d="M3 3v5h5"/>',
    download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    pause:'<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
    'chevron-left':'<path d="m15 18-6-6 6-6"/>',
    'chevron-right':'<path d="m9 18 6-6-6-6"/>',
    x:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    map:'<path d="m9 4 6 2 5-2v15l-5 2-6-2-5 2V6z"/><path d="M9 4v15"/><path d="M15 6v15"/>',
    check:'<path d="M20 6 9 17l-5-5"/>'
  };
  const ICONS_FILLED = { play:'<path d="M7 4v16l13-8z"/>' };
  function icon(name,size){
    const s=size||18;
    if(ICONS_FILLED[name])
      return `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICONS_FILLED[name]}</svg>`;
    return `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]||''}</svg>`;
  }

  /* ---- formatting helpers ---- */
  function fmtDate(d){
    let h=d.getUTCHours(), ap=h>=12?'PM':'AM'; h=h%12||12;
    const m=String(d.getUTCMinutes()).padStart(2,'0');
    return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()} · ${h}:${m} ${ap}`;
  }
  function fmtDateShort(d){return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;}
  function fmtDur(s){if(s==null)return'';const m=Math.floor(s/60),x=Math.round(s%60);return m+':'+String(x).padStart(2,'0');}

  /* ---- filtering ---- */
  function getFiltered(){
    let out = M.filter(m=>{
      if(deleted.has(m.id)) return false;
      if(state.type && m.type!==state.type) return false;
      if(state.year && m.year!==+state.year) return false;
      if(state.place && m.place!==state.place) return false;
      if(state.overlay && !m.overlay) return false;
      if(state.located && !m.hasLoc) return false;
      if(state.from && m.iso.slice(0,10) < state.from) return false;
      if(state.to && m.iso.slice(0,10) > state.to) return false;
      return true;
    });
    out.sort((a,b)=> state.sort==='asc' ? (a.iso<b.iso?-1:1) : (a.iso>b.iso?-1:1));
    return out;
  }

  /* ---- dropdown population ---- */
  function populateFilters(){
    const years=[...new Set(M.map(m=>m.year))].sort((a,b)=>b-a);
    const ysel=document.getElementById('f-year');
    years.forEach(y=>ysel.add(new Option(y,y)));

    const pc={};
    M.forEach(m=>{if(m.place)pc[m.place]=(pc[m.place]||0)+1;});
    const places=Object.keys(pc).sort((a,b)=>pc[b]-pc[a]).slice(0,80);
    const psel=document.getElementById('f-place');
    places.forEach(p=>psel.add(new Option(`${p} (${pc[p]})`,p)));
  }

  function bindFilters(){
    const map={'f-type':'type','f-year':'year','f-place':'place','f-from':'from','f-to':'to','f-sort':'sort'};
    Object.entries(map).forEach(([id,key])=>{
      document.getElementById(id).addEventListener('change',e=>{state[key]=e.target.value;refresh();});
    });
    document.getElementById('f-overlay').addEventListener('change',e=>{state.overlay=e.target.checked;refresh();});
    document.getElementById('f-located').addEventListener('change',e=>{state.located=e.target.checked;refresh();});
    document.getElementById('f-clear').addEventListener('click',()=>{
      Object.assign(state,{type:'',year:'',place:'',from:'',to:'',overlay:false,located:false,sort:'desc'});
      ['f-type','f-year','f-place','f-from','f-to','f-sort'].forEach(id=>document.getElementById(id).value=(id==='f-sort'?'desc':''));
      document.getElementById('f-overlay').checked=false;
      document.getElementById('f-located').checked=false;
      refresh();
    });
  }

  function setCount(n){
    document.getElementById('resultCount').textContent = n.toLocaleString()+' memories';
  }

  function refresh(){
    const v=views[current];
    if(v && v.render) v.render();
  }

  /* ---- routing ---- */
  const FILTERED_VIEWS=new Set(['gallery','map']); // filter bar applies here
  function switchView(name){
    if(name==='slideshow'){ App.Slideshow.start(getFiltered()); return; }
    if(!views[name]) return;
    if(location.hash!=='#'+name) history.replaceState(null,'','#'+name);
    if(views[current] && views[current].onHide) views[current].onHide();
    document.querySelectorAll('#view-'+current).forEach(el=>el.classList.remove('active'));
    document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));
    const el=document.getElementById('view-'+name);
    if(el) el.classList.add('active');
    current=name;
    document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
    document.getElementById('filterbar').style.display = FILTERED_VIEWS.has(name)?'flex':'none';
    if(views[name].render) views[name].render();
    if(views[name].onShow) views[name].onShow();
  }

  function register(name,obj){views[name]=obj;}

  function init(){
    M = normalize(window.MEMORIES);
    M.sort((a,b)=> a.iso>b.iso?-1:1);
    // prune queue to IDs that still exist (so applied/moved items auto-clear)
    const ids=new Set(M.map(m=>m.id));
    let changed=false;
    deleted.forEach(id=>{ if(!ids.has(id)){ deleted.delete(id); changed=true; } });
    if(changed) saveDeleted();
    updateDeletedBadge();
    populateFilters();
    bindFilters();
    document.querySelectorAll('#nav button').forEach(b=>{
      b.addEventListener('click',()=>switchView(b.dataset.view));
    });
    const start=(location.hash||'').slice(1);
    switchView(views[start]?start:'gallery');
  }

  return {init,register,getFiltered,switchView,setCount,refresh,icon,
          fmtDate,fmtDateShort,fmtDur,MONTHS,WD,
          deleteMemory,restoreMemory,deletedItems,deletedIds,deletedCount,
          state, all:()=>M.filter(m=>!deleted.has(m.id)), current:()=>current};
})();
