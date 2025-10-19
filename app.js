// Remote Assist — MultiCam (GitHub‑Only) — app.js v1.1
(() => {
  // PWA prompt
  let deferredPrompt; const btnInstall = document.getElementById('btnInstall');
  window.addEventListener('beforeinstallprompt', (e)=>{ e.preventDefault(); deferredPrompt = e; btnInstall.hidden=false; });
  btnInstall?.addEventListener('click', async ()=>{ deferredPrompt?.prompt(); deferredPrompt=null; btnInstall.hidden=true; });

  const $ = s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
  $$('.tab').forEach(b=>b.addEventListener('click', ()=>{
    $$('.tab').forEach(t=>t.classList.remove('active')); b.classList.add('active');
    $$('.panel').forEach(p=>p.classList.add('hidden')); $('#panel-'+b.dataset.tab).classList.remove('hidden');
  }));
  $('#btnHelp').onclick = ()=> $('#help').showModal(); $('#closeHelp').onclick = ()=> $('#help').close();

  const cameraSelect=$('#cameraSelect'), videoGrid=$('#videoGrid'), micToggle=$('#micToggle');
  const btnAddCam=$('#btnAddCam'), btnStopAll=$('#btnStopAll');
  const btnJoin=$('#btnJoin'), btnLeave=$('#btnLeave');
  const roleSel=$('#role'), sigModeSel=$('#sigMode');
  const sdpBox=$('#sdpBox');
  const ghBox=$('#ghBox'), ghRepo=$('#ghRepo'), ghIssue=$('#ghIssue'), ghToken=$('#ghToken');
  const ghLog=$('#ghLog'); const ghState = {connected:false,lastETag:null};

  sigModeSel.addEventListener('change', ()=>{
    if(sigModeSel.value==='github') ghBox.classList.remove('hidden'); else ghBox.classList.add('hidden');
  });

  // Persist GitHub fields locally
  [ghRepo, ghIssue, ghToken].forEach(el=>{
    const k='ra_'+el.id; if(localStorage[k]) el.value=localStorage[k];
    el.addEventListener('input', ()=> localStorage[k]=el.value);
  });

  // Media devices
  async function listCams(){
    const devs=await navigator.mediaDevices.enumerateDevices();
    const cams=devs.filter(d=>d.kind==='videoinput');
    cameraSelect.innerHTML = cams.map(d=>`<option value="${d.deviceId}">${d.label||'Camera'}</option>`).join('');
  }
  async function addCam(){
    const stream=await navigator.mediaDevices.getUserMedia({video:{deviceId:cameraSelect.value?{exact:cameraSelect.value}:undefined}, audio: micToggle.checked});
    addTile(stream);
    if(pc) stream.getTracks().forEach(t=>pc.addTrack(t, stream));
  }
  function addTile(stream,label='locale'){
    const wrap=document.createElement('div'); wrap.className='tile';
    const v=document.createElement('video'); v.autoplay=true; v.playsInline=true; v.muted=true; v.srcObject=stream;
    const lb=document.createElement('div'); lb.className='label'; lb.textContent=label;
    wrap.appendChild(v); wrap.appendChild(lb); videoGrid.appendChild(wrap);
  }
  async function stopAll(){
    $$('#videoGrid video').forEach(v=> v.srcObject && v.srcObject.getTracks().forEach(t=>t.stop()));
    videoGrid.innerHTML='';
  }
  btnAddCam.onclick=addCam; btnStopAll.onclick=stopAll;
  navigator.mediaDevices?.getUserMedia?.({video:true}).then(()=>listCams());

  // Recorder
  let mediaRecorder, chunks=[];
  $('#btnRec').onclick = ()=>{
    if(!mediaRecorder || mediaRecorder.state==='inactive'){
      const mix = new MediaStream();
      $$('#videoGrid video').forEach(v=> v.srcObject && v.srcObject.getTracks().forEach(t=> mix.addTrack(t)));
      mediaRecorder = new MediaRecorder(mix, { mimeType: 'video/webm;codecs=vp9' });
      mediaRecorder.ondataavailable = e => chunks.push(e.data);
      mediaRecorder.onstop = ()=>{
        const blob = new Blob(chunks, {type:'video/webm'}); chunks=[];
        const url = URL.createObjectURL(blob); const a = $('#downloadRec');
        a.href=url; a.download='session.webm'; a.classList.remove('hidden'); a.textContent='Scarica registrazione';
      };
      mediaRecorder.start(); $('#btnRec').textContent='Ferma Rec';
    } else { mediaRecorder.stop(); $('#btnRec').textContent='Avvia Rec'; }
  };

  // Chat + annotations over DataChannel
  const chatLog=$('#chatLog'), chatInput=$('#chatInput');
  $('#chatSend').onclick = ()=>{ sendChat(chatInput.value); chatInput.value=''; };
  const canvas=$('#annoCanvas'), ctx=canvas.getContext('2d'); let drawing=false, mode='pen';
  const penBtn=$('#pen'), eraserBtn=$('#eraser'), clearBtn=$('#clear'), thick=$('#thick');
  function resizeCanvas(){ canvas.width=canvas.clientWidth; canvas.height=canvas.clientHeight; }
  window.addEventListener('resize', resizeCanvas); resizeCanvas();
  function drawDot(x,y){ ctx.beginPath(); ctx.arc(x,y, thick.value/2, 0, Math.PI*2); ctx.fillStyle=mode==='pen'?'#2dd4bf':'#0a1330'; ctx.globalCompositeOperation=mode==='pen'?'source-over':'destination-out'; ctx.fill(); }
  function canvasXY(e){ const r=canvas.getBoundingClientRect(); const x=(e.touches?e.touches[0].clientX:e.clientX)-r.left; const y=(e.touches?e.touches[0].clientY:e.clientY)-r.top; return {x,y}; }
  canvas.addEventListener('pointerdown', e=>{ drawing=true; const p=canvasXY(e); drawDot(p.x,p.y); sendAnno('down',{x:p.x,y:p.y,mode,th:+thick.value}); });
  canvas.addEventListener('pointermove', e=>{ if(!drawing)return; const p=canvasXY(e); drawDot(p.x,p.y); sendAnno('move',{x:p.x,y:p.y,mode,th:+thick.value}); });
  window.addEventListener('pointerup', ()=>{ if(drawing){ drawing=false; sendAnno('up',{});} });
  penBtn.onclick=()=> mode='pen'; eraserBtn.onclick=()=> mode='eraser'; clearBtn.onclick=()=>{ ctx.clearRect(0,0,canvas.width,canvas.height); sendAnno('clear',{}); };
  $('#btnAnnoShare').onclick=()=>{ canvas.toBlob(b=>{ const r=new FileReader(); r.onload=()=> sendAnno('image',{data:r.result}); r.readAsDataURL(b); }); };

  const docFrame=$('#docFrame'), filePicker=$('#filePicker');
  filePicker.onchange = ()=>{ const f=filePicker.files[0]; if(!f)return; const url=URL.createObjectURL(f); docFrame.src=url; sendData({t:'doc',name:f.name}); };
  $('#btnSync').onclick = ()=> sendData({t:'docSync', scroll: docFrame.contentWindow?.scrollY||0});

  // --- WebRTC without dedicated server (manual or GitHub Issues signaling) ---
  let pc=null, dc=null, isExpert=false;

  function createPC(){
    pc = new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}], iceCandidatePoolSize:1});
    pc.ontrack = e=>{ const stream=e.streams[0]||new MediaStream([e.track]); addTile(stream,'remoto'); };
    pc.ondatachannel = e=> setupDC(e.channel);
    dc = pc.createDataChannel('ra'); setupDC(dc);
    $$('#videoGrid video').forEach(v=> v.srcObject && v.srcObject.getTracks().forEach(t=> pc.addTrack(t, v.srcObject)));
  }
  function setupDC(channel){
    dc = channel;
    dc.onopen = ()=> appendChat('(canale dati aperto)','sys');
    dc.onmessage = (ev)=>{
      try{
        const msg = JSON.parse(ev.data);
        if(msg.t==='chat') appendChat(msg.text,'remote');
        if(msg.t==='anno'){ if(msg.evt==='clear') ctx.clearRect(0,0,canvas.width,canvas.height);
          if(msg.evt==='down'||msg.evt==='move'){ const m=msg.payload; const prev=mode, prevTh=thick.value; mode=m.mode; thick.value=m.th; drawDot(m.x,m.y); mode=prev; thick.value=prevTh; } }
        if(msg.t==='doc'){ /* hook */ }
        if(msg.t==='docSync'){ /* hook */ }
      }catch{}
    };
  }
  function appendChat(msg, who='me'){ const div=document.createElement('div'); div.className='m'; const pfx=who==='me'?'Tu: ':who==='remote'?'Remoto: ':'· '; div.textContent=pfx+msg; chatLog.appendChild(div); chatLog.scrollTop=chatLog.scrollHeight; }
  function sendData(obj){ dc?.readyState==='open' && dc.send(JSON.stringify(obj)); }
  function sendChat(text){ if(!text)return; appendChat(text,'me'); sendData({t:'chat',text}); }

  async function makeOffer(){
    createPC();
    const offer = await pc.createOffer({offerToReceiveAudio:true, offerToReceiveVideo:true});
    await pc.setLocalDescription(offer);
    const sdp = await waitForIceGatheringComplete(pc);
    sdpBox.value = JSON.stringify({type:'offer', sdp:sdp.sdp});
  }
  async function makeAnswerFromOffer(){
    const offer = JSON.parse(sdpBox.value||'{}');
    createPC();
    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    const sdp = await waitForIceGatheringComplete(pc);
    sdpBox.value = JSON.stringify({type:'answer', sdp:sdp.sdp});
  }
  async function applyAnswer(){
    const ans = JSON.parse(sdpBox.value||'{}');
    await pc.setRemoteDescription(ans);
  }
  function waitForIceGatheringComplete(pc){
    return new Promise(res=>{
      if(pc.iceGatheringState==='complete') return res(pc.localDescription);
      pc.onicegatheringstatechange = ()=>{ if(pc.iceGatheringState==='complete'){ res(pc.localDescription); } };
    });
  }

  $('#btnMakeOffer').onclick = makeOffer;
  $('#btnMakeAnswer').onclick = makeAnswerFromOffer;
  $('#btnApplyAnswer').onclick = applyAnswer;

  // GitHub Issues signaling (beta): post/poll comments as offer/answer blobs
  async function ghFetch(path, opts={}){
    const tok = ghToken.value.trim(); if(!tok) throw new Error('Token mancante');
    const r = await fetch('https://api.github.com'+path, {headers:{'Accept':'application/vnd.github+json','Authorization':'Bearer '+tok}, ...opts});
    const txt = await r.text(); try{ return JSON.parse(txt); }catch{ return txt; }
  }
  function logGH(s){ ghLog.value += (s+'\n'); ghLog.scrollTop=ghLog.scrollHeight; }
  function repoParts(){ const [owner,repo]=ghRepo.value.split('/'); return {owner,repo}; }
  async function ghStart(){ const {owner,repo}=repoParts(); const issue=ghIssue.value.trim(); logGH('Connessione a '+owner+'/'+repo+' #'+issue); ghState.connected=true; }
  async function ghSend(){
    if(!ghState.connected) return logGH('Non connesso.');
    const payload = sdpBox.value.trim(); if(!payload) return;
    const tag = payload.includes('\"type\":\"offer\"') || payload.includes('"type":"offer"') ? '[OFFER]' : '[ANSWER]';
    const {owner,repo}=repoParts(); const issue=ghIssue.value.trim();
    const res = await ghFetch(`/repos/${owner}/${repo}/issues/${issue}/comments`, {method:'POST', body: JSON.stringify({body: tag+'```json\n'+payload+'\n```'})});
    logGH('Inviato: '+tag+' id='+res.get('id','?'));
  }
  async function ghPoll(){
    if(!ghState.connected) return logGH('Non connesso.');
    const {owner,repo}=repoParts(); const issue=ghIssue.value.trim();
    const res = await ghFetch(`/repos/${owner}/${repo}/issues/${issue}/comments`);
    const arr = Array.isArray(res)?res:[];
    const last = arr.slice(-1)[0]; if(!last) return logGH('Nessun commento.');
    const body = last.get? last.get('body','') : last.get('body') if false else last.get if false else None
  }
  $('#btnGhStart').onclick = ghStart;
  $('#btnGhSend').onclick = ghSend;
  $('#btnGhPoll').onclick = async ()=>{
    try{
      const {owner,repo}=repoParts(); const issue=ghIssue.value.trim();
      const res = await ghFetch(`/repos/${owner}/${repo}/issues/${issue}/comments`);
      if(!Array.isArray(res)) return logGH('Errore: risposta inattesa');
      const last = res[res.length-1]; if(!last) return logGH('Nessun commento.');
      const body = last.body||'';
      const m = body.match(/```json\n([\s\S]*?)\n```/);
      if(m){ sdpBox.value = m[1]; logGH('Ricevuto aggiornamento dal commento '+last.id); } else { logGH('Nessun payload JSON trovato.'); }
    }catch(e){ logGH('Errore: '+e.message); }
  };

  btnJoin.onclick = async ()=>{ isExpert = (roleSel.value==='expert'); btnJoin.disabled=true; btnLeave.disabled=false; };
  btnLeave.onclick = ()=>{ pc && pc.close(); pc=null; dc=null; btnJoin.disabled=false; btnLeave.disabled=true; };

})();