// Remote Assist — MultiCam (Mobile Cam) — app.js v1.0
(() => {
  let deferredPrompt; const btnInstall=document.getElementById('btnInstall');
  window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); deferredPrompt=e; btnInstall.hidden=false; });
  btnInstall?.addEventListener('click', ()=>{ deferredPrompt?.prompt(); deferredPrompt=null; btnInstall.hidden=true; });

  const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
  $$('.tab').forEach(b=>b.addEventListener('click', ()=>{ $$('.tab').forEach(t=>t.classList.remove('active')); b.classList.add('active'); $$('.panel').forEach(p=>p.classList.add('hidden')); $('#panel-'+b.dataset.tab).classList.remove('hidden'); }));
  $('#btnHelp').onclick=()=>$('#help').showModal(); $('#closeHelp').onclick=()=>$('#help').close();

  const cameraSelect=$('#cameraSelect'), videoGrid=$('#videoGrid'), micToggle=$('#micToggle');
  const btnAddCam=$('#btnAddCam'), btnStopAll=$('#btnStopAll');
  const btnJoin=$('#btnJoin'), btnLeave=$('#btnLeave');
  const sdpBox=$('#sdpBox');
  const ghRepo=$('#ghRepo'), ghIssue=$('#ghIssue'), ghToken=$('#ghToken'), ghLog=$('#ghLog');

  // Rear camera (Mobile Cam Mode)
  const btnRearCam=$('#btnRearCam'), btnTorch=$('#btnTorch'), btnFullscreen=$('#btnFullscreen'), btnLock=$('#btnLock');
  let rearStream=null, rearTrack=null, imageCapture=null, torch=false;
  async function startRearCam(){
    try{
      rearStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: 'environment' }, width: {ideal:1280}, height:{ideal:720}, frameRate:{ideal:30} },
        audio: micToggle.checked
      });
    }catch{
      // fallback senza exact
      rearStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: {ideal:1280}, height:{ideal:720} },
        audio: micToggle.checked
      });
    }
    addTile(rearStream, 'mobile-cam');
    if(pc) rearStream.getTracks().forEach(t=>pc.addTrack(t, rearStream));
    rearTrack = rearStream.getVideoTracks()[0];
    try{ imageCapture = new ImageCapture(rearTrack); }catch{ imageCapture = null; }
  }
  btnRearCam.onclick = startRearCam;

  btnTorch.onclick = async ()=>{
    torch = !torch;
    btnTorch.textContent = torch ? 'Torch OFF' : 'Torch ON';
    if(!rearTrack) return;
    try{
      await rearTrack.applyConstraints({ advanced: [{ torch }] });
    }catch(e){ console.warn('Torch non supportata', e); }
  };

  btnFullscreen.onclick = async ()=>{
    const el = document.documentElement;
    try{ await (el.requestFullscreen?.() || el.webkitRequestFullscreen?.()); }catch{}
  };
  btnLock.onclick = async ()=>{
    try{ await screen.orientation.lock('landscape'); }catch(e){ console.warn('Orientation lock non supportato', e); }
  };

  // Devices list
  async function listCams(){ const devs=await navigator.mediaDevices.enumerateDevices(); const cams=devs.filter(d=>d.kind==='videoinput'); cameraSelect.innerHTML=cams.map(d=>`<option value="${d.deviceId}">${d.label||'Camera'}</option>`).join(''); }
  async function addCam(){ const stream=await navigator.mediaDevices.getUserMedia({video:{deviceId:cameraSelect.value?{exact:cameraSelect.value}:undefined}, audio: micToggle.checked}); addTile(stream); if(pc) stream.getTracks().forEach(t=>pc.addTrack(t,stream)); }
  function addTile(stream,label='locale'){ const wrap=document.createElement('div'); wrap.className='tile'; const v=document.createElement('video'); v.autoplay=true; v.playsInline=true; v.muted=true; v.srcObject=stream; const lb=document.createElement('div'); lb.className='label'; lb.textContent=label; wrap.appendChild(v); wrap.appendChild(lb); videoGrid.appendChild(wrap); }
  async function stopAll(){ $$('#videoGrid video').forEach(v=> v.srcObject && v.srcObject.getTracks().forEach(t=>t.stop())); videoGrid.innerHTML=''; }
  btnAddCam.onclick=addCam; btnStopAll.onclick=stopAll; navigator.mediaDevices?.getUserMedia?.({video:true}).then(()=>listCams());

  // Recorder
  let mediaRecorder, chunks=[];
  $('#btnRec').onclick=()=>{ if(!mediaRecorder || mediaRecorder.state==='inactive'){ const mix=new MediaStream(); $$('#videoGrid video').forEach(v=> v.srcObject && v.srcObject.getTracks().forEach(t=>mix.addTrack(t))); mediaRecorder=new MediaRecorder(mix,{mimeType:'video/webm;codecs=vp9'}); mediaRecorder.ondataavailable=e=>chunks.push(e.data); mediaRecorder.onstop=()=>{ const blob=new Blob(chunks,{type:'video/webm'}); chunks=[]; const url=URL.createObjectURL(blob); const a=$('#downloadRec'); a.href=url; a.download='session.webm'; a.classList.remove('hidden'); a.textContent='Scarica registrazione'; }; mediaRecorder.start(); $('#btnRec').textContent='Ferma Rec'; } else { mediaRecorder.stop(); $('#btnRec').textContent='Avvia Rec'; } };

  // Chat + annotations
  const chatLog=$('#chatLog'), chatInput=$('#chatInput');
  $('#chatSend').onclick=()=>{ sendChat(chatInput.value); chatInput.value=''; };
  function appendChat(msg,who='me'){ const div=document.createElement('div'); div.className='m'; const pfx=who==='me'?'Tu: ':who==='remote'?'Remoto: ':'· '; div.textContent=pfx+msg; chatLog.appendChild(div); chatLog.scrollTop=chatLog.scrollHeight; }
  function sendData(o){ dc?.readyState==='open' && dc.send(JSON.stringify(o)); }
  function sendChat(text){ if(!text) return; appendChat(text,'me'); sendData({t:'chat',text}); }

  // Annotazioni + Laser
  const canvas=$('#annoCanvas'), ctx=canvas.getContext('2d'); let drawing=false, mode='pen';
  const penBtn=$('#pen'), eraserBtn=$('#eraser'), clearBtn=$('#clear'), thick=$('#thick');
  function resizeCanvas(){ canvas.width=canvas.clientWidth; canvas.height=canvas.clientHeight; } window.addEventListener('resize',resizeCanvas); resizeCanvas();
  function drawDot(x,y){ ctx.beginPath(); ctx.arc(x,y, thick.value/2, 0, Math.PI*2); ctx.fillStyle=mode==='pen'?'#2dd4bf':'#0a1330'; ctx.globalCompositeOperation=mode==='pen'?'source-over':'destination-out'; ctx.fill(); }
  function canvasXY(e){ const r=canvas.getBoundingClientRect(); const x=(e.touches?e.touches[0].clientX:e.clientX)-r.left; const y=(e.touches?e.touches[0].clientY:e.clientY)-r.top; return {x,y}; }
  canvas.addEventListener('pointerdown', e=>{ drawing=true; const p=canvasXY(e); drawDot(p.x,p.y); sendData({t:'anno',evt:'down',payload:{x:p.x,y:p.y,mode,th:+thick.value}}); });
  canvas.addEventListener('pointermove', e=>{ if(!drawing)return; const p=canvasXY(e); drawDot(p.x,p.y); sendData({t:'anno',evt:'move',payload:{x:p.x,y:p.y,mode,th:+thick.value}}); });
  window.addEventListener('pointerup', ()=>{ if(drawing){ drawing=false; sendData({t:'anno',evt:'up'})}});
  penBtn.onclick=()=>mode='pen'; eraserBtn.onclick=()=>mode='eraser'; clearBtn.onclick=()=>{ ctx.clearRect(0,0,canvas.width,canvas.height); sendData({t:'anno',evt:'clear'}) };

  const docFrame=$('#docFrame'), filePicker=$('#filePicker');
  const overlay=$('#cursorOverlay'), rCursor=$('#remoteCursor'), lCursor=$('#localCursor');
  let laser=false;
  $('#btnLaser').onclick=()=>{ laser=!laser; $('#btnLaser').textContent=laser?'Laser OFF':'Laser ON'; overlay.style.pointerEvents = laser ? 'auto' : 'none'; lCursor.classList.toggle('hidden', !laser); };
  function posCursor(el, nx, ny){ const rect=$('.docWrap').getBoundingClientRect(); el.style.left = (nx*rect.width)+'px'; el.style.top = (ny*rect.height)+'px'; }
  overlay.addEventListener('pointermove', e=>{ if(!laser) return; const rect=$('.docWrap').getBoundingClientRect(); const nx=(e.clientX-rect.left)/rect.width; const ny=(e.clientY-rect.top)/rect.height; posCursor(lCursor, nx, ny); sendData({t:'cursor', nx, ny}); });
  $('#btnSync').onclick=()=> sendData({t:'docSync', scroll: docFrame.contentWindow?.scrollY || 0});
  $('#btnPdfJs').onclick=()=>{ const url=docFrame.src; const isLocal=url.includes('/docs/')||url.endsWith('sample.pdf'); if(!isLocal){ alert('Per PDF.js usa file in /docs del repo (no blob).'); return; } const viewer='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/web/viewer.html?file='+encodeURIComponent(url); docFrame.src=viewer; appendChat('Aperto con PDF.js (CDN)','sys'); };
  filePicker.onchange=()=>{ const f=filePicker.files[0]; if(!f)return; const url=URL.createObjectURL(f); docFrame.src=url; sendData({t:'doc', name:f.name}); };

  // --- WebRTC (manual / GitHub Issues) ---
  let pc=null, dc=null;
  function createPC(){
    pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}], iceCandidatePoolSize:1});
    pc.ontrack=e=>{ const s=e.streams[0]||new MediaStream([e.track]); addTile(s,'remoto'); };
    pc.ondatachannel=e=>setupDC(e.channel);
    dc=pc.createDataChannel('ra'); setupDC(dc);
    $$('#videoGrid video').forEach(v=> v.srcObject && v.srcObject.getTracks().forEach(t=> pc.addTrack(t, v.srcObject)));
  }
  function setupDC(ch){ dc=ch; dc.onopen=()=>appendChat('(canale dati aperto)','sys'); dc.onmessage=(ev)=>{ try{ const m=JSON.parse(ev.data); if(m.t==='chat') appendChat(m.text,'remote'); if(m.t==='anno'){ if(m.evt==='clear') ctx.clearRect(0,0,canvas.width,canvas.height); if(m.evt==='down'||m.evt==='move'){ const p=m.payload; const prev=mode,th0=thick.value; mode=p.mode; thick.value=p.th; drawDot(p.x,p.y); mode=prev; thick.value=th0; } } if(m.t==='cursor'){ rCursor.classList.remove('hidden'); posCursor(rCursor, m.nx, m.ny); } if(m.t==='docSync'){ /* hook scroll */ } }catch{} }; }
  async function waitIce(pc){ return new Promise(res=>{ if(pc.iceGatheringState==='complete') return res(pc.localDescription); pc.onicegatheringstatechange=()=>{ if(pc.iceGatheringState==='complete') res(pc.localDescription); }; }); }
  async function makeOffer(){ createPC(); const off=await pc.createOffer({offerToReceiveAudio:true,offerToReceiveVideo:true}); await pc.setLocalDescription(off); const sdp=await waitIce(pc); sdpBox.value=JSON.stringify({type:'offer',sdp:sdp.sdp}); }
  async function makeAnswerFromOffer(){ const offer=JSON.parse(sdpBox.value||'{}'); createPC(); await pc.setRemoteDescription(offer); const ans=await pc.createAnswer(); await pc.setLocalDescription(ans); const sdp=await waitIce(pc); sdpBox.value=JSON.stringify({type:'answer', sdp:sdp.sdp}); }
  async function applyAnswer(){ const ans=JSON.parse(sdpBox.value||'{}'); await pc.setRemoteDescription(ans); }
  $('#btnMakeOffer').onclick=makeOffer; $('#btnMakeAnswer').onclick=makeAnswerFromOffer; $('#btnApplyAnswer').onclick=applyAnswer;

  function logGH(s){ ghLog.value+=(s+'\n'); ghLog.scrollTop=ghLog.scrollHeight; }
  async function ghFetch(path, opts={}){ const tok=ghToken.value.trim(); if(!tok) throw new Error('Token mancante'); const r=await fetch('https://api.github.com'+path, {headers:{'Accept':'application/vnd.github+json','Authorization':'Bearer '+tok}, ...opts}); const t=await r.text(); try{ return JSON.parse(t); }catch{ return t; } }
  function repoParts(){ const [owner,repo]=ghRepo.value.split('/'); return {owner,repo}; }
  $('#btnGhStart').onclick=()=> logGH('Issue collegata (client-side).');
  $('#btnGhSend').onclick=async ()=>{ try{ const payload=sdpBox.value.trim(); if(!payload) return; const tag = payload.includes('"type":"offer"') ? '[OFFER]' : '[ANSWER]'; const {owner,repo}=repoParts(); const issue=ghIssue.value.trim(); const res=await ghFetch(`/repos/${owner}/${repo}/issues/${issue}/comments`, {method:'POST', body: JSON.stringify({body: tag+"```json\n"+payload+"\n```"})}); logGH('Inviato '+tag+' id='+ (res.id||'?')); }catch(e){ logGH('Errore: '+e.message); } };
  $('#btnGhPoll').onclick=async ()=>{ try{ const {owner,repo}=repoParts(); const issue=ghIssue.value.trim(); const res=await ghFetch(`/repos/${owner}/${repo}/issues/${issue}/comments`); if(!Array.isArray(res)) return logGH('Errore risposta API'); const last=res[res.length-1]; if(!last) return logGH('Nessun commento.'); const body=last.body||''; const m=body.match(/```json\n([\s\S]*?)\n```/); if(m){ sdpBox.value=m[1]; logGH('Aggiornato da commento '+last.id); } else { logGH('Nessun payload JSON.'); } }catch(e){ logGH('Errore: '+e.message); } };

  btnJoin.onclick=()=>{ btnJoin.disabled=true; btnLeave.disabled=false; };
  btnLeave.onclick=()=>{ pc && pc.close(); pc=null; dc=null; btnJoin.disabled=false; btnLeave.disabled=true; };
})();