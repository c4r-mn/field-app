// Cassie for Roseville — Field App
// Firebase helpers — shared across all pages

var fbBase = '';
var fbConnected = false;

function setFbBase() {
  fbBase = (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.databaseURL) || '';
}

function fbFetch(path, opts) {
  // Every request must carry the signed-in user's ID token as ?auth=...
  // or Firebase's REST API treats it as anonymous — this was previously
  // missing entirely, which worked only because old test-mode rules didn't
  // check auth status at all. Real rules require this.
  var user = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth().currentUser : null;
  var tokenPromise = user ? user.getIdToken(false) : Promise.resolve(null);

  // Safety timeout — if getIdToken() ever stalls (seen intermittently on
  // some mobile/network conditions), don't hang the whole app forever
  // with no error. Fall back to an unauthenticated request after 8s so
  // the request at least resolves (and fails cleanly) instead of hanging.
  var timeoutPromise = new Promise(function(resolve) {
    setTimeout(function() { resolve(null); }, 8000);
  });

  return Promise.race([tokenPromise, timeoutPromise]).then(function(token) {
    var url = fbBase + path + '.json';
    if (token) {
      url += (url.indexOf('?') === -1 ? '?' : '&') + 'auth=' + encodeURIComponent(token);
    }
    return fetch(url, opts || {});
  });
}
function fbGet(path) {
  return fbFetch(path).then(function(r) { return r.json(); });
}
function fbPut(path, data) {
  return fbFetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}
function fbPatch(path, data) {
  return fbFetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
// A calendar date can now have more than one shift on it — the first shift
// on 2026-10-15 is keyed "2026-10-15" same as always, but a second (or
// third...) shift created on that same date gets "2026-10-15__2",
// "2026-10-15__3", etc. so each shift still gets its own fully independent
// /canvass-days entry (and its own /assignments, /logs, /buckets
// namespace per neighborhood — exactly like anytime-<timestamp> shifts
// already get their own namespace). Anywhere that needs the actual
// calendar date out of a shift key — for display, or for day-vs-day
// comparisons — strips that suffix first with this helper.
function baseShiftDate(dateStr) {
  if (!dateStr) return dateStr;
  var m = /^(\d{4}-\d{2}-\d{2})__\d+$/.exec(dateStr);
  return m ? m[1] : dateStr;
}
function formatDate(dateStr) {
  if (dateStr && dateStr.indexOf('anytime') === 0) return 'No Specific Date';
  var d = new Date(baseShiftDate(dateStr) + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
function formatDateLong(dateStr) {
  if (dateStr && dateStr.indexOf('anytime') === 0) return 'No Specific Date';
  var d = new Date(baseShiftDate(dateStr) + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
