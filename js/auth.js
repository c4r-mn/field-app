// Cassie for Roseville — Field App
// Authentication module — Firebase Auth with Email/Password and Google

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

// Initialize Firebase
const app = initializeApp(window.FIREBASE_CONFIG);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Expose auth instance globally so app.js can use it
window.firebaseApp = app;
window.firebaseAuth = auth;

// ── ROLE CHECK ────────────────────────────────────────────────────────────────
function isAdmin(email) {
  return window.ADMIN_EMAILS && window.ADMIN_EMAILS.indexOf(email) !== -1;
}

// ── LOGIN SCREEN ──────────────────────────────────────────────────────────────
function showLoginScreen() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('admin-screen').style.display = 'none';
  document.getElementById('setup-screen').style.display = 'none';
  document.getElementById('app').style.display = 'none';
  document.getElementById('auth-error').textContent = '';
}

function showAuthError(msg) {
  var el = document.getElementById('auth-error');
  if (el) el.textContent = msg;
}

// ── EMAIL/PASSWORD LOGIN ──────────────────────────────────────────────────────
window.doEmailLogin = function() {
  var email = document.getElementById('auth-email').value.trim();
  var pw = document.getElementById('auth-password').value;
  if (!email || !pw) { showAuthError('Enter your email and password.'); return; }
  document.getElementById('auth-btn-email').disabled = true;
  signInWithEmailAndPassword(auth, email, pw)
    .then(function(result) {
      // onAuthStateChanged handles the rest
    })
    .catch(function(err) {
      document.getElementById('auth-btn-email').disabled = false;
      showAuthError(friendlyAuthError(err.code));
    });
};

// ── GOOGLE LOGIN ──────────────────────────────────────────────────────────────
window.doGoogleLogin = function() {
  document.getElementById('auth-btn-google').disabled = true;
  signInWithPopup(auth, googleProvider)
    .then(function(result) {
      // onAuthStateChanged handles the rest
    })
    .catch(function(err) {
      document.getElementById('auth-btn-google').disabled = false;
      if (err.code !== 'auth/popup-closed-by-user') {
        showAuthError(friendlyAuthError(err.code));
      }
    });
};

// ── SIGN OUT ──────────────────────────────────────────────────────────────────
window.doSignOut = function() {
  signOut(auth).then(function() {
    showLoginScreen();
  });
};

// ── PASSWORD VISIBILITY ───────────────────────────────────────────────────────
window.toggleAuthPwVisible = function() {
  var inp = document.getElementById('auth-password');
  var btn = document.getElementById('pw-toggle');
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
  if (btn) btn.textContent = inp.type === 'password' ? 'Show' : 'Hide';
};

// ── AUTH STATE LISTENER ───────────────────────────────────────────────────────
onAuthStateChanged(auth, function(user) {
  // Reset button states
  var eb = document.getElementById('auth-btn-email');
  var gb = document.getElementById('auth-btn-google');
  if (eb) eb.disabled = false;
  if (gb) gb.disabled = false;

  if (!user) {
    showLoginScreen();
    return;
  }

  var email = user.email || '';
  var displayName = user.displayName || email.split('@')[0];
  var admin = isAdmin(email);

  // Store globally for app.js to use
  window.currentUser = { uid: user.uid, email: email, displayName: displayName, isAdmin: admin };

  // Hide auth screen
  document.getElementById('auth-screen').style.display = 'none';

  if (admin) {
    // Admin — go straight to admin screen
    if (typeof initFirebaseAdmin === 'function') initFirebaseAdmin();
  } else {
    // Canvasser — go to setup screen
    if (typeof initFirebaseCanvasser === 'function') initFirebaseCanvasser();
  }
});

// ── ERROR MESSAGES ────────────────────────────────────────────────────────────
function friendlyAuthError(code) {
  switch(code) {
    case 'auth/invalid-email':       return 'Invalid email address.';
    case 'auth/user-not-found':      return 'No account found with that email.';
    case 'auth/wrong-password':      return 'Incorrect password.';
    case 'auth/invalid-credential':  return 'Incorrect email or password.';
    case 'auth/too-many-requests':   return 'Too many attempts. Try again later.';
    case 'auth/network-request-failed': return 'Network error. Check your connection.';
    default: return 'Sign-in failed. Try again.';
  }
}

// ── KEYBOARD SHORTCUT ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  var pwInput = document.getElementById('auth-password');
  if (pwInput) {
    pwInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') window.doEmailLogin();
    });
  }
});
