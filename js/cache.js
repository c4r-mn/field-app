// Cassie for Roseville — admin read cache
// Door history for finished shifts never changes, so it is downloaded once and
// kept in this browser (IndexedDB). Pages ask for "settled" data through these
// helpers instead of re-downloading whole log trees on every visit.
//   - fbHoodLogs(hood)      all of a neighborhood's logs; only shifts that are
//                            new / open / today are re-fetched
//   - fbGetShiftCached(...) one /hood/<node>/<shiftKey> path, cached when settled
//   - fbGetTTL(path, ms)    short-lived cache for small shared nodes (roster, shifts)
// Any write made through fbPut/fbPatch/fbDelete in this browser drops the
// affected entries. c4rClearCache() wipes everything (the "Refresh" links use it).
var C4R_CACHE_VER = 'v1';
var c4rMem = {};
var c4rDbP = null;

function c4rDb() {
  if (!c4rDbP) c4rDbP = new Promise(function(resolve) {
    try {
      var req = indexedDB.open('c4r-cache', 1);
      req.onupgradeneeded = function() { req.result.createObjectStore('kv'); };
      req.onsuccess = function() { resolve(req.result); };
      req.onerror = function() { resolve(null); };
    } catch (e) { resolve(null); }
  });
  return c4rDbP;
}
function c4rIdb(mode, fn) {
  return c4rDb().then(function(db) {
    if (!db) return null;
    return new Promise(function(resolve) {
      try {
        var tx = db.transaction('kv', mode), st = tx.objectStore('kv');
        var out = fn(st);
        tx.oncomplete = function() { resolve(out && out.result !== undefined ? out.result : null); };
        tx.onerror = tx.onabort = function() { resolve(null); };
      } catch (e) { resolve(null); }
    });
  });
}
function c4rCacheGet(key) {
  if (c4rMem[key]) return Promise.resolve(c4rMem[key]);
  return c4rIdb('readonly', function(st) { return st.get(C4R_CACHE_VER + key); }).then(function(r) {
    if (r) c4rMem[key] = r; return r;
  });
}
function c4rCacheSet(key, v) {
  var rec = {v: v, t: Date.now()};
  c4rMem[key] = rec;
  return c4rIdb('readwrite', function(st) { return st.put(rec, C4R_CACHE_VER + key); });
}
// A write to `path` makes any cached node that contains it, or lives under it, stale.
function c4rCacheInvalidate(path) {
  path = (path || '').split('?')[0].replace(/\/+$/, '');
  function hit(k) { return !path || k.indexOf(path) === 0 || path.indexOf(k) === 0; }
  Object.keys(c4rMem).forEach(function(k) { if (hit(k)) delete c4rMem[k]; });
  return c4rIdb('readwrite', function(st) {
    var req = st.openCursor();
    req.onsuccess = function() {
      var c = req.result; if (!c) return;
      if (hit(String(c.key).slice(C4R_CACHE_VER.length))) c.delete();
      c.continue();
    };
    return req;
  });
}
function c4rClearCache() {
  c4rMem = {};
  return c4rIdb('readwrite', function(st) { return st.clear(); });
}

function fbGetTTL(path, ttlMs) {
  return c4rCacheGet(path).then(function(hit) {
    if (hit && Date.now() - hit.t < ttlMs) return hit.v;
    return fbGet(path).then(function(d) { c4rCacheSet(path, d === undefined ? null : d); return d; });
  });
}

function c4rLocalToday() {
  var d = new Date();
  return d.getFullYear() + '-' + ('0' + (d.getMonth()+1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}
// How long a shift's data may be reused: closed -> 30 days, past -> 12 hours
// (late syncs from a phone are possible), today/future/unknown -> never.
function c4rShiftTTL(shiftKey, days) {
  var day = days && days[shiftKey];
  if (!day) return 0;
  if (day.closed) return 30 * 864e5;
  if (baseShiftDate(shiftKey) < c4rLocalToday() && shiftKey.indexOf('anytime') !== 0) return 12 * 36e5;
  return 0;
}
// `days` = the /canvass-days object the page already loaded.
function fbGetShiftCached(hood, node, shiftKey, days) {
  var path = '/' + hood + '/' + node + '/' + shiftKey, ttl = c4rShiftTTL(shiftKey, days);
  if (!ttl) return fbGet(path);
  return fbGetTTL(path, ttl);
}
// Every shift key under /hood/logs, without downloading any log data.
function fbShiftKeys(hood, node) {
  return fbGet('/' + hood + '/' + node + '?shallow=true').then(function(d) { return d ? Object.keys(d) : []; });
}
// Whole-neighborhood logs shaped like fbGet('/hood/logs'), but settled shifts come from cache.
// Anything not cached is fetched: in one bulk request when many shifts are missing
// (first visit), otherwise shift by shift. Bulk results are split into per-shift
// cache entries so later visits only need the new/open shifts.
function fbHoodLogs(hood, days, maxAgeMs) {
  return fbShiftKeys(hood, 'logs').then(function(keys) {
    keys.sort();   // same order Firebase returns a whole tree, so ties between duplicate entries always resolve the same way
    var out = {}, missing = [];
    return Promise.all(keys.map(function(k) {
      var ttl = c4rShiftTTL(k, days);
      if (ttl && maxAgeMs) ttl = Math.min(ttl, maxAgeMs);
      if (!ttl) { missing.push(k); return null; }
      return c4rCacheGet('/' + hood + '/logs/' + k).then(function(hit) {
        if (hit && Date.now() - hit.t < ttl) { if (hit.v) out[k] = hit.v; } else missing.push(k);
      });
    })).then(function() {
      function ordered() { var o = {}; keys.forEach(function(k){ if (out[k]) o[k] = out[k]; }); return o; }
      if (!missing.length) return ordered();
      if (missing.length > 8) {
        return fbGet('/' + hood + '/logs').then(function(all) {
          all = all || {};
          Object.keys(all).forEach(function(k) {
            out[k] = all[k];
            if (c4rShiftTTL(k, days)) c4rCacheSet('/' + hood + '/logs/' + k, all[k]);
          });
          return ordered();
        });
      }
      return Promise.all(missing.map(function(k) {
        return fbGetShiftCached(hood, 'logs', k, days).then(function(d) { if (d) out[k] = d; });
      })).then(function() { return ordered(); });
    });
  });
}
