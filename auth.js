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
    if (!user) { showAuthScreen(); return; }

    var email = user.email || '';
    var displayName = user.displayName || email.split('@')[0];
    var admin = isAdmin(email);

    window.currentUser = {
      uid: user.uid,
      email: email,
      displayName: displayName,
      isAdmin: admin
    };

    document.getElementById('auth-screen').style.display = 'none';

    if (admin) {
      if (typeof initFirebaseAdmin === 'function') initFirebaseAdmin();
    } else {
      if (typeof initFirebaseCanvasser === 'function') initFirebaseCanvasser();
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
