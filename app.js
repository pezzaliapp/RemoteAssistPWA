// app.js — Modalità Mobile + Laser (doc & video) + Annotazioni + PDF.js/DOCX + WebRTC + Tour + WebBluetooth
(() => {
  // --- PWA install banner ---
  let deferredPrompt; const btnInstall=document.getElementById('btnInstall');
  window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); deferredPrompt=e; btnInstall.hidden=false; });
  btnInstall?.addEventListener('click', ()=>{ deferredPrompt?.prompt(); deferredPrompt=null; btnInstall.hidden=true; });

  // --- helpers ---
  const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));

  // Tabs
  $$('.tab').forEach(b=>b.addEventListener('click', ()=>{
    $$('.tab').forEach(t=>t.classList.remove('active'));
    b.classList.add('active');
    $$('.panel').forEach(p=>p.classList.add('hidden'));
    $('#panel-'+b.dataset.tab).classList.remove('hidden');
  }));
  $('#btnHelp')?.addEventListener('click', ()=>$('#help').showModal());
  $('#closeHelp')?.addEventListener('click', ()=>$('#help').close());

  // ===== Modalità Mobile: gestione toggle + auto su iOS/Android =====
  const mmToggle = document.getElementById('mobileMode');
  function setVHVar(){ const vh = window.innerHeight * 0.01; document.documentElement.style.setProperty('--vh', `${vh}px`); }
  function applyMobileMode(on){
    document.body.classList.toggle('mobile-mode', !!on);
    document.documentElement.classList.toggle('mobile-mode', !!on); // <— IMPORTANTE per iOS
    if (mmToggle) mmToggle.checked = !!on;
    try{ localStorage.setItem('mobile-mode', on ? '1':'0'); }catch{}
    setVHVar();
  }
  function shouldAutoMobile(){
    const narrow = window.matchMedia('(max-width: 820px)').matches;
    const ua = navigator.userAgent || '';
    const isIOS = /iP(hone|od|ad)/i.test(ua);
    const isAndroid = /Android/i.test(ua);
    return narrow || isIOS || isAndroid;
  }
  (function initMobileMode(){
    setVHVar();
    window.addEventListener('resize', setVHVar, {passive:true});
    window.addEventListener('orientationchange', setVHVar, {passive:true});
    let stored = null; try{ stored = localStorage.getItem('mobile-mode'); }catch{}
    if (stored === '1' || (stored === null && shouldAutoMobile())){ applyMobileMode(true); }
    mmToggle?.addEventListener('change', (e)=> applyMobileMode(e.target.checked));
  })();

  // ===== Tutorial overlay base =====
  const tourRoot = document.getElementById('tour');
  if (tourRoot) tourRoot.classList.add('hidden');
  const notour = new URL(location.href).searchParams.get('notour')==='1';
  if (notour && tourRoot) tourRoot.remove();
  function tourShow(){ tourRoot?.classList.remove('hidden'); tourRoot?.classList.add('show'); }
  function tourHide(){
    if (tourRoot) {
      const maskEl = tourRoot.querySelector('.tour-mask');
      if (maskEl){
        maskEl.style.setProperty('--spot-x','-1000px');
        maskEl.style.setProperty('--spot-y','-1000px');
        maskEl.style.setProperty('--spot-r','0px');
      }
    }
    tourRoot?.classList.remove('show'); tourRoot?.classList.add('hidden');
  }

  // ===== Switch viste Standard / Glasses / Mobile =====
  const stdOnly=$('.std-only'), gOnly=$('.glasses-only'), mOnly=$('.mobile-only');
  $$('.mode').forEach(btn=>btn.addEventListener('click', ()=>{
    $$('.mode').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const m = btn.dataset.mode;
    stdOnly?.classList.toggle('hidden', m!=='standard');
    gOnly?.classList.toggle('hidden', m!=='glasses');
    mOnly?.classList.toggle('hidden', m!=='mobile');
  }));

  // ===== Video / Audio local =====
  const cameraSelect=$('#cameraSelect'), videoGrid=$('#videoGrid'), micToggle=$('#micToggle');
  const btnAddCam=$('#btnAddCam'), btnStopAll=$('#btnStopAll');
  const sdpBox=$('#sdpBox'); const ghRepo=$('#ghRepo'), ghIssue=$('#ghIssue'), ghToken=$('#ghToken'), ghLog=$('#ghLog');
  const live=$('.live-indicator');

  let tileSeq = 0;

  async function listCams(){
    const devs=await navigator.mediaDevices.enumerateDevices();
    const cams=devs.filter(d=>d.kind==='videoinput');
    if(cameraSelect) cameraSelect.innerHTML=cams.map(d=>`<option value="${d.deviceId}">${d.label||'Camera'}</option>`).join('');
  }
  async function addCam(){
    const stream=await navigator.mediaDevices.getUserMedia({
      video:{deviceId:cameraSelect.value?{exact:cameraSelect.value}:undefined},
      audio: micToggle?.checked
    });
    addTile(stream);
    if(pc) stream.getTracks().forEach(t=>pc.addTrack(t,stream));
  }
  function addTile(stream,label='locale'){
    const wrap=document.createElement('div');
    wrap.className='tile';
    wrap.dataset.tid = (++tileSeq).toString();

    const v=document.createElement('video');
    v.autoplay=true; v.playsInline=true; v.muted=true; v.srcObject=stream;

    const overlay = document.createElement('div');
    overlay.className = 'laserOverlay';
    overlay.style.pointerEvents = 'none';
    overlay.style.touchAction = 'none';

    const dotLocal  = document.createElement('div'); dotLocal.className  = 'cursorDot local';  dotLocal.style.display='none';
    const dotRemote = document.createElement('div'); dotRemote.className = 'cursorDot remote'; dotRemote.style.display='none';
    overlay.appendChild(dotLocal); overlay.appendChild(dotRemote);

    const lb=document.createElement('div');
    lb.className='label'; lb.textContent=label;

    wrap.appendChild(v);
    wrap.appendChild(overlay);
    wrap.appendChild(lb);
    videoGrid.appendChild(wrap);

    function moveInTile(e){
      if(!laser) return;
      const r = overlay.getBoundingClientRect();
      const cx = (e.clientX ?? (e.touches?.[0]?.clientX)) ?? 0;
      const cy = (e.clientY ?? (e.touches?.[0]?.clientY)) ?? 0;
      const nx = (cx - r.left) / r.width;
      const ny = (cy - r.top)  / r.height;
      placeTileDot(dotLocal, overlay, nx, ny);
      try{ dc?.readyState==='open' && dc.send(JSON.stringify({t:'vidCursor', id:wrap.dataset.tid, nx, ny})); }catch{}
    }
    overlay.addEventListener('pointermove', moveInTile, {passive:true});
    overlay.addEventListener('pointerdown', moveInTile, {passive:true});
    overlay.addEventListener('touchmove', moveInTile, {passive:true});
    overlay.addEventListener('pointerleave', ()=>{ dotLocal.style.display='none'; }, {passive:true});
  }
  function placeTileDot(dotEl, overlayEl, nx, ny){
    dotEl.style.display='block';
    const ow = overlayEl.clientWidth, oh = overlayEl.clientHeight;
    dotEl.style.left = (nx*ow) + 'px';
    dotEl.style.top  = (ny*oh) + 'px';
  }

  async function stopAll(){
    $$('#videoGrid video').forEach(v=> v.srcObject && v.srcObject.getTracks().forEach(t=>t.stop()));
    videoGrid.innerHTML='';
  }
  btnAddCam?.addEventListener('click', addCam);
  btnStopAll?.addEventListener('click', stopAll);
  navigator.mediaDevices?.getUserMedia?.({video:true}).then(()=>listCams());

  // ===== Recorder =====
  let mediaRecorder, chunks=[];
  $('#btnRec')?.addEventListener('click', ()=>{
    if(!mediaRecorder || mediaRecorder.state==='inactive'){
      const mix=new MediaStream();
      $$('#videoGrid video').forEach(v=> v.srcObject && v.srcObject.getTracks().forEach(t=>mix.addTrack(t)));
      mediaRecorder=new MediaRecorder(mix,{mimeType:'video/webm;codecs=vp9'});
      mediaRecorder.ondataavailable=e=>chunks.push(e.data);
      mediaRecorder.onstop=()=>{
        const blob=new Blob(chunks,{type:'video/webm'});
        chunks=[];
        const url=URL.createObjectURL(blob);
        const a=$('#downloadRec'); a.href=url; a.download='session.webm';
        a.classList.remove('hidden'); a.textContent='Scarica registrazione';
      };
      mediaRecorder.start(); $('#btnRec').textContent='Ferma Rec';
    } else {
      mediaRecorder.stop(); $('#btnRec').textContent='Avvia Rec';
    }
  });

  // ====== Web Bluetooth (Smart Glasses) + Uscita audio ======
  const btnBt  = document.getElementById('btnBtBattery');
  const btStatus = document.getElementById('btStatus');
  const selAudioOut = document.getElementById('audioOut');
  const btnApplySink = document.getElementById('applySink');
  const sinkInfo = document.getElementById('sinkInfo');

  if (btnBt && btStatus) {
    const setStatus = (txt) => { btStatus.textContent = txt; };

    const hasBT = !!navigator.bluetooth;
    if (!hasBT) { setStatus('Web Bluetooth non supportato su questo browser.'); btnBt.disabled = true; }

    let device = null, server = null, batteryLevelChar = null;

    btnBt.addEventListener('click', async () => {
      if (!hasBT) return;
      try {
        setStatus('Richiesta dispositivo…');
        device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: ['battery_service'] });
        device.addEventListener('gattserverdisconnected', () => { setStatus('Disconnesso'); batteryLevelChar = null; });
        setStatus('Connessione…');
        server = await device.gatt.connect();
        try {
          const svc = await server.getPrimaryService('battery_service');
          batteryLevelChar = await svc.getCharacteristic('battery_level');
          const val = await batteryLevelChar.readValue();
          const percent = val.getUint8(0);
          setStatus(`Connesso (${device.name || 'BLE'}), Batteria: ${percent}%`);
          batteryLevelChar.startNotifications?.().then(() => {
            batteryLevelChar.addEventListener('characteristicvaluechanged', (e) => {
              const p = e.target.value.getUint8(0);
              setStatus(`Connesso (${device.name || 'BLE'}), Batteria: ${p}%`);
            });
          }).catch(()=>{});
        } catch {
          setStatus(`Connesso (${device.name || 'BLE'})`);
        }
      } catch (err) {
        console.warn('WebBluetooth:', err);
        setStatus(err?.name === 'NotFoundError' ? 'Nessun dispositivo selezionato' : `Errore: ${err.message || err}`);
      }
    });

    async function populateAudioOutputs() {
      if (!selAudioOut) return;
      const canSetSink = typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
      if (!canSetSink) {
        selAudioOut.disabled = true; btnApplySink?.setAttribute('disabled', 'disabled');
        sinkInfo && (sinkInfo.textContent = 'Cambio uscita audio non supportato su questo browser.'); return;
      }
      try {
        const devs = await navigator.mediaDevices.enumerateDevices();
        const outs = devs.filter(d => d.kind === 'audiooutput');
        selAudioOut.innerHTML = outs.length
          ? outs.map(o => `<option value="${o.deviceId}">${o.label || 'Uscita audio'}</option>`).join('')
          : `<option value="">(nessuna uscita trovata)</option>`;
      } catch {
        selAudioOut.innerHTML = `<option value="">(permessi mancanti)</option>`;
      }
    }
    btnApplySink?.addEventListener('click', async () => {
      const id = selAudioOut?.value || '';
      if (!id) return;
      const canSetSink = 'setSinkId' in HTMLMediaElement.prototype;
      if (!canSetSink) return;
      const mediaEls = Array.from(document.querySelectorAll('video, audio'));
      try { await Promise.all(mediaEls.map(el => el.setSinkId(id))); sinkInfo && (sinkInfo.textContent = `Uscita impostata ✓ (${id})`); }
      catch(e){ sinkInfo && (sinkInfo.textContent = `Errore sink: ${e?.message || e}`); }
    });

    if (navigator.mediaDevices?.enumerateDevices) {
      populateAudioOutputs();
      navigator.mediaDevices.addEventListener?.('devicechange', populateAudioOutputs);
    }
  }

  // ===== Chat =====
  const chatLog=$('#chatLog'), chatInput=$('#chatInput');
  $('#chatSend')?.addEventListener('click', ()=>{ sendChat(chatInput.value); chatInput.value=''; });
  function appendChat(msg,who='me'){ const div=document.createElement('div'); div.className='m'; const pfx=who==='me'?'Tu: ':who==='remote'?'Remoto: ':'· '; div.textContent=pfx+msg; chatLog?.appendChild(div); chatLog&&(chatLog.scrollTop=chatLog.scrollHeight); }
  function sendData(o){ try{ dc?.readyState==='open' && dc.send(JSON.stringify(o)); }catch{} }
  function sendChat(text){ if(!text) return; appendChat(text,'me'); sendData({t:'chat',text}); }

  // ===== Annotazioni =====
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
          if(m.t==='annoImage'){ /* opzionale */ }
          if(m.t==='docOpen'){ const url=m.url; const df=document.getElementById('docFrame'); if(url && df) df.src=url; }
          if(m.t==='cursor'){ // laser su documenti
            const rc=document.getElementById('remoteCursor');
            if(rc){
              rc.classList.remove('hidden');
              const rect=document.querySelector('.docWrap').getBoundingClientRect();
              rc.style.left=(m.nx*rect.width)+'px';
              rc.style.top=(m.ny*rect.height)+'px';
            }
          }
          if(m.t==='vidCursor'){ // laser su riquadri video
            const tile = document.querySelector(`.tile[data-tid="${m.id}"]`);
            if(tile){
              tile.classList.add('laser-active');
              const overlay = tile.querySelector('.laserOverlay');
              const dotR = tile.querySelector('.cursorDot.remote');
              if (overlay && dotR){
                const ow = overlay.clientWidth, oh = overlay.clientHeight;
                dotR.style.left = (m.nx*ow) + 'px';
                dotR.style.top  = (m.ny*oh) + 'px';
                dotR.style.display='block';
              }
            }
          }
        }catch{}
      });
    };
  }
  initAnnotations();

  // ===== Laser + Documenti =====
  const docFrame=$('#docFrame'), filePicker=$('#filePicker');
  const overlay=$('#cursorOverlay'), lCursor=$('#localCursor');
  let laser=false;

  function setLaser(on){
    laser = !!on;
    $('#btnLaser') && ($('#btnLaser').textContent = laser ? 'Laser OFF' : 'Laser ON');
    if(overlay) overlay.style.pointerEvents = laser?'auto':'none';
    lCursor?.classList.toggle('hidden', !laser);
    $$('#videoGrid .tile').forEach(t=>{
      const ov = t.querySelector('.laserOverlay');
      if(ov) ov.style.pointerEvents = laser ? 'auto' : 'none';
      t.classList.toggle('laser-active', laser);
      if(!laser){
        const dl = t.querySelector('.cursorDot.local');  if(dl) dl.style.display='none';
        const dr = t.querySelector('.cursorDot.remote'); if(dr) dr.style.display='none';
      }
    });
  }
  $('#btnLaser')?.addEventListener('click', ()=> setLaser(!laser));

  function posCursor(el, nx, ny){
    const rect=$('.docWrap').getBoundingClientRect();
    el.style.left=(nx*rect.width)+'px';
    el.style.top=(ny*rect.height)+'px';
  }
  overlay?.addEventListener('pointermove', e=>{
    if(!laser) return;
    const rect=$('.docWrap').getBoundingClientRect();
    const nx=(e.clientX-rect.left)/rect.width;
    const ny=(e.clientY-rect.top)/rect.height;
    posCursor(lCursor, nx, ny);
    try{ dc?.readyState==='open' && dc.send(JSON.stringify({t:'cursor', nx, ny})); }catch{}
  });

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

  filePicker && (filePicker.onchange=()=>{
    const f=filePicker.files[0]; if(!f)return;
    const url=URL.createObjectURL(f);
    if(docFrame) docFrame.src=url;
    try{ dc?.readyState==='open' && dc.send(JSON.stringify({t:'docOpen', url})); }catch{}
    if(/\.docx$/i.test(f.name||'')){ appendChat('DOCX caricato in locale (blob). Per aprirlo nel viewer usa un URL web o posizionalo in /docs.', 'sys'); }
  });

  $('#btnSync')?.addEventListener('click', ()=>{
    const url = docFrame?.src || '';
    if(!dc || dc.readyState!=='open'){ appendChat('Non connesso. Apri Segnaling e collegati.', 'sys'); return; }
    if(!url){ appendChat('Nessun documento da sincronizzare.', 'sys'); return; }
    if(url.startsWith('blob:')){ appendChat('Sync richiede URL web. Metti il file in /docs o usa un link pubblico.', 'sys'); return; }
    try{ dc.send(JSON.stringify({t:'docOpen', url})); }catch{}
    appendChat('Sync inviato ✓','sys');
  });

  // ===== WebRTC base + GitHub Issues =====
  let pc=null, dc=null;
  function createPC(){
    pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
    pc.ontrack=e=>{ const s=e.streams[0]||new MediaStream([e.track]); addTile(s,'remoto'); };
    pc.ondatachannel=e=>setupDC(e.channel);
    dc=pc.createDataChannel('ra'); setupDC(dc);
    $$('#videoGrid video').forEach(v=> v.srcObject && v.srcObject.getTracks().forEach(t=> pc.addTrack(t, v.srcObject)));
  }
  function setupDC(ch){
    dc=ch;
    dc.onopen = ()=>{ appendChat('(canale dati aperto)','sys'); live?.classList.remove('idle'); };
    dc.onclose= ()=>{ live?.classList.add('idle'); };
    dc.onmessage=(ev)=>{ try{ const m=JSON.parse(ev.data); if(m.t==='chat') appendChat(m.text,'remote'); }catch{} };
    if(window.__setupDC__) window.__setupDC__(ch);
  }
  async function waitIce(pc){
    return new Promise(res=>{
      if(pc.iceGatheringState==='complete') return res(pc.localDescription);
      pc.onicegatheringstatechange=()=>{ if(pc.iceGatheringState==='complete') res(pc.localDescription); };
    });
  }
  async function makeOffer(){ createPC(); const off=await pc.createOffer({offerToReceiveAudio:true,offerToReceiveVideo:true}); await pc.setLocalDescription(off); const sdp=await waitIce(pc); sdpBox.value=JSON.stringify({type:'offer',sdp:sdp.sdp}); }
  async function makeAnswerFromOffer(){ const offer=JSON.parse(sdpBox.value||'{}'); createPC(); await pc.setRemoteDescription(offer); const ans=await pc.createAnswer(); await pc.setLocalDescription(ans); const sdp=await waitIce(pc); sdpBox.value=JSON.stringify({type:'answer', sdp:sdp.sdp}); }
  async function applyAnswer(){ const ans=JSON.parse(sdpBox.value||'{}'); await pc.setRemoteDescription(ans); }
  document.getElementById('btnMakeOffer')?.addEventListener('click', makeOffer);
  document.getElementById('btnMakeAnswer')?.addEventListener('click', makeAnswerFromOffer);
  document.getElementById('btnApplyAnswer')?.addEventListener('click', applyAnswer);

  function logGH(s){ ghLog.value+=(s+'\n'); ghLog.scrollTop=ghLog.scrollHeight; }
  async function ghFetch(path, opts={}){
    const tok=ghToken?.value?.trim?.()||''; if(!tok) throw new Error('Token mancante');
    const r=await fetch('https://api.github.com'+path, {headers:{'Accept':'application/vnd.github+json','Authorization':'Bearer '+tok}, ...opts});
    const t=await r.text(); try{ return JSON.parse(t); }catch{ return t; }
  }
  function repoParts(){ const v=ghRepo?.value||''; const [owner,repo]=v.split('/'); return {owner,repo}; }
  document.getElementById('btnGhStart')?.addEventListener('click', ()=> logGH('Issue collegata (client-side).'));
  document.getElementById('btnGhSend')?.addEventListener('click', async ()=>{
    try{
      const payload=sdpBox.value.trim(); if(!payload) return;
      const tag = payload.includes('"type":"offer"') ? '[OFFER]' : '[ANSWER]';
      const {owner,repo}=repoParts(); const issue=ghIssue.value.trim();
      const res=await ghFetch(`/repos/${owner}/${repo}/issues/${issue}/comments`, {method:'POST', body: JSON.stringify({body: tag+"```json\n"+payload+"\n```"})});
      logGH('Inviato '+tag+' id='+ (res.id||'?'));
    }catch(e){ logGH('Errore: '+e.message); }
  });
  document.getElementById('btnGhPoll')?.addEventListener('click', async ()=>{
    try{
      const {owner,repo}=repoParts(); const issue=ghIssue.value.trim();
      const res=await ghFetch(`/repos/${owner}/${repo}/issues/${issue}/comments`);
      if(!Array.isArray(res)) return logGH('Errore risposta API');
      const last=res[res.length-1]; if(!last) return logGH('Nessun commento.');
      const body=last.body||''; const m=body.match(/```json\n([\s\S]*?)\n```/);
      if(m){ sdpBox.value=m[1]; logGH('Aggiornato da commento '+last.id); } else { logGH('Nessun payload JSON.'); }
    }catch(e){ logGH('Errore: '+e.message); }
  });

  // ===== Tutorial (passi) =====
  const tourEl = document.getElementById('tour');
  if (tourEl){
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
      const pop = tourEl.querySelector('.tour-pop');
      const hi  = highlight;
      const maskEl = tourEl.querySelector('.tour-mask');

      if (!target) {
        hi.style.width = hi.style.height = '0px';
        hi.style.left = hi.style.top = '-9999px';
        if (maskEl){
          maskEl.style.setProperty('--spot-x','-1000px');
          maskEl.style.setProperty('--spot-y','-1000px');
          maskEl.style.setProperty('--spot-r','0px');
        }
        pop.style.left = (window.innerWidth - (pop.offsetWidth||360))/2 + 'px';
        pop.style.top  = (window.innerHeight - (pop.offsetHeight||140))/2 + 'px';
        pop.dataset.arrow = 'none';
        return;
      }

      const rect0 = target.getBoundingClientRect();
      const margin = 24;
      const outTop = rect0.top < margin;
      const outBottom = rect0.bottom > (window.innerHeight - margin);
      const outLeft = rect0.left < margin;
      const outRight = rect0.right > (window.innerWidth - margin);
      if (outTop || outBottom || outLeft || outRight) {
        target.scrollIntoView({behavior:'smooth', block:'center', inline:'center'});
      }

      const r = target.getBoundingClientRect();

      const pad = 8;
      const x = Math.max(0, r.left - pad);
      const y = Math.max(0, r.top  - pad);
      const w = Math.min(window.innerWidth  - x, r.width  + pad*2);
      const h = Math.min(window.innerHeight - y, r.height + pad*2);
      hi.style.position='fixed';
      hi.style.left = x + 'px';
      hi.style.top  = y + 'px';
      hi.style.width  = w + 'px';
      hi.style.height = h + 'px';

      if (maskEl){
        const cx = r.left + r.width/2;
        const cy = r.top  + r.height/2;
        const rad = Math.hypot(r.width, r.height)/2 + 18;
        maskEl.style.setProperty('--spot-x', cx + 'px');
        maskEl.style.setProperty('--spot-y', cy + 'px');
        maskEl.style.setProperty('--spot-r', rad + 'px');
      }
      const gap = 16;
      const pw = pop.offsetWidth  || 420;
      const ph = pop.offsetHeight || 160;
      const roomRight = window.innerWidth  - (r.right + gap);
      const roomLeft  = r.left - gap;
      const roomAbove = r.top - gap;
      const roomBelow = window.innerHeight - (r.bottom + gap);

      let px, py, arrow = 'left';
      if (roomRight >= pw) { px = r.right + gap;  py = Math.min(Math.max(r.top, margin), window.innerHeight - ph - margin); arrow = 'left'; }
      else if (roomLeft >= pw) { px = r.left - pw - gap; py = Math.min(Math.max(r.top, margin), window.innerHeight - ph - margin); arrow = 'right'; }
      else if (roomBelow >= ph) { px = Math.min(Math.max(r.left, margin), window.innerWidth - pw - margin); py = r.bottom + gap; arrow = 'top'; }
      else if (roomAbove >= ph) { px = Math.min(Math.max(r.left, margin), window.innerWidth - pw - margin); py = r.top - ph - gap; arrow = 'bottom'; }
      else { px = (window.innerWidth - pw)/2; py = (window.innerHeight - ph)/2; arrow = 'none'; }

      px = Math.min(Math.max(px, margin), window.innerWidth  - pw - margin);
      py = Math.min(Math.max(py, margin), window.innerHeight - ph - margin);

      pop.style.left = px + 'px';
      pop.style.top  = py + 'px';
      pop.dataset.arrow = arrow;
    }

    function showStep(i){ idx=i; const s=steps[idx]; const target=document.querySelector(s.sel); stepEl.textContent = `Passo ${idx+1}/${steps.length} — `+s.text; placeHighlight(target); tourShow(); }
    function next(){ if(idx<steps.length-1) showStep(idx+1); else tourHide(); }
    function prev(){ if(idx>0) showStep(idx-1); }
    document.getElementById('tourNext')?.addEventListener('click', next);
    document.getElementById('tourPrev')?.addEventListener('click', prev);
    document.getElementById('tourClose')?.addEventListener('click', tourHide);

    document.getElementById('btnTutorial')?.addEventListener('click', ()=> showStep(0));
    document.getElementById('startTour')?.addEventListener('click', ()=>{ document.getElementById('help')?.close(); showStep(0); });

    ['resize','orientationchange','scroll'].forEach(ev=>{
      window.addEventListener(ev, ()=>{ const cur = steps[idx]; if(cur){ const t=document.querySelector(cur.sel); if(t) placeHighlight(t); }}, {passive:true});
    });
  }

  // ===== SW: ricarica quando c’è una nuova versione =====
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!window.__reloadedOnce) { window.__reloadedOnce = true; location.reload(); }
    });
  }
})();
