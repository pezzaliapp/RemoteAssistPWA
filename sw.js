// sw.js — auto-refresh on activate
const CACHE='pezzaliapp-remoteassist-v1';
const ASSETS=['./','./index.html','./styles.css
','./app.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/pezzaliAPP-logo.svg','./docs/sample.pdf','./docs/bg.jpg','./docs/guida.html'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
      .then(()=>self.clients.matchAll())
      .then(clients=>clients.forEach(c=>c.navigate(c.url)))
  );
});
self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))})
