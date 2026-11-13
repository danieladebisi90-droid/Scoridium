/* Scoridium PWA — intentionally conservative.
   Only the offline fallback and icons are cached. Game data, HTML, CSS,
   JS, auth and Supabase responses are never cached by this service worker. */
const CACHE = 'scoridium-pwa-shell-v44-1';
const STATIC = 'scoridium-pwa-static-v44-1';
const SHELL = ['./offline.html', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
self.addEventListener('install', event => {
  event.waitUntil(Promise.all([caches.open(CACHE).then(cache => cache.addAll(SHELL)),caches.open(STATIC)]));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('scoridium-pwa-') && k !== CACHE && k !== STATIC).map(k => caches.delete(k)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch', event => {
  const req=event.request;
  if(req.method!=='GET')return;
  const parsed=new URL(req.url);
  // Network-first for versioned app assets: do not serve an obsolete JS/CSS
  // file after the user explicitly installs an update. Offline cached fallback only.
  if(parsed.origin===self.location.origin && req.mode!=='navigate' &&
     /\.(?:css|js|png|svg|webp|woff2?)(?:$|\?)/i.test(parsed.pathname) &&
     !/supabase-config|auth/i.test(parsed.pathname)){
    // Network-first: an older cache must never mask a newly deployed JS/CSS file.
    event.respondWith(caches.open(STATIC).then(async cache => {
      try { const response=await fetch(req,{cache:'no-store'}); if(response.ok && response.type==='basic')await cache.put(req,response.clone());return response; }
      catch(e) { const cached=await cache.match(req);if(cached)return cached;throw e; }
    }));return;
  }
  if(req.mode !== 'navigate' || req.method !== 'GET') return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin) return;
  // Always request fresh pages. An offline fallback is not a working game tracker.
  event.respondWith(fetch(req,{cache:'no-store'}).catch(() => caches.match('./offline.html')));
});

self.addEventListener('message', event => {if(event.data?.type==='SKIP_WAITING') self.skipWaiting();});
