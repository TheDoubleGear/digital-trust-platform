/* Accesso dimostrativo condiviso della Digital Trust Platform.
   ATTENZIONE: non è un sistema di sicurezza. Le credenziali sono scritte in chiaro in questo file,
   i controlli avvengono solo nel browser e servono a far vivere il prototipo "come se" ci fosse un login.
   - sessionStorage  "dtp-demo-role"      -> solo il ruolo della sessione demo (mai la password)
   - localStorage    "dtp-demo-lr-setup"  -> avanzamento del primo setup del legale rappresentante
   - sessionStorage  "dtp-demo-flash"     -> messaggio di cortesia mostrato una sola volta dopo un reindirizzamento
   Il file è usato dalle 22 pagine HTML, dall'app React (login e Workspace) e dai test node. */
(function (root) {
  'use strict';

  var ROLE_KEY = 'dtp-demo-role';
  var SETUP_KEY = 'dtp-demo-lr-setup';
  /* Dati dimostrativi condivisi tra le pagine: richieste di modifica (dtp-modifiche.js), codici di configurazione (V-02)
     e cambio del legale rappresentante (dtp-subentro.js). */
  var DEMO_DATA_KEYS = ['dtp-demo-modifiche', 'dtp-demo-config-codes', 'dtp-demo-subentro'];
  var FLASH_KEY = 'dtp-demo-flash';
  var LEGACY_KEYS = ['dtp-persona-cliente', 'dtp-persona-postel'];
  var LOGIN = 'login';

  var H = 'cliente-H-catalogo.html';
  var PS01 = 'cliente-PS01-delegati.html';
  var PS02 = 'cliente-PS02-soglie.html';
  var D0 = 'tecnico-D0-developer-portal.html';

  var ROLES = {
    lr: { label: 'Legale rappresentante', area: 'Portale cliente' },
    amm: { label: 'Delegato amministrativo', area: 'Portale cliente' },
    op: { label: 'Delegato operativo', area: 'Portale cliente' },
    tec: { label: 'Delegato tecnico', area: 'Developer portal' },
    com: { label: 'Commerciale', area: 'Console Postel' },
    ops: { label: 'Operations', area: 'Console Postel' },
    cdg: { label: 'Controllo di gestione', area: 'Console Postel' }
  };

  /* Le sette coppie della demo. Utente senza distinzione tra maiuscole e minuscole, password esatta. */
  var ACCOUNTS = [
    { user: 'LR', password: 'LR1', role: 'lr' },
    { user: 'DA', password: 'DA1', role: 'amm' },
    { user: 'DO', password: 'DO1', role: 'op' },
    { user: 'DT', password: 'DT1', role: 'tec' },
    { user: 'C', password: 'C1', role: 'com' },
    { user: 'O', password: 'O1', role: 'ops' },
    { user: 'CDG', password: 'CDG1', role: 'cdg' }
  ];

  var HOME = { amm: H, op: H, tec: D0, com: 'postel-O1-executive.html', ops: 'postel-O3-operations.html', cdg: 'postel-O4-marginalita.html' };

  /* Ruoli ammessi per pagina: rispecchiano le "options" di persona dichiarate in DC.mount di ciascuna pagina
     (un test verifica che restino allineati). PS-01/PS-02 e D0 non dichiarano persone: valgono i ruoli qui sotto. */
  var CLIENT = ['lr', 'amm', 'op'];
  var CLIENT_TEC = ['lr', 'amm', 'op', 'tec'];
  var PAGES = {
    'vetrina-V01-catalogo.html': { code: 'V-01', open: true },
    'vetrina-V02-contratto.html': { code: 'V-02', open: true },
    'vetrina-V03-subentro.html': { code: 'V-03', open: true },
    'vetrina-V04-servizio.html': { code: 'V-04', open: true },
    'vetrina-V05-consulente.html': { code: 'V-05', open: true },
    'cliente-H-catalogo.html': { code: 'H', roles: CLIENT },
    'cliente-U-utenze.html': { code: 'U', roles: CLIENT },
    'cliente-M1-panoramica.html': { code: 'M1', roles: CLIENT_TEC },
    'cliente-M2-dettaglio.html': { code: 'M2', roles: CLIENT_TEC },
    'cliente-M3-qualita.html': { code: 'M3', roles: CLIENT_TEC },
    'cliente-M4-fatture.html': { code: 'M4', roles: CLIENT },
    'cliente-M5-contratto.html': { code: 'M5', roles: CLIENT },
    'cliente-A-assistenza.html': { code: 'A', roles: CLIENT_TEC },
    'cliente-N-notifiche.html': { code: 'N', roles: CLIENT_TEC },
    'cliente-PS01-delegati.html': { code: 'PS-01', roles: ['lr'], setup: 1 },
    'cliente-PS02-soglie.html': { code: 'PS-02', roles: ['lr'], setup: 2 },
    'tecnico-D0-developer-portal.html': { code: 'D0', roles: ['tec'] },
    'postel-O1-executive.html': { code: 'O1', roles: ['com', 'cdg'] },
    'postel-O2-portafoglio.html': { code: 'O2', roles: ['com', 'ops', 'cdg'] },
    'postel-O3-operations.html': { code: 'O3', roles: ['ops', 'com'] },
    'postel-O4-marginalita.html': { code: 'O4', roles: ['cdg', 'com'] },
    'postel-O5-scheda-cliente.html': { code: 'O5', roles: ['com', 'ops', 'cdg'] }
  };

  /* ---------- archiviazione ----------
     Nessun ripiego in memoria: se il browser blocca l'archiviazione la sessione non sopravviverebbe al cambio
     di pagina, quindi la scrittura fallisce in modo esplicito e chi la chiama avvisa l'utente.
     Le letture e le cancellazioni non sollevano errori: senza archiviazione semplicemente non c'è sessione. */
  var STORAGE_MESSAGES = {
    sessionStorage: 'Non è possibile avviare la sessione demo: il browser non consente di salvare i dati di questo sito. Consenti i dati del sito oppure esci dalla navigazione privata, poi riprova.',
    localStorage: 'Non è possibile salvare l\'avanzamento del primo setup: il browser non consente di salvare i dati di questo sito. Consenti i dati del sito oppure esci dalla navigazione privata, poi riprova.'
  };
  function storageError(kind, cause) {
    var err = new Error(STORAGE_MESSAGES[kind]);
    err.name = 'DTPStorageError';
    err.code = 'storage-unavailable';
    err.storage = kind;
    if (cause) err.cause = cause;
    return err;
  }
  function isStorageError(err) { return !!err && err.name === 'DTPStorageError'; }
  function store(kind) {
    try { var s = root[kind]; if (s && typeof s.getItem === 'function') return s; } catch (e) {}
    return null;
  }
  function read(kind, key) {
    var s = store(kind);
    if (s) { try { return s.getItem(key); } catch (e) {} }
    return null;
  }
  /* Solleva DTPStorageError se il valore non risulta davvero salvato. */
  function write(kind, key, value) {
    var s = store(kind);
    if (!s) throw storageError(kind);
    try { s.setItem(key, value); } catch (e) { throw storageError(kind, e); }
    var back = null;
    try { back = s.getItem(key); } catch (e2) {}
    if (back !== value) throw storageError(kind);
  }
  function drop(kind, key) {
    var s = store(kind);
    if (s) { try { s.removeItem(key); } catch (e) {} }
  }

  /* ---------- logica pura: credenziali, sessione, setup, destinazioni, permessi ---------- */
  function isRole(role) { return typeof role === 'string' && Object.prototype.hasOwnProperty.call(ROLES, role); }

  function authenticate(user, password) {
    var u = String(user == null ? '' : user).trim().toUpperCase();
    var p = String(password == null ? '' : password);
    for (var i = 0; i < ACCOUNTS.length; i++) {
      if (ACCOUNTS[i].user === u && ACCOUNTS[i].password === p) return { user: ACCOUNTS[i].user, role: ACCOUNTS[i].role };
    }
    return null;
  }

  function getRole() { var r = read('sessionStorage', ROLE_KEY); return isRole(r) ? r : null; }

  function clearLegacy() { LEGACY_KEYS.forEach(function (k) { drop('sessionStorage', k); }); }

  /* Riceve solo il ruolo: la password non arriva mai fin qui e non viene salvata.
     Solleva DTPStorageError se la sessione non può essere salvata: in quel caso non si deve navigare. */
  function login(role) {
    if (!isRole(role)) return false;
    clearLegacy();
    drop('sessionStorage', FLASH_KEY);
    write('sessionStorage', ROLE_KEY, role);
    return true;
  }

  function clearSession() {
    drop('sessionStorage', ROLE_KEY);
    drop('sessionStorage', FLASH_KEY);
    clearLegacy();
  }

  function getSetup() {
    var out = { delegates: false, done: false };
    try {
      var v = JSON.parse(read('localStorage', SETUP_KEY) || 'null');
      if (v && typeof v === 'object') { out.done = v.done === true; out.delegates = out.done || v.delegates === true; }
    } catch (e) {}
    return out;
  }
  function saveSetup(s) { write('localStorage', SETUP_KEY, JSON.stringify({ delegates: !!s.delegates, done: !!s.done })); }
  /* PS-01 "Continua": sblocca PS-02, il setup resta da concludere. Come completeSetup, solleva DTPStorageError se non riesce a salvare. */
  function markDelegates() { var s = getSetup(); if (!s.delegates) saveSetup({ delegates: true, done: s.done }); return getSetup(); }
  /* Solo PS-02 "Concludi" chiude il setup; resta chiuso anche dopo logout e nuovi accessi. */
  function completeSetup() { saveSetup({ delegates: true, done: true }); return getSetup(); }
  function resetSetup() { drop('localStorage', SETUP_KEY); return getSetup(); }
  /* "Ripristina dati demo": riporta modifiche, codici e subentro allo stato iniziale. Il primo accesso del LR ha il suo pulsante. */
  function resetDemoData() { DEMO_DATA_KEYS.forEach(function (k) { drop('localStorage', k); }); }

  function homeFor(role, setup) {
    if (!isRole(role)) return LOGIN;
    if (role === 'lr') return (setup || getSetup()).done ? H : PS01;
    return HOME[role];
  }

  /* Decide se "role" può aprire "file". Non cambia mai il ruolo: chi non può entrare viene mandato altrove. */
  function decide(file, role, setup, rolesOverride) {
    var page = PAGES[file];
    if (!page && !rolesOverride) return { allow: true, reason: 'unmanaged' };
    if (page && page.open) return { allow: true, reason: 'open' };
    if (!isRole(role)) return { allow: false, reason: 'anon', redirect: LOGIN };
    var st = setup || getSetup();
    var roles = rolesOverride || page.roles || [];
    if (roles.indexOf(role) < 0) return { allow: false, reason: 'role', redirect: homeFor(role, st) };
    if (role === 'lr') {
      var step = page ? page.setup : 0;
      if (st.done) {
        if (step) return { allow: false, reason: 'setup-done', redirect: H };
      } else {
        if (!step) return { allow: false, reason: 'setup', redirect: PS01 };
        if (step === 2 && !st.delegates) return { allow: false, reason: 'setup-order', redirect: PS01 };
      }
    }
    return { allow: true, reason: 'ok' };
  }

  function destinationAfterLogin(role, setup, next) {
    var st = setup || getSetup();
    if (next && PAGES[next] && !PAGES[next].open && decide(next, role, st).allow) return next;
    return homeFor(role, st);
  }

  function reasonText(reason, role) {
    var label = isRole(role) ? ROLES[role].label : '';
    if (reason === 'role') return 'Pagina non disponibile per il ruolo ' + label + '.';
    if (reason === 'setup') return 'Disponibile dopo il primo setup: prima i delegati (PS-01), poi soglie e notifiche (PS-02).';
    if (reason === 'setup-order') return 'Conferma prima i delegati in PS-01: poi si apre PS-02.';
    if (reason === 'setup-done') return 'Il primo setup è già concluso e non è più disponibile.';
    if (reason === 'anon') return 'Accedi con una credenziale demo per aprire questa pagina.';
    return '';
  }

  var api = {
    ROLES: ROLES, ACCOUNTS: ACCOUNTS, PAGES: PAGES, LOGIN: LOGIN, LEGACY_KEYS: LEGACY_KEYS,
    KEYS: { role: ROLE_KEY, setup: SETUP_KEY, flash: FLASH_KEY }, DEMO_DATA_KEYS: DEMO_DATA_KEYS,
    authenticate: authenticate, login: login, clearSession: clearSession, getRole: getRole,
    getSetup: getSetup, markDelegates: markDelegates, completeSetup: completeSetup, resetSetup: resetSetup, resetDemoData: resetDemoData,
    homeFor: homeFor, decide: decide, destinationAfterLogin: destinationAfterLogin, reasonText: reasonText,
    isStorageError: isStorageError,
    /* Messaggio di cortesia: se non si può salvare si rinuncia al messaggio, non è stato di sessione. */
    setFlash: function (text) { if (!text) return; try { write('sessionStorage', FLASH_KEY, String(text)); } catch (e) {} },
    takeFlash: function () { var t = read('sessionStorage', FLASH_KEY); drop('sessionStorage', FLASH_KEY); return t || null; }
  };
  root.DTPAuth = api;

  /* ---------- parte browser ---------- */
  var doc = root.document;
  if (!doc) return;

  var scriptSrc = doc.currentScript && doc.currentScript.src ? doc.currentScript.src.split(/[?#]/)[0] : '';
  function mockupsBase() {
    if (scriptSrc) return scriptSrc.replace(/[^/]*$/, '');
    var p = root.location.pathname, i = p.indexOf('/mockups/');
    return root.location.origin + (i >= 0 ? p.slice(0, i) : '') + '/mockups/';
  }
  function appBase() { return mockupsBase().replace(/mockups\/$/, ''); }
  /* L'accesso demo vive su /accesso: la radice del sito apre la vetrina V-01. */
  function loginUrl(next) { return appBase() + 'accesso' + (next ? '?next=' + encodeURIComponent(next) : ''); }
  function workspaceUrl() { return appBase() + 'workspace'; }
  function pageUrl(file) { return mockupsBase() + file; }
  function currentFile() { var seg = root.location.pathname.split('/'); return seg[seg.length - 1] || ''; }
  function fileOfAnchor(a) {
    var href = a.href || '', base = mockupsBase();
    if (href.indexOf(base) !== 0) return null;
    var f = href.slice(base.length).split(/[?#]/)[0];
    return PAGES[f] ? f : null;
  }

  api.urls = { login: loginUrl, workspace: workspaceUrl, page: pageUrl };
  api.currentFile = currentFile;
  /* Sostituibile nei test. */
  api._navigate = function (url, replace) { if (replace) root.location.replace(url); else root.location.assign(url); };

  var denied = false, enteredRoles = null;

  function deny(d, file) {
    denied = true;
    var app = doc.getElementById('app');
    if (app) app.replaceChildren();
    if (d.redirect === LOGIN) { api._navigate(loginUrl(file), true); return; }
    api.setFlash(reasonText(d.reason, getRole()));
    api._navigate(pageUrl(d.redirect), true);
  }

  /* Chiamata da DC.mount: restituisce il ruolo della sessione oppure null dopo aver avviato il reindirizzamento. */
  api.enter = function (meta) {
    var file = currentFile(), page = PAGES[file];
    var roles = meta && meta.persona && meta.persona.options ? meta.persona.options.slice() : (page && page.roles) || [];
    var role = getRole();
    var d = decide(file, role, getSetup(), roles);
    if (!d.allow) { deny(d, file); return null; }
    enteredRoles = roles;
    return { role: role, label: ROLES[role].label };
  };

  api.logout = function (opts) {
    clearSession();
    api.setFlash('Sei uscito dalla sessione demo.');
    if (!opts || opts.navigate !== false) { denied = true; api._navigate(loginUrl(), true); }
  };

  function toast(text) {
    if (!text || !doc.body) return;
    var el = doc.getElementById('dtp-demo-toast');
    if (!el) {
      el = doc.createElement('div');
      el.id = 'dtp-demo-toast'; el.className = 'dtp-toast';
      el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
      el.setAttribute('data-testid', 'status-demo-notice');
      doc.body.appendChild(el);
    }
    el.textContent = text;
    el.setAttribute('data-show', 'true');
    root.clearTimeout(toast.t);
    toast.t = root.setTimeout(function () { el.removeAttribute('data-show'); }, 6000);
  }
  api.toast = toast;

  /* Dopo ogni render: mostra il ruolo corrente e segna i collegamenti che il ruolo non può aprire. */
  api.decorate = function (scope) {
    /* Ogni render ricrea il template: integra i controlli nella navigazione
       prima che venga mostrata, senza cambiare sessione o gestori di uscita. */
    var bar = scope.querySelector('.dtp-projectbar');
    var sidebar = scope.querySelector('.dtp-sidenav');
    var header = scope.querySelector('.dtp-header > div:not(.dtp-projectbar)');
    if (bar && (sidebar || header)) {
      var home = bar.querySelector('[data-testid="link-home"]');
      var logout = bar.querySelector('[data-dtp-logout]');
      if (home && logout) {
        home.textContent = 'Workspace';
        if (sidebar) {
          var actions = el('div', { 'class': 'dtp-sidebar-actions' });
          actions.appendChild(home);
          actions.appendChild(logout);
          sidebar.appendChild(actions);
        } else {
          /* Workspace è un collegamento del prototipo: sta nel gruppo dell'utente, a destra, prima di identità ed Esci. */
          header.classList.add('dtp-client-header');
          home.classList.add('dtp-workspace-link');
          home.setAttribute('title', 'Workspace: indice delle schermate del prototipo');
          var identity = header.lastElementChild;
          var account = el('div', { 'class': 'dtp-client-account' });
          account.appendChild(home);
          if (identity) account.appendChild(identity);
          account.appendChild(logout);
          header.appendChild(account);
        }
        bar.remove();
      }
    }
    var role = getRole(), setup = getSetup(), i;
    var tags = scope.querySelectorAll('[data-dtp-role]');
    for (i = 0; i < tags.length; i++) tags[i].textContent = role ? ROLES[role].label : '';
    var links = scope.querySelectorAll('a[href]');
    for (i = 0; i < links.length; i++) {
      var a = links[i];
      if (a.hasAttribute('data-dtp-setup')) continue;
      var f = fileOfAnchor(a);
      if (!f) continue;
      var d = decide(f, role, setup);
      if (d.allow) continue;
      a.setAttribute('aria-disabled', 'true');
      a.setAttribute('data-dtp-locked', d.reason);
      a.setAttribute('title', reasonText(d.reason, role));
    }
  };

  function el(tag, attrs, text) {
    var n = doc.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text != null) n.textContent = text;
    return n;
  }

  /* Barra delle pagine pubbliche (V-01 … V-05): Accedi per i visitatori, ruolo e uscita per chi è in sessione. */
  function hydratePublicBar() {
    var bars = doc.querySelectorAll('[data-dtp-publicbar]');
    var role = getRole();
    for (var i = 0; i < bars.length; i++) {
      var box = bars[i];
      box.replaceChildren();
      var right = el('span', { 'class': 'dtp-session' });
      if (role) {
        right.appendChild(el('span', { 'class': 'dtp-session-who', 'data-testid': 'text-current-role' }, ROLES[role].label));
        right.appendChild(el('a', { 'class': 'dtp-home', href: pageUrl(homeFor(role, getSetup())), 'data-testid': 'link-my-area' }, 'La tua area'));
        right.appendChild(el('a', { 'class': 'dtp-home', href: workspaceUrl(), title: 'Torna a Workspace / 2026', 'data-testid': 'link-home' }, 'Home'));
        right.appendChild(el('button', { 'class': 'dtp-logout', type: 'button', 'data-dtp-logout': '', 'data-testid': 'button-logout' }, 'Esci'));
      } else {
        right.appendChild(el('a', { 'class': 'dtp-home', href: loginUrl(), 'data-testid': 'link-login' }, 'Accedi'));
      }
      box.appendChild(right);
    }
  }

  var here = PAGES[currentFile()];
  if (!here) return; /* nell'app React (login, Workspace) serve solo la logica: l'interfaccia la gestisce React */

  doc.addEventListener('click', function (ev) {
    var t = ev.target && ev.target.closest ? ev.target : null;
    if (!t) return;
    if (t.closest('[data-dtp-logout]')) { ev.preventDefault(); api.logout(); return; }
    var a = t.closest('a[href]');
    if (!a) return;
    var step = a.getAttribute('data-dtp-setup');
    if (step && getRole() === 'lr') {
      /* Se l'avanzamento non si salva non si prosegue: la pagina successiva lo rifiuterebbe comunque. */
      try {
        if (step === 'delegates') markDelegates();
        if (step === 'complete') completeSetup();
      } catch (err) {
        ev.preventDefault();
        toast(isStorageError(err) ? err.message : 'Non è stato possibile salvare il passaggio. Riprova.');
        return;
      }
    }
    var f = fileOfAnchor(a);
    if (!f) return;
    var d = decide(f, getRole(), getSetup());
    if (!d.allow) { ev.preventDefault(); toast(reasonText(d.reason, getRole())); }
  });

  /* Tasto Indietro e bfcache: a ogni ritorno sulla pagina la sessione viene ricontrollata. */
  root.addEventListener('pageshow', function () {
    if (here.open) { hydratePublicBar(); return; }
    if (!enteredRoles || denied) return;
    var d = decide(currentFile(), getRole(), getSetup(), enteredRoles);
    if (!d.allow) deny(d, currentFile());
  });

  function ready() {
    if (here.open) hydratePublicBar();
    if (!denied) toast(api.takeFlash());
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', ready); else ready();
})(typeof window !== 'undefined' ? window : globalThis);
