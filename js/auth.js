// ── EMERGENCY ESCAPE HATCH ───────────────────────────────────────────────────
// Add ?signout=1 to URL to force sign out regardless of state
if (window.location.search.indexOf('signout=1') !== -1) {
  // Clear all Firebase auth state from localStorage
  Object.keys(localStorage).forEach(function(k) {
    if (k.indexOf('firebase') !== -1) localStorage.removeItem(k);
  });
  // Redirect to clean URL
  window.location.href = window.location.pathname;
}

// Firebase config — safe to be public (security enforced by Firebase rules)
// Admin emails determine who gets admin UI vs canvasser UI
var FIREBASE_CONFIG = {
  apiKey: "AIzaSyAug-z3reeIeiOsMqRWo5SH5l-w7xCz9bA",
  authDomain: "canvas-c4r.firebaseapp.com",
  databaseURL: "https://canvas-c4r-default-rtdb.firebaseio.com",
  projectId: "canvas-c4r",
  storageBucket: "canvas-c4r.firebasestorage.app",
  messagingSenderId: "832444035787",
  appId: "1:832444035787:web:f9aa34afea27015dd0614e",
};

var ADMIN_EMAILS = [
  'campaign@cassie4roseville.com',
];

// Make available globally for app.js
window.FIREBASE_CONFIG = FIREBASE_CONFIG;
window.ADMIN_EMAILS = ADMIN_EMAILS;

// Cassie for Roseville — Field App
// Authentication — Firebase Auth (compat SDK, regular script)

// Wait for Firebase to be ready
function initAuth() {
  if (typeof firebase === 'undefined' || !window.FIREBASE_CONFIG) {
    setTimeout(initAuth, 100);
    return;
  }

  // Initialize Firebase if not already done
  if (!firebase.apps.length) {
    firebase.initializeApp(window.FIREBASE_CONFIG);
  }

  var auth = firebase.auth();
  var googleProvider = new firebase.auth.GoogleAuthProvider();

  // ── ROLE CHECK ──────────────────────────────────────────────────────────────
  function isAdmin(email) {
    return window.ADMIN_EMAILS && window.ADMIN_EMAILS.indexOf(email) !== -1;
  }

  // ── SHOW/HIDE SCREENS ───────────────────────────────────────────────────────
  function showAuthScreen() {
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('admin-screen').style.display = 'none';
    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('app').style.display = 'none';
    var ub = document.getElementById('user-bar');
    if (ub) ub.style.display = 'none';
    clearAuthError();
    var eb = document.getElementById('auth-btn-email');
    var gb = document.getElementById('auth-btn-google');
    if (eb) eb.disabled = false;
    if (gb) gb.disabled = false;
  }

  function showAuthError(msg) {
    var el = document.getElementById('auth-error');
    if (el) el.textContent = msg;
  }

  function clearAuthError() {
    var el = document.getElementById('auth-error');
    if (el) el.textContent = '';
  }

  // ── GOOGLE LOGIN ─────────────────────────────────────────────────────────────
  window.doGoogleLogin = function() {
    clearAuthError();
    var btn = document.getElementById('auth-btn-google');
    if (btn) btn.disabled = true;
    auth.signInWithPopup(googleProvider)
      .catch(function(err) {
        if (btn) btn.disabled = false;
        if (err.code !== 'auth/popup-closed-by-user') {
          showAuthError(friendlyError(err.code));
        }
      });
  };

  // ── EMAIL LOGIN ──────────────────────────────────────────────────────────────
  window.doEmailLogin = function() {
    clearAuthError();
    var email = document.getElementById('auth-email').value.trim();
    var pw = document.getElementById('auth-password').value;
    if (!email || !pw) { showAuthError('Enter your email and password.'); return; }
    var btn = document.getElementById('auth-btn-email');
    if (btn) btn.disabled = true;
    auth.signInWithEmailAndPassword(email, pw)
      .catch(function(err) {
        if (btn) btn.disabled = false;
        showAuthError(friendlyError(err.code));
      });
  };

  // ── SIGN OUT ─────────────────────────────────────────────────────────────────
  window.doSignOut = function() {
    auth.signOut().then(showAuthScreen);
  };

  window.goLogin = window.doSignOut;

  // ── PASSWORD TOGGLE ──────────────────────────────────────────────────────────
  window.toggleAuthPwVisible = function() {
    var inp = document.getElementById('auth-password');
    var btn = document.getElementById('pw-toggle');
    if (!inp) return;
    inp.type = inp.type === 'password' ? 'text' : 'password';
    if (btn) btn.textContent = inp.type === 'password' ? 'Show' : 'Hide';
  };

  // ── AUTH STATE ───────────────────────────────────────────────────────────────
  auth.onAuthStateChanged(function(user) {
    var userBar = document.getElementById('user-bar');
    var nameEl = document.getElementById('user-bar-name');
    if (!user) {
      if (nameEl) nameEl.textContent = 'Not signed in';
      showAuthScreen();
      return;
    }
    // Update user bar immediately — before anything else that could crash
    if (nameEl) nameEl.textContent = (user.displayName || user.email || 'Signed in') + ' — tap Sign Out to switch accounts';

    var email = user.email || '';
    var displayName = user.displayName || email.split('@')[0];
    var admin = isAdmin(email);

    window.currentUser = {
      uid: user.uid,
      email: email,
      displayName: displayName,
      isAdmin: admin
    };

    // Update user bar with role info
    if (nameEl) nameEl.textContent = displayName + ' (' + (admin ? 'Admin' : 'Canvasser') + ') — Sign Out to switch';

    document.getElementById('auth-screen').style.display = 'none';

    try {
      if (admin) {
        if (typeof initFirebaseAdmin === 'function') initFirebaseAdmin();
      } else {
        if (typeof initFirebaseCanvasser === 'function') initFirebaseCanvasser();
      }
    } catch(e) {
      var bar = document.getElementById('debug-bar');
      if (bar) { bar.style.display='block'; bar.textContent='ERROR after login: '+e.message+' (line '+e.lineNumber+')\n'; }
    }
  });

  // ── KEYBOARD ─────────────────────────────────────────────────────────────────
  var pwInput = document.getElementById('auth-password');
  if (pwInput) {
    pwInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') window.doEmailLogin();
    });
  }
}

