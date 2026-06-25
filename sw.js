// sw.js — network-first per l'app-shell (aggiornamenti immediati), cache come fallback offline.
// Il vecchio cache-first congelava CSS/JS: un fix pushato non arrivava mai al dispositivo.
const CACHE='pezzaliapp-remoteassist-v3';
const ASSETS=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest',
  './icons/icon-192.png','./icons/icon-512.png','./icons/pezzaliAPP-logo.svg',
  './docs/sample.pdf','./docs/bg.jpg','./docs/guida.html'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET') return;                 // solo GET
  const url=new URL(req.url);
  if(url.origin!==location.origin) return;        // CDN esterne (pdf.js, office, github) -> rete diretta

  // Network-first: prendi la versione fresca quando c'è rete (aggiornamenti immediati),
  // aggiorna la cache, e usa la cache solo se offline.
  e.respondWith(
    fetch(req).then(res=>{
      const copy=res.clone();
      caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{});
      return res;
    }).catch(()=> caches.match(req).then(r=> r || caches.match('./index.html')))
  );
});
