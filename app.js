// app.js — PATCH: Sync affidabile, PDF.js chiaro, tasto Esci
(() => {
  let deferredPrompt; const btnInstall=document.getElementById('btnInstall');
  window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); deferredPrompt=e; btnInstall && (btnInstall.hidden=false); });
  btnInstall && btnInstall.addEventListener('click', ()=>{ try{ deferredPrompt?.prompt(); }finally{ deferredPrompt=null; btnInstall.hidden=true; } });

  const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
  const live=$('.live-indicator');

  // Tabs
  $$('.tab').forEach(b=>b.addEventListener('click', ()=>{ $$('.tab').forEach(t=>t.classList.remove('active')); b.classList.add('active'); $$('.panel').forEach(p=>p.classList.add('hidden')); $('#panel-'+b.dataset.tab).classList.remove('hidden'); }));

  // Mode switch
  const stdOnly=$('.std-only'), gOnly=$('.glasses-only'), mOnly=$('.mobile-only');
  $$('.mode').forEach(btn=>btn.addEventListener('click', ()=>{ $$('.mode').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); const m=btn.dataset.mode; stdOnly?.classList.toggle('hidden', m!=='standard'); gOnly?.classList.toggle('hidden', m!=='glasses'); mOnly?.classList.toggle('hidden', m!=='mobile'); }));

  // Devices (come prima, abbreviato)
  const cameraSelect=$('#cameraSelect'), videoGrid=$('#videoGrid'), micToggle=$('#micToggle');
  const btnAddCam=$('#btnAddCam'), btnStopAll=$('#btnStopAll');
  async function listCams(){ try{ const devs=await navigator.mediaDevices.enumerateDevices(); const cams=devs.filter(d=>d.kind==='videoinput'); if(cameraSelect) cameraSelect.innerHTML=cams.map(d=>`<option value="${d.deviceId}">${d.label||'Camera'}</option>`).join(''); }catch{} }
  async function addCam(){ const stream=await navigator.mediaDevices.getUserMedia({video:{deviceId:cameraSelect?.value?{exact:cameraSelect.value}:undefined}, audio: micToggle?.checked}); addTile(stream); if(pc) stream.getTracks().forEach(t=>pc.addTrack(t,stream)); }
  function addTile(stream,label='locale'){ const wrap=document.createElement('div'); wrap.className='tile'; const v=document.createElement('video'); v.autoplay=true; v.playsInline=true; v.muted=true; v.srcObject=stream; const lb=document.createElement('div'); lb.className='label'; lb.textContent=label; wrap.appendChild(v); wrap.appendChild(lb); videoGrid?.appendChild(wrap); }
  async function stopAll(){ $$('#videoGrid video').forEach(v=> v.srcObject && v.srcObject.getTracks().forEach(t=>t.stop())); if(videoGrid) videoGrid.innerHTML=''; }
  btnAddCam?.addEventListener('click', addCam); btnStopAll?.addEventListener('click', stopAll); navigator.mediaDevices?.getUserMedia?.({video:true}).then(()=>listCams());

  // Chat
  const chatLog=$('#chatLog'), chatInput=$('#chatInput');
  $('#chatSend')?.addEventListener('click', ()=>{ sendChat(chatInput.value); chatInput.value=''; });
  function appendChat(msg,who='me'){ const d=document.createElement('div'); d.className='m'; const pfx=who==='me'?'Tu: ':who==='remote'?'Remoto: ':'· '; d.textContent=pfx+msg; chatLog?.appendChild(d); chatLog&&(chatLog.scrollTop=chatLog.scrollHeight); }
  function sendData(o){ try{ dc?.readyState==='open' && dc.send(JSON.stringify(o)); }catch{} }
  function sendChat(text){ if(!text) return; appendChat(text,'me'); sendData({t:'chat',text}); }

  // Annotazioni (già patchate in precedenza) – lasciate intatte
  // ... (omesso per brevità: mantieni la tua versione funzionante) ...

  // Documenti + Laser + Sync
  const docFrame=$('#docFrame'), filePicker=$('#filePicker');
  const overlay=$('#cursorOverlay'), lCursor=$('#localCursor');
  let laser=false;
  $('#btnLaser')?.addEventListener('click', ()=>{ laser=!laser; $('#btnLaser').textContent=laser?'Laser OFF':'Laser ON'; overlay && (overlay.style.pointerEvents = laser?'auto':'none'); lCursor?.classList.toggle('hidden', !laser); });
  function posCursor(el, nx, ny){ const rect=$('.docWrap').getBoundingClientRect(); el.style.left=(nx*rect.width)+'px'; el.style.top=(ny*rect.height)+'px'; }
  overlay?.addEventListener('pointermove', e=>{ if(!laser) return; const rect=$('.docWrap').getBoundingClientRect(); const nx=(e.clientX-rect.left)/rect.width; const ny=(e.clientY-rect.top)/rect.height; posCursor(lCursor, nx, ny); sendData({t:'cursor', nx, ny}); });

  // PDF.js (usa viewer Mozilla). Nota: i blob locali NON possono essere letti da un viewer su dominio esterno.
  $('#btnPdfJs')?.addEventListener('click', ()=>{
    const url = docFrame?.src || '';
    if(!url){ return appendChat('Nessun documento aperto','sys'); }
    if(url.startsWith('blob:')){
      return appendChat('PDF.js esterno non può aprire un file locale (blob). Carica il PDF in /docs o usa un URL pubblico, poi riprova.', 'sys');
    }
    const viewer = 'https://mozilla.github.io/pdf.js/web/viewer.html?file=' + encodeURIComponent(url);
    docFrame.src = viewer;
    appendChat('Aperto con PDF.js (Mozilla viewer)','sys');
  });

  // File picker: carica e invia URL al remoto (se connessi)
  filePicker && (filePicker.onchange=()=>{ const f=filePicker.files[0]; if(!f)return; const url=URL.createObjectURL(f); if(docFrame) docFrame.src=url; sendData({t:'docOpen', url}); });

  // ---- Sync vista → remoto ----
  const btnSync = document.getElementById('btnSync');
  btnSync && btnSync.addEventListener('click', ()=>{
    if(!dc || dc.readyState!=='open'){ appendChat('Non connesso: apri la tab Segnaling e collega un partner.', 'sys'); return; }
    const url = docFrame?.src || '';
    if(!url){ appendChat('Nessun documento da sincronizzare.', 'sys'); return; }
    if(url.startsWith('blob:')){ appendChat('Sync richiede un URL web. Carica il PDF in /docs della repo o incolla un URL pubblico, poi premi Sync.', 'sys'); return; }
    sendData({t:'docOpen', url});
    appendChat('Sync inviato ✓', 'sys');
  });

  // ---- WebRTC core (ridotto) + hook per ricevere docOpen/cursor ----
  let pc=null, dc=null;
  function createPC(){ pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]}); pc.ontrack=e=>{ const s=e.streams[0]||new MediaStream([e.track]); addTile(s,'remoto'); }; pc.ondatachannel=e=>setupDC(e.channel); dc=pc.createDataChannel('ra'); setupDC(dc); $$('#videoGrid video').forEach(v=> v.srcObject && v.srcObject.getTracks().forEach(t=> pc.addTrack(t, v.srcObject))); }
  function setupDC(ch){ dc=ch; ch.onopen=()=>{ appendChat('(canale dati aperto)','sys'); live?.classList.remove('idle'); }; ch.onclose=()=>{ live?.classList.add('idle'); }; ch.onmessage=(ev)=>{ try{ const m=JSON.parse(ev.data); if(m.t==='chat') appendChat(m.text,'remote'); if(m.t==='docOpen'){ if(docFrame) docFrame.src=m.url; appendChat('Documento sincronizzato dal remoto', 'sys'); } if(m.t==='cursor'){ /* opzionale: potresti mostrare un puntatore remoto qui */ } }catch{} }; if(window.__setupDC__) window.__setupDC__(ch); }
  async function waitIce(pc){ return new Promise(res=>{ if(pc.iceGatheringState==='complete') return res(pc.localDescription); pc.onicegatheringstatechange=()=>{ if(pc.iceGatheringState==='complete') res(pc.localDescription); }; }); }
  const sdpBox=$('#sdpBox');
  async function makeOffer(){ createPC(); const off=await pc.createOffer({offerToReceiveAudio:true,offerToReceiveVideo:true}); await pc.setLocalDescription(off); const sdp=await waitIce(pc); sdpBox.value=JSON.stringify({type:'offer',sdp:sdp.sdp}); }
  async function makeAnswerFromOffer(){ const offer=JSON.parse(sdpBox.value||'{}'); createPC(); await pc.setRemoteDescription(offer); const ans=await pc.createAnswer(); await pc.setLocalDescription(ans); const sdp=await waitIce(pc); sdpBox.value=JSON.stringify({type:'answer', sdp:sdp.sdp}); }
  async function applyAnswer(){ const ans=JSON.parse(sdpBox.value||'{}'); await pc.setRemoteDescription(ans); }
  document.getElementById('btnMakeOffer')?.addEventListener('click', makeOffer);
  document.getElementById('btnMakeAnswer')?.addEventListener('click', makeAnswerFromOffer);
  document.getElementById('btnApplyAnswer')?.addEventListener('click', applyAnswer);

  // ---- Esci dalla sessione ----
  function leaveSession(){
    try{ dc && dc.close(); }catch{}
    try{ pc && pc.close(); }catch{}
    pc=null; dc=null; live?.classList.add('idle');
    stopAll();
    appendChat('Hai lasciato la sessione.', 'sys');
  }
  // Collega al bottone con id="btnLeave" (aggiungi l'id a "Esci" in index.html)
  document.getElementById('btnLeave')?.addEventListener('click', leaveSession);

  // ---- GitHub Issues utility (invariata e opzionale) ----
  const ghRepo=$('#ghRepo'), ghIssue=$('#ghIssue'), ghToken=$('#ghToken'), ghLog=$('#ghLog');
  function logGH(s){ ghLog && (ghLog.value+=(s+'\n'), ghLog.scrollTop=ghLog.scrollHeight); }
  async function ghFetch(path, opts={}){ const tok=ghToken?.value?.trim(); if(!tok) throw new Error('Token mancante'); const r=await fetch('https://api.github.com'+path, {headers:{'Accept':'application/vnd.github+json','Authorization':'Bearer '+tok}, ...opts}); const t=await r.text(); try{ return JSON.parse(t); }catch{ return t; } }
  function repoParts(){ const [owner,repo]=(ghRepo?.value||'').split('/'); return {owner,repo}; }
  document.getElementById('btnGhStart')?.addEventListener('click', ()=> logGH('Issue collegata (client-side).'));
  document.getElementById('btnGhSend')?.addEventListener('click', async ()=>{ try{ const payload=sdpBox.value.trim(); if(!payload) return; const tag = payload.includes('\"type\":\"offer\"') ? '[OFFER]' : '[ANSWER]'; const {owner,repo}=repoParts(); const issue=ghIssue.value.trim(); const res=await ghFetch(f'/repos/{owner}/{repo}/issues/{issue}/comments', {method:'POST', body: JSON.stringify({body: tag+\"```json\\n\"+payload+\"\\n```\"})}); logGH('Inviato '+tag+' id='+(res.id||'?')); }catch(e){ logGH('Errore: '+e.message); } });
  document.getElementById('btnGhPoll')?.addEventListener('click', async ()=>{ try{ const {owner,repo}=repoParts(); const issue=ghIssue.value.trim(); const res=await ghFetch(f'/repos/{owner}/{repo}/issues/{issue}/comments'); if(!Array.isArray(res)) return logGH('Errore risposta API'); const last=res[res.length-1]; if(!last) return logGH('Nessun commento.'); const body=last.body||''; const m=body.match(/```json\\n([\\s\\S]*?)\\n```/); if(m){ sdpBox.value=m[1]; logGH('Aggiornato da commento '+last.id); } else { logGH('Nessun payload JSON.'); } }catch(e){ logGH('Errore: '+e.message); } });
})();