// ── ERROR MESSAGES ────────────────────────────────────────────────────────────
function friendlyError(code) {
  switch(code) {
    case 'auth/invalid-email':          return 'Invalid email address.';
    case 'auth/user-not-found':         return 'No account found with that email.';
    case 'auth/wrong-password':         return 'Incorrect password.';
    case 'auth/invalid-credential':     return 'Incorrect email or password.';
    case 'auth/too-many-requests':      return 'Too many attempts — try again later.';
    case 'auth/network-request-failed': return 'Network error — check your connection.';
    case 'auth/popup-blocked':          return 'Popup blocked — allow popups for this site.';
    default: return 'Sign-in failed — try again.';
  }
}

// ── IMMEDIATE STUBS — available before Firebase loads ──────────────────────
// These get replaced by real implementations when initAuth() runs
window.doGoogleLogin = function() {
  showInitError('Still loading — try again in a moment.');
};
window.doEmailLogin = function() {
  showInitError('Still loading — try again in a moment.');
};
window.toggleAuthPwVisible = function() {
  var inp = document.getElementById('auth-password');
  var btn = document.getElementById('pw-toggle');
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
  if (btn) btn.textContent = inp.type === 'password' ? 'Show' : 'Hide';
};
window.doSignOut = function() { location.reload(); };
window.goLogin = function() { location.reload(); };

function showInitError(msg) {
  var el = document.getElementById('auth-error');
  if (el) el.textContent = msg;
}

// Wait for all scripts to load then init
window.addEventListener('load', function() {
  if (typeof firebase === 'undefined') {
    var bar = document.getElementById('debug-bar');
    if (bar) { bar.style.display='block'; bar.textContent='ERROR: Firebase SDK failed to load.\n'; }
    return;
  }
  if (!window.FIREBASE_CONFIG) {
    var bar = document.getElementById('debug-bar');
    if (bar) { bar.style.display='block'; bar.textContent='ERROR: config.js not loaded — check file exists in repo.\n'; }
    return;
  }
  initAuth();
});
