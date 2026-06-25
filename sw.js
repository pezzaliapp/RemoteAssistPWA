// sw.js — cache-first con fallback rete + versioning serio
const CACHE='pezzaliapp-remoteassist-v2';
const ASSETS=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest',
  './icons/icon-192.png','./icons/icon-512.png','./icons/pezzaliAPP-logo.svg',
  './docs/sample.pdf','./docs/bg.jpg','./docs/guida.html'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{
  e.waitUntil(
    // Cancella SOLO le cache con nome diverso da quella corrente (versioning serio).
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
    // NB: nessun c.navigate() dei client — il reload è gestito lato pagina su 'controllerchange'.
  );
});
self.addEventListener('fetch',e=>{
  // Gestisci solo le richieste GET; le altre passano direttamente alla rete.
  if(e.request.method!=='GET') return;
  // Cache-first con fallback rete.
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});
