/* Scoridium PWA — intentionally conservative.
   Only the offline fallback and icons are cached. Game data, HTML, CSS,
   JS, auth and Supabase responses are never cached by this service worker. */
const CACHE = 'scoridium-pwa-shell-v2';
const SHELL = ['./offline.html', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('scoridium-pwa-') && k !== CACHE).map(k => caches.delete(k)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch', event => {
  const req=event.request;
  if(req.mode !== 'navigate' || req.method !== 'GET') return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin) return;
  // Always request fresh pages. An offline fallback is not a working game tracker.
  event.respondWith(fetch(req).catch(() => caches.match('./offline.html')));
});

self.addEventListener('message', event => {if(event.data?.type==='SKIP_WAITING') self.skipWaiting();});
