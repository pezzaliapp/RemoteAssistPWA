// app.js (logic + tutorial + indicator + signaling)
(() => {
  let deferredPrompt; const btnInstall=document.getElementById('btnInstall');
  window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); deferredPrompt=e; btnInstall.hidden=false; });
  btnInstall?.addEventListener('click', ()=>{ deferredPrompt?.prompt(); deferredPrompt=null; btnInstall.hidden=true; });

  const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
  $$('.tab').forEach(b=>b.addEventListener('click', ()=>{ $$('.tab').forEach(t=>t.classList.remove('active')); b.classList.add('active'); $$('.panel').forEach(p=>p.classList.add('hidden')); $('#panel-'+b.dataset.tab).classList.remove('hidden'); }));
  $('#btnHelp').onclick=()=>$('#help').showModal(); $('#closeHelp').onclick=()=>$('#help').close();

  const stdOnly=$('.std-only'), gOnly=$('.glasses-only'), mOnly=$('.mobile-only');
  $$('.mode').forEach(btn=>btn.addEventListener('click', ()=>{
    $$('.mode').forEach(b=>b.classList.remove('active')); btn.classList.add('active');
    const m = btn.dataset.mode;
    stdOnly.classList.toggle('hidden', m!=='standard'); gOnly.classList.toggle('hidden', m!=='glasses'); mOnly.classList.toggle('hidden', m!=='mobile');
  }));

  const cameraSelect=$('#cameraSelect'), videoGrid=$('#videoGrid'), micToggle=$('#micToggle');
  const btnAddCam=$('#btnAddCam'), btnStopAll=$('#btnStopAll');
  const btnJoin=$('#btnJoin'), btnLeave=$('#btnLeave'); const sdpBox=$('#sdpBox');
  const ghRepo=$('#ghRepo'), ghIssue=$('#ghIssue'), ghToken=$('#ghToken'), ghLog=$('#ghLog');
  const live=$('.live-indicator');

  async function listCams(){ const devs=await navigator.mediaDevices.enumerateDevices(); const cams=devs.filter(d=>d.kind==='videoinput'); if(cameraSelect) cameraSelect.innerHTML=cams.map(d=>`<option value="${d.deviceId}">${d.label||'Camera'}</option>`).join(''); }
  async function addCam(){ const stream=await navigator.mediaDevices.getUserMedia({video:{deviceId:cameraSelect.value?{exact:cameraSelect.value}:undefined}, audio: micToggle?.checked}); addTile(stream); if(pc) stream.getTracks().forEach(t=>pc.addTrack(t,stream)); }
  function addTile(stream,label='locale'){ const wrap=document.createElement('div'); wrap.className='tile'; const v=document.createElement('video'); v.autoplay=true; v.playsInline=true; v.muted=true; v.srcObject=stream; const lb=document.createElement('div'); lb.className='label'; lb.textContent=label; wrap.appendChild(v); wrap.appendChild(lb); videoGrid.appendChild(wrap); }
  async function stopAll(){ $$('#videoGrid video').forEach(v=> v.srcObject && v.srcObject.getTracks().forEach(t=>t.stop())); videoGrid.innerHTML=''; }
  btnAddCam?.addEventListener('click', addCam); btnStopAll?.addEventListener('click', stopAll); navigator.mediaDevices?.getUserMedia?.({video:true}).then(()=>listCams());

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

  // Mobile cam specifics
  const btnRearCam=$('#btnRearCam'), btnTorch=$('#btnTorch'), btnFullscreen=$('#btnFullscreen'), btnLock=$('#btnLock');
  let rearStream=null, rearTrack=null, torch=false;
  async function startRearCam(){
    try{
      rearStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:{exact:'environment'}, width:{ideal:1280}, height:{ideal:720}, frameRate:{ideal:30} }, audio: micToggle?.checked });
    }catch{
      rearStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment', width:{ideal:1280}, height:{ideal:720} }, audio: micToggle?.checked });
    }
    addTile(rearStream,'mobile-cam'); if(pc) rearStream.getTracks().forEach(t=>pc.addTrack(t, rearStream));
    rearTrack = rearStream.getVideoTracks()[0];
  }
  btnRearCam?.addEventListener('click', startRearCam);
  btnTorch?.addEventListener('click', async ()=>{ torch=!torch; btnTorch.textContent=torch?'Torch OFF':'Torch ON'; if(!rearTrack) return; try{ await rearTrack.applyConstraints({advanced:[{torch}]}); }catch(e){} });
  btnFullscreen?.addEventListener('click', async ()=>{ const el=document.documentElement; try{ await (el.requestFullscreen?.()||el.webkitRequestFullscreen?.()); }catch{} });
  btnLock?.addEventListener('click', async ()=>{ try{ await screen.orientation.lock('landscape'); }catch(e){} });

  // Smart Glasses specifics
  const btBtn=$('#btnBtBattery'), btStatus=$('#btStatus'), audioOut=$('#audioOut'), applySink=$('#applySink'), sinkInfo=$('#sinkInfo');
  let sinkReady=false;
  async function loadSinks(){ if(!navigator.mediaDevices?.enumerateDevices){ sinkInfo.textContent='Uscita audio: enumerateDevices non disponibile.'; return; } const list=await navigator.mediaDevices.enumerateDevices(); const outs=list.filter(d=>d.kind==='audiooutput'); if(audioOut) audioOut.innerHTML = outs.map(d=>`<option value="${d.deviceId}">${d.label||'Uscita audio'}</option>`).join(''); sinkReady = ('setSinkId' in HTMLMediaElement.prototype); if(sinkInfo) sinkInfo.textContent = sinkReady ? 'Puoi selezionare un’uscita audio compatibile (non iOS).' : 'Cambio uscita non supportato su questo browser.'; }
  loadSinks();
  applySink?.addEventListener('click', ()=>{ if(!sinkReady){ alert('Cambio uscita non supportato su questo browser.'); return; } const id=audioOut.value; $$('#videoGrid video').forEach(v=>{ if(v.setSinkId) try{ v.setSinkId(id); }catch(e){} }); });
  btBtn?.addEventListener('click', async ()=>{ try{ const dev=await navigator.bluetooth.requestDevice({acceptAllDevices:true, optionalServices:['battery_service','device_information']}); if(btStatus) btStatus.textContent='Connesso a '+(dev.name||'device'); const server=await dev.gatt.connect(); try{ const svc=await server.getPrimaryService('battery_service'); const ch=await svc.getCharacteristic('battery_level'); const val=await ch.readValue(); const lvl=val.getUint8(0); if(btStatus) btStatus.textContent+=' — Batteria: '+lvl+'%'; }catch{ if(btStatus) btStatus.textContent+=' — Batteria non esposta'; } dev.ongattserverdisconnected=()=> btStatus && (btStatus.textContent='Disconnesso'); }catch(e){ btStatus && (btStatus.textContent='Connessione fallita o non supportata'); } });

  // WebRTC core + GitHub Issues signaling
  let pc=null, dc=null;
  function createPC(){ pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}], iceCandidatePoolSize:1}); pc.ontrack=e=>{ const s=e.streams[0]||new MediaStream([e.track]); addTile(s,'remoto'); }; pc.ondatachannel=e=>setupDC(e.channel); dc=pc.createDataChannel('ra'); setupDC(dc); $$('#videoGrid video').forEach(v=> v.srcObject && v.srcObject.getTracks().forEach(t=> pc.addTrack(t, v.srcObject))); }
  function setupDC(ch){ dc=ch; dc.onopen=()=>{appendChat('(canale dati aperto)','sys'); live?.classList.remove('idle');}; dc.onclose=()=>{live?.classList.add('idle');}; dc.onmessage=(ev)=>{ try{ const m=JSON.parse(ev.data); if(m.t==='chat') appendChat(m.text,'remote'); if(m.t==='anno'){ if(m.evt==='clear') ctx.clearRect(0,0,canvas.width,canvas.height); if(m.evt==='down'||m.evt==='move'){ const p=m.payload; const prev=mode,th0=thick.value; mode=p.mode; thick.value=p.th; drawDot(p.x,p.y); mode=prev; thick.value=th0; } } if(m.t==='cursor'){ $('#remoteCursor').classList.remove('hidden'); const nx=m.nx,ny=m.ny; const rect=$('.docWrap').getBoundingClientRect(); $('#remoteCursor').style.left=(nx*rect.width)+'px'; $('#remoteCursor').style.top=(ny*rect.height)+'px'; } if(m.t==='docSync'){ /* hook scroll */ } }catch{} }; }
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

  // Tutorial overlay
  const tourEl=$('#tour'), tourStep=$('.tour-step'), tourPrev=$('#tourPrev'), tourNext=$('#tourNext'), tourClose=$('#tourClose'), btnTutorial=$('#btnTutorial'), btnStartInHelp=$('#startTour');
  const highlight=document.createElement('div'); highlight.className='tour-highlight'; tourEl.appendChild(highlight);
  const steps=[
    {sel:'.modes', text:'Scegli la modalità: Standard, Smart Glasses o Mobile Cam.'},
    {sel:'.tab[data-tab="signal"]', text:'Vai nella tab “Segnaling” per stabilire la connessione.'},
    {sel:'#btnMakeOffer', text:'Tecnico: premi “Genera Offerta” e copia il JSON.'},
    {sel:'#sdpBox', text:'Incolla qui l’offerta (Esperto) oppure la risposta (Tecnico).'},
    {sel:'#btnMakeAnswer', text:'Esperto: “Crea Risposta da Offerta”, poi inviala al Tecnico.'},
    {sel:'#btnApplyAnswer', text:'Tecnico: “Applica Risposta” — la connessione sarà stabilita.'},
    {sel:'#btnLaser', text:'Usa il Laser per indicare i dettagli sul documento condiviso.'}
  ];
  let idx=0;
  function placeHighlight(target){ const r=target.getBoundingClientRect(); highlight.style.left=(r.left-6)+'px'; highlight.style.top=(r.top-6)+'px'; highlight.style.width=(r.width+12)+'px'; highlight.style.height=(r.height+12)+'px'; const pop=$('.tour-pop'); const px=Math.min(window.innerWidth-380, Math.max(16, r.right+16)); const py=Math.min(window.innerHeight-160, Math.max(16, r.top)); pop.style.left=px+'px'; pop.style.top=py+'px'; }
  function showStep(i){ idx=i; const s=steps[idx]; const target=document.querySelector(s.sel); if(!target){ tourStep.textContent='Step non disponibile su questo device. Prosegui.'; } else { placeHighlight(target); tourStep.textContent=s.text; } tourEl.classList.remove('hidden'); }
  function next(){ if(idx<steps.length-1) showStep(idx+1); else tourEl.classList.add('hidden'); }
  function prev(){ if(idx>0) showStep(idx-1); }
  $('#tourNext').addEventListener('click', next); $('#tourPrev').addEventListener('click', prev); $('#tourClose').addEventListener('click', ()=>tourEl.classList.add('hidden'));
  btnTutorial.addEventListener('click', ()=>showStep(0)); btnStartInHelp?.addEventListener('click', ()=>{ $('#help').close(); showStep(0); });
})();