// Cassie for Roseville — Field App Service Worker
var CACHE = 'c4r-v13';

// Only precache truly static assets — HTML is always network-first below,
// so precaching it here just adds a fragile install-time dependency.
var STATIC = [
  '/field-app/css/app.css',
  '/field-app/js/app.js',
  '/field-app/js/auth.js',
  '/field-app/js/firebase.js',
  '/field-app/js/data.js',
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) {
      return c.addAll(STATIC).catch(function(err) {
        // Don't let one failed asset kill the whole install
        console.warn('SW precache warning:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  if (!e.request.url.startsWith('http')) return;
  if (e.request.url.indexOf('firebase') !== -1 ||
      e.request.url.indexOf('google') !== -1 ||
      e.request.url.indexOf('config.json') !== -1) {
    return;
  }

  var isHtml = e.request.mode === 'navigate' ||
    e.request.url.endsWith('.html') || e.request.url.endsWith('/');

  if (isHtml) {
    // Always go to network for HTML — never serve stale pages
    e.respondWith(
      fetch(e.request).catch(function() {
        return caches.match(e.request).then(function(r) {
          return r || caches.match('/field-app/');
        });
      })
    );
    return;
  }

  // JS/CSS: cache-first, refresh in background
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      var fetchPromise = fetch(e.request).then(function(resp) {
        var clone = resp.clone();
        caches.open(CACHE).then(function(c){ c.put(e.request, clone); });
        return resp;
      }).catch(function(){ return cached; });
      return cached || fetchPromise;
    })
  );
});
