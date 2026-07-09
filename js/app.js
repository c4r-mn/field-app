// Cassie for Roseville — Field App
// Main application logic


var PROP_META = {
  house:     { label:'House',            color:'#27ae60', callout:null },
  apartment: { label:'Apartment',        color:'#2563eb', callout:{cls:'apartment',icon:'🏢',text:'Apartment building — coordinate with management before knocking.'} },
  senior:    { label:'55+ Community',    color:'#d97706', callout:{cls:'senior',icon:'🏛',text:'55+ community — call residents or management before visiting.'} },
  mobile:    { label:'Mobile Home Park', color:'#7c3aed', callout:{cls:'mobile',icon:'🏘',text:'Mobile home park — coordinate with park management first.'} },
  assisted:  { label:'Assisted Living',  color:'#e67e22', callout:{cls:'assisted',icon:'🏥',text:'Assisted living — call before any visit.'} },
};

var CONTACT_COLORS = {
  'Not Home':'#64748b','Vacant':'#475569','For Sale':'#7c3aed',
  'No Soliciting':'#92400e','Refused':'#c0392b',
  'Accepted':'#27ae60','Other Language':'#2563eb',
};

var CANVASSER_COLORS = ['#2563eb','#7c3aed','#0891b2','#dc2626','#ea580c','#db2777','#059669','#ca8a04'];

// ── GLOBAL STATE ──────────────────────────
var isAdmin = false;
var fbConnected = false;
var fbBase = '';
// fbBase gets set when auth completes (see initFirebaseAdmin / initFirebaseCanvasser)

// ── FIREBASE INIT ─────────────────────────────────────────────────────────
function initFirebaseAdmin() {
  setFbBase();
  fbGet('/.json?shallow=true')
    .then(function(){
      fbConnected = true;
      loadRoster().then(function(){
        loadCanvassDays().then(function(){
          showAdminScreen();
        });
      });
    })
    .catch(function(){ showToast('Firebase offline — check connection'); showAdminScreen(); });
}

function initFirebaseCanvasser() {
  setFbBase();
  var ss=document.getElementById('setup-screen');
  if(ss) ss.style.display='flex';
  document.getElementById('setup-loading').style.display='block';
  document.getElementById('setup-fields').style.display='none';
  document.getElementById('setup-btn').disabled = true;

  fbGet('/.json?shallow=true')
    .then(function(){
      fbConnected = true;
      return Promise.all([loadRoster(), loadCanvassDays()]);
    })
    .then(function(){
      document.getElementById('setup-loading').style.display='none';
      document.getElementById('setup-fields').style.display='flex';
      buildSetupSelects();
    })
    .catch(function(e){
      document.getElementById('setup-loading').textContent='Could not connect — check your internet connection.';
    });
}


