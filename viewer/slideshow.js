/* slideshow.js — fullscreen auto-advancing story mode with overlay compositing. */
(function(){
  const box=document.getElementById('slideshow');
  const stage=document.getElementById('ss-stage');
  const posEl=document.getElementById('ss-pos');
  const playBtn=document.getElementById('ss-play');
  let list=[], idx=0, playing=true, timer=null, speed=3;
  const PAUSE_BTN=App.icon('pause',16)+'<span>Pause</span>';
  const PLAY_BTN=App.icon('play',16)+'<span>Play</span>';

  function clear(){if(timer){clearTimeout(timer);timer=null;}}
  function show(){
    clear(); stage.innerHTML='';
    const m=list[idx];
    let main;
    if(m.type==='V'){
      main=document.createElement('video');
      main.src=m.file; main.autoplay=true; main.muted=false; main.playsInline=true; main.controls=false;
      main.onended=()=>{if(playing)next();};
      if(!playing) main.pause();
    }else{
      main=document.createElement('img'); main.className='main'; main.src=m.file; main.alt='';
      if(playing) timer=setTimeout(next, speed*1000);
    }
    stage.appendChild(main);
    if(m.overlay){const ov=document.createElement('img');ov.className='ov';ov.src=m.overlay;stage.appendChild(ov);}
    const cap=document.createElement('div'); cap.className='ss-cap';
    cap.innerHTML=`<span>${App.fmtDate(m.date)}</span>${m.place?App.icon('pin',14)+'<span>'+m.place+'</span>':''}`;
    stage.appendChild(cap);
    posEl.textContent=`${idx+1} / ${list.length}`;
  }
  function next(){idx=(idx+1)%list.length;show();}
  function prev(){idx=(idx-1+list.length)%list.length;show();}
  function setPlaying(p){
    playing=p; playBtn.innerHTML=p?PAUSE_BTN:PLAY_BTN;
    const v=stage.querySelector('video');
    if(p){ if(v){v.play();} else { clear(); timer=setTimeout(next,speed*1000);} }
    else { clear(); if(v)v.pause(); }
  }
  function start(l){
    if(!l||!l.length){alert('Nothing to play — adjust your filters first.');return;}
    list=l; idx=0; playing=true; box.classList.remove('hidden'); playBtn.innerHTML=PAUSE_BTN; show();
  }
  function exit(){clear();const v=stage.querySelector('video');if(v)v.pause();stage.innerHTML='';box.classList.add('hidden');}

  document.getElementById('ss-next').onclick=next;
  document.getElementById('ss-prev').onclick=prev;
  document.getElementById('ss-exit').onclick=exit;
  playBtn.onclick=()=>setPlaying(!playing);
  document.getElementById('ss-speed').onchange=e=>{speed=+e.target.value;if(playing&&list[idx]&&list[idx].type==='I'){clear();timer=setTimeout(next,speed*1000);}};
  document.addEventListener('keydown',e=>{
    if(box.classList.contains('hidden'))return;
    if(e.key==='Escape')exit();
    else if(e.key==='ArrowRight')next();
    else if(e.key==='ArrowLeft')prev();
    else if(e.key===' '){e.preventDefault();setPlaying(!playing);}
  });

  App.Slideshow={start};
})();
