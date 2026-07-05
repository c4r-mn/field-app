// Cassie for Roseville — Field App Service Worker
var CACHE = 'c4r-v3';
var STATIC = [
  '/field-app/',
  '/field-app/index.html',
  '/field-app/canvass.html',
  '/field-app/admin/',
  '/field-app/admin/index.html',
  '/field-app/admin/shifts.html',
  '/field-app/admin/shift.html',
  '/field-app/admin/roster.html',
  '/field-app/admin/field.html',
  '/field-app/css/app.css',
  '/field-app/js/app.js',
  '/field-app/js/auth.js',
  '/field-app/js/firebase.js',
  '/field-app/js/data.js',
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) { return c.addAll(STATIC); })
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
  // Only handle http/https requests
  if (!e.request.url.startsWith('http')) return;
  // Never cache Firebase, Google, or config
  if (e.request.url.indexOf('firebase') !== -1 ||
      e.request.url.indexOf('google') !== -1 ||
      e.request.url.indexOf('config.json') !== -1) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      return cached || fetch(e.request).then(function(resp) {
        var clone = resp.clone();
        caches.open(CACHE).then(function(c){ c.put(e.request, clone); });
        return resp;
      });
    }).catch(function() {
      return caches.match('/field-app/');
    })
  );
});
