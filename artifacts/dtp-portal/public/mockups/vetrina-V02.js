/* V02 – attivazione servizio: configurazione e carrello, dati, contratto, stato finale.
   Tutto in memoria, tranne i codici di configurazione dimostrativi salvati in localStorage di questo browser.
   La password non viene mai conservata. */
(function () {
  var D = window.DTP, e = D.esc, $ = function (id) { return document.getElementById(id); };
  var FIELDS = ['ragione', 'piva', 'sdi', 'sede', 'pec', 'nome', 'cognome', 'cf', 'tel', 'email'];
  /* Modalità assistita (O2-09): riconosciuta dalla sessione demo del commerciale. Il commerciale interviene
     solo nella configurazione: servizi, quantità e sconto entro soglia, poi genera il codice. Dati, contratto
     firmato e invio restano al legale rappresentante. Il nome è quello dimostrativo del commerciale C/C1. */
  var AUTH = window.DTPAuth;
  var ASSIST = !!(AUTH && typeof AUTH.getRole === 'function' && AUTH.getRole() === 'com');
  var COMMERCIALE = 'Marco Rinaldi';
  var CLIENTE = '';
  try { CLIENTE = (new URLSearchParams(window.location.search).get('cliente') || '').trim().slice(0, 120); } catch (x) {}
  var MAX = 10 * 1024 * 1024;
  var CODE_KEY = 'dtp-demo-config-codes';
  var CODE_RE = /^DTP-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  /* Dati fittizi di esempio per esplorare il percorso fino al contratto: precompilati all'apertura e
     reinseribili in ogni momento con «Compila con dati di esempio» (anche dopo il ripristino di un codice). */
  var DEMO_PREFILL = true;
  var DEMO = {
    ragione: 'Azienda Demo S.r.l.', piva: '12345678901', sdi: '0000000',
    sede: 'Via Esempio 10, 00100 Roma', pec: 'azienda@pec.example',
    nome: 'Mario', cognome: 'Rossi', cf: 'RSSMRA80A01H501U',
    tel: '+390000000000', email: 'mario.rossi@example.com'
  };
  var DEMO_PW = 'DemoTemporanea2026!';
  function fillDemo() {
    Object.keys(DEMO).forEach(function (id) { $(id).value = DEMO[id]; });
    $('pw').value = DEMO_PW; $('pw2').value = DEMO_PW;
    $('demo-prefill').hidden = false;
  }
  if (DEMO_PREFILL) fillDemo();
  var S = {
    step: 1, qty: {}, configured: false, autoAdded: [], code: null, codeErr: '', restored: '',
    data: null, pwOk: false, dirty: false,
    contract: null, downloaded: false, downloadErr: '', file: null, fileErr: '', acks: [false, false, false], invalidNote: false,
    submitted: false, ref: null,
    sconto: 0, scontoErr: '', origin: null, scontoLost: 0
  };

  /* ---------- carrello e dipendenze ---------- */
  function items() {
    return D.lines(S.qty).map(function (l) {
      return { key: l.id, name: l.name, detail: D.num(l.qty) + ' unità × ' + D.unit3(l.unit) + ' €', price: l.amount };
    });
  }
  function quote() { return D.price(S.qty); }
  function scontato() { return D.applySconto(quote(), S.sconto); }
  function total() { return scontato().totale.netto; }
  // Servizi nel carrello che richiedono il servizio id.
  function requiredBy(id) {
    return D.services.filter(function (s) { return S.qty[s.id] > 0 && s.deps.indexOf(id) >= 0; }).map(function (s) { return s.name; });
  }
  // Aggiunge un passo di quantità; i servizi richiesti entrano nel carrello con la quantità minima.
  function addWithDeps(id) {
    var s = D.byId(id);
    S.qty[id] = (S.qty[id] || 0) + s.step;
    s.deps.forEach(function (d) {
      if (S.qty[d] > 0) return;
      S.autoAdded.push({ dep: d, by: id });
      addWithDeps(d);
    });
  }
  function invalidate() {
    if (S.contract || S.downloaded || S.file) S.invalidNote = true;
    S.contract = null; S.downloaded = false; S.downloadErr = ''; S.file = null; S.fileErr = ''; S.acks = [false, false, false];
  }
  /* Il legale rappresentante che cambia la configurazione predisposta dal commerciale perde lo sconto:
     lo sconto vale per la configurazione del codice, che si può ripristinare reinserendolo. */
  function cartEdited() {
    if (!ASSIST && S.sconto) { S.scontoLost = S.sconto; S.sconto = 0; }
    cartChanged();
  }
  function cartChanged() {
    S.dirty = true; S.configured = false; S.restored = '';
    if (S.code) S.code.stale = true;
    S.autoAdded = S.autoAdded.filter(function (a) { return S.qty[a.by] > 0 && S.qty[a.dep] > 0; });
    invalidate(); render();
  }

  /* ---------- codice di configurazione (dimostrativo, solo in questo browser) ---------- */
  function readCodes() { var raw = localStorage.getItem(CODE_KEY); return raw ? JSON.parse(raw) : {}; }
  function newCode() {
    var A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', p = function () { var x = ''; for (var i = 0; i < 4; i++) x += A[Math.floor(Math.random() * A.length)]; return x; };
    return 'DTP-' + p() + '-' + p();
  }
  function generateCode(ev) {
    var from = ev && ev.currentTarget && ev.currentTarget.id === 'gen-code' ? 'gen-code' : 'side-gen';
    S.codeErr = '';
    if (!items().length) { S.code = null; S.codeErr = 'Aggiungi almeno un servizio prima di generare il codice.'; render(); return; }
    if (S.scontoErr) { S.code = null; S.codeErr = 'Correggi lo sconto prima di generare il codice: ' + S.scontoErr; render(); return; }
    try {
      var all = readCodes(), code = newCode();
      while (all[code]) code = newCode();
      var rec = { qty: JSON.parse(JSON.stringify(S.qty)), at: new Date().toISOString() };
      /* Il codice contiene solo servizi, quantità ed eventuale sconto con il commerciale che l'ha applicato:
         nessun dato dell'azienda o del legale rappresentante, nessuna password. */
      var by = ASSIST ? { commerciale: COMMERCIALE } : S.origin;
      if (by) { rec.origine = 'Commerciale'; rec.commerciale = by.commerciale; }
      if (by && S.sconto > 0) rec.sconto = S.sconto;
      all[code] = rec;
      localStorage.setItem(CODE_KEY, JSON.stringify(all));
      S.code = { value: code, stale: false };
    } catch (err) {
      S.code = null;
      S.codeErr = 'Non è possibile salvare il codice: il browser non consente di salvare i dati di questo sito. Consenti i dati del sito oppure esci dalla navigazione privata, poi riprova.';
    }
    render();
    var out = $('code-copy') || $(from); if (out) out.focus();
  }
  function restoreCode() {
    var v = $('code-in').value.trim().toUpperCase(), err = '', saved = null;
    if (!v) err = 'Inserisci il codice di configurazione.';
    else if (!CODE_RE.test(v)) err = 'Il codice ha il formato DTP-XXXX-XXXX.';
    else {
      try { saved = readCodes()[v]; } catch (x) { err = 'Non è possibile leggere i codici salvati: il browser non consente di accedere ai dati di questo sito.'; }
      if (!err && !saved) err = 'Codice non trovato in questo browser. Controlla di averlo scritto correttamente.';
    }
    $('code-in').setAttribute('aria-invalid', err ? 'true' : 'false');
    $('code-in-e').textContent = err;
    if (err) { $('code-in').focus(); return; }
    var q = {};
    Object.keys(saved.qty || {}).forEach(function (id) { if (D.byId(id) && saved.qty[id] > 0) q[id] = saved.qty[id]; });
    S.qty = q; S.autoAdded = [];
    cartChanged();
    var sc = D.checkSconto(saved.commerciale && saved.sconto > 0 ? String(saved.sconto) : '');
    S.sconto = sc.ok ? sc.value : 0; S.scontoErr = ''; S.scontoLost = 0;
    S.origin = saved.commerciale ? { commerciale: String(saved.commerciale), sconto: S.sconto, code: v } : null;
    if (ASSIST) { $('sconto').value = S.sconto ? D.num(S.sconto) : ''; setScontoMsg(); }
    else clearData();
    S.restored = v; S.code = null;
    $('code-in').value = '';
    render();
    $('t1').focus();
  }
  /* Il codice non porta dati: chi lo inserisce trova il passo Dati vuoto e lo compila da sé. */
  function clearData() {
    FIELDS.concat(['pw', 'pw2']).forEach(function (f) { $(f).value = ''; fieldError(f, ''); });
    $('errsum').hidden = true; $('demo-prefill').hidden = true; $('pw-ok').hidden = true;
    S.pwOk = false;
    if (S.data) { S.data = null; invalidate(); }
  }
  $('gen-code').addEventListener('click', function (ev) { if (!S.submitted) generateCode(ev); });
  $('side-gen').addEventListener('click', function (ev) { if (!S.submitted) generateCode(ev); });
  $('code-apply').addEventListener('click', function () { if (!S.submitted) restoreCode(); });
  $('code-in').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); restoreCode(); } });
  $('code-in').addEventListener('input', function () { $('code-in').setAttribute('aria-invalid', 'false'); $('code-in-e').textContent = ''; });

  /* ---------- validazione dei dati, anche all'uscita da ogni campo ---------- */
  var EM = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var CF = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/;
  function val(id) { return $(id).value.trim(); }
  function check() {
    var er = {}, v = {};
    FIELDS.forEach(function (f) { v[f] = val(f); });
    if (v.ragione.length < 2) er.ragione = 'Inserisci la ragione sociale.';
    var piva = v.piva.replace(/^IT/i, '').replace(/\s/g, '');
    if (!/^\d{11}$/.test(piva)) er.piva = 'La partita IVA deve contenere 11 cifre.';
    if (!/^[A-Z0-9]{7}$/i.test(v.sdi)) er.sdi = 'Il codice SdI deve avere 7 caratteri alfanumerici.';
    if (v.sede.length < 5) er.sede = 'Inserisci indirizzo, CAP e comune della sede legale.';
    if (!EM.test(v.pec)) er.pec = 'Inserisci un indirizzo PEC valido.';
    if (v.nome.length < 2) er.nome = 'Inserisci il nome.';
    if (v.cognome.length < 2) er.cognome = 'Inserisci il cognome.';
    if (!CF.test(v.cf.toUpperCase())) er.cf = 'Il codice fiscale non ha un formato valido.';
    var digits = v.tel.replace(/[\s+]/g, '');
    if (!/^\+?[\d\s]+$/.test(v.tel) || digits.length < 9 || digits.length > 15) er.tel = 'Inserisci un numero di cellulare valido.';
    if (!EM.test(v.email)) er.email = 'Inserisci un indirizzo e-mail valido.';
    var pw = $('pw').value, pw2 = $('pw2').value;
    if (!(S.pwOk && !pw && !pw2)) {
      if (!pw) er.pw = 'Scegli una password.';
      else if (pw.length < 10 || !/[A-Z]/.test(pw) || !/[a-z]/.test(pw) || !/\d/.test(pw)) er.pw = 'Almeno 10 caratteri, con maiuscola, minuscola e numero.';
      if (!er.pw && pw2 !== pw) er.pw2 = 'Le due password non coincidono.';
      if (!er.pw && !pw2) er.pw2 = 'Conferma la password.';
    }
    v.piva = piva; v.cf = v.cf.toUpperCase(); v.sdi = v.sdi.toUpperCase();
    return { er: er, v: v };
  }
  var LABELS = { ragione: 'Ragione sociale', piva: 'Partita IVA', sdi: 'Codice SdI', sede: 'Sede legale', pec: 'PEC', nome: 'Nome', cognome: 'Cognome', cf: 'Codice fiscale', tel: 'Cellulare', email: 'E-mail', pw: 'Password', pw2: 'Conferma password' };
  function fieldError(f, msg) {
    var bad = !!msg; $(f).setAttribute('aria-invalid', bad); $(f + '-e').textContent = msg || '';
    var d = ($(f).getAttribute('aria-describedby') || '').split(' ').filter(function (x) { return x && x !== f + '-e'; });
    if (bad) d.push(f + '-e'); if (d.length) $(f).setAttribute('aria-describedby', d.join(' ')); else $(f).removeAttribute('aria-describedby');
  }
  function showErrors(er) {
    FIELDS.concat(['pw', 'pw2']).forEach(function (f) { fieldError(f, er[f]); });
    var keys = Object.keys(er), box = $('errsum');
    if (!keys.length) { box.hidden = true; return; }
    box.innerHTML = '<strong>Controlla ' + (keys.length === 1 ? 'il campo evidenziato' : 'i ' + keys.length + ' campi evidenziati') + '</strong><ul>' + keys.map(function (k) { return '<li><a href="#' + k + '">' + LABELS[k] + ': ' + e(er[k]) + '</a></li>'; }).join('') + '</ul>';
    box.hidden = false; box.focus();
  }
  $('errsum').addEventListener('click', function (ev) { var a = ev.target.closest('a'); if (!a) return; ev.preventDefault(); $(a.getAttribute('href').slice(1)).focus(); });
  // Controllo formale al momento dell'inserimento: alla perdita del focus di ogni campo.
  $('f1').addEventListener('focusout', function (ev) {
    var id = ev.target.id;
    if (!LABELS[id] || S.submitted) return;
    if ((id === 'pw' || id === 'pw2') && S.pwOk && !$('pw').value && !$('pw2').value) return;
    if (id === 'pw' && !$('pw2').value) { fieldError('pw', check().er.pw); return; }
    fieldError(id, check().er[id]);
  });
  $('f1').addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (S.submitted || !canGo(2)) return;
    var r = check();
    showErrors(r.er);
    if (Object.keys(r.er).length) return;
    var changed = !S.data || FIELDS.some(function (f) { return S.data[f] !== r.v[f]; });
    if (changed && S.data) invalidate();
    S.data = r.v; S.pwOk = true;
    $('pw').value = ''; $('pw2').value = ''; $('pw-ok').hidden = false;
    if (!S.contract) S.contract = { id: 'DTP-BOZZA-' + String(Math.floor(100000 + Math.random() * 900000)), date: new Date() };
    go(3);
  });
  $('f1').addEventListener('input', function (ev) {
    S.dirty = true;
    var id = ev.target.id;
    if (ev.target.getAttribute('aria-invalid') === 'true') fieldError(id, '');
    if (id === 'pw' || id === 'pw2') { if (S.pwOk) { S.pwOk = false; $('pw-ok').hidden = true; S.data = null; invalidate(); render(); } return; }
    if (S.data && S.data[id] !== undefined) { S.data = null; invalidate(); render(); }
  });

  $('demo-fill').addEventListener('click', function () {
    if (S.submitted || ASSIST) return;
    fillDemo();
    FIELDS.concat(['pw', 'pw2']).forEach(function (f) { fieldError(f, ''); });
    $('errsum').hidden = true; $('pw-ok').hidden = true;
    S.pwOk = false; S.dirty = true;
    if (S.data) { S.data = null; invalidate(); render(); }
    $('data-submit').focus();
  });

  /* ---------- navigazione ---------- */
  function canGo(n) {
    if (S.submitted) return false;
    if (n === 1) return true;
    if (ASSIST) return false;
    if (n === 2) return S.configured && items().length > 0;
    return S.configured && items().length > 0 && !!S.data;
  }
  function go(n) {
    if (!canGo(n)) return;
    S.step = n; render();
    var h = $('t' + n); if (h) { h.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  }
  document.addEventListener('click', function (ev) { var b = ev.target.closest('[data-go]'); if (b) go(+b.dataset.go); });

  function renderStepper() {
    var L = ASSIST ? [['Servizi', 'Configurazione, sconto e codice'], ['Dati', 'A cura del legale rappresentante'], ['Contratto', 'A cura del legale rappresentante']]
      : [['Servizi', 'Configurazione e carrello'], ['Dati', 'Azienda, rappresentante, password'], ['Contratto', 'Bozza, firma, caricamento']];
    $('stepper').innerHTML = L.map(function (l, i) {
      var n = i + 1, cur = !S.submitted && S.step === n, done = S.submitted || (n === 1 ? S.configured && items().length > 0 : n === 2 ? !!S.data && S.configured : false);
      var why = !canGo(n) && !S.submitted ? (ASSIST ? ' (riservato al legale rappresentante)' : n === 2 ? ' (conferma prima la configurazione)' : ' (completa prima configurazione e dati)') : '';
      return '<li><button type="button" class="' + (done ? 'done' : '') + '" data-step="' + n + '"' + (cur ? ' aria-current="step"' : '') + (canGo(n) ? '' : ' disabled') + ' aria-label="Passo ' + n + ': ' + l[0] + (done ? ', completato' : '') + why + '"><span class="dot" aria-hidden="true">' + (done && !cur ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg>' : n) + '</span><span class="l"><b>' + l[0] + '</b><span>' + l[1] + '</span></span></button></li>';
    }).join('');
  }
  $('stepper').addEventListener('click', function (ev) { var b = ev.target.closest('[data-step]'); if (b && !b.disabled) go(+b.dataset.step); });

  /* ---------- passo 1: configurazione ---------- */
  function renderCat() {
    var h = '', first = true;
    if (S.restored) {
      var o = S.origin;
      h += '<div class="okbox" role="status" style="margin-bottom:14px"><span>Configurazione ripristinata dal codice <strong>' + e(S.restored) + '</strong>' +
        (o ? ', predisposta in modalità assistita dal commerciale ' + e(o.commerciale) + (o.sconto ? ', con sconto del ' + D.num(o.sconto) + '% sul prezzo complessivo' : '') : '') +
        (ASSIST ? '. Puoi modificarla e generare un nuovo codice.' : '. Controllala e conferma per proseguire.' + (o ? ' Inserisci tu i dati di azienda e legale rappresentante, firmi il contratto e invii la richiesta.' : '')) + '</span></div>';
    }
    if (S.scontoLost && !ASSIST) h += '<div class="info" role="status" style="margin-bottom:14px">Hai cambiato la configurazione predisposta dal commerciale: lo sconto del ' + D.num(S.scontoLost) + '% vale solo per quella configurazione e non si applica più. Per recuperarlo reinserisci il codice ricevuto.</div>';
    D.families.forEach(function (f) {
      var list = D.services.filter(function (s) { return s.family === f; });
      h += '<h2 style="font-size:17px;margin:' + (first ? '0' : '22px') + ' 0 10px">' + e(f) + '</h2><div class="tscroll"><table class="tbl stack"><thead><tr><th>Servizio</th><th>Quantità</th><th class="r">Componente variabile</th></tr></thead><tbody>';
      first = false;
      list.forEach(function (s) {
        var i = D.services.indexOf(s), q = S.qty[s.id] || 0, req = requiredBy(s.id);
        var locked = q > 0 && q <= s.step && req.length > 0;
        var dep = s.deps.length ? ' · richiede ' + s.deps.map(function (d) { return D.byId(d).name; }).join(', ') : '';
        h += '<tr class="' + (q ? '' : 'off') + '"><td><strong>' + e(s.name) + '</strong><small>' + D.unit3(s.unit) + ' € per unità · multipli di ' + D.num(s.step) + e(dep) + '</small>' +
          (req.length && q ? '<span class="dep" id="lock-' + s.id + '">Necessario per ' + e(req.join(', ')) + ': non si può togliere finché ' + (req.length === 1 ? 'è' : 'sono') + ' nel carrello.</span>' : '') + '</td>' +
          '<td><span class="qty"><button type="button" data-act="dec" data-i="' + i + '" aria-label="Riduci ' + e(s.name) + '"' + (locked ? ' aria-describedby="lock-' + s.id + '"' : '') + (q && !locked ? '' : ' disabled') + '>−</button><output aria-live="polite">' + (q ? D.num(q) : 'Non incluso') + '</output><button type="button" data-act="inc" data-i="' + i + '" aria-label="Aumenta ' + e(s.name) + '">+</button></span></td>' +
          '<td class="r"><strong>' + (q ? D.eur(Math.round(q * s.unit * 100) / 100) : '—') + '</strong></td></tr>';
      });
      h += '</tbody></table></div>';
    });
    var notes = S.autoAdded.map(function (a) { return '<div class="info" role="status">Aggiunto ' + e(D.byId(a.dep).name) + ': è necessario per ' + e(D.byId(a.by).name) + '. Puoi modificarne la quantità, ma non toglierlo finché ' + e(D.byId(a.by).name) + ' è nel carrello.</div>'; });
    if (notes.length) h += '<div class="notes">' + notes.join('') + '</div>';
    $('cat').innerHTML = h;
    var n = items().length;
    var why = !n ? 'Aggiungi almeno un servizio al carrello' : S.scontoErr ? 'Correggi lo sconto' : '';
    /* «Acquista» in fondo al passo e nel riepilogo: stessi controlli, stesso passaggio ai dati. */
    $('confirm').disabled = $('side-buy').disabled = !n || !!S.scontoErr;
    $('confirm').textContent = n ? 'Acquista · ' + D.eur(total()) : 'Acquista';
    $('confirm').title = $('side-buy').title = why;
  }
  /* Codice generato: nel passo 1, una sola volta, nel riepilogo «Il tuo ordine» sotto i pulsanti. */
  function renderCode() {
    var c = '';
    if (S.codeErr) c = '<div class="ferr" role="alert">' + e(S.codeErr) + '</div>';
    else if (S.code) c = '<div class="code" role="status"><span>Codice di configurazione</span><output id="code-value">' + e(S.code.value) + '</output><button type="button" class="btn btn-o" id="code-copy">Copia il codice</button>' +
      '<p>' + (S.code.stale ? '<strong style="color:#855800">La configurazione è cambiata dopo la generazione: il codice conserva quella precedente. Generane uno nuovo per salvare quella attuale.</strong> ' : '') +
      (ASSIST ? 'Consegna il codice al legale rappresentante: inserendolo in questa pagina ritrova servizi, quantità e sconto, poi inserisce i dati di azienda e legale rappresentante, firma il contratto e invia la richiesta. Il codice non contiene dati dell\'azienda. ' : '') +
      'Il codice registra la configurazione presente al momento della generazione e permette di riprendere il percorso. Validità del codice: [DA DEFINIRE]. Nel prototipo il codice è salvato solo in questo browser.</p></div>';
    $('code-out').innerHTML = S.step === 1 ? c : '';
    var cp = $('code-copy');
    if (cp) cp.onclick = function () {
      var fail = function () { cp.textContent = 'Copia non riuscita: selezionalo e copialo'; };
      try { navigator.clipboard.writeText(S.code.value).then(function () { cp.textContent = 'Codice copiato'; }, fail); } catch (x) { fail(); }
    };
  }
  $('cat').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-act]'); if (!b || b.disabled || S.submitted) return;
    var a = b.dataset.act, i = +b.dataset.i, s = D.services[i];
    if (a === 'inc') addWithDeps(s.id);
    else {
      var q = (S.qty[s.id] || 0) - s.step;
      if (q <= 0 && requiredBy(s.id).length) return;
      if (q > 0) S.qty[s.id] = q; else delete S.qty[s.id];
    }
    cartEdited(); refocus(a, i);
  });
  /* «Seleziona tutto»: ogni servizio almeno alla quantità minima (un passo); le quantità più alte restano.
     È una modifica della configurazione: lo sconto di un codice del commerciale decade come per ogni altra modifica. */
  function selectAll() {
    if (S.submitted) return;
    var changed = false;
    D.services.forEach(function (s) { if (!(S.qty[s.id] >= s.step)) { S.qty[s.id] = s.step; changed = true; } });
    if (changed) cartEdited();
  }
  $('select-all').addEventListener('click', selectAll);
  function refocus(a, i) {
    var el = $('cat').querySelector('[data-act="' + a + '"][data-i="' + i + '"]');
    if (el && !el.disabled) el.focus(); else { var alt = $('cat').querySelector('[data-act="inc"][data-i="' + i + '"]'); if (alt) alt.focus(); }
  }
  function buy() {
    if (!items().length || S.submitted || S.scontoErr) return;
    S.configured = true;
    go(2);
  }
  $('confirm').addEventListener('click', buy);
  $('side-buy').addEventListener('click', buy);

  /* ---------- riepilogo laterale ---------- */
  function renderSide() {
    var it = items();
    var h = '';
    if (!it.length) h += '<div class="cempty">Il carrello è vuoto.<br>Scegli i servizi e le quantità, oppure ripristina una configurazione con il codice.</div>';
    else h += '<ul class="citems">' + it.map(function (i) {
      var req = requiredBy(i.key);
      return '<li><div class="c"><strong>' + e(i.name) + '</strong><small>' + e(i.detail) + '</small><span style="font-weight:600">' + D.eur(i.price) + '</span>' + (req.length ? '<small>Necessario per ' + e(req.join(', ')) + '</small>' : '') + '</div>' +
        (req.length ? '' : '<button type="button" class="x" data-rm="' + i.key + '" aria-label="Rimuovi ' + e(i.name) + '"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button>') + '</li>';
    }).join('') + '</ul>';
    if (it.length && S.sconto > 0) {
      var x = scontato(), pc = D.num(x.pct) + '%';
      var row = function (label, c) { return '<tr><th scope="row">' + label + '</th><td>' + D.eur(c.listino) + '</td><td>−' + D.eur(c.sconto) + '</td><td><strong>' + D.eur(c.netto) + '</strong></td></tr>'; };
      h += '<table class="sctbl" data-testid="table-sconto"><caption class="sr">Prezzo di listino, sconto del ' + pc + ' e prezzo scontato per componente</caption><thead><tr><th scope="col">Componente</th><th scope="col">Listino</th><th scope="col">Sconto ' + pc + '</th><th scope="col">Scontato</th></tr></thead><tbody>' +
        row('Componente variabile', x.variabile) + row('Fee di attivazione', x.fee) + row('Canone periodico', x.canone) +
        '</tbody><tfoot>' + row('Totale', x.totale) + '</tfoot></table>';
      h += '<p class="muted" style="margin:0;font-size:12px">Sconto sul prezzo complessivo' + (S.origin && !ASSIST ? ' applicato dal commerciale ' + e(S.origin.commerciale) : '') + ', entro la soglia massima. Fee di attivazione e canone: ' + e(D.SEGNAPOSTO) + '. Periodicità del canone: ' + e(D.periodicita) + '.</p>';
    } else if (it.length) {
      var p = quote();
      h += '<ul class="kv"><li><span>Componente variabile</span><strong>' + D.eur(p.variabile) + '</strong></li><li><span>Fee di attivazione</span><strong>' + D.eur(p.fee) + '</strong></li><li><span>Canone periodico</span><strong>' + D.eur(p.canone) + '</strong></li></ul>';
      h += '<p class="muted" style="margin:0;font-size:12px">Fee di attivazione e canone: ' + e(D.SEGNAPOSTO) + '. Periodicità del canone: ' + e(D.periodicita) + '.</p>';
    }
    h += '<div class="tot"><span class="muted" style="font-size:14px">' + (S.sconto > 0 && it.length ? 'Totale scontato' : 'Totale') + ', IVA esclusa</span><strong>' + D.eur(total()) + '</strong></div>';
    h += '<p class="muted" style="margin:0;font-size:12px">Durata 12 mesi dalla controfirma di Postel. Nessun addebito in questa fase: la prima fattura si paga fuori dalla piattaforma.</p>';
    $('side-body').innerHTML = h;
  }
  $('side').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-rm]'); if (!b || S.submitted) return;
    var k = b.dataset.rm;
    if (requiredBy(k).length) return;
    delete S.qty[k];
    cartEdited();
    var next = $('side').querySelector('[data-rm]'); (next || $('t1')).focus();
  });

  /* ---------- passo 3: contratto ---------- */
  function size(b) { return b < 1024 * 1024 ? (b / 1024).toFixed(0) + ' KB' : (b / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB'; }
  function ready() { return S.downloaded && !!S.file && S.acks.every(Boolean); }
  function ackTexts() {
    return [
      'Dichiaro di essere il legale rappresentante di ' + S.data.ragione + ' indicato nel contratto. Il primo acquisto può essere concluso solo dal legale rappresentante.',
      'Confermo che il file caricato è il contratto generato per questa richiesta, firmato da me.',
      'Prendo atto che l\'attivazione non è immediata: dopo la verifica della firma e dei dati e la controfirma di Postel riceverò via e-mail la prima fattura, da pagare fuori dalla piattaforma. Il servizio sarà abilitato e le credenziali inviate solo dopo il pagamento.'
    ];
  }
  function renderContract() {
    if (!S.contract) { $('contract').innerHTML = ''; return; }
    var c = S.contract, h = '';
    if (S.invalidNote) h += '<div class="info" role="status">I dati o i servizi sono cambiati: abbiamo generato un nuovo contratto. Scaricalo di nuovo e carica la versione firmata aggiornata.</div>';
    h += '<div class="task' + (S.downloaded ? ' ok' : '') + '"><span class="dot" aria-hidden="true">' + (S.downloaded ? '✓' : '1') + '</span><div class="b"><h2>Scarica il contratto</h2><p>Riferimento <strong>' + c.id + '</strong> · ' + items().length + (items().length === 1 ? ' servizio configurato' : ' servizi configurati') + ' · ' + D.eur(total()) + ' IVA esclusa' + (S.sconto > 0 ? ', con sconto del ' + D.num(S.sconto) + '% sul prezzo complessivo' : '') + '. Formato: <strong>PDF</strong>, scaricabile direttamente. Bozza dimostrativa senza valore legale; termini da approvare, nessuna firma o attivazione reale.</p><div><button type="button" class="btn ' + (S.downloaded ? 'btn-o' : 'btn-p') + '" id="dl"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 3v12m0 0 5-5m-5 5-5-5M4 21h16"/></svg>' + (S.downloaded ? 'Scarica di nuovo (PDF)' : 'Scarica il contratto (PDF)') + '</button></div>' + (S.downloadErr ? '<p role="alert">' + e(S.downloadErr) + '</p>' : '') + '</div></div>';
    h += '<div class="task' + (S.file ? ' ok' : '') + '"><span class="dot" aria-hidden="true">' + (S.file ? '✓' : '2') + '</span><div class="b"><h2>Firma e carica il contratto firmato</h2><p>Firma il documento fuori da questa pagina con il tuo strumento di firma, poi carica il file firmato in formato PDF o P7M. Tipologie di firma ammesse: [DA DEFINIRE]. Massimo 10 MB.</p>' +
      '<input type="file" id="file" accept=".pdf,.p7m,application/pdf,application/pkcs7-mime" class="sr" aria-describedby="file-h"' + (S.downloaded ? '' : ' disabled') + '>' +
      (!S.downloaded ? '<p id="file-h" class="muted" style="font-size:13px">Scarica prima il contratto per poter caricare il file firmato.</p>' :
        S.file ? '<div class="file"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#B42318" stroke-width="1.6" aria-hidden="true"><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z M14 3v5h5"/></svg><div class="n">' + e(S.file.name) + '<small>' + (/\.p7m$/i.test(S.file.name) ? 'P7M' : 'PDF') + ' · ' + size(S.file.size) + ' · tenuto solo in memoria, non caricato</small></div><button type="button" class="btn btn-o" id="replace">Sostituisci</button><button type="button" class="btn btn-o" id="rmfile">Rimuovi</button></div><span id="file-h" class="sr">File caricato</span>' :
        '<label for="file" class="drop" id="drop"><strong style="color:#0047BB">Scegli il contratto firmato</strong><br><span class="muted" style="font-size:13px" id="file-h">oppure trascinalo qui · PDF o P7M, massimo 10 MB</span></label>') +
      (S.fileErr ? '<div class="ferr" role="alert">' + e(S.fileErr) + '</div>' : '') + '</div></div>';
    h += '<fieldset class="task"><span class="dot" aria-hidden="true">3</span><div class="b"><legend style="font-size:16px;margin:0">Conferme del legale rappresentante</legend>' +
      ackTexts().map(function (t, i) {
        return '<label class="chk"><input type="checkbox" data-ack="' + i + '"' + (S.acks[i] ? ' checked' : '') + '><span>' + e(t) + '</span></label>';
      }).join('') + '</div></fieldset>';
    var miss = [];
    if (!S.downloaded) miss.push('scarica il contratto'); if (!S.file) miss.push('carica il contratto firmato'); if (!S.acks.every(Boolean)) miss.push('seleziona le conferme');
    h += '<p id="sub-h" class="muted" style="margin:0;font-size:13px" aria-live="polite">' + (miss.length ? 'Per inviare: ' + miss.join(', ') + '.' : 'Tutto pronto per l\'invio.') + '</p>';
    $('contract').innerHTML = h;
    $('submit').disabled = !ready();
    $('submit').setAttribute('aria-describedby', 'sub-h');
    wireContract();
  }
  function setFile(f) {
    S.fileErr = '';
    if (!f) return;
    S.file = null;
    S.acks = [false, false, false];
    var isPdf = /\.pdf$/i.test(f.name) && (!f.type || f.type === 'application/pdf' || f.type === 'application/octet-stream');
    var isP7m = /\.p7m$/i.test(f.name) && (!f.type || /^application\/(x-)?pkcs7-mime$/.test(f.type) || f.type === 'application/octet-stream');
    if (!isPdf && !isP7m) S.fileErr = 'Il file "' + f.name + '" non è un PDF o un P7M. Carica il contratto firmato in uno di questi formati.';
    else if (f.size === 0) S.fileErr = 'Il file selezionato è vuoto.';
    else if (f.size > MAX) S.fileErr = 'Il file pesa ' + size(f.size) + ': il limite è 10 MB.';
    else S.file = { name: f.name, size: f.size, ref: f };
    render(); var t = $('replace') || $('drop'); if (t) t.focus();
  }
  function wireContract() {
    var dl = $('dl');
    if (dl) dl.onclick = function () {
      var url, a;
      try {
        var blob = window.DTPContractPDF({ data: S.data, contract: S.contract, config: S.qty, sconto: S.sconto });
        url = URL.createObjectURL(blob);
        a = document.createElement('a'); a.href = url; a.download = 'bozza-contratto-' + S.contract.id + '.pdf';
        document.body.appendChild(a); a.click();
        S.downloaded = true; S.downloadErr = ''; S.invalidNote = false;
      } catch (err) {
        S.downloadErr = 'Impossibile generare o scaricare il PDF. Ricarica la pagina e riprova.';
      } finally {
        if (a) a.remove();
        if (url) setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      }
      render(); $('dl').focus();
    };
    var fi = $('file');
    if (fi) fi.onchange = function () { setFile(fi.files[0]); };
    var rp = $('replace'); if (rp) rp.onclick = function () { fi.click(); };
    var rm = $('rmfile'); if (rm) rm.onclick = function () { S.file = null; S.fileErr = ''; render(); var d = $('drop'); if (d) d.focus(); };
    var dr = $('drop');
    if (dr) {
      dr.tabIndex = 0;
      dr.onkeydown = function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); fi.click(); } };
      dr.ondragover = function (ev) { ev.preventDefault(); dr.classList.add('over'); };
      dr.ondragleave = function () { dr.classList.remove('over'); };
      dr.ondrop = function (ev) { ev.preventDefault(); dr.classList.remove('over'); if (ev.dataTransfer.files.length > 1) { S.fileErr = 'Carica un solo file.'; render(); return; } setFile(ev.dataTransfer.files[0]); };
    }
    Array.prototype.forEach.call($('contract').querySelectorAll('[data-ack]'), function (cb) {
      cb.onchange = function () { S.acks[+cb.dataset.ack] = cb.checked; var i = cb.dataset.ack; render(); $('contract').querySelector('[data-ack="' + i + '"]').focus(); };
    });
  }
  $('submit').addEventListener('click', function () {
    if (ASSIST || S.submitted || !ready() || !canGo(3)) return;
    S.submitted = true;
    S.ref = 'RA-' + String(Math.floor(1000000 + Math.random() * 9000000));
    S.file = { name: S.file.name, size: S.file.size };
    Array.prototype.forEach.call(document.querySelectorAll('#f1 input, #code-in'), function (i) { i.disabled = true; });
    render(); openDialog();
  });

  /* ---------- stato finale e dialogo ---------- */
  function timeline() {
    var li = function (n, ok, title, sub) { return '<li' + (ok ? ' class="ok"' : '') + '><span class="dot" aria-hidden="true">' + (ok ? '✓' : n) + '</span><div>' + title + '<small>' + sub + '</small></div></li>'; };
    return '<ol class="tl">' +
      li(1, true, 'Richiesta inviata', 'Contratto ' + S.contract.id + ' e file firmato ' + e(S.file.name) + ' (' + size(S.file.size) + ')') +
      li(2, false, 'Verifica della firma e dei dati', 'Controllo della firma del contratto e della sua corrispondenza con i dati di azienda e legale rappresentante inseriti.') +
      li(3, false, 'Controfirma di Postel', 'Dopo l’esito positivo della verifica, Postel controfirma il contratto.') +
      li(4, false, 'Prima fattura via e-mail', 'Arriverà a ' + e(S.data.email) + ' con il collegamento per il pagamento, che avviene fuori dalla piattaforma. Nessun addebito automatico.') +
      li(5, false, 'Pagamento, abilitazione e credenziali', 'Ricevuto il pagamento, il servizio viene abilitato e ricevi via e-mail il nome utente (la tua e-mail) e le istruzioni per il primo accesso. Userai la password scelta: non sarà inclusa nell’e-mail.') +
      li(6, false, 'Primo accesso del legale rappresentante', 'Al primo accesso completerai PS-01 (Delegati) e poi PS-02 (Soglie e notifiche). Solo dopo il setup accederai alla homepage cliente.') +
      '</ol>';
  }
  function renderDone() {
    var el = $('done');
    if (!S.submitted) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = '<div><span class="pend">In attesa di verifica</span><h1 id="t4" tabindex="-1" style="margin-top:10px">Richiesta di attivazione inviata</h1><p class="lead">Riferimento <strong>' + S.ref + '</strong> · ' + e(S.data.ragione) + '. I servizi non sono ancora attivi e l\'accesso all\'area clienti non è ancora disponibile.</p></div>' + timeline() +
      '<div class="demo" role="note"><span>Nel prototipo nessun file è stato caricato, nessuna e-mail è stata inviata, nessuna verifica è stata avviata e nessuna fattura è stata emessa. I dati restano in questa scheda fino alla chiusura o al ricaricamento.</span></div>' +
      '<div class="actions" style="justify-content:flex-start"><button type="button" class="btn btn-o" id="reopen">Rivedi la conferma</button><a class="btn btn-o" href="vetrina-V01-catalogo.html">Torna alla vetrina</a></div>';
    $('reopen').onclick = openDialog;
  }
  function openDialog() {
    var root = $('dlg-root');
    root.innerHTML = '<div class="scrim" id="scrim"><div class="dlg" role="dialog" aria-modal="true" aria-labelledby="dlg-t" aria-describedby="dlg-d"><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start"><div><span class="pend">In attesa di verifica</span><h2 id="dlg-t" style="margin-top:10px">Grazie, abbiamo ricevuto la richiesta</h2></div><button type="button" class="x" id="dlg-x" aria-label="Chiudi"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>' +
      '<p id="dlg-d" style="margin:0;font-size:14px;color:#3A424C">La richiesta ' + S.ref + ' passa ora alla verifica della firma e dei dati. Seguiranno la controfirma di Postel e la prima fattura via e-mail, da pagare fuori dalla piattaforma: i servizi non sono attivi e l\'area clienti non è accessibile fino al pagamento.</p>' + timeline() +
      '<div class="demo" role="note"><span><strong>Demo:</strong> nessun caricamento, invio di e-mail, verifica o fattura è stato eseguito.</span></div><button type="button" class="btn btn-p" id="dlg-ok">Ho capito</button></div></div>';
    var dlg = root.querySelector('.dlg');
    function close() { root.innerHTML = ''; document.removeEventListener('keydown', key); $('t4').focus(); }
    function key(ev) {
      if (ev.key === 'Escape') { ev.preventDefault(); close(); }
      if (ev.key === 'Tab') {
        var f = dlg.querySelectorAll('button'), first = f[0], last = f[f.length - 1];
        if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
        else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', key);
    $('dlg-x').onclick = close; $('dlg-ok').onclick = close;
    $('scrim').onclick = function (ev) { if (ev.target.id === 'scrim') close(); };
    $('dlg-ok').focus();
  }

  /* ---------- modalità assistita: banda e sconto; il percorso del commerciale si ferma alla configurazione ---------- */
  function setScontoMsg() {
    $('sconto').setAttribute('aria-invalid', S.scontoErr ? 'true' : 'false');
    $('sconto-e').textContent = S.scontoErr;
    $('sconto-h').textContent = 'Soglia massima ' + D.num(D.sogliaSconto) + '%: valore dimostrativo, ' + D.SOGLIA_SCONTO_STATO + '. Lo sconto si applica a componente variabile, fee di attivazione e canone periodico; oltre la soglia il sistema blocca.';
    $('sconto').setAttribute('aria-describedby', 'sconto-h' + (S.scontoErr ? ' sconto-e' : ''));
  }
  if (ASSIST) {
    var band = $('assist-band');
    band.innerHTML = '<strong>Modalità assistita · commerciale ' + e(COMMERCIALE) + '</strong>' +
      '<span>' + (CLIENTE ? 'Per <b>' + e(CLIENTE) + '</b>' + (/\.$/.test(CLIENTE) ? ' ' : '. ') : '') + 'In modalità assistita prepari la configurazione e lo sconto; dati e contratto li completa il legale rappresentante. Scegli servizi e quantità, applichi uno sconto entro la soglia e generi il codice di configurazione da consegnargli: contiene solo servizi, quantità e sconto. Non inserisci dati, non carichi il contratto firmato e non invii la richiesta.</span>' +
      '<span><a href="postel-O2-portafoglio.html">Torna a Portafoglio e contratti</a></span>';
    band.hidden = false;
    $('discount-box').hidden = false;
    /* Nessun dato in modalità assistita: il modulo dei dati resta vuoto e non raggiungibile. */
    FIELDS.concat(['pw', 'pw2']).forEach(function (f) { $(f).value = ''; $(f).disabled = true; });
    $('demo-prefill').hidden = true; $('demo-fill-box').hidden = true;
    /* Nessun «Acquista» per il commerciale: resta solo «Genera codice di configurazione», come pulsante principale. */
    $('confirm').hidden = true;
    $('side-buy').hidden = true;
    $('gen-code').className = 'btn btn-p btn-lg';
    $('gen-code').textContent = 'Genera codice di configurazione';
    $('side-gen').className = 'btn btn-p btn-lg';
    setScontoMsg();
    $('sconto').addEventListener('input', function () {
      var r = D.checkSconto($('sconto').value);
      S.sconto = r.value; S.scontoErr = r.error;
      setScontoMsg();
      cartChanged();
    });
  }

  /* ---------- render ---------- */
  function render() {
    if (S.step === 3 && !canGo(3)) S.step = canGo(2) ? 2 : 1;
    if (S.step === 2 && !canGo(2)) S.step = 1;
    renderStepper();
    $('s1').hidden = S.submitted || S.step !== 1;
    $('s2').hidden = S.submitted || S.step !== 2;
    $('s3').hidden = S.submitted || S.step !== 3;
    var showCart = S.step === 1 && !S.submitted;
    $('side').hidden = !showCart;
    $('activation-layout').classList.toggle('layout-single', !showCart);
    if (S.step === 1 && !S.submitted) { renderCat(); renderSide(); }
    renderCode();
    if (S.step === 3 && !S.submitted) renderContract();
    renderDone();
  }
  window.addEventListener('beforeunload', function (ev) {
    if (S.submitted || !(S.dirty || items().length)) return;
    ev.preventDefault(); ev.returnValue = '';
  });
  /* Da «Acquista» nella scheda V-04: ?servizio=<id> apre la configurazione con quel servizio nel carrello alla quantità
     minima; i servizi richiesti entrano come sempre, con il messaggio esplicativo. Un identificativo sconosciuto è ignorato.
     Convive con la modalità assistita (?cliente=); un codice di configurazione inserito poi sostituisce il carrello. */
  var PRESEL = '';
  try { PRESEL = (new URLSearchParams(window.location.search).get('servizio') || '').trim(); } catch (x) {}
  if (PRESEL && D.services.indexOf(D.byId(PRESEL)) >= 0) addWithDeps(PRESEL);
  render();
})();
