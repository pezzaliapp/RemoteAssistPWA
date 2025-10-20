// app.js patch – annotazioni robuste + share + hook DC + TUTORIAL + PDF.js fix + Sync doc
(() => {
  let deferredPrompt; const btnInstall=document.getElementById('btnInstall');
  window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); deferredPrompt=e; btnInstall.hidden=false; });
  btnInstall?.addEventListener('click', ()=>{ deferredPrompt?.prompt(); deferredPrompt=null; btnInstall.hidden=true; });

  const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
  $$('.tab').forEach(b=>b.addEventListener('click', ()=>{ $$('.tab').forEach(t=>t.classList.remove('active')); b.classList.add('active'); $$('.panel').forEach(p=>p.classList.add('hidden')); $('#panel-'+b.dataset.tab).classList.remove('hidden'); }));
  $('#btnHelp')?.addEventListener('click', ()=>$('#help').showModal()); $('#closeHelp')?.addEventListener('click', ()=>$('#help').close());

  // Tour safe default
  const tourRoot = document.getElementById('tour');
  if (tourRoot) tourRoot.classList.add('hidden');
  const notour = new URL(location.href).searchParams.get('notour')==='1';
  if (notour && tourRoot) tourRoot.remove();
  function tourShow(){ tourRoot?.classList.remove('hidden'); tourRoot?.classList.add('show'); }
  function tourHide(){ tourRoot?.classList.remove('show'); tourRoot?.classList.add('hidden'); }

  const stdOnly=$('.std-only'), gOnly=$('.glasses-only'), mOnly=$('.mobile-only');
  $$('.mode').forEach(btn=>btn.addEventListener('click', ()=>{
    $$('.mode').forEach(b=>b.classList.remove('active')); btn.classList.add('active');
    const m = btn.dataset.mode;
    stdOnly?.classList.toggle('hidden', m!=='standard'); gOnly?.classList.toggle('hidden', m!=='glasses'); mOnly?.classList.toggle('hidden', m!=='mobile');
  }));

  const cameraSelect=$('#cameraSelect'), videoGrid=$('#videoGrid'), micToggle=$('#micToggle');
  const btnAddCam=$('#btnAddCam'), btnStopAll=$('#btnStopAll');
  const sdpBox=$('#sdpBox'); const ghRepo=$('#ghRepo'), ghIssue=$('#ghIssue'), ghToken=$('#ghToken'), ghLog=$('#ghLog');
  const live=$('.live-indicator');

  async function listCams(){ const devs=await navigator.mediaDevices.enumerateDevices(); const cams=devs.filter(d=>d.kind==='videoinput'); if(cameraSelect) cameraSelect.innerHTML=cams.map(d=>`<option value="${d.deviceId}">${d.label||'Camera'}</option>`).join(''); }
  async function addCam(){ const stream=await navigator.mediaDevices.getUserMedia({video:{deviceId:cameraSelect.value?{exact:cameraSelect.value}:undefined}, audio: micToggle?.checked}); addTile(stream); if(pc) stream.getTracks().forEach(t=>pc.addTrack(t,stream)); }
  function addTile(stream,label='locale'){ const wrap=document.createElement('div'); wrap.className='tile'; const v=document.createElement('video'); v.autoplay=true; v.playsInline=true; v.muted=true; v.srcObject=stream; const lb=document.createElement('div'); lb.className='label'; lb.textContent=label; wrap.appendChild(v); wrap.appendChild(lb); videoGrid.appendChild(wrap); }
  async function stopAll(){ $$('#videoGrid video').forEach(v=> v.srcObject && v.srcObject.getTracks().forEach(t=>t.stop())); videoGrid.innerHTML=''; }
  btnAddCam?.addEventListener('click', addCam); btnStopAll?.addEventListener('click', stopAll); navigator.mediaDevices?.getUserMedia?.({video:true}).then(()=>listCams());

  // Recorder (invariato)
  let mediaRecorder, chunks=[];
  $('#btnRec')?.addEventListener('click', ()=>{ if(!mediaRecorder || mediaRecorder.state==='inactive'){ const mix=new MediaStream(); $$('#videoGrid video').forEach(v=> v.srcObject && v.srcObject.getTracks().forEach(t=>mix.addTrack(t))); mediaRecorder=new MediaRecorder(mix,{mimeType:'video/webm;codecs=vp9'}); mediaRecorder.ondataavailable=e=>chunks.push(e.data); mediaRecorder.onstop=()=>{ const blob=new Blob(chunks,{type:'video/webm'}); chunks=[]; const url=URL.createObjectURL(blob); const a=$('#downloadRec'); a.href=url; a.download='session.webm'; a.classList.remove('hidden'); a.textContent='Scarica registrazione'; }; mediaRecorder.start(); $('#btnRec').textContent='Ferma Rec'; } else { mediaRecorder.stop(); $('#btnRec').textContent='Avvia Rec'; } });

  // Chat helpers
  const chatLog=$('#chatLog'), chatInput=$('#chatInput');
  $('#chatSend')?.addEventListener('click', ()=>{ sendChat(chatInput.value); chatInput.value=''; });
  function appendChat(msg,who='me'){ const div=document.createElement('div'); div.className='m'; const pfx=who==='me'?'Tu: ':who==='remote'?'Remoto: ':'· '; div.textContent=pfx+msg; chatLog?.appendChild(div); chatLog&&(chatLog.scrollTop=chatLog.scrollHeight); }
  function sendData(o){ try{ dc?.readyState==='open' && dc.send(JSON.stringify(o)); }catch{} }
  function sendChat(text){ if(!text) return; appendChat(text,'me'); sendData({t:'chat',text}); }

  // ---------- Annotazioni + Laser (PATCH) ----------
  function initAnnotations(){
    const canvas = document.getElementById('annoCanvas');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    const penBtn = document.getElementById('pen');
    const eraserBtn = document.getElementById('eraser');
    const clearBtn = document.getElementById('clear');
    const shareBtn = document.getElementById('btnAnnoShare');
    const thick = document.getElementById('thick');

    let drawing=false, mode='pen', last=null;

    function sizeCanvasToParent(){
      const p = canvas.parentElement;
      const r = p.getBoundingClientRect();
      const w = Math.max(1, r.width|0), h = Math.max(1, r.height|0);
      if (canvas.width!==w || canvas.height!==h){
        const snap = (canvas.width&&canvas.height) ? ctx.getImageData(0,0,canvas.width,canvas.height) : null;
        canvas.width=w; canvas.height=h;
        if(snap) try{ ctx.putImageData(snap,0,0);}catch{}
      }
    }
    new ResizeObserver(sizeCanvasToParent).observe(canvas.parentElement);
    window.addEventListener('load', sizeCanvasToParent);
    window.addEventListener('orientationchange', sizeCanvasToParent);
    setTimeout(sizeCanvasToParent, 30);

    function pt(e){ const r=canvas.getBoundingClientRect(); const x=(e.touches?e.touches[0].clientX:e.clientX)-r.left; const y=(e.touches?e.touches[0].clientY:e.clientY)-r.top; return {x,y}; }
    function seg(a,b){
      ctx.globalCompositeOperation = (mode==='pen' ? 'source-over' : 'destination-out');
      ctx.lineCap='round'; ctx.lineJoin='round'; ctx.lineWidth=+thick.value; ctx.strokeStyle='#2dd4bf';
      ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
    }

    canvas.addEventListener('pointerdown', e=>{ canvas.setPointerCapture?.(e.pointerId); drawing=true; last=pt(e); seg(last,last); sendData({t:'anno',evt:'down',payload:{x:last.x,y:last.y,mode,th:+thick.value}}); });
    canvas.addEventListener('pointermove', e=>{ if(!drawing)return; const p=pt(e); seg(last,p); last=p; sendData({t:'anno',evt:'move',payload:{x:p.x,y:p.y,mode,th:+thick.value}}); });
    window.addEventListener('pointerup', ()=>{ if(drawing){ drawing=false; last=null; sendData({t:'anno',evt:'up'}); }});

    penBtn && (penBtn.onclick=()=>mode='pen');
    eraserBtn && (eraserBtn.onclick=()=>mode='eraser');
    clearBtn && (clearBtn.onclick=()=>{ ctx.clearRect(0,0,canvas.width,canvas.height); sendData({t:'anno',evt:'clear'}); });
    shareBtn && (shareBtn.onclick=()=>{ try{ const data=canvas.toDataURL('image/png'); sendData({t:'annoImage',data}); appendChat('Schema inviato al remoto','sys'); }catch(e){} });

    // Hook per ricezione via data channel (senza rompere setupDC)
    const oldHook = window.__setupDC__;
    window.__setupDC__ = function(ch){
      if (oldHook) oldHook(ch);
      ch.addEventListener('message', ev=>{
        try{
          const m = JSON.parse(ev.data);
          if(m.t==='anno'){
            if(m.evt==='clear') ctx.clearRect(0,0,canvas.width,canvas.height);
            if(m.evt==='down' || m.evt==='move'){
              const p=m.payload; const prevM=mode, prevT=thick.value;
              mode=p.mode; thick.value=p.th;
              const from = last || {x:p.x,y:p.y}; seg(from,{x:p.x,y:p.y}); last={x:p.x,y:p.y};
              mode=prevM; thick.value=prevT;
            }
            if(m.evt==='up') last=null;
          }
          if(m.t==='annoImage'){ /* opzionale: window.open(m.data,'_blank'); */ }
          if(m.t==='docOpen'){ const url=m.url; const df=document.getElementById('docFrame'); if(url && df) df.src=url; }
          if(m.t==='cursor'){ const rc=document.getElementById('remoteCursor'); if(rc){ rc.classList.remove('hidden'); const rect=document.querySelector('.docWrap').getBoundingClientRect(); rc.style.left=(m.nx*rect.width)+'px'; rc.style.top=(m.ny*rect.height)+'px'; } }
        }catch{}
      });
    };
  }
  initAnnotations();

  // ------- Laser + documenti (+ PDF.js fix + Sync) -------
  const docFrame=$('#docFrame'), filePicker=$('#filePicker');
  const overlay=$('#cursorOverlay'), lCursor=$('#localCursor');
  let laser=false;
  $('#btnLaser')?.addEventListener('click', ()=>{ laser=!laser; $('#btnLaser').textContent=laser?'Laser OFF':'Laser ON'; overlay && (overlay.style.pointerEvents = laser?'auto':'none'); lCursor?.classList.toggle('hidden', !laser); });
  function posCursor(el, nx, ny){ const rect=$('.docWrap').getBoundingClientRect(); el.style.left=(nx*rect.width)+'px'; el.style.top=(ny*rect.height)+'px'; }
  overlay?.addEventListener('pointermove', e=>{ if(!laser) return; const rect=$('.docWrap').getBoundingClientRect(); const nx=(e.clientX-rect.left)/rect.width; const ny=(e.clientY-rect.top)/rect.height; posCursor(lCursor, nx, ny); sendData({t:'cursor', nx, ny}); });

  // PDF.js / DOCX viewer
  $('#btnPdfJs')?.addEventListener('click', ()=>{
    const url = docFrame?.src || '';
    if(!url){ appendChat('Nessun documento aperto','sys'); return; }
    const low = url.toLowerCase();
    if(low.endsWith('.docx')){
      if(url.startsWith('blob:')){ appendChat('DOCX locale (blob): usa file in /docs o URL pubblico per aprirlo nel viewer.','sys'); return; }
      const office = 'https://view.officeapps.live.com/op/view.aspx?src=' + encodeURIComponent(url);
      if(docFrame) docFrame.src = office;
      appendChat('Aperto DOCX con Office Web Viewer','sys');
      return;
    }
    if(url.startsWith('blob:')){ appendChat('PDF.js non può aprire file locali (blob). Metti il PDF in /docs o usa URL pubblico.','sys'); return; }
    const viewer = 'https://mozilla.github.io/pdf.js/web/viewer.html?file=' + encodeURIComponent(url);
    if(docFrame) docFrame.src = viewer;
    appendChat('Aperto con PDF.js (Mozilla viewer)','sys');
  });

  // file picker
  filePicker && (filePicker.onchange=()=>{ const f=filePicker.files[0]; if(!f)return; const url=URL.createObjectURL(f); if(docFrame) docFrame.src=url; sendData({t:'docOpen', url}); if(/\.docx$/i.test(f.name||'')){ appendChat('DOCX caricato in locale (blob). Per aprirlo nel viewer usa un URL web o posizionalo in /docs.', 'sys'); } });

  // Sync vista → remoto: invia l'URL attuale del documento (compatibile cross-origin)
  $('#btnSync')?.addEventListener('click', ()=>{
    const url = docFrame?.src || '';
    if(!dc || dc.readyState!=='open'){ appendChat('Non connesso. Apri Segnaling e collegati.', 'sys'); return; }
    if(!url){ appendChat('Nessun documento da sincronizzare.', 'sys'); return; }
    if(url.startsWith('blob:')){ appendChat('Sync richiede URL web. Metti il file in /docs o usa un link pubblico.', 'sys'); return; }
    sendData({t:'docOpen', url});
    appendChat('Sync inviato ✓','sys');
  });

  // --------- WebRTC base + GitHub Issues (ridotto) ---------
  let pc=null, dc=null;
  function createPC(){ pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]}); pc.ontrack=e=>{ const s=e.streams[0]||new MediaStream([e.track]); addTile(s,'remoto'); }; pc.ondatachannel=e=>setupDC(e.channel); dc=pc.createDataChannel('ra'); setupDC(dc); $$('#videoGrid video').forEach(v=> v.srcObject && v.srcObject.getTracks().forEach(t=> pc.addTrack(t, v.srcObject))); }
  function setupDC(ch){ dc=ch; dc.onopen=()=>{appendChat('(canale dati aperto)','sys'); live?.classList.remove('idle');}; dc.onclose=()=>{live?.classList.add('idle');}; dc.onmessage=(ev)=>{ try{ const m=JSON.parse(ev.data); if(m.t==='chat') appendChat(m.text,'remote'); }catch{} }; if(window.__setupDC__) window.__setupDC__(ch); }
  async function waitIce(pc){ return new Promise(res=>{ if(pc.iceGatheringState==='complete') return res(pc.localDescription); pc.onicegatheringstatechange=()=>{ if(pc.iceGatheringState==='complete') res(pc.localDescription); }; }); }
  async function makeOffer(){ createPC(); const off=await pc.createOffer({offerToReceiveAudio:true,offerToReceiveVideo:true}); await pc.setLocalDescription(off); const sdp=await waitIce(pc); sdpBox.value=JSON.stringify({type:'offer',sdp:sdp.sdp}); }
  async function makeAnswerFromOffer(){ const offer=JSON.parse(sdpBox.value||'{}'); createPC(); await pc.setRemoteDescription(offer); const ans=await pc.createAnswer(); await pc.setLocalDescription(ans); const sdp=await waitIce(pc); sdpBox.value=JSON.stringify({type:'answer', sdp:sdp.sdp}); }
  async function applyAnswer(){ const ans=JSON.parse(sdpBox.value||'{}'); await pc.setRemoteDescription(ans); }
  document.getElementById('btnMakeOffer')?.addEventListener('click', makeOffer);
  document.getElementById('btnMakeAnswer')?.addEventListener('click', makeAnswerFromOffer);
  document.getElementById('btnApplyAnswer')?.addEventListener('click', applyAnswer);

  function logGH(s){ ghLog.value+=(s+'\n'); ghLog.scrollTop=ghLog.scrollHeight; }
  async function ghFetch(path, opts={}){ const tok=ghToken.value.trim(); if(!tok) throw new Error('Token mancante'); const r=await fetch('https://api.github.com'+path, {headers:{'Accept':'application/vnd.github+json','Authorization':'Bearer '+tok}, ...opts}); const t=await r.text(); try{ return JSON.parse(t); }catch{ return t; } }
  function repoParts(){ const [owner,repo]=ghRepo.value.split('/'); return {owner,repo}; }
  document.getElementById('btnGhStart')?.addEventListener('click', ()=> logGH('Issue collegata (client-side).'));
  document.getElementById('btnGhSend')?.addEventListener('click', async ()=>{ try{ const payload=sdpBox.value.trim(); if(!payload) return; const tag = payload.includes('"type":"offer"') ? '[OFFER]' : '[ANSWER]'; const {owner,repo}=repoParts(); const issue=ghIssue.value.trim(); const res=await ghFetch(`/repos/${owner}/${repo}/issues/${issue}/comments`, {method:'POST', body: JSON.stringify({body: tag+"```json\n"+payload+"\n```"})}); logGH('Inviato '+tag+' id='+ (res.id||'?')); }catch(e){ logGH('Errore: '+e.message); } });
  document.getElementById('btnGhPoll')?.addEventListener('click', async ()=>{ try{ const {owner,repo}=repoParts(); const issue=ghIssue.value.trim(); const res=await ghFetch(`/repos/${owner}/${repo}/issues/${issue}/comments`); if(!Array.isArray(res)) return logGH('Errore risposta API'); const last=res[res.length-1]; if(!last) return logGH('Nessun commento.'); const body=last.body||''; const m=body.match(/```json\n([\s\S]*?)\n```/); if(m){ sdpBox.value=m[1]; logGH('Aggiornato da commento '+last.id); } else { logGH('Nessun payload JSON.'); } }catch(e){ logGH('Errore: '+e.message); } });

  // ---------- Tutorial interattivo (Avvia guida) ----------
  const tourEl = document.getElementById('tour');
  if (tourEl && !notour){
    const highlight = document.createElement('div'); highlight.className = 'tour-highlight'; tourEl.appendChild(highlight);
    const stepEl = tourEl.querySelector('.tour-step');
    const steps = [
      {sel:'.modes', text:'Scegli la modalità: Standard, Smart Glasses o Mobile Cam.'},
      {sel:'.tab[data-tab="signal"]', text:'Vai nella tab “Segnaling” per collegarti.'},
      {sel:'#btnMakeOffer', text:'Tecnico: premi “Genera Offerta” e copia il JSON.'},
      {sel:'#sdpBox', text:'Incolla qui l’Offerta/Risposta.'},
      {sel:'#btnMakeAnswer', text:'Esperto: crea la Risposta, poi inviala.'},
      {sel:'#btnApplyAnswer', text:'Tecnico: applica la Risposta — connessi.'},
      {sel:'#btnLaser', text:'Usa Laser e Annotazioni per guidare il lavoro.'}
    ];
    let idx=0;
    function placeHighlight(target){
      const r=target.getBoundingClientRect();
      highlight.style.position='fixed';
      highlight.style.left=(r.left-6)+'px'; highlight.style.top=(r.top-6)+'px';
      highlight.style.width=(r.width+12)+'px'; highlight.style.height=(r.height+12)+'px';
      const pop = tourEl.querySelector('.tour-pop');
      const px=Math.min(window.innerWidth-380, Math.max(16, r.right+16));
      const py=Math.min(window.innerHeight-160, Math.max(16, r.top));
      pop.style.left=px+'px'; pop.style.top=py+'px';
    }
    function showStep(i){
      idx=i;
      const s=steps[idx];
      const target=document.querySelector(s.sel);
      stepEl.textContent = `Passo ${idx+1}/${steps.length} — `+s.text;
      if(target) placeHighlight(target);
      tourShow();
    }
    function next(){ if(idx<steps.length-1) showStep(idx+1); else tourHide(); }
    function prev(){ if(idx>0) showStep(idx-1); }
    document.getElementById('tourNext')?.addEventListener('click', next);
    document.getElementById('tourPrev')?.addEventListener('click', prev);
    document.getElementById('tourClose')?.addEventListener('click', tourHide);
    document.getElementById('btnTutorial')?.addEventListener('click', ()=> showStep(0));
    document.getElementById('startTour')?.addEventListener('click', ()=>{ document.getElementById('help')?.close(); showStep(0); });
  }
})();