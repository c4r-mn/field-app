<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Cassie for Roseville — Field App</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/app.css">
  <script>
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/field-app/sw.js');
    }
  </script>
</head>
<body>
<div id="user-bar" style="display:none;">
  <span id="user-bar-name"></span>
  <div class="user-bar-right">
    <button class="signout-btn" onclick="doSignOut()">Sign Out</button>
  </div>
</div>

<main class="auth-page">
  <div class="auth-card">
    <img src="assets/logo-horizontal.png" alt="Cassie Iverson for Roseville City Council" style="width:100%;max-width:320px;height:auto;margin-bottom:6px;">
    <div class="auth-sub">Field Operations App</div>

    <div id="access-denied" class="auth-denied" style="display:none;">
      You don't have access to this app.<br>Contact the campaign manager.
    </div>

    <div id="auth-form" style="width:100%;display:flex;flex-direction:column;gap:10px;margin-top:4px;">
      <button class="auth-btn-google" id="auth-btn-google" onclick="doGoogleLogin()">
        <svg width="18" height="18" viewBox="0 0 18 18">
          <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
          <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
          <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18z"/>
          <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
        </svg>
        Sign in with Google
      </button>

      <div class="auth-divider">or</div>

      <input class="auth-input" id="auth-email" type="email" placeholder="Email address" autocomplete="email">

      <div class="auth-pw-wrap">
        <input class="auth-input" id="auth-password" type="password" placeholder="Password" autocomplete="current-password">
        <button class="pw-toggle" id="pw-toggle" onclick="toggleAuthPwVisible()">Show</button>
      </div>

      <button class="auth-btn-email" onclick="doEmailLogin()">Sign In</button>
    </div>

    <div id="auth-error" class="auth-msg"></div>
    <div style="font-size:11px;color:var(--subtle);">Cassie Iverson for Roseville City Council 2026</div>
  </div>
</main>

<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js" crossorigin="anonymous"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js" crossorigin="anonymous"></script>
<script src="js/firebase.js"></script>
<script src="js/auth.js"></script>
<script>
  // Check for access denied redirect
  if (window.location.search.indexOf('denied=1') !== -1) {
    document.getElementById('access-denied').style.display = 'block';
    document.getElementById('auth-form').style.display = 'none';
  }
  // Init auth — if already logged in, redirect
  initAuth(
    function(user) { window.location.href = '/field-app/admin/'; },
    function(user) { window.location.href = '/field-app/canvass.html'; }
  );
</script>
</body>
</html>
