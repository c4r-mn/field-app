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

  return tokenPromise.then(function(token) {
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
function formatDate(dateStr) {
  var d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
function formatDateLong(dateStr) {
  var d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
