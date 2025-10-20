// app.js — Remote Assist SUITE full (Laser + Tour Fix)
(() => {
  const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
  const live=$('.live-indicator');
  const docFrame=$('#docFrame'), overlay=$('#cursorOverlay'), lCursor=$('#localCursor'), rCursor=$('#remoteCursor');
  let laser=false, dc=null;

  // Laser pointer
  $('#btnLaser')?.addEventListener('click', ()=>{
    laser=!laser;
    $('#btnLaser').textContent=laser?'Laser OFF':'Laser ON';
    overlay.style.pointerEvents=laser?'auto':'none';
    lCursor.classList.toggle('hidden', !laser);
  });
  overlay?.addEventListener('pointermove', e=>{
    if(!laser) return;
    const rect=$('.docWrap').getBoundingClientRect();
    const nx=(e.clientX-rect.left)/rect.width, ny=(e.clientY-rect.top)/rect.height;
    posCursor(lCursor,nx,ny); sendData({t:'cursor',nx,ny});
  });
  function posCursor(el,nx,ny){const rect=$('.docWrap').getBoundingClientRect(); el.style.left=(nx*rect.width)+'px'; el.style.top=(ny*rect.height)+'px';}
  function sendData(o){try{dc?.readyState==='open'&&dc.send(JSON.stringify(o));}catch{}}

  // Hook ricezione cursore remoto
  window.__setupDC__=function(ch){
    dc=ch;
    ch.addEventListener('message',ev=>{
      try{
        const m=JSON.parse(ev.data);
        if(m.t==='cursor'){rCursor.classList.remove('hidden');posCursor(rCursor,m.nx,m.ny);}
      }catch{}
    });
  };

  // --- TOUR (Guida Interattiva) ---
  const tourEl=$('#tour'); if(tourEl){
    const highlight=document.createElement('div');highlight.className='tour-highlight';tourEl.appendChild(highlight);
    const stepEl=tourEl.querySelector('.tour-step');
    const steps=[
      {sel:'.modes',text:'Scegli la modalità: Standard, Smart Glasses o Mobile Cam.'},
      {sel:'.tab[data-tab="signal"]',text:'Apri la tab Segnaling per collegarti.'},
      {sel:'#btnMakeOffer',text:'Tecnico: genera Offerta e copia il JSON.'},
      {sel:'#sdpBox',text:'Incolla Offerta/Risposta qui.'},
      {sel:'#btnLaser',text:'Attiva il Laser per guidare il lavoro.'}
    ];
    let idx=0;
    function placeHighlight(target){
      const r=target.getBoundingClientRect();
      highlight.style.position='fixed';highlight.style.left=(r.left-6)+'px';highlight.style.top=(r.top-6)+'px';
      highlight.style.width=(r.width+12)+'px';highlight.style.height=(r.height+12)+'px';
      const pop=tourEl.querySelector('.tour-pop');
      pop.style.left=Math.min(window.innerWidth-360,r.right+16)+'px';
      pop.style.top=Math.min(window.innerHeight-160,r.top)+'px';
    }
    function showStep(i){idx=i;const s=steps[idx];const target=document.querySelector(s.sel);stepEl.textContent=`Passo ${i+1}/${steps.length}: `+s.text;if(target)placeHighlight(target);tourEl.classList.remove('hidden');}
    $('#tourNext')?.addEventListener('click',()=>{if(idx<steps.length-1)showStep(idx+1);else tourEl.classList.add('hidden');});
    $('#tourPrev')?.addEventListener('click',()=>{if(idx>0)showStep(idx-1);});
    $('#tourClose')?.addEventListener('click',()=>tourEl.classList.add('hidden'));
    $('#btnTutorial')?.addEventListener('click',()=>showStep(0));
    $('#startTour')?.addEventListener('click',()=>{document.getElementById('help')?.close();showStep(0);});
  }
})();