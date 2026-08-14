/* Oneiratory service worker.
   Network-first so pages always stay fresh online (no stale-cache surprises);
   the cache is only a fallback so the app still opens offline. */
var CACHE = 'oneiratory-v1';
var CORE = ['/', '/index.html', '/oneiratory.css', '/favicon.svg', '/icon.svg', '/apple-touch-icon.png', '/manifest.webmanifest'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(CORE).catch(function () {}); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;                 // never intercept API writes
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;  // only our own origin
  if (url.pathname.indexOf('/api/') === 0) return;  // the API always hits the network
  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.status === 200 && res.type === 'basic') {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (m) { return m || caches.match('/index.html'); });
    })
  );
});
