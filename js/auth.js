// Cassie for Roseville — Field App
// Auth module — loaded on every page

// ── EMERGENCY SIGNOUT ────────────────────────────────────────────────────────
if (window.location.search.indexOf('signout=1') !== -1) {
  Object.keys(localStorage).forEach(function(k) {
    if (k.indexOf('firebase') !== -1) localStorage.removeItem(k);
  });
  window.location.href = '/field-app/';
}

var FIREBASE_CONFIG = null;
var ADMIN_EMAILS = [];
var _authReady = false;
var _currentUser = null;

// ── STUBS (replaced once Firebase loads) ─────────────────────────────────────
window.doEmailLogin = function() { showAuthMsg('Loading… please wait'); };
window.doSignOut = function() {
  Object.keys(localStorage).forEach(function(k) {
    if (k.indexOf('firebase') !== -1) localStorage.removeItem(k);
  });
  window.location.href = '/field-app/';
};
window.toggleAuthPwVisible = function() {
  var inp = document.getElementById('auth-password');
  var btn = document.getElementById('pw-toggle');
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
  if (btn) btn.textContent = inp.type === 'password' ? 'Show' : 'Hide';
};

function showAuthMsg(msg, isError) {
  var el = document.getElementById('auth-error') || document.getElementById('auth-msg');
  if (el) {
    el.textContent = msg;
    el.style.color = isError ? '#c0392b' : '#6b6860';
  }
}

// ── INIT ─────────────────────────────────────────────────────────────────────
function initAuth(onAdmin, onCanvasser) {
  if (typeof firebase === 'undefined') { setTimeout(function(){ initAuth(onAdmin, onCanvasser); }, 100); return; }

  showAuthMsg('Loading configuration…');

  fetch('/field-app/config.json?v=' + Date.now())
    .then(function(r) {
      if (!r.ok) throw new Error('config.json not found (status ' + r.status + ')');
      return r.json();
    })
    .then(function(cfg) {
      FIREBASE_CONFIG = cfg.firebase;
      ADMIN_EMAILS = cfg.adminEmails || [];
      window.FIREBASE_CONFIG = FIREBASE_CONFIG;
      window.ADMIN_EMAILS = ADMIN_EMAILS;
      if (typeof setFbBase === 'function') setFbBase();
      showAuthMsg('');
      startFirebase(onAdmin, onCanvasser);
    })
    .catch(function(e) {
      showAuthMsg('Config error: ' + e.message, true);
    });
}