function initFirebase() {
  // Called from canvasser app to reconnect
  fbGet('/.json?shallow=true')
    .then(function(){
      fbConnected=true;
      var dot=document.getElementById('fb-dot'), lbl=document.getElementById('fb-lbl');
      if(dot) dot.style.background='#27ae60';
      if(lbl) lbl.textContent='Syncing live';
      if(pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(pullCanvasserData, 15000);
      pullCanvasserData();
    })
    .catch(function(){
      var dot=document.getElementById('fb-dot'), lbl=document.getElementById('fb-lbl');
      if(dot) dot.style.background='#c0392b';
      if(lbl) lbl.textContent='Offline — saving locally';
    });
}

// ── ROSTER ────────────────────────────────
function loadRoster() {
  return fbGet('/roster').then(function(d){
    if (d && typeof d==='object' && Object.keys(d).length > 0) {
      roster = d;
    } else {
      // First run — seed from INITIAL_ROSTER
      roster = {};
      var promises = INITIAL_ROSTER.map(function(v){
        var id = genId();
        roster[id] = {name:v.name, status:v.status, added:todayKey};
        return fbPut('/roster/'+id, roster[id]);
      });
      return Promise.all(promises);
    }
  }).catch(function(){ roster = {}; });
}

function loadCanvassDays() {
  return fbGet('/canvass-days').then(function(d){
    canvassDays = (d && typeof d==='object') ? d : {};
  }).catch(function(){ canvassDays = {}; });
}

// ── ROSTER MANAGEMENT ─────────────────────
function showAdminScreen() {
  document.getElementById('admin-screen').style.display='flex';
  buildNewDayHoodSelect();
  renderNewDayVolunteers();
  renderRoster();
  renderDaysList();
  buildAssignDaySelect();
  buildAssignCanvasserSelect();
  setTimeout(function(){ if(!adminMap) initAdminMap(); }, 300);
  setupRailHighlight();
}

function setupRailHighlight() {
  var content = document.getElementById('admin-content');
  if (!content) return;
  var sections = ['section-roster','section-days','section-assign'];
  content.addEventListener('scroll', function() {
    var scrollTop = content.scrollTop + 80;
    var active = sections[0];
    sections.forEach(function(id) {
      var el = document.getElementById(id);
      if (el && el.offsetTop <= scrollTop) active = id;
    });
    document.querySelectorAll('.rail-link').forEach(function(a) {
      a.classList.toggle('active', a.getAttribute('href') === '#'+active);
    });
    // Init map when assign section scrolls into view
    if (active === 'section-assign' && !adminMap) {
      setTimeout(function() { initAdminMap(); }, 100);
    }
  });
  var first = document.querySelector('.rail-link');
  if (first) first.classList.add('active');
}

function renderRoster() {
  var list = document.getElementById('roster-list');
  if (!list) return;
  var vols = Object.entries(roster).sort(function(a,b){return a[1].name.localeCompare(b[1].name);});
  if (!vols.length) {
    list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--subtle);font-size:13px;">No volunteers yet.</div>';
    return;
  }
  list.innerHTML = vols.map(function(pair){
    var id = pair[0], v = pair[1];
    var inactive = v.status === 'inactive';
    return '<div class="roster-item' + (inactive ? ' inactive' : '') + '" id="ri-' + id + '">' +
      '<div class="roster-avatar' + (inactive ? ' inactive-av' : '') + '">' + v.name.charAt(0).toUpperCase() + '</div>' +
      '<div class="roster-info">' +
        '<div class="roster-name" id="rn-' + id + '">' + v.name + '</div>' +
        '<div class="roster-status">' + (inactive ? 'Inactive' : 'Active') + '</div>' +
      '</div>' +
      '<div class="roster-actions" id="ra-' + id + '">' +
        '<button class="r-btn" data-id="' + id + '" onclick="startEditVol(this.dataset.id)">Edit</button>' +
        '<button class="r-btn r-danger" data-id="' + id + '" onclick="handleToggleVol(this.dataset.id)">' + (inactive ? 'Reactivate' : 'Deactivate') + '</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function startEditVol(id) {
  var v = roster[id]; if (!v) return;
  var nameEl = document.getElementById('rn-' + id);
  var actionsEl = document.getElementById('ra-' + id);
  if (!nameEl || !actionsEl) return;
  nameEl.innerHTML = '<input class="roster-edit-input" id="rei-' + id + '" type="text" value="' + v.name.replace(/"/g,'&quot;') + '">';
  actionsEl.innerHTML =
    '<button class="r-btn r-save" data-id="' + id + '" onclick="saveInlineEdit(this.dataset.id)">Save</button>' +
    '<button class="r-btn r-cancel" onclick="renderRoster()">Cancel</button>';
  var inp = document.getElementById('rei-' + id);
  if (inp) { inp.focus(); inp.select(); }
}

function saveInlineEdit(id) {
  var inp = document.getElementById('rei-' + id);
  if (!inp) return;
  var newName = inp.value.trim();
  if (!newName) { showToast('Name cannot be empty'); return; }
  var oldName = roster[id] ? roster[id].name : '';
  roster[id].name = newName;
  fbPatch('/roster/' + id, {name: newName}).then(function(){
    return updateVolNameInLogs(id, oldName, newName);
  }).then(function(){
    renderRoster();
    buildAssignCanvasserSelect();
    showToast('Updated to ' + newName);
  }).catch(function(err){
    showToast('Save failed: ' + (err && err.message ? err.message : 'check connection'));
    console.error('saveAssignments error:', err);
  });
}


function addVolunteer() {
  var input = document.getElementById('new-vol-name');
  var name = input.value.trim();
  if (!name) return;
  var id = genId();
  roster[id] = {name:name, status:'active', added:todayKey};
  fbPut('/roster/'+id, roster[id]).then(function(){
    input.value='';
    renderRoster();
    buildAssignCanvasserSelect();
    showToast('Added '+name);
  }).catch(function(err){
    showToast('Save failed: ' + (err && err.message ? err.message : 'check connection'));
    console.error('saveAssignments error:', err);
  });
}

// openEditVol/saveVolunteerEdit replaced by startEditVol inline

function updateVolNameInLogs(volId, oldName, newName) {
  // Fetch all logs, find entries with canvasser matching oldName, update them
  return fbGet('/').then(function(allData){
    if (!allData) return;
    var updates = {};
    CONFIG.neighborhoods.forEach(function(n){
      var hoodData = allData[n.key];
      if (!hoodData || !hoodData.logs) return;
      Object.entries(hoodData.logs).forEach(function(dayPair){
        var date=dayPair[0], dayLogs=dayPair[1];
        if (!dayLogs) return;
        Object.entries(dayLogs).forEach(function(volPair){
          var vKey=volPair[0], vLogs=volPair[1];
          if (!vLogs) return;
          Object.entries(vLogs).forEach(function(logPair){
            var addrId=logPair[0], log=logPair[1];
            if (log && log.canvasser && log.canvasser.indexOf(oldName) !== -1) {
              var updated = log.canvasser.replace(new RegExp(oldName,'g'), newName);
              updates['/'+n.key+'/logs/'+date+'/'+vKey+'/'+addrId+'/canvasser'] = updated;
            }
          });
        });
      });
    });
    if (Object.keys(updates).length) {
      return fbPatch('', updates);
    }
  });
}

function handleToggleVol(id){var v=roster[id];toggleVolStatus(id,v&&v.status==='inactive');}
function toggleVolStatus(id, isInactive) {
  var newStatus = isInactive ? 'active' : 'inactive';
  var v = roster[id];
  if (!v) return;
  if (!isInactive && !confirm('Deactivate '+v.name+'? They will not appear in future shift selectors. Their past data is preserved.')) return;
  roster[id].status = newStatus;
  fbPatch('/roster/'+id, {status:newStatus}).then(function(){
    renderRoster();
    showToast(v.name + (newStatus==='inactive' ? ' deactivated' : ' reactivated'));
  }).catch(function(err){
    showToast('Save failed: ' + (err && err.message ? err.message : 'check connection'));
    console.error('saveAssignments error:', err);
  });
}

// ── CANVASS DAYS ──────────────────────────
function renderDaysList() {
  var list = document.getElementById('days-list');
  if (!list) return;
  var days = Object.entries(canvassDays).sort(function(a,b){return a[0].localeCompare(b[0]);});
  if (!days.length) {
    list.innerHTML = '<div style="padding:16px;font-size:12px;color:var(--subtle);">No shifts yet. Create one above.</div>';
    return;
  }
  var upcoming = days.filter(function(p){return p[0]>=todayKey;});
  var past = days.filter(function(p){return p[0]<todayKey;}).reverse();

  function dayCard(pair, isPast) {
    var date=pair[0], day=pair[1];
    var hood = CONFIG.neighborhoods.find(function(n){return n.key===day.neighborhood;});
    var hoodName = hood ? hood.displayName : day.neighborhood;
    var vols = (day.volunteers||[]).map(volName);
    return '<div class="day-item' + (isPast?' past-day':'') + '">' +
      '<div class="day-item-header">' +
        '<div>' +
          '<div class="day-date">' + formatDate(date) + (isPast?' <span style="font-size:9px;color:var(--subtle);font-weight:400;">(past)</span>':'') + '</div>' +
          '<div class="day-meta">' + hoodName + (day.notes ? ' · ' + day.notes : '') + '</div>' +
        '</div>' +
        '<div class="day-actions">' +
          '<button class="r-btn" data-date="' + date + '" onclick="jumpToAssign(this.dataset.date)">View / Assign →</button>' +
          '<button class="r-btn r-danger" data-date="' + date + '" onclick="deleteDay(this.dataset.date)">Delete</button>' +
        '</div>' +
      '</div>' +
      (vols.length ? '<div class="day-volunteers">' + vols.map(function(n){return '<span class="day-vol-pill">'+n+'</span>';}).join('') + '</div>' : '') +
    '</div>';
  }

  var html = '';
  if (upcoming.length) {
    html += '<div class="days-divider">Upcoming</div>';
    html += upcoming.map(function(p){return dayCard(p,false);}).join('');
  }
  if (past.length) {
    html += '<div class="days-divider" style="margin-top:16px;">Past Shifts</div>';
    html += past.map(function(p){return dayCard(p,true);}).join('');
  }
  list.innerHTML = html;
}


function buildAssignDaySelect() {
  var sel = document.getElementById('assign-day-select');
  if (!sel) return;
  var prev = sel.value;
  sel.innerHTML = '<option value="">— Select a shift —</option>';
  Object.keys(canvassDays).sort().forEach(function(date){
    var o=document.createElement('option'); o.value=date; o.textContent=formatDate(date);
    if(date===prev) o.selected=true;
    sel.appendChild(o);
  });
}

function setAssignDay(date) {
  var sel = document.getElementById('assign-day-select');
  if (sel) { sel.value = date; onAssignDayChange(); }
}

function jumpToAssign(date) {
  setAssignDay(date);
  var el = document.getElementById('section-assign');
  if (el) el.scrollIntoView({behavior:'smooth'});
}

function onAssignDayChange() {
  var date = document.getElementById('assign-day-select').value;
  adminCurrentDay = date;
  adminSelected = {}; adminRoute = [];
  buildAssignCanvasserSelect();
  if (date && canvassDays[date]) {
    var hood = canvassDays[date].neighborhood;
    adminHoodKey = hood;
    adminAddresses = NEIGHBORHOOD_DATA[hood] || [];
    refreshAdminMarkers();
    if (adminMap && adminAddresses.length) {
      var lats=adminAddresses.map(function(a){return a.lat;});
      var lngs=adminAddresses.map(function(a){return a.lng;});
      adminMap.fitBounds([[Math.min.apply(null,lats),Math.min.apply(null,lngs)],[Math.max.apply(null,lats),Math.max.apply(null,lngs)]],{padding:[20,20]});
    }
    // Load all assignments for this day
    fbGet('/'+adminHoodKey+'/assignments/'+date).then(function(d){
      adminAllData = (d&&typeof d==='object') ? d : {};
      if (adminMapView==='all') refreshAdminMarkers();
      updateAllLegend();
    }).catch(function(){});
    // Auto-select canvasser if only one on this shift
    var vols = canvassDays[date].volunteers || [];
    var cvSel = document.getElementById('admin-canvasser');
    if (cvSel && vols.length === 1) {
      cvSel.value = vols[0];
      onAdminCanvasserChange();
      return; // onAdminCanvasserChange handles render
    }
  }
  renderAdminAddrList();
  updateAdminSelLabel();
}

function buildAssignCanvasserSelect() {
  var sel = document.getElementById('admin-canvasser');
  var psel = document.getElementById('admin-partner');
  if (!sel) return;
  var prevC = adminVolId, prevP = psel ? psel.value : '';
  sel.innerHTML = '<option value="">— Select canvasser —</option>';
  if (psel) psel.innerHTML = '<option value="">— No partner —</option>';
  var day = adminCurrentDay ? canvassDays[adminCurrentDay] : null;
  var vols = day && day.volunteers ? day.volunteers.map(function(id){return {id:id,name:volName(id)};}) : activeVols();
  vols.forEach(function(v){
    var o=document.createElement('option'); o.value=v.id; o.textContent=v.name;
    if(v.id===prevC) o.selected=true;
    sel.appendChild(o);
    if (psel) {
      var o2=document.createElement('option'); o2.value=v.id; o2.textContent=v.name;
      if(v.id===prevP) o2.selected=true;
      psel.appendChild(o2);
    }
  });
}

function onAdminCanvasserChange() {
  adminVolId = document.getElementById('admin-canvasser').value;
  adminSelected = {}; adminRoute = [];
  if (adminVolId && adminCurrentDay && adminHoodKey) {
    fbGet('/'+adminHoodKey+'/assignments/'+adminCurrentDay+'/'+adminVolId).then(function(d){
      if (d && typeof d==='object') {
        if (Array.isArray(d.route)) {
          adminRoute = d.route;
          adminSelected = d.assignments || {};
        } else {
          // Legacy flat format
          adminSelected = {};
          adminRoute = [];
          Object.keys(d).forEach(function(k){
            if(k!=='route'&&k!=='assignments'){
              adminSelected[k]=true;
              adminRoute.push(k);
            }
          });
        }
        showToast('Loaded ' + adminRoute.length + ' addresses for ' + volName(adminVolId));
      } else {
        adminSelected = {}; adminRoute = [];
      }
      refreshAdminMarkers();
      renderAdminAddrList();
      updateAdminSelLabel();
    }).catch(function(e){
      showToast('Load failed — check connection');
      renderAdminAddrList();
      updateAdminSelLabel();
    });
  } else {
    refreshAdminMarkers();
    renderAdminAddrList();
    updateAdminSelLabel();
  }
}

function saveAssignments() {
  if (!adminVolId) { showToast('Select a canvasser first'); return; }
  if (!adminCurrentDay) { showToast('Select a shift first'); return; }
  if (!adminHoodKey) { showToast('No neighborhood set — pick a shift first'); return; }
  if (adminRoute.length === 0) { showToast('No addresses selected'); return; }
  var psel = document.getElementById('admin-partner');
  var partnerId = psel ? psel.value : '';
  var saves = [fbPut('/'+adminHoodKey+'/assignments/'+adminCurrentDay+'/'+adminVolId, {route:adminRoute,assignments:adminSelected})];
  if (partnerId && partnerId !== adminVolId) {
    saves.push(fbPut('/'+adminHoodKey+'/assignments/'+adminCurrentDay+'/'+partnerId, {route:adminRoute,assignments:adminSelected}));
  }
  Promise.all(saves).then(function(){
    var names = volName(adminVolId)+(partnerId&&partnerId!==adminVolId?' & '+volName(partnerId):'');
    showToast('Saved '+adminRoute.length+' addresses for '+names);
    fbGet('/'+adminHoodKey+'/assignments/'+adminCurrentDay).then(function(d){
      adminAllData=(d&&typeof d==='object')?d:{};
      updateAllLegend();
    });
  }).catch(function(err){
    showToast('Save failed: ' + (err && err.message ? err.message : 'check connection'));
    console.error('saveAssignments error:', err);
  });
}

// ── ADMIN MAP ─────────────────────────────
function initAdminMap() {
  adminMap = L.map('admin-map', {center:[45.017,-93.153], zoom:15});
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{
    attribution:'&copy; OpenStreetMap &copy; CARTO',subdomains:'abcd',maxZoom:20
  }).addTo(adminMap);
  // Selection via map pin clicks and checklist only
}
function adminMarkerColor(addr) {
  if (adminMapView==='all') {
    var keys=Object.keys(adminAllData);
    for(var i=0;i<keys.length;i++){
      if(adminAllData[keys[i]]&&adminAllData[keys[i]][addr.id]) return CANVASSER_COLORS[i%CANVASSER_COLORS.length];
    }
    return '#d1d5db';
  }
  if (adminSelected[addr.id]) return '#D4A832';
  return (PROP_META[addr.t]||PROP_META.house).color;
}

function refreshAdminMarkers() {
  if (!adminMap) return;
  Object.values(adminMarkers).forEach(function(m){adminMap.removeLayer(m);});
  adminMarkers={};
  adminAddresses.forEach(function(addr){
    var color=adminMarkerColor(addr);
    var sel=!!adminSelected[addr.id];
    var size=sel?14:9; var op=(sel||adminMapView==='all')?1:.45;
    var routeIdx = adminRoute.indexOf(addr.id);
    var pinNum = (sel && routeIdx >= 0) ? (routeIdx+1) : '';
    var pinSize = sel ? 20 : size;
    var icon=L.divIcon({className:'',html:'<div style="width:'+pinSize+'px;height:'+pinSize+'px;background:'+color+';border:'+(sel?'2px solid rgba(0,0,0,.3)':'1.5px solid rgba(0,0,0,.1)')+';border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.2);cursor:pointer;opacity:'+op+';display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:800;color:#1d1b16;">'+pinNum+'</div>',iconSize:[pinSize,pinSize],iconAnchor:[pinSize/2,pinSize/2]});
    var m=L.marker([addr.lat,addr.lng],{icon:icon}).addTo(adminMap);
    var addrId=addr.id;
    m.on('click',function(){
      if(!adminVolId){showToast('Select a canvasser first');return;}
      toggleAdminAddr(addrId);
    });
    m.bindTooltip(addr.n+' '+addr.s,{permanent:false,direction:'top'});
    adminMarkers[addr.id]=m;
  });
}

function renderAdminAddrList() {
  var container = document.getElementById('admin-addr-list');
  if (!adminAddresses.length) {
    container.innerHTML = '<div style="padding:12px;font-size:12px;color:var(--subtle);text-align:center;">Select a shift first</div>';
    return;
  }
  var addrMap = {};
  adminAddresses.forEach(function(a){ addrMap[a.id]=a; });

  var routeHtml = adminRoute.map(function(id, i) {
    var addr = addrMap[id]; if (!addr) return '';
    var meta = PROP_META[addr.t]||PROP_META.house;
    var isFirst = i===0, isLast = i===adminRoute.length-1;
    return '<div class="admin-addr-list-item sel" style="border-left:3px solid var(--gold);min-height:44px;align-items:center;">' +
      '<div style="display:flex;flex-direction:column;gap:2px;align-items:center;justify-content:center;width:24px;flex-shrink:0;">' +
        '<button data-rid="'+id+'" data-dir="-1" onclick="moveRouteItem(this.dataset.rid,parseInt(this.dataset.dir))" '+(isFirst?'disabled':'')+
          ' style="border:none;background:none;cursor:pointer;color:'+(isFirst?'#ddd':'var(--gold-acc)')+';font-size:14px;padding:2px;line-height:1;display:block;">▲</button>' +
        '<button data-rid="'+id+'" data-dir="1" onclick="moveRouteItem(this.dataset.rid,parseInt(this.dataset.dir))" '+(isLast?'disabled':'')+
          ' style="border:none;background:none;cursor:pointer;color:'+(isLast?'#ddd':'var(--gold-acc)')+';font-size:14px;padding:2px;line-height:1;display:block;">▼</button>' +
      '</div>' +
      '<div class="aali-check" data-aid="'+id+'" onclick="toggleAdminAddr(this.dataset.aid)" style="margin:0 6px;">✓</div>' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
          '<span style="color:var(--gold-acc);margin-right:4px;">'+(i+1)+'.</span>'+addr.n+' '+addr.s+(addr.u?', '+addr.u:'')+'</div>' +
        '<div style="font-size:10px;color:var(--subtle);">'+meta.label+'</div>' +
      '</div>' +
    '</div>';
  }).join('');

  var unselected = adminAddresses
    .filter(function(a){ return !adminSelected[a.id]; })
    .sort(function(a,b){ return parseInt(a.n||0)-parseInt(b.n||0); });

  var unselHtml = unselected.map(function(addr) {
    var meta = PROP_META[addr.t]||PROP_META.house;
    return '<div class="admin-addr-list-item" data-aid="'+addr.id+'" onclick="toggleAdminAddr(this.dataset.aid)" style="min-height:44px;align-items:center;">' +
      '<div class="aali-check" style="margin-right:6px;"></div>' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+addr.n+' '+addr.s+(addr.u?', '+addr.u:'')+'</div>' +
        '<div style="font-size:10px;color:var(--subtle);">'+meta.label+'</div>' +
      '</div></div>';
  }).join('');

  var divider = (adminRoute.length && unselected.length) ?
    '<div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--subtle);padding:6px 10px;background:var(--light);">— Not yet added —</div>' : '';

  container.innerHTML = routeHtml + divider + unselHtml;
}

function getSiblingUnits(id) {
  // Return all address IDs that share the same street number and street name
  var addr = adminAddresses.find(function(a){return a.id===id;});
  if (!addr || !addr.u) return [id]; // no unit field = standalone house
  return adminAddresses
    .filter(function(a){ return a.n===addr.n && a.s===addr.s; })
    .map(function(a){ return a.id; })
    .sort(function(a,b){
      var au = adminAddresses.find(function(x){return x.id===a;});
      var bu = adminAddresses.find(function(x){return x.id===b;});
      var an = parseInt((au&&au.u||'').replace(/\D/g,''))||0;
      var bn = parseInt((bu&&bu.u||'').replace(/\D/g,''))||0;
      return an - bn;
    });
}

function toggleAdminAddr(id) {
  if(!adminVolId){showToast('Select a canvasser first');return;}
  var siblings = getSiblingUnits(id);
  if(adminSelected[id]) {
    // Deselect all siblings
    siblings.forEach(function(sid){
      delete adminSelected[sid];
      adminRoute = adminRoute.filter(function(rid){return rid!==sid;});
    });
  } else {
    // Select all siblings in unit order
    siblings.forEach(function(sid){
      if(!adminSelected[sid]){
        adminSelected[sid] = true;
        adminRoute.push(sid);
      }
    });
  }
  refreshAdminMarkers(); renderAdminAddrList(); updateAdminSelLabel();
}

function moveRouteItem(id, dir) {
  var i = adminRoute.indexOf(id);
  if (i === -1) return;
  var j = i + dir;
  if (j < 0 || j >= adminRoute.length) return;
  var tmp = adminRoute[i]; adminRoute[i] = adminRoute[j]; adminRoute[j] = tmp;
  refreshAdminMarkers(); renderAdminAddrList();
}

function updateAdminSelLabel() {
  var n=adminRoute.length;
  var psel=document.getElementById('admin-partner');
  var partnerId=psel?psel.value:'';
  var label='';
  if(!adminCurrentDay) label='Select a shift to begin';
  else if(!adminVolId) label='Select a canvasser';
  else {
    var names=volName(adminVolId)+(partnerId&&partnerId!==adminVolId?' & '+volName(partnerId):'');
    label=n+' address'+(n===1?'':'es')+' selected for '+names;
  }
  document.getElementById('admin-sel-label').textContent=label;
  var canAct = !!(adminVolId && adminCurrentDay && adminHoodKey);
  document.getElementById('admin-save-btn').disabled = !canAct;
  var printBtn = document.getElementById('admin-print-btn');
  if (printBtn) printBtn.disabled = !(canAct && adminRoute.length > 0);
}

function setAdminMapView(v){
  adminMapView=v;
  document.querySelectorAll('.amt-btn').forEach(function(b){b.classList.toggle('active',b.dataset.mv===v);});
  document.getElementById('admin-all-legend').style.display=v==='all'?'block':'none';
  refreshAdminMarkers();
}

function updateAllLegend(){
  var rows=document.getElementById('admin-all-legend'); if(!rows) return;
  var keys=Object.keys(adminAllData);
  if(!keys.length){rows.innerHTML='<div style="font-size:12px;color:var(--subtle);padding:4px 0;">No assignments saved yet.</div>';return;}
  rows.innerHTML=keys.map(function(id,i){
    var count=adminAllData[id]?Object.keys(adminAllData[id]).length:0;
    return '<div class="all-legend-row"><div class="alr-dot" style="background:'+CANVASSER_COLORS[i%CANVASSER_COLORS.length]+';"></div><span class="alr-name">'+volName(id)+'</span><span class="alr-count">'+count+'</span></div>';
  }).join('');
}


function setFbBase() {
  fbBase = (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.databaseURL) || '';
}

// Roster: id -> {name, status, added}
var roster = {};

// Canvass days: date -> {volunteers:[id,...], neighborhood:key, notes:str}
var canvassDays = {};

// Canvasser app state
var myVolId = '';
var myVolName = '';
var partnerVolId = '';
var partnerVolName = '';
var neighborhoodKey = '';
var addresses = [];
var mode = 'canvass';
var activeFilter = 'all';
var logs = {};
var myAssignments = {};
var myRoute = [];
var addrToVolId = {};
var signs = [];
var markers = {};
var signMarkers = [];
var selectedId = null;
var modalId = null;
var pendingLatLng = null;
var map = null;
var mobileShowingMap = true;
var todayKey = new Date().toISOString().slice(0,10);
var pollTimer = null;

// Admin state
var adminCurrentDay = '';
var adminVolId = '';
var adminHoodKey = '';
var adminAddresses = [];
var adminMarkers = {};
var adminSelected = {};
var adminRoute = [];
var adminAllData = {};
var adminMap = null;
var adminDrawLayer = null;
var adminMapView = 'single';

// ── HELPERS ───────────────────────────────
function fbFetch(path, opts) {
  return fetch(fbBase + path + '.json', opts || {});
}
function fbGet(path) {
  return fbFetch(path).then(function(r){return r.json();});
}
function fbPut(path, data) {
  return fbFetch(path, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
}
function fbPatch(path, data) {
  return fbFetch(path, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2,6);
}

function volName(id) {
  return roster[id] ? roster[id].name : id;
}

function activeVols() {
  return Object.entries(roster).filter(function(e){return e[1].status==='active';}).map(function(e){return {id:e[0],name:e[1].name};}).sort(function(a,b){return a.name.localeCompare(b.name);});
}

// ── LOGIN ─────────────────────────────────
// doLogin replaced by Firebase Auth in auth.js

function goLogin() { if(typeof doSignOut==='function') doSignOut(); }


// ── ROSTER ────────────────────────────────
function loadRoster() {
  return fbGet('/roster').then(function(d){
    if (d && typeof d==='object' && Object.keys(d).length > 0) {
      roster = d;
    } else {
      // First run — seed from INITIAL_ROSTER
      roster = {};
      var promises = INITIAL_ROSTER.map(function(v){
        var id = genId();
        roster[id] = {name:v.name, status:v.status, added:todayKey};
        return fbPut('/roster/'+id, roster[id]);
      });
      return Promise.all(promises);
    }
  }).catch(function(){ roster = {}; });
}

function loadCanvassDays() {
  return fbGet('/canvass-days').then(function(d){
    canvassDays = (d && typeof d==='object') ? d : {};
  }).catch(function(){ canvassDays = {}; });
}

// ── ROSTER MANAGEMENT ─────────────────────
function showAdminScreen() {
  document.getElementById('admin-screen').style.display='flex';
  var sub = document.getElementById('admin-topbar-sub');
  if (sub && window.currentUser) sub.textContent = window.currentUser.email;
  buildNewDayHoodSelect();
  renderNewDayVolunteers();
  renderRoster();
  renderDaysList();
  buildAssignDaySelect();
  buildAssignCanvasserSelect();
  setTimeout(function(){ if(!adminMap) initAdminMap(); }, 300);
  setupRailHighlight();
}

function setupRailHighlight() {
  var content = document.getElementById('admin-content');
  if (!content) return;
  var sections = ['section-roster','section-days','section-assign'];
  content.addEventListener('scroll', function() {
    var scrollTop = content.scrollTop + 80;
    var active = sections[0];
    sections.forEach(function(id) {
      var el = document.getElementById(id);
      if (el && el.offsetTop <= scrollTop) active = id;
    });
    document.querySelectorAll('.rail-link').forEach(function(a) {
      a.classList.toggle('active', a.getAttribute('href') === '#'+active);
    });
    // Init map when assign section scrolls into view
    if (active === 'section-assign' && !adminMap) {
      setTimeout(function() { initAdminMap(); }, 100);
    }
  });
  var first = document.querySelector('.rail-link');
  if (first) first.classList.add('active');
}

function renderRoster() {
  var list = document.getElementById('roster-list');
  if (!list) return;
  var vols = Object.entries(roster).sort(function(a,b){return a[1].name.localeCompare(b[1].name);});
  if (!vols.length) {
    list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--subtle);font-size:13px;">No volunteers yet.</div>';
    return;
  }
  list.innerHTML = vols.map(function(pair){
    var id = pair[0], v = pair[1];
    var inactive = v.status === 'inactive';
    return '<div class="roster-item' + (inactive ? ' inactive' : '') + '" id="ri-' + id + '">' +
      '<div class="roster-avatar' + (inactive ? ' inactive-av' : '') + '">' + v.name.charAt(0).toUpperCase() + '</div>' +
      '<div class="roster-info">' +
        '<div class="roster-name" id="rn-' + id + '">' + v.name + '</div>' +
        '<div class="roster-status">' + (inactive ? 'Inactive' : 'Active') + '</div>' +
      '</div>' +
      '<div class="roster-actions" id="ra-' + id + '">' +
        '<button class="r-btn" data-id="' + id + '" onclick="startEditVol(this.dataset.id)">Edit</button>' +
        '<button class="r-btn r-danger" data-id="' + id + '" onclick="handleToggleVol(this.dataset.id)">' + (inactive ? 'Reactivate' : 'Deactivate') + '</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function startEditVol(id) {
  var v = roster[id]; if (!v) return;
  var nameEl = document.getElementById('rn-' + id);
  var actionsEl = document.getElementById('ra-' + id);
  if (!nameEl || !actionsEl) return;
  nameEl.innerHTML = '<input class="roster-edit-input" id="rei-' + id + '" type="text" value="' + v.name.replace(/"/g,'&quot;') + '">';
  actionsEl.innerHTML =
    '<button class="r-btn r-save" data-id="' + id + '" onclick="saveInlineEdit(this.dataset.id)">Save</button>' +
    '<button class="r-btn r-cancel" onclick="renderRoster()">Cancel</button>';
  var inp = document.getElementById('rei-' + id);
  if (inp) { inp.focus(); inp.select(); }
}

function saveInlineEdit(id) {
  var inp = document.getElementById('rei-' + id);
  if (!inp) return;
  var newName = inp.value.trim();
  if (!newName) { showToast('Name cannot be empty'); return; }
  var oldName = roster[id] ? roster[id].name : '';
  roster[id].name = newName;
  fbPatch('/roster/' + id, {name: newName}).then(function(){
    return updateVolNameInLogs(id, oldName, newName);
  }).then(function(){
    renderRoster();
    buildAssignCanvasserSelect();
    showToast('Updated to ' + newName);
  }).catch(function(err){
    showToast('Save failed: ' + (err && err.message ? err.message : 'check connection'));
    console.error('saveAssignments error:', err);
  });
}


function addVolunteer() {
  var input = document.getElementById('new-vol-name');
  var name = input.value.trim();
  if (!name) return;
  var id = genId();
  roster[id] = {name:name, status:'active', added:todayKey};
  fbPut('/roster/'+id, roster[id]).then(function(){
    input.value='';
    renderRoster();
    buildAssignCanvasserSelect();
    showToast('Added '+name);
  }).catch(function(err){
    showToast('Save failed: ' + (err && err.message ? err.message : 'check connection'));
    console.error('saveAssignments error:', err);
  });
}

// openEditVol/saveVolunteerEdit replaced by startEditVol inline

function updateVolNameInLogs(volId, oldName, newName) {
  // Fetch all logs, find entries with canvasser matching oldName, update them
  return fbGet('/').then(function(allData){
    if (!allData) return;
    var updates = {};
    window.NEIGHBORHOODS.forEach(function(n){
      var hoodData = allData[n.key];
      if (!hoodData || !hoodData.logs) return;
      Object.entries(hoodData.logs).forEach(function(dayPair){
        var date=dayPair[0], dayLogs=dayPair[1];
        if (!dayLogs) return;
        Object.entries(dayLogs).forEach(function(volPair){
          var vKey=volPair[0], vLogs=volPair[1];
          if (!vLogs) return;
          Object.entries(vLogs).forEach(function(logPair){
            var addrId=logPair[0], log=logPair[1];
            if (log && log.canvasser && log.canvasser.indexOf(oldName) !== -1) {
              var updated = log.canvasser.replace(new RegExp(oldName,'g'), newName);
              updates['/'+n.key+'/logs/'+date+'/'+vKey+'/'+addrId+'/canvasser'] = updated;
            }
          });
        });
      });
    });
    if (Object.keys(updates).length) {
      return fbPatch('', updates);
    }
  });
}

function handleToggleVol(id){var v=roster[id];toggleVolStatus(id,v&&v.status==='inactive');}
function toggleVolStatus(id, isInactive) {
  var newStatus = isInactive ? 'active' : 'inactive';
  var v = roster[id];
  if (!v) return;
  if (!isInactive && !confirm('Deactivate '+v.name+'? They will not appear in future shift selectors. Their past data is preserved.')) return;
  roster[id].status = newStatus;
  fbPatch('/roster/'+id, {status:newStatus}).then(function(){
    renderRoster();
    showToast(v.name + (newStatus==='inactive' ? ' deactivated' : ' reactivated'));
  }).catch(function(err){
    showToast('Save failed: ' + (err && err.message ? err.message : 'check connection'));
    console.error('saveAssignments error:', err);
  });
}

// ── CANVASS DAYS ──────────────────────────
function renderDaysList() {
  var list = document.getElementById('days-list');
  if (!list) return;
  var days = Object.entries(canvassDays).sort(function(a,b){return a[0].localeCompare(b[0]);});
  if (!days.length) {
    list.innerHTML = '<div style="padding:16px;font-size:12px;color:var(--subtle);">No shifts yet. Create one above.</div>';
    return;
  }
  var upcoming = days.filter(function(p){return p[0]>=todayKey;});
  var past = days.filter(function(p){return p[0]<todayKey;}).reverse();

  function dayCard(pair, isPast) {
    var date=pair[0], day=pair[1];
    var hood = window.NEIGHBORHOODS.find(function(n){return n.key===day.neighborhood;});
    var hoodName = hood ? hood.displayName : day.neighborhood;
    var vols = (day.volunteers||[]).map(volName);
    return '<div class="day-item' + (isPast?' past-day':'') + '">' +
      '<div class="day-item-header">' +
        '<div>' +
          '<div class="day-date">' + formatDate(date) + (isPast?' <span style="font-size:9px;color:var(--subtle);font-weight:400;">(past)</span>':'') + '</div>' +
          '<div class="day-meta">' + hoodName + (day.notes ? ' · ' + day.notes : '') + '</div>' +
        '</div>' +
        '<div class="day-actions">' +
          '<button class="r-btn" data-date="' + date + '" onclick="jumpToAssign(this.dataset.date)">View / Assign →</button>' +
          '<button class="r-btn r-danger" data-date="' + date + '" onclick="deleteDay(this.dataset.date)">Delete</button>' +
        '</div>' +
      '</div>' +
      (vols.length ? '<div class="day-volunteers">' + vols.map(function(n){return '<span class="day-vol-pill">'+n+'</span>';}).join('') + '</div>' : '') +
    '</div>';
  }

  var html = '';
  if (upcoming.length) {
    html += '<div class="days-divider">Upcoming</div>';
    html += upcoming.map(function(p){return dayCard(p,false);}).join('');
  }
  if (past.length) {
    html += '<div class="days-divider" style="margin-top:16px;">Past Shifts</div>';
    html += past.map(function(p){return dayCard(p,true);}).join('');
  }
  list.innerHTML = html;
}


function buildAssignDaySelect() {
  var sel = document.getElementById('assign-day-select');
  if (!sel) return;
  var prev = sel.value;
  sel.innerHTML = '<option value="">— Select a shift —</option>';
  Object.keys(canvassDays).sort().forEach(function(date){
    var o=document.createElement('option'); o.value=date; o.textContent=formatDate(date);
    if(date===prev) o.selected=true;
    sel.appendChild(o);
  });
}

function setAssignDay(date) {
  var sel = document.getElementById('assign-day-select');
  if (sel) { sel.value = date; onAssignDayChange(); }
}

function jumpToAssign(date) {
  setAssignDay(date);
  var el = document.getElementById('section-assign');
  if (el) el.scrollIntoView({behavior:'smooth'});
}

function onAssignDayChange() {
  var date = document.getElementById('assign-day-select').value;
  adminCurrentDay = date;
  adminSelected = {}; adminRoute = [];
  buildAssignCanvasserSelect();
  if (date && canvassDays[date]) {
    var hood = canvassDays[date].neighborhood;
    adminHoodKey = hood;
    adminAddresses = window.NEIGHBORHOOD_DATA[hood] || [];
    refreshAdminMarkers();
    if (adminMap && adminAddresses.length) {
      var lats=adminAddresses.map(function(a){return a.lat;});
      var lngs=adminAddresses.map(function(a){return a.lng;});
      adminMap.fitBounds([[Math.min.apply(null,lats),Math.min.apply(null,lngs)],[Math.max.apply(null,lats),Math.max.apply(null,lngs)]],{padding:[20,20]});
    }
    // Load all assignments for this day
    fbGet('/'+adminHoodKey+'/assignments/'+date).then(function(d){
      adminAllData = (d&&typeof d==='object') ? d : {};
      if (adminMapView==='all') refreshAdminMarkers();
      updateAllLegend();
    }).catch(function(){});
    // Auto-select canvasser if only one on this shift
    var vols = canvassDays[date].volunteers || [];
    var cvSel = document.getElementById('admin-canvasser');
    if (cvSel && vols.length === 1) {
      cvSel.value = vols[0];
      onAdminCanvasserChange();
      return; // onAdminCanvasserChange handles render
    }
  }
  renderAdminAddrList();
  updateAdminSelLabel();
}

function buildAssignCanvasserSelect() {
  var sel = document.getElementById('admin-canvasser');
  var psel = document.getElementById('admin-partner');
  if (!sel) return;
  var prevC = adminVolId, prevP = psel ? psel.value : '';
  sel.innerHTML = '<option value="">— Select canvasser —</option>';
  if (psel) psel.innerHTML = '<option value="">— No partner —</option>';
  var day = adminCurrentDay ? canvassDays[adminCurrentDay] : null;
  var vols = day && day.volunteers ? day.volunteers.map(function(id){return {id:id,name:volName(id)};}) : activeVols();
  vols.forEach(function(v){
    var o=document.createElement('option'); o.value=v.id; o.textContent=v.name;
    if(v.id===prevC) o.selected=true;
    sel.appendChild(o);
    if (psel) {
      var o2=document.createElement('option'); o2.value=v.id; o2.textContent=v.name;
      if(v.id===prevP) o2.selected=true;
      psel.appendChild(o2);
    }
  });
}

function onAdminCanvasserChange() {
  adminVolId = document.getElementById('admin-canvasser').value;
  adminSelected = {}; adminRoute = [];
  if (adminVolId && adminCurrentDay && adminHoodKey) {
    fbGet('/'+adminHoodKey+'/assignments/'+adminCurrentDay+'/'+adminVolId).then(function(d){
      if (d && typeof d==='object') {
        if (Array.isArray(d.route)) {
          adminRoute = d.route;
          adminSelected = d.assignments || {};
        } else {
          // Legacy flat format
          adminSelected = {};
          adminRoute = [];
          Object.keys(d).forEach(function(k){
            if(k!=='route'&&k!=='assignments'){
              adminSelected[k]=true;
              adminRoute.push(k);
            }
          });
        }
        showToast('Loaded ' + adminRoute.length + ' addresses for ' + volName(adminVolId));
      } else {
        adminSelected = {}; adminRoute = [];
      }
      refreshAdminMarkers();
      renderAdminAddrList();
      updateAdminSelLabel();
    }).catch(function(e){
      showToast('Load failed — check connection');
      renderAdminAddrList();
      updateAdminSelLabel();
    });
  } else {
    refreshAdminMarkers();
    renderAdminAddrList();
    updateAdminSelLabel();
  }
}

function saveAssignments() {
  if (!adminVolId) { showToast('Select a canvasser first'); return; }
  if (!adminCurrentDay) { showToast('Select a shift first'); return; }
  if (!adminHoodKey) { showToast('No neighborhood set — pick a shift first'); return; }
  if (adminRoute.length === 0) { showToast('No addresses selected'); return; }
  var psel = document.getElementById('admin-partner');
  var partnerId = psel ? psel.value : '';
  var saves = [fbPut('/'+adminHoodKey+'/assignments/'+adminCurrentDay+'/'+adminVolId, {route:adminRoute,assignments:adminSelected})];
  if (partnerId && partnerId !== adminVolId) {
    saves.push(fbPut('/'+adminHoodKey+'/assignments/'+adminCurrentDay+'/'+partnerId, {route:adminRoute,assignments:adminSelected}));
  }
  Promise.all(saves).then(function(){
    var names = volName(adminVolId)+(partnerId&&partnerId!==adminVolId?' & '+volName(partnerId):'');
    showToast('Saved '+adminRoute.length+' addresses for '+names);
    fbGet('/'+adminHoodKey+'/assignments/'+adminCurrentDay).then(function(d){
      adminAllData=(d&&typeof d==='object')?d:{};
      updateAllLegend();
    });
  }).catch(function(err){
    showToast('Save failed: ' + (err && err.message ? err.message : 'check connection'));
    console.error('saveAssignments error:', err);
  });
}

// ── ADMIN MAP ─────────────────────────────
function initAdminMap() {
  adminMap = L.map('admin-map', {center:[45.017,-93.153], zoom:15});
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{
    attribution:'&copy; OpenStreetMap &copy; CARTO',subdomains:'abcd',maxZoom:20
  }).addTo(adminMap);
  // Selection via map pin clicks and checklist only
}
function adminMarkerColor(addr) {
  if (adminMapView==='all') {
    var keys=Object.keys(adminAllData);
    for(var i=0;i<keys.length;i++){
      if(adminAllData[keys[i]]&&adminAllData[keys[i]][addr.id]) return CANVASSER_COLORS[i%CANVASSER_COLORS.length];
    }
    return '#d1d5db';
  }
  if (adminSelected[addr.id]) return '#D4A832';
  return (PROP_META[addr.t]||PROP_META.house).color;
}

function refreshAdminMarkers() {
  if (!adminMap) return;
  Object.values(adminMarkers).forEach(function(m){adminMap.removeLayer(m);});
  adminMarkers={};
  adminAddresses.forEach(function(addr){
    var color=adminMarkerColor(addr);
    var sel=!!adminSelected[addr.id];
    var size=sel?14:9; var op=(sel||adminMapView==='all')?1:.45;
    var routeIdx = adminRoute.indexOf(addr.id);
    var pinNum = (sel && routeIdx >= 0) ? (routeIdx+1) : '';
    var pinSize = sel ? 20 : size;
    var icon=L.divIcon({className:'',html:'<div style="width:'+pinSize+'px;height:'+pinSize+'px;background:'+color+';border:'+(sel?'2px solid rgba(0,0,0,.3)':'1.5px solid rgba(0,0,0,.1)')+';border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.2);cursor:pointer;opacity:'+op+';display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:800;color:#1d1b16;">'+pinNum+'</div>',iconSize:[pinSize,pinSize],iconAnchor:[pinSize/2,pinSize/2]});
    var m=L.marker([addr.lat,addr.lng],{icon:icon}).addTo(adminMap);
    var addrId=addr.id;
    m.on('click',function(){
      if(!adminVolId){showToast('Select a canvasser first');return;}
      toggleAdminAddr(addrId);
    });
    m.bindTooltip(addr.n+' '+addr.s,{permanent:false,direction:'top'});
    adminMarkers[addr.id]=m;
  });
}

function renderAdminAddrList() {
  var container = document.getElementById('admin-addr-list');
  if (!adminAddresses.length) {
    container.innerHTML = '<div style="padding:12px;font-size:12px;color:var(--subtle);text-align:center;">Select a shift first</div>';
    return;
  }
  var addrMap = {};
  adminAddresses.forEach(function(a){ addrMap[a.id]=a; });

  var routeHtml = adminRoute.map(function(id, i) {
    var addr = addrMap[id]; if (!addr) return '';
    var meta = PROP_META[addr.t]||PROP_META.house;
    var isFirst = i===0, isLast = i===adminRoute.length-1;
    return '<div class="admin-addr-list-item sel" style="border-left:3px solid var(--gold);min-height:44px;align-items:center;">' +
      '<div style="display:flex;flex-direction:column;gap:2px;align-items:center;justify-content:center;width:24px;flex-shrink:0;">' +
        '<button data-rid="'+id+'" data-dir="-1" onclick="moveRouteItem(this.dataset.rid,parseInt(this.dataset.dir))" '+(isFirst?'disabled':'')+
          ' style="border:none;background:none;cursor:pointer;color:'+(isFirst?'#ddd':'var(--gold-acc)')+';font-size:14px;padding:2px;line-height:1;display:block;">▲</button>' +
        '<button data-rid="'+id+'" data-dir="1" onclick="moveRouteItem(this.dataset.rid,parseInt(this.dataset.dir))" '+(isLast?'disabled':'')+
          ' style="border:none;background:none;cursor:pointer;color:'+(isLast?'#ddd':'var(--gold-acc)')+';font-size:14px;padding:2px;line-height:1;display:block;">▼</button>' +
      '</div>' +
      '<div class="aali-check" data-aid="'+id+'" onclick="toggleAdminAddr(this.dataset.aid)" style="margin:0 6px;">✓</div>' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
          '<span style="color:var(--gold-acc);margin-right:4px;">'+(i+1)+'.</span>'+addr.n+' '+addr.s+(addr.u?', '+addr.u:'')+'</div>' +
        '<div style="font-size:10px;color:var(--subtle);">'+meta.label+'</div>' +
      '</div>' +
    '</div>';
  }).join('');

  var unselected = adminAddresses
    .filter(function(a){ return !adminSelected[a.id]; })
    .sort(function(a,b){ return parseInt(a.n||0)-parseInt(b.n||0); });

  var unselHtml = unselected.map(function(addr) {
    var meta = PROP_META[addr.t]||PROP_META.house;
    return '<div class="admin-addr-list-item" data-aid="'+addr.id+'" onclick="toggleAdminAddr(this.dataset.aid)" style="min-height:44px;align-items:center;">' +
      '<div class="aali-check" style="margin-right:6px;"></div>' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+addr.n+' '+addr.s+(addr.u?', '+addr.u:'')+'</div>' +
        '<div style="font-size:10px;color:var(--subtle);">'+meta.label+'</div>' +
      '</div></div>';
  }).join('');

  var divider = (adminRoute.length && unselected.length) ?
    '<div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--subtle);padding:6px 10px;background:var(--light);">— Not yet added —</div>' : '';

  container.innerHTML = routeHtml + divider + unselHtml;
}

function getSiblingUnits(id) {
  // Return all address IDs that share the same street number and street name
  var addr = adminAddresses.find(function(a){return a.id===id;});
  if (!addr || !addr.u) return [id]; // no unit field = standalone house
  return adminAddresses
    .filter(function(a){ return a.n===addr.n && a.s===addr.s; })
    .map(function(a){ return a.id; })
    .sort(function(a,b){
      var au = adminAddresses.find(function(x){return x.id===a;});
      var bu = adminAddresses.find(function(x){return x.id===b;});
      var an = parseInt((au&&au.u||'').replace(/\D/g,''))||0;
      var bn = parseInt((bu&&bu.u||'').replace(/\D/g,''))||0;
      return an - bn;
    });
}

function toggleAdminAddr(id) {
  if(!adminVolId){showToast('Select a canvasser first');return;}
  var siblings = getSiblingUnits(id);
  if(adminSelected[id]) {
    // Deselect all siblings
    siblings.forEach(function(sid){
      delete adminSelected[sid];
      adminRoute = adminRoute.filter(function(rid){return rid!==sid;});
    });
  } else {
    // Select all siblings in unit order
    siblings.forEach(function(sid){
      if(!adminSelected[sid]){
        adminSelected[sid] = true;
        adminRoute.push(sid);
      }
    });
  }
  refreshAdminMarkers(); renderAdminAddrList(); updateAdminSelLabel();
}

function moveRouteItem(id, dir) {
  var i = adminRoute.indexOf(id);
  if (i === -1) return;
  var j = i + dir;
  if (j < 0 || j >= adminRoute.length) return;
  var tmp = adminRoute[i]; adminRoute[i] = adminRoute[j]; adminRoute[j] = tmp;
  refreshAdminMarkers(); renderAdminAddrList();
}

function updateAdminSelLabel() {
  var n=adminRoute.length;
  var psel=document.getElementById('admin-partner');
  var partnerId=psel?psel.value:'';
  var label='';
  if(!adminCurrentDay) label='Select a shift to begin';
  else if(!adminVolId) label='Select a canvasser';
  else {
    var names=volName(adminVolId)+(partnerId&&partnerId!==adminVolId?' & '+volName(partnerId):'');
    label=n+' address'+(n===1?'':'es')+' selected for '+names;
  }
  document.getElementById('admin-sel-label').textContent=label;
  var canAct = !!(adminVolId && adminCurrentDay && adminHoodKey);
  document.getElementById('admin-save-btn').disabled = !canAct;
  var printBtn = document.getElementById('admin-print-btn');
  if (printBtn) printBtn.disabled = !(canAct && adminRoute.length > 0);
}

function setAdminMapView(v){
  adminMapView=v;
  document.querySelectorAll('.amt-btn').forEach(function(b){b.classList.toggle('active',b.dataset.mv===v);});
  document.getElementById('admin-all-legend').style.display=v==='all'?'block':'none';
  refreshAdminMarkers();
}

function updateAllLegend(){
  var rows=document.getElementById('admin-all-legend'); if(!rows) return;
  var keys=Object.keys(adminAllData);
  if(!keys.length){rows.innerHTML='<div style="font-size:12px;color:var(--subtle);padding:4px 0;">No assignments saved yet.</div>';return;}
  rows.innerHTML=keys.map(function(id,i){
    var count=adminAllData[id]?Object.keys(adminAllData[id]).length:0;
    return '<div class="all-legend-row"><div class="alr-dot" style="background:'+CANVASSER_COLORS[i%CANVASSER_COLORS.length]+';"></div><span class="alr-name">'+volName(id)+'</span><span class="alr-count">'+count+'</span></div>';
  }).join('');
}

// ── CANVASSER SETUP ───────────────────────
function buildSetupSelects() {
  var vols=activeVols();
  var ns=document.getElementById('setup-name');
  if(ns){
    ns.innerHTML='<option value="">— Select your name —</option>';
    var myEmail=(window.currentUser&&window.currentUser.email)||'';
    var myId='';
    Object.entries(roster).forEach(function(e){
      if(e[1].email&&e[1].email.toLowerCase()===myEmail.toLowerCase()) myId=e[0];
    });
    vols.forEach(function(v){
      var o=document.createElement('option');
      o.value=v.id; o.textContent=v.name;
      if(v.id===myId) o.selected=true;
      ns.appendChild(o);
    });
  }
  var ds=document.getElementById('setup-date');
  if(ds){
    ds.innerHTML='<option value="">— Select shift date —</option>';
    var today=new Date().toISOString().slice(0,10);
    var days=Object.keys(canvassDays).sort().reverse();
    if(days.indexOf(today)===-1) days.unshift(today);
    days.forEach(function(date){
      var o=document.createElement('option');
      o.value=date;
      var day=canvassDays[date];
      var label=formatDate(date)+(date===today?' (today)':'');
      if(day&&day.notes) label+=' · '+day.notes;
      o.textContent=label;
      if(date===today) o.selected=true;
      ds.appendChild(o);
    });
  }
}
function onSetupChange() {
  var name=(document.getElementById('setup-name')||{}).value||'';
  var dateEl=document.getElementById('setup-date');
  var shiftDate=dateEl?dateEl.value:'';
  var btn=document.getElementById('setup-btn');
  if(btn) btn.disabled=!name||!shiftDate;
}
function startApp() {
  myVolId=(document.getElementById('setup-name')||{}).value||'';
  var dateEl=document.getElementById('setup-date');
  if(dateEl&&dateEl.value) todayKey=dateEl.value;
  var shiftDay=canvassDays[todayKey];
  neighborhoodKey=(shiftDay&&shiftDay.neighborhood)||((window.NEIGHBORHOODS&&window.NEIGHBORHOODS[0])?window.NEIGHBORHOODS[0].key:'');
  if(!myVolId||!todayKey) return;
  myVolName=volName(myVolId);
  // Partner is set by admin during assignment — look it up from Firebase
  partnerVolName='';
  var displayName=myVolName;
  document.getElementById('setup-screen').style.display='none';
  document.getElementById('app').style.display='flex';
  document.getElementById('user-badge').textContent=displayName+' ▾';
  document.getElementById('topbar-sub').textContent='Hamline · '+todayKey;
  addresses=window.NEIGHBORHOOD_DATA[neighborhoodKey]||[];
  myAssignments={}; signs=[]; addrToVolId={};
  if(!map) initMap(); else {refreshAllMarkers();fitBounds();}
  var dot=document.getElementById('fb-dot'),lbl=document.getElementById('fb-lbl');
  if(dot) dot.style.background='#d97706'; if(lbl) lbl.textContent='Connecting…';
  fbGet('/.json?shallow=true').then(function(){
    fbConnected=true;
    if(dot) dot.style.background='#27ae60'; if(lbl) lbl.textContent='Syncing live';
    if(pollTimer) clearInterval(pollTimer);
    pollTimer=setInterval(pullCanvasserData,15000);
    pullCanvasserData();
  }).catch(function(){if(dot)dot.style.background='#c0392b';if(lbl)lbl.textContent='Offline';});
  initMobileView();
}

function goSetup() {
  document.getElementById('setup-screen').style.display='flex';
  document.getElementById('app').style.display='none';
  document.getElementById('setup-name').value='';
  document.getElementById('setup-btn').disabled=true;
}

function showUserMenu() {
  document.getElementById('user-menu-name').textContent=myVolName+(partnerVolName?' & '+partnerVolName:'');
  openOverlay('user-menu-overlay');
}

function saveAndExit() {
  pushLogs();
  setTimeout(function(){
    logs={}; signs=[]; myAssignments={}; addrToVolId={};
    if(pollTimer) clearInterval(pollTimer);
    doSignOut();
  },500);
}

// ── CANVASSER MAP ─────────────────────────

function initMap(){
  map=L.map('map',{center:[45.017,-93.153],zoom:15});
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{attribution:'&copy; OpenStreetMap &copy; CARTO',subdomains:'abcd',maxZoom:20}).addTo(map);
  map.whenReady(function(){
    addresses.forEach(function(addr){markers[addr.id]=createMarker(addr);});
    fitBounds(); renderMyList(); renderAllList(); renderLog(); updateStats();
  });
  map.on('click',function(e){
    if(mode!=='signs') return;
    pendingLatLng=e.latlng;
    document.getElementById('sign-coords').textContent=e.latlng.lat.toFixed(5)+', '+e.latlng.lng.toFixed(5);
    document.getElementById('sign-addr').value=''; document.getElementById('sign-notes').value='';
    openOverlay('sign-overlay');
  });
}

function fitBounds(){
  if(!addresses.length||!map) return;
  var lats=addresses.map(function(a){return a.lat;}),lngs=addresses.map(function(a){return a.lng;});
  map.fitBounds([[Math.min.apply(null,lats),Math.min.apply(null,lngs)],[Math.max.apply(null,lats),Math.max.apply(null,lngs)]],{padding:[30,30]});
}

function addrLabel(addr){return addr.n+' '+addr.s+(addr.u?', '+addr.u:'');}
function isMyAddr(addr){return !!myAssignments[addr.id];}
function markerColor(addr){
  if(logs[addr.id]) return '#9ca3af';
  if(myAssignments[addr.id]) return '#D4A832';
  return (PROP_META[addr.t]||PROP_META.house).color;
}

function createMarker(addr){
  var color=markerColor(addr),mine=isMyAddr(addr),size=mine?20:9,op=mine?1:.35;
  var routeIdx = mine ? myRoute.indexOf(addr.id) : -1;
  var isDone = !!logs[addr.id];
  var label = (mine && routeIdx>=0 && !isDone) ? '<span style="font-size:9px;font-weight:800;color:#fff;">'+(routeIdx+1)+'</span>' : '';
  var icon=L.divIcon({className:'',html:'<div style="width:'+size+'px;height:'+size+'px;background:'+color+';border:'+(mine?'2px solid rgba(0,0,0,.2)':'1.5px solid rgba(0,0,0,.1)')+';border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.2);cursor:pointer;opacity:'+op+';display:flex;align-items:center;justify-content:center;">'+label+'</div>',iconSize:[size,size],iconAnchor:[size/2,size/2]});
  var m=L.marker([addr.lat,addr.lng],{icon:icon}).addTo(map);
  m.bindPopup(makePopup(addr),{maxWidth:270,closeButton:true});
  m.on('click',function(e){
    L.DomEvent.stopPropagation(e);
    selectedId=addr.id;
    m.openPopup();
  });
  return m;
}

function makePopup(addr){
  var log=logs[addr.id],meta=PROP_META[addr.t]||PROP_META.house;
  var sc=log?(CONTACT_COLORS[log.contact]||'#888'):'#ccc',st=log?log.contact:'Not logged';
  var detail='';
  if(log){
    if(log.interest) detail+='Interest: '+log.interest+'/5  ';
    var fl=[log.litdrop&&'\uD83D\uDCC4',log.wantContact&&'\uD83D\uDCDE',log.wantSign&&'\uD83E\uDEB7'].filter(Boolean).join(' ');
    if(fl) detail+=fl; if(log.notes) detail+=(detail?'<br>':'')+log.notes;
  }
  var aid=addr.id;
  return '<div class="mpop"><div class="mpop-addr">'+addrLabel(addr)+'</div><div class="mpop-meta">'+addr.s+'</div>' +
    '<span class="mpop-type" style="background:'+meta.color+'22;color:'+meta.color+';">'+meta.label+'</span> ' +
    '<span class="mpop-status" style="background:'+sc+'22;color:'+sc+';">'+st+'</span>' +
    (isMyAddr(addr)?'<div class="mpop-assignee">\uD83D\uDCC4 Your assignment</div>':'') +
    (detail?'<div class="mpop-detail">'+detail+'</div>':'')+
    '<button class="mpop-btn" data-aid="'+aid+'" onclick="openDoor(this.dataset.aid)">'+(log?'\u270F Edit':'+ Log Result')+'</button></div>';
}

function refreshMarker(id){
  var addr=addresses.find(function(a){return a.id===id;});
  if(!addr||!map) return;
  if(markers[id]) map.removeLayer(markers[id]);
  markers[id]=createMarker(addr);
}
function refreshAllMarkers(){addresses.forEach(function(a){refreshMarker(a.id);});}

// ── LISTS ─────────────────────────────────
function renderMyList(){
  var container=document.getElementById('my-list-container');
  var mine=addresses.filter(isMyAddr);
  if(!mine.length){
    container.innerHTML='<div style="padding:32px;text-align:center;color:var(--subtle);font-size:13px;"><div style="font-size:32px;margin-bottom:12px;">\uD83D\uDCCB</div>No addresses assigned yet.<br>Check back after your shift is set up.</div>';
    return;
  }
  mine.sort(function(a,b){var al=!!logs[a.id],bl=!!logs[b.id];if(al!==bl)return al?1:-1;var ai=myRoute.indexOf(a.id),bi=myRoute.indexOf(b.id);if(ai===-1)ai=999;if(bi===-1)bi=999;return ai-bi;});
  container.innerHTML=mine.map(function(addr){
    var log=logs[addr.id],meta=PROP_META[addr.t]||PROP_META.house;
    var dotColor=log?(CONTACT_COLORS[log.contact]||'#888'):'#D4A832';
    var badge=log?'<span class="addr-badge" style="background:'+(CONTACT_COLORS[log.contact]||'#888')+'22;color:'+(CONTACT_COLORS[log.contact]||'#888')+';">'+log.contact+'</span>':'<span class="addr-badge" style="background:'+meta.color+'18;color:'+meta.color+';">'+meta.label+'</span>';
    var routeIdx = myRoute.indexOf(addr.id);
    var numLabel = (!log && routeIdx>=0) ? '<span style="color:var(--gold-acc);font-weight:800;margin-right:4px;">'+(routeIdx+1)+'.</span>' : '';
    return '<div class="addr-item is-mine'+(addr.id===selectedId?' selected':'')+'" data-aid="'+addr.id+'" onclick="handleAddrClick(this.dataset.aid)"><div class="addr-dot" style="background:'+dotColor+';"></div><div class="addr-info"><div class="addr-street">'+numLabel+addrLabel(addr)+'</div><div class="addr-meta">'+addr.s+(log&&log.interest?' \u00B7 \u2605'+log.interest:'')+'</div></div>'+badge+'</div>';
  }).join('');
}

function renderAllList(){
  var q=(document.getElementById('search-input').value||'').toLowerCase();
  var addrs=addresses.slice();
  if(activeFilter!=='all') addrs=addrs.filter(function(a){return a.t===activeFilter;});
  if(q) addrs=addrs.filter(function(a){return (a.n+' '+a.s+' '+a.u).toLowerCase().indexOf(q)!==-1;});
  addrs.sort(function(a,b){var am=isMyAddr(a),bm=isMyAddr(b);if(am!==bm)return am?-1:1;return parseInt(a.n||0)-parseInt(b.n||0);});
  var list=document.getElementById('addr-list');
  if(!addrs.length){list.innerHTML='<div style="padding:24px;text-align:center;color:var(--subtle);font-size:13px;">No addresses match.</div>';return;}
  list.innerHTML=addrs.map(function(addr){
    var log=logs[addr.id],meta=PROP_META[addr.t]||PROP_META.house;
    var dotColor=log?(CONTACT_COLORS[log.contact]||'#888'):meta.color;
    var mine=isMyAddr(addr);
    var otherVolId=!mine?addrToVolId[addr.id]:null;
    var initial=otherVolId?volName(otherVolId).charAt(0).toUpperCase():null;
    var badge=log?'<span class="addr-badge" style="background:'+(CONTACT_COLORS[log.contact]||'#888')+'22;color:'+(CONTACT_COLORS[log.contact]||'#888')+';">'+log.contact+'</span>':otherVolId?'<span class="addr-badge" style="background:#e5e7eb;color:#6b7280;font-size:11px;font-weight:800;">'+initial+'</span>':'<span class="addr-badge" style="background:'+meta.color+'18;color:'+meta.color+';">'+meta.label+'</span>';
    var cls='addr-item'+(mine?' is-mine':'')+(addr.id===selectedId?' selected':'');
    return '<div class="'+cls+'" data-aid="'+addr.id+'" onclick="handleAddrClick(this.dataset.aid)"><div class="addr-dot" style="background:'+dotColor+';opacity:'+(mine?1:(otherVolId?.6:.3))+';"></div><div class="addr-info"><div class="addr-street">'+addrLabel(addr)+'</div><div class="addr-meta">'+addr.s+(log&&log.interest?' \u00B7 \u2605'+log.interest:'')+'</div></div>'+badge+'</div>';
  }).join('');
}

function handleAddrClick(id){
  selectedId=id; renderMyList(); renderAllList();
  var addr=addresses.find(function(a){return a.id===id;});
  if(addr&&map){
    if(window.innerWidth<=640&&!mobileShowingMap){
      document.getElementById('main').className='show-map';
      document.getElementById('fab-toggle').textContent='\u2630 List';
      mobileShowingMap=true;
      setTimeout(function(){map.invalidateSize();map.panTo([addr.lat,addr.lng]);if(markers[id])markers[id].openPopup();},60);
    } else {map.panTo([addr.lat,addr.lng]);if(markers[id])markers[id].openPopup();}
  }
  openDoor(id);
}

function setFilter(f){activeFilter=f;document.querySelectorAll('.filter-chip').forEach(function(c){c.classList.toggle('active',c.dataset.f===f);});renderAllList();}
function setMode(m){
  mode=m;
  document.querySelectorAll('.mode-btn').forEach(function(b,i){b.classList.toggle('active',(i===0&&m==='canvass')||(i===1&&m==='signs'));});
  var hint=document.querySelector('.sign-hint');
  if(m==='signs'){if(!hint){hint=document.createElement('div');hint.className='sign-hint';hint.textContent='\uD83E\uDEB7 Tap map to place a yard sign';document.getElementById('main').appendChild(hint);}}
  else{if(hint)hint.remove();}
}

document.querySelectorAll('.tab').forEach(function(tab){
  tab.addEventListener('click',function(){
    document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active');});
    document.querySelectorAll('.panel').forEach(function(p){p.classList.remove('active');});
    tab.classList.add('active');
    document.getElementById('panel-'+tab.dataset.panel).classList.add('active');
    if(tab.dataset.panel==='export') updateStats();
  });
});

// ── DOOR MODAL ────────────────────────────
function openDoor(id){
  modalId=id;
  var addr=addresses.find(function(a){return a.id===id;}); if(!addr) return;
  var titleEl=document.getElementById('door-title'); if(titleEl) titleEl.textContent=addrLabel(addr);
  var subEl=document.getElementById('door-sub'); if(subEl) subEl.textContent='Roseville, MN 55113 \u00B7 '+addr.s;
  var meta=PROP_META[addr.t]||PROP_META.house;
  var calloutEl=document.getElementById('door-callout');
  if(calloutEl) calloutEl.innerHTML=meta.callout?'<div class="prop-callout '+meta.callout.cls+'">'+meta.callout.icon+' '+meta.callout.text+'</div>':'';
  document.querySelectorAll('.contact-btn').forEach(function(b){b.classList.remove('active');});
  document.querySelectorAll('.interest-btn').forEach(function(b){b.classList.remove('active');});
  ['chk-lit','chk-contact','chk-sign'].forEach(function(cid){document.getElementById(cid).classList.remove('checked');});
  var cf=document.getElementById('contact-fields');
  if(cf) cf.style.display='none';
  document.getElementById('door-name').value='';
  var ln=document.getElementById('door-lastname'); if(ln) ln.value='';
  document.getElementById('door-phone').value='';
  var de=document.getElementById('door-email'); if(de) de.value='';
  var sb=document.getElementById('chk-stopby'); if(sb) sb.classList.remove('checked');
  document.getElementById('door-notes').value='';
  var log=logs[id];
  if(log){
    var cb=document.querySelector('.contact-btn[data-r="'+log.contact+'"]'); if(cb) cb.classList.add('active');
    if(log.litLeft||log.cardLeft) document.getElementById('chk-lit').classList.add('checked'); // support both old+new
    if(log.wantContact){
      document.getElementById('chk-contact').classList.add('checked');
      var cf=document.getElementById('contact-fields');
      if(cf) cf.style.display='block';
      var de=document.getElementById('door-email'); if(de) de.value=log.email||'';
      var ll=document.getElementById('door-lastname'); if(ll) ll.value=log.lastname||'';
      var sb=document.getElementById('chk-stopby'); if(sb&&log.stopBy) sb.classList.add('checked');
    }
    if(log.wantSign&&document.getElementById('chk-sign')) document.getElementById('chk-sign').classList.add('checked');
    if(log.visitAgain) document.getElementById('chk-revisit').classList.add('checked');
    document.getElementById('door-name').value=log.name||'';
    document.getElementById('door-phone').value=log.phone||'';
    document.getElementById('door-notes').value=log.notes||'';
  }
  openOverlay('door-overlay');
}

function selContact(el){document.querySelectorAll('.contact-btn').forEach(function(b){b.classList.remove('active');});el.classList.add('active');}
function toggleWantsContact(el){
  el.classList.toggle('checked');
  var cf=document.getElementById('contact-fields');
  if(cf) cf.style.display=el.classList.contains('checked')?'block':'none';
}


function saveDoor(){
  if(!modalId) return;
  var ce=document.querySelector('.contact-btn.active');
  if(!ce){showToast('Select a contact result first');return;}
  var ie=document.querySelector('.interest-btn.active');
  var addr=addresses.find(function(a){return a.id===modalId;});
  var wantsContact=document.getElementById('chk-contact').classList.contains('checked');
  logs[modalId]={
    contact:ce.dataset.r,
    litLeft:document.getElementById('chk-lit').classList.contains('checked'),
    wantContact:wantsContact,
    wantSign:document.getElementById('chk-sign')?document.getElementById('chk-sign').classList.contains('checked'):false,
    stopBy:wantsContact&&document.getElementById('chk-stopby')?document.getElementById('chk-stopby').classList.contains('checked'):false,
    visitAgain:document.getElementById('chk-revisit').classList.contains('checked'),
    name:wantsContact?document.getElementById('door-name').value.trim():'',
    lastname:wantsContact&&document.getElementById('door-lastname')?document.getElementById('door-lastname').value.trim():'',
    phone:wantsContact?document.getElementById('door-phone').value.trim():'',
    email:wantsContact&&document.getElementById('door-email')?document.getElementById('door-email').value.trim():'',
    notes:document.getElementById('door-notes').value.trim(),
    canvasser:myVolName+(partnerVolName?' & '+partnerVolName:''),
    volId:myVolId,
    propType:addr?addr.t:'house',
    time:new Date().toISOString(),
  };
  refreshMarker(modalId);
  if(markers[modalId]&&addr) markers[modalId].setPopupContent(makePopup(addr));
  renderMyList(); renderAllList(); renderLog(); updateStats();
  closeOverlay('door-overlay');
  showToast('Saved: '+logs[modalId].contact+(logs[modalId].interest?' \u00B7 '+logs[modalId].interest+'/5':''));
  pushLogs();
}

// ── SIGN ──────────────────────────────────
function saveSign(){
  if(!pendingLatLng){closeOverlay('sign-overlay');return;}
  var s={id:'sign_'+Date.now(),lat:pendingLatLng.lat,lng:pendingLatLng.lng,addr:document.getElementById('sign-addr').value.trim(),notes:document.getElementById('sign-notes').value.trim(),date:new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),canvasser:myVolName,neighborhood:neighborhoodKey};
  signs.push(s); placeSignMarker(s);
  closeOverlay('sign-overlay'); pendingLatLng=null;
  showToast('\uD83E\uDEB7 Sign logged'); pushLogs();
}

function placeSignMarker(s){
  if(!map) return;
  var icon=L.divIcon({className:'',html:'<div style="font-size:22px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.2));cursor:pointer;">\uD83E\uDEB7</div>',iconSize:[24,28],iconAnchor:[12,24]});
  var m=L.marker([s.lat,s.lng],{icon:icon}).addTo(map);
  m.bindPopup('<div class="mpop"><div class="mpop-addr">\uD83E\uDEB7 Yard Sign</div><div class="mpop-meta">'+(s.addr||'Location noted')+'</div><div style="font-size:11px;color:var(--muted);margin-top:4px;">'+s.date+' \u00B7 '+s.canvasser+'</div>'+(s.notes?'<div style="font-size:11px;color:var(--muted);margin-top:4px;">'+s.notes+'</div>':'')+'</div>',{maxWidth:240});
  signMarkers.push(m);
}

// ── LOG / STATS / CSV ─────────────────────
function renderLog(){
  var container=document.getElementById('log-list');
  var entries=Object.entries(logs);
  if(!entries.length){container.innerHTML='<div style="padding:32px;text-align:center;color:var(--subtle);font-size:13px;">\uD83D\uDCCB Nothing logged yet.</div>';return;}
  entries.sort(function(a,b){return new Date(b[1].time)-new Date(a[1].time);});
  container.innerHTML=entries.map(function(pair){
    var id=pair[0],log=pair[1];
    var addr=addresses.find(function(a){return a.id===id;});
    var label=addr?addrLabel(addr):'Unknown';
    var color=CONTACT_COLORS[log.contact]||'#888';
    var time=new Date(log.time).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
    var flags=[(log.litLeft||log.cardLeft)&&'📄 Lit left',log.wantContact&&(log.stopBy?'🚶 Stop by personally':'📞 Cassie to contact'),log.wantSign&&'🪧 Yard sign',log.visitAgain&&'🔄 Visit again'].filter(Boolean).join(' · ');
    return '<div class="log-item" data-aid="'+id+'" onclick="openDoor(this.dataset.aid)"><div class="log-header"><div class="log-addr">'+label+'</div><div class="log-badge" style="background:'+color+'22;color:'+color+';">'+log.contact+'</div></div><div class="log-meta">'+time+' \u00B7 '+log.canvasser+(log.interest?' \u00B7 \u2605'+log.interest:'')+'</div>'+(flags?'<div class="log-detail">'+flags+'</div>':'')+(log.notes?'<div class="log-detail">'+log.notes+'</div>':'')+'</div>';
  }).join('');
}

function updateStats(){
  var el=document.getElementById('export-stats'); if(!el) return;
  var arr=Object.values(logs);
  var counts={}; Object.keys(CONTACT_COLORS).forEach(function(k){counts[k]=0;});
  arr.forEach(function(l){if(counts[l.contact]!==undefined)counts[l.contact]++;});
  el.innerHTML='<div class="stat-grid"><div class="stat-card"><div class="stat-n">'+arr.length+'</div><div class="stat-l">Logged</div></div><div class="stat-card"><div class="stat-n" style="color:#27ae60;">'+arr.filter(function(l){return l.interest>=4;}).length+'</div><div class="stat-l">4\u20135 Interest</div></div><div class="stat-card"><div class="stat-n" style="color:var(--gold-acc);">'+signs.length+'</div><div class="stat-l">Signs</div></div></div><div class="stat-grid">'+Object.entries(counts).map(function(e){return '<div class="stat-card"><div class="stat-n" style="font-size:16px;color:'+(CONTACT_COLORS[e[0]]||'#888')+';">'+e[1]+'</div><div class="stat-l" style="font-size:8px;">'+e[0]+'</div></div>';}).join('')+'</div><div class="stat-grid"><div class="stat-card"><div class="stat-n" style="color:#27ae60;">'+arr.filter(function(l){return l.wantContact;}).length+'</div><div class="stat-l">Want Contact</div></div><div class="stat-card"><div class="stat-n" style="color:var(--gold-acc);">'+arr.filter(function(l){return l.wantSign;}).length+'</div><div class="stat-l">Want Sign</div></div><div class="stat-card"><div class="stat-n">'+arr.filter(function(l){return l.litdrop;}).length+'</div><div class="stat-l">Lit Drop</div></div></div>';
}

function buildCSV(){
  var rows=['Neighborhood,Address,Unit,Street,Property Type,Lat,Lng,Contact Result,Lit Left,Cassie to Contact,Stop By,Wants Sign,Visit Again,First Name,Last Name,Phone,Email,Notes,Canvasser,Date,Time'];
  var hoodName=(window.NEIGHBORHOODS.find(function(n){return n.key===neighborhoodKey;})||{}).displayName||neighborhoodKey;
  addresses.forEach(function(addr){
    var log=logs[addr.id]; if(!log) return;
    var dt=new Date(log.time);
    rows.push(['"'+hoodName+'"','"'+addr.n+' '+addr.s+'"','"'+addr.u+'"','"'+addr.s+'"','"'+((PROP_META[addr.t]||PROP_META.house).label)+'"',addr.lat,addr.lng,'"'+log.contact+'"',log.interest||'',log.litdrop?'Yes':'No',log.wantContact?'Yes':'No',log.wantSign?'Yes':'No','"'+(log.name||'').replace(/"/g,'""')+'"','"'+(log.party||'')+'"','"'+(log.phone||'').replace(/"/g,'""')+'"','"'+(log.notes||'').replace(/"/g,'""')+'"','"'+log.canvasser+'"','"'+dt.toLocaleDateString()+'"','"'+dt.toLocaleTimeString()+'"'].join(','));
  });
  if(signs.length){rows.push('');rows.push('YARD SIGNS');rows.push('Neighborhood,Address/Location,Lat,Lng,Notes,Date,Canvasser');signs.forEach(function(s){rows.push('"'+hoodName+'","'+s.addr+'",'+s.lat+','+s.lng+',"'+(s.notes||'')+'","'+s.date+'","'+s.canvasser+'"');});}
  return rows.join('\n');
}

function exportCSV(){var csv=buildCSV(),blob=new Blob([csv],{type:'text/csv'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='cassie-canvass-'+neighborhoodKey+'-'+todayKey+'.csv';a.click();URL.revokeObjectURL(url);showToast('CSV downloaded');}
function copyCSV(){navigator.clipboard.writeText(buildCSV()).then(function(){showToast('Copied');}).catch(function(){showToast('Try Download');});}
function confirmClear(){if(confirm('Clear all logged results?')){logs={};signs=[];signMarkers.forEach(function(m){map&&map.removeLayer(m);});signMarkers=[];refreshAllMarkers();renderMyList();renderAllList();renderLog();updateStats();showToast('Cleared');}}

// ── FIREBASE CANVASSER ────────────────────
function pushLogs(){
  if(!fbConnected||!neighborhoodKey) return;
  fbPut('/'+neighborhoodKey+'/logs/'+todayKey+'/'+myVolId, logs).catch(function(){});
  if(signs.length) fbPut('/'+neighborhoodKey+'/signs/'+todayKey, signs).catch(function(){});
}

function pullCanvasserData(){
  if(!fbConnected||!neighborhoodKey) return;
  // Pull all assignments for today to build addrToVolId map
  fbGet('/'+neighborhoodKey+'/assignments/'+todayKey).then(function(d){
    if(!d||typeof d!=='object') return;
    addrToVolId={};
    myAssignments={};
    myRoute=[];
    Object.entries(d).forEach(function(pair){
      var vid=pair[0], data=pair[1];
      if(!data) return;
      // Handle new {route,assignments} format and legacy flat format
      var assigns = (data.assignments && typeof data.assignments==='object')
        ? data.assignments : data;
      var route = Array.isArray(data.route) ? data.route : Object.keys(assigns);
      route.forEach(function(addrId){
        if(addrId==='route'||addrId==='assignments') return;
        addrToVolId[addrId]=vid;
        if(vid===myVolId){ myAssignments[addrId]=true; myRoute.push(addrId); }
      });
    });
    // Detect partner: another vol with same assignments on same day
    if (!partnerVolName) {
      Object.entries(d).forEach(function(pair){
        var vid=pair[0], data=pair[1];
        if(vid===myVolId||!data) return;
        var assigns = (data.assignments && typeof data.assignments==='object') ? data.assignments : data;
        var overlap=Object.keys(assigns).filter(function(id){return myAssignments[id] && id!=='route' && id!=='assignments';});
        if(overlap.length > 2) {
          partnerVolName = volName(vid);
          var badge = document.getElementById('user-badge');
          if(badge) badge.textContent = myVolName+' & '+partnerVolName+' ▾';
        }
      });
    }
    refreshAllMarkers(); renderMyList(); renderAllList();
  }).catch(function(){});
  // Pull today's logs
  fbGet('/'+neighborhoodKey+'/logs/'+todayKey).then(function(d){
    if(!d||typeof d!=='object') return;
    var changed=false;
    Object.values(d).forEach(function(vl){
      if(!vl||typeof vl!=='object') return;
      Object.entries(vl).forEach(function(p){if(!logs[p[0]]){logs[p[0]]=p[1];refreshMarker(p[0]);changed=true;}});
    });
    if(changed){renderMyList();renderAllList();renderLog();updateStats();}
  }).catch(function(){});
}

// ── MOBILE ────────────────────────────────
function toggleMobileView(){
  var main=document.getElementById('main'),fab=document.getElementById('fab-toggle');
  if(mobileShowingMap){main.className='show-list';fab.textContent='\uD83D\uDDFA Map';mobileShowingMap=false;}
  else{main.className='show-map';fab.textContent='\u2630 List';mobileShowingMap=true;if(map)setTimeout(function(){map.invalidateSize();},50);}
}
function initMobileView(){
  var isMobile=window.innerWidth<=640,main=document.getElementById('main');
  if(isMobile){main.className='show-map';mobileShowingMap=true;document.getElementById('fab-toggle').textContent='\u2630 List';}
  else main.className='';
}
window.addEventListener('resize',function(){if(window.innerWidth>640)document.getElementById('main').className='';});

// ── OVERLAYS / TOAST ─────────────────────
function openOverlay(id){document.getElementById(id).classList.add('open');}
function closeOverlay(id){document.getElementById(id).classList.remove('open');}
function bgClose(e,id){if(e.target===document.getElementById(id))closeOverlay(id);}
var toastTimer;
function showToast(msg){var t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(function(){t.classList.remove('show');},2500);}

// ── PRINT WALK SHEET ─────────────────────
function printWalkSheet() {
  if (!adminVolId || !adminCurrentDay || !adminHoodKey) { showToast('Select shift and canvasser first'); return; }
  if (!Object.keys(adminSelected).length) { showToast('No addresses selected'); return; }

  var psel = document.getElementById('admin-partner');
  var partnerId = psel ? psel.value : '';
  var names = volName(adminVolId) + (partnerId && partnerId !== adminVolId ? ' & ' + volName(partnerId) : '');
  var selected = adminAddresses.filter(function(a) { return adminSelected[a.id]; });
  if (!selected.length) { showToast('No addresses selected to print'); return; }

  var hood = window.NEIGHBORHOODS.find(function(n){return n.key===adminHoodKey;});
  var hoodName = hood ? hood.displayName : adminHoodKey;
  var dateStr = new Date(adminCurrentDay+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});

  var typeLabels = {
    senior:'55+ \u2014 Call first',
    apartment:'Apt \u2014 Coordinate',
    mobile:'Mobile Home \u2014 Coordinate',
    assisted:'Assisted Living \u2014 Call first'
  };

  // Use admin-defined route order
  var addrMap = {};
  selected.forEach(function(a){ addrMap[a.id]=a; });
  var sortedAddrs = adminRoute
    .filter(function(id){ return !!addrMap[id]; })
    .map(function(id){ return addrMap[id]; });
  // Any selected not in route — append at end
  selected.forEach(function(a){
    if(adminRoute.indexOf(a.id)===-1) sortedAddrs.push(a);
  });

  // ── BUILD TABLE ROWS ──────────────────────────────────────────────────────
  var rows = '';
  sortedAddrs.forEach(function(addr, i) {
    var num = i + 1;
    var isOdd = parseInt(addr.n||0) % 2 === 1;
    var meta = addr.t !== 'house' ? (typeLabels[addr.t]||addr.t) : '';
    var side = isOdd ? 'odd-row' : 'even-row';
    rows +=
      '<tr class="addr-row ' + side + '">' +
        '<td class="num">' + num + '</td>' +
        '<td class="addr">' +
          '<span style="font-weight:800;">' + addr.n + '</span> ' + addr.s +
          (addr.u ? '<span class="unit"> · ' + addr.u + '</span>' : '') +
          (meta ? '<div class="warn">' + meta + '</div>' : '') +
        '</td>' +
        '<td class="cb-cell"><span class="cb"></span></td>' +
        '<td class="cb-cell"><span class="cb"></span></td>' +
        '<td class="cb-cell"><span class="cb"></span></td>' +
        '<td class="cb-cell"><span class="cb"></span></td>' +
        '<td class="cb-cell"><span class="cb"></span></td>' +
        '<td class="cb-cell"><span class="cb"></span></td>' +
        '<td class="cb-cell"><span class="cb"></span></td>' +
        '<td class="notes-cell"></td>' +
      '</tr>';
  });

  // ── LEGEND FOR PROPERTY TYPES ─────────────────────────────────────────────
  var typesSeen = {};
  selected.forEach(function(a){ if(a.t!=='house') typesSeen[a.t]=true; });
  var legend = Object.keys(typesSeen).filter(function(t){return typeLabels[t];}).map(function(t){
    return '\u26A0\uFE0F ' + typeLabels[t];
  }).join('  \u00B7  ');

  var css =
    '@import url("https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap");' +
    'body{font-family:Outfit,sans-serif;font-size:9pt;color:#1d1b16;margin:0;}' +
    '.page{padding:10mm 12mm;}' +
    '.hdr{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:6px;border-bottom:3px solid #D4A832;margin-bottom:6px;}' +
    '.hdr-l .camp{font-size:7.5pt;font-weight:800;color:#9A7215;}' +
    '.hdr-l .title{font-size:14pt;font-weight:800;line-height:1.1;margin:2px 0;}' +
    '.hdr-l .meta{font-size:8pt;color:#6b6860;}' +
    '.hdr-r{text-align:right;}' +
    '.hdr-r .cnt{font-size:18pt;font-weight:800;color:#D4A832;line-height:1;}' +
    '.hdr-r .cnt-l{font-size:7pt;color:#6b6860;text-transform:uppercase;letter-spacing:.05em;}' +
    '.legend{font-size:7.5pt;color:#d97706;font-weight:600;margin-bottom:6px;}' +
    'table{width:100%;border-collapse:collapse;}' +
    'th{font-size:7pt;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#6b6860;' +
      'padding:4px 4px 3px;border-bottom:2px solid #e0ddd3;text-align:center;white-space:nowrap;}' +
    'th.addr-th{text-align:left;}' +
    '.sh td{font-size:8pt;font-weight:800;color:#9A7215;text-transform:uppercase;letter-spacing:.06em;' +
      'background:#fdf6e0;padding:5px 4px 3px;border-bottom:2px solid #D4A832;page-break-after:avoid;}' +
    '.addr-row td{padding:4px 4px;border-bottom:1px solid #f0ede4;vertical-align:middle;}' +
    '.odd-row{background:#fff;}' +
    '.even-row{background:#faf8f4;}' +
    '.num{width:18px;font-size:8pt;font-weight:800;color:#a8a49a;text-align:right;padding-right:6px!important;}' +
    '.addr{font-size:9.5pt;font-weight:700;min-width:120px;}' +
    '.unit{font-size:8pt;font-weight:400;color:#6b6860;}' +
    '.warn{font-size:7pt;color:#d97706;font-weight:600;}' +
    '.cb-cell{width:28px;text-align:center;}' +
    '.cb{display:inline-block;width:10px;height:10px;border:1.5px solid #888;border-radius:2px;}' +
    '.notes-cell{min-width:80px;border-left:1px solid #e8e4dc;}' +
    '.footer{margin-top:8px;padding-top:4px;border-top:1px solid #e0ddd3;font-size:7pt;color:#a8a49a;display:flex;justify-content:space-between;}' +
    '.side-note{font-size:7pt;color:#a8a49a;text-align:center;font-style:italic;}' +
    '@media print{.addr-row{page-break-inside:avoid;}.sh{page-break-inside:avoid;page-break-after:avoid;}}';

  var body =
    '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
    '<title>Walk Sheet \u2014 ' + names + ' \u2014 ' + adminCurrentDay + '</title>' +
    '<style>' + css + '</style></head><body>' +
    '<div class="page">' +
      '<div class="hdr">' +
        '<div class="hdr-l">' +
          '<div class="camp">Cassie for Roseville \u2014 Field App</div>' +
          '<div class="title">Walk Sheet: ' + names + '</div>' +
          '<div class="meta">' + hoodName + ' \u00B7 ' + dateStr + '</div>' +
        '</div>' +
        '<div class="hdr-r">' +
          '<div class="cnt">' + selected.length + '</div>' +
          '<div class="cnt-l">Addresses</div>' +
        '</div>' +
      '</div>' +
      (legend ? '<div class="legend">\u26A0\uFE0F ' + legend + '</div>' : '') +
      '<table>' +
        '<thead><tr>' +
          '<th></th>' +
          '<th class="addr-th">Address</th>' +
          '<th>Not<br>Home</th>' +
          '<th>Vacant</th>' +
          '<th>For<br>Sale</th>' +
          '<th>No<br>Solic.</th>' +
          '<th>Refused</th>' +
          '<th>Accepted</th>' +
          '<th>Other<br>Lang.</th>' +
          '<th style="text-align:left;padding-left:6px;">Card / Contact / Revisit \u00B7 Name \u00B7 Phone \u00B7 Notes</th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>' +
      '<div class="footer">' +
        '<span>Cassie Iverson for Roseville City Council 2026 \u00B7 cassie4roseville.com</span>' +
        '<span>Printed ' + new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) + '</span>' +
      '</div>' +
    '</div>' +
    '<scr' + 'ipt>window.onload=function(){window.print();};<' + '/script>' +
    '</body></html>';

  try {
    var blob = new Blob([body], {type: 'text/html'});
    var url = URL.createObjectURL(blob);
    var w = window.open(url, '_blank');
    if (!w) { showToast('Allow popups to print walk sheets'); }
    // Revoke after delay to allow print dialog
    setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
  } catch(e) {
    showToast('Print error: ' + e.message);
  }
}


// ── MISSING FUNCTIONS RESTORED ───────────────────────────
function buildNewDayHoodSelect() {
  var sel = document.getElementById('new-day-hood');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Select —</option>';
  window.NEIGHBORHOODS.forEach(function(n) {
    var o = document.createElement('option');
    o.value = n.key; o.textContent = n.displayName;
    sel.appendChild(o);
  });
}

function toggleVolCheckItem(el) {
  el.classList.toggle('checked');
}

function renderNewDayVolunteers() {
  var vols = activeVols();
  var container = document.getElementById('new-day-volunteers');
  if (!container) return;
  if (!vols.length) {
    container.innerHTML = '<div style="font-size:12px;color:var(--subtle);">Add volunteers to roster first.</div>';
    return;
  }
  container.innerHTML = vols.map(function(v) {
    return '<div class="vol-check-item" data-id="' + v.id + '" onclick="toggleVolCheckItem(this)">' +
      '<div class="vci-box">✓</div>' +
      '<div class="vci-name">' + v.name + '</div>' +
    '</div>';
  }).join('');
}


function saveNewDay() {
  var date = document.getElementById('new-day-date').value;
  var hood = document.getElementById('new-day-hood').value;
  var notes = document.getElementById('new-day-notes').value.trim();
  if (!date) { showToast('Pick a date'); return; }
  if (!hood) { showToast('Pick a neighborhood'); return; }
  var checked = document.querySelectorAll('#new-day-volunteers .vol-check-item.checked');
  var vols = Array.from(checked).map(function(el) { return el.dataset.id; });
  canvassDays[date] = {
    neighborhood: hood, notes: notes, volunteers: vols,
    created: new Date().toISOString()
  };
  fbPut('/canvass-days/' + date, canvassDays[date]).then(function() {
    renderDaysList();
    buildAssignDaySelect();
    // Reset form
    document.getElementById('new-day-date').value = '';
    document.getElementById('new-day-notes').value = '';
    document.getElementById('new-day-hood').value = '';
    renderNewDayVolunteers();
    showToast('Shift created for ' + formatDate(date));
  }).catch(function() { showToast('Save failed — check connection'); });
}

function deleteDay(date) {
  if (!confirm('Delete shift for ' + formatDate(date) + '? Assignments and logs are kept.')) return;
  delete canvassDays[date];
  fbPut('/canvass-days/' + date, null).then(function() {
    renderDaysList();
    buildAssignDaySelect();
    showToast('Shift deleted');
  }).catch(function() { showToast('Delete failed'); });
}

function formatDate(dateStr) {
  var d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric'});
}

// ── BOOT ──────────────────────────────────
// Boot handled by js/auth.js
