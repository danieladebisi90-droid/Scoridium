/* Scoridium PWA — intentionally conservative.
   Only the offline fallback and icons are cached. Game data, HTML, CSS,
   JS, auth and Supabase responses are never cached by this service worker. */
const CACHE = 'scoridium-pwa-shell-v43r2';
const STATIC = 'scoridium-pwa-static-v43r2';
const SHELL = ['./offline.html', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
self.addEventListener('install', event => {
  event.waitUntil(Promise.all([caches.open(CACHE).then(cache => cache.addAll(SHELL)),caches.open(STATIC)]));
  self.skipWaiting();
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
  if(parsed.origin===self.location.origin && req.mode!=='navigate' &&
     /\.(?:css|js|png|svg|webp|woff2?)(?:$|\?)/i.test(parsed.pathname) &&
     !/supabase-config|auth/i.test(parsed.pathname)){
    event.respondWith(caches.open(STATIC).then(async cache=>{
      const cached=await cache.match(req);
      const network=fetch(req).then(response=>{
        if(response.ok && response.type==='basic')cache.put(req,response.clone()).catch(()=>{});
        return response;
      }).catch(()=>cached);
      return cached||network;
    }));return;
  }
  if(req.mode !== 'navigate' || req.method !== 'GET') return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin) return;
  // Always request fresh pages. An offline fallback is not a working game tracker.
  event.respondWith(fetch(req).catch(() => caches.match('./offline.html')));
});

self.addEventListener('message', event => {if(event.data?.type==='SKIP_WAITING') self.skipWaiting();});