function startFirebase(onAdmin, onCanvasser) {
  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  _authReady = true;

  var auth = firebase.auth();

  // Explicitly force LOCAL persistence (survives page navigations and
  // browser restarts) rather than relying on Firebase's default. Some
  // mobile browser contexts — especially in-app browsers opened from
  // Messages/Mail/etc — handle default persistence inconsistently, which
  // can cause a real, successful sign-in to silently vanish on the very
  // next page navigation.
  try {
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function(e) {
      console.warn('setPersistence rejected, continuing with default:', e);
    });
  } catch (e) {
    console.warn('setPersistence threw synchronously, continuing with default:', e);
  }

  window.doEmailLogin = function() {
    var email = (document.getElementById('auth-email') || {}).value || '';
    var pw = (document.getElementById('auth-password') || {}).value || '';
    if (!email || !pw) { showAuthMsg('Enter your email and password.', true); return; }
    showAuthMsg('Signing in…');
    auth.signInWithEmailAndPassword(email.trim(), pw.trim()).catch(function(e) {
      // TEMPORARY DIAGNOSTIC — impossible-to-miss popup version.
      alert('SIGN-IN ERROR\n\nCode: ' + e.code + '\n\nMessage: ' + e.message);
      showAuthMsg(friendlyError(e.code), true);
    });
  };

  window.doSignOut = function() {
    auth.signOut().then(function() {
      window.location.href = '/field-app/';
    });
  };

  // Auth state
  // Firebase can fire this callback once with a transient null before it
  // finishes checking persisted login state, then fire again shortly after
  // with the real signed-in user — this shows up mostly on mobile, where
  // storage reads are slower. Acting on that first null bounces someone
  // who is actually still validly signed in, causing a redirect loop.
  // Fix: don't redirect away on null until we've seen auth settle at least
  // once, and give one grace check before treating it as a real sign-out.
  var authSeenOnce = false;
  var pendingNullRedirect = null;
  var rosterCheckedFor = null; // uid we've already completed a roster check for — prevents a duplicate/racy second check from overriding a correct first result

  auth.onAuthStateChanged(function(user) {
    updateUserBar(user);

    if (!user) {
      if (pendingNullRedirect) clearTimeout(pendingNullRedirect);
      var alreadyOnLogin = window.location.pathname === '/field-app/' || window.location.pathname === '/field-app/index.html';
      if (alreadyOnLogin) { authSeenOnce = true; return; }

      if (!authSeenOnce) {
        // First callback ever and it's null — could be the transient
        // pre-restore state. Wait briefly for a possible follow-up
        // callback with the real user before redirecting away.
        pendingNullRedirect = setTimeout(function() {
          if (!auth.currentUser) window.location.href = '/field-app/';
        }, 1800);
        authSeenOnce = true;
        return;
      }

      window.location.href = '/field-app/';
      return;
    }

    authSeenOnce = true;
    if (pendingNullRedirect) { clearTimeout(pendingNullRedirect); pendingNullRedirect = null; }

    var email = user.email || '';
    if (!email) {
      auth.signOut();
      window.location.href = '/field-app/?denied=1&email=(no+email+returned+by+Google)';
      return;
    }
    var isAdmin = ADMIN_EMAILS.map(function(e){return (e||'').toLowerCase();}).indexOf(email.toLowerCase()) !== -1;
    _currentUser = { uid: user.uid, email: email, displayName: user.displayName || email.split('@')[0], isAdmin: isAdmin };
    window.currentUser = _currentUser;

    // Check roster access for canvassers
    if (!isAdmin) {
      if (rosterCheckedFor === user.uid) return; // already resolved this sign-in, ignore duplicate firing
      rosterCheckedFor = user.uid;
      if (typeof setFbBase === 'function') setFbBase();
      var targetEmail = email.trim().toLowerCase();
      fbGet('/roster').then(function(roster) {
        var found = false;
        if (roster && typeof roster === 'object') {
          Object.values(roster).forEach(function(v) {
            if (!v) return;
            var rawEmail = v.email || v.Email || v.EMAIL || '';
            if (rawEmail && rawEmail.trim().toLowerCase() === targetEmail) found = true;
          });
        }
        if (!found) {
          auth.signOut();
          window.location.href = '/field-app/?denied=1&email='+encodeURIComponent(email);
          return;
        }
        if (typeof onCanvasser === 'function') onCanvasser(_currentUser);
        else if (!window.location.pathname.includes('/canvass')) window.location.href = '/field-app/canvass.html';
      }).catch(function() {
        if (typeof onCanvasser === 'function') onCanvasser(_currentUser);
      });
    } else {
      if (typeof onAdmin === 'function') onAdmin(_currentUser);
      else if (!window.location.pathname.includes('/admin')) window.location.href = '/field-app/admin/index.html';
    }
  });

  // Keyboard
  var pwInput = document.getElementById('auth-password');
  if (pwInput) pwInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') window.doEmailLogin(); });
}

function updateUserBar(user) {
  var bar = document.getElementById('user-bar');
  var name = document.getElementById('user-bar-name');
  if (!bar) return;
  if (!user) { bar.style.display = 'none'; return; }
  bar.style.display = 'flex';
  if (name) name.textContent = (user.displayName || user.email || '');
}

function friendlyError(code) {
  var map = {
    'auth/invalid-email': 'Invalid email address.',
    'auth/user-not-found': 'No account found with that email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/too-many-requests': 'Too many attempts — try again later.',
    'auth/network-request-failed': 'Network error — check your connection.',
    'auth/popup-blocked': 'Popup blocked — allow popups for this site.',
  };
  return map[code] || 'Sign-in failed — try again.';
}
