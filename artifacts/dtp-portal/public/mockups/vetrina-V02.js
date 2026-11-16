/* V02 – attivazione servizio. Tutto in memoria: nessuno storage, nessuna rete. La password non viene mai conservata. */
(function () {
  var D = window.DTP, e = D.esc, $ = function (id) { return document.getElementById(id); };
  var FIELDS = ['ragione', 'piva', 'sdi', 'sede', 'pec', 'nome', 'cognome', 'cf', 'tel', 'email'];
  var MAX = 10 * 1024 * 1024;
  // Temporary preview aid: switch off to restore an empty registration form.
  var DEMO_PREFILL = true;
  if (DEMO_PREFILL) {
    var demo = {
      ragione: 'Azienda Demo S.r.l.', piva: '12345678901', sdi: '0000000',
      sede: 'Via Esempio 10, 00100 Roma', pec: 'azienda@pec.example',
      nome: 'Mario', cognome: 'Rossi', cf: 'RSSMRA80A01H501U',
      tel: '+390000000000', email: 'mario.rossi@example.com',
      pw: 'DemoTemporanea2026!', pw2: 'DemoTemporanea2026!'
    };
    Object.keys(demo).forEach(function (id) { $(id).value = demo[id]; });
    demo = null;
    $('demo-prefill').hidden = false;
  }
  var S = {
    step: 1, data: null, pwOk: false, dirty: false, purchased: false,
    bundle: null, packs: [], entQty: D.entDefault(),
    contract: null, downloaded: false, downloadErr: '', file: null, fileErr: '', acks: [false, false], invalidNote: false,
    submitted: false, ref: null
  };

  /* ---------- carrello ---------- */
  function items() {
    var out = [];
    if (S.bundle === 'Enterprise') {
      var n = S.entQty.filter(function (q) { return q > 0; }).length;
      out.push({ key: 'b', name: 'Bundle Enterprise', detail: n + ' servizi · quantità personalizzate · prezzo indicativo', price: D.entTotal(S.entQty), ent: true });
    } else if (S.bundle) {
      var b = D.bundles.filter(function (x) { return x.id === S.bundle; })[0];
      out.push({ key: 'b', name: 'Bundle ' + b.id, detail: 'Canone annuale · tutti i servizi del catalogo', price: b.price });
    }
    S.packs.forEach(function (k) {
      var p = k.split('|'), s = D.services.filter(function (x) { return x.id === p[0]; })[0], pk = s.packs[+p[1]];
      out.push({ key: k, name: s.name, detail: 'Offerta singola · ' + D.num(pk.qty) + ' unità', price: pk.price });
    });
    return out;
  }
  function total() { return items().reduce(function (a, i) { return a + i.price; }, 0); }
  function invalidate() {
    if (S.contract || S.downloaded || S.file) S.invalidNote = true;
    S.contract = null; S.downloaded = false; S.downloadErr = ''; S.file = null; S.fileErr = ''; S.acks = [false, false];
  }
  function cartChanged() { S.dirty = true; S.purchased = false; invalidate(); render(); }

  /* ---------- validazione ---------- */
  var EM = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
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
    if (!/^[A-Z0-9]{16}$/i.test(v.cf)) er.cf = 'Il codice fiscale deve avere 16 caratteri alfanumerici.';
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
  function showErrors(er) {
    FIELDS.concat(['pw', 'pw2']).forEach(function (f) {
      var bad = !!er[f]; $(f).setAttribute('aria-invalid', bad); $(f + '-e').textContent = er[f] || '';
      var d = ($(f).getAttribute('aria-describedby') || '').split(' ').filter(function (x) { return x && x !== f + '-e'; });
      if (bad) d.push(f + '-e'); if (d.length) $(f).setAttribute('aria-describedby', d.join(' ')); else $(f).removeAttribute('aria-describedby');
    });
    var keys = Object.keys(er), box = $('errsum');
    if (!keys.length) { box.hidden = true; return; }
    box.innerHTML = '<strong>Controlla ' + (keys.length === 1 ? 'il campo evidenziato' : 'i ' + keys.length + ' campi evidenziati') + '</strong><ul>' + keys.map(function (k) { return '<li><a href="#' + k + '">' + LABELS[k] + ': ' + e(er[k]) + '</a></li>'; }).join('') + '</ul>';
    box.hidden = false; box.focus();
  }
  $('errsum').addEventListener('click', function (ev) { var a = ev.target.closest('a'); if (!a) return; ev.preventDefault(); $(a.getAttribute('href').slice(1)).focus(); });

  $('f1').addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (S.submitted) return;
    var r = check();
    showErrors(r.er);
    if (Object.keys(r.er).length) return;
    var changed = !S.data || FIELDS.some(function (f) { return S.data[f] !== r.v[f]; });
    if (changed && S.data) { S.purchased = false; invalidate(); }
    S.data = r.v; S.pwOk = true;
    $('pw').value = ''; $('pw2').value = ''; $('pw-ok').hidden = false;
    go(2);
  });
  $('f1').addEventListener('input', function (ev) {
    S.dirty = true;
    var id = ev.target.id;
    if (ev.target.getAttribute('aria-invalid') === 'true') { ev.target.setAttribute('aria-invalid', 'false'); $(id + '-e').textContent = ''; }
    if (id === 'pw' || id === 'pw2') { if (S.pwOk) { S.pwOk = false; $('pw-ok').hidden = true; S.data = null; S.purchased = false; invalidate(); render(); } return; }
    if (S.data && S.data[id] !== undefined) { S.data = null; S.purchased = false; invalidate(); render(); }
  });

  /* ---------- navigazione ---------- */
  function canGo(n) {
    if (S.submitted) return false;
    if (n === 1) return true;
    if (n === 2) return !!S.data;
    return !!S.data && S.purchased && items().length > 0;
  }
  function go(n) {
    if (!canGo(n)) return;
    S.step = n; render();
    var h = $('t' + n); if (h) { h.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  }
  document.addEventListener('click', function (ev) { var b = ev.target.closest('[data-go]'); if (b) go(+b.dataset.go); });

  function renderStepper() {
    var L = [['Dati', 'Azienda, rappresentante, password'], ['Servizi', 'Catalogo e carrello'], ['Contratto', 'Bozza, firma, allegato']];
    $('stepper').innerHTML = L.map(function (l, i) {
      var n = i + 1, cur = !S.submitted && S.step === n, done = S.submitted || (n === 1 ? !!S.data : n === 2 ? S.purchased && items().length > 0 : false);
      var why = !canGo(n) && !S.submitted ? (n === 2 ? ' (completa prima i dati)' : ' (scegli i servizi e premi Acquista)') : '';
      return '<li><button type="button" class="' + (done ? 'done' : '') + '" data-step="' + n + '"' + (cur ? ' aria-current="step"' : '') + (canGo(n) ? '' : ' disabled') + ' aria-label="Passo ' + n + ': ' + l[0] + (done ? ', completato' : '') + why + '"><span class="dot" aria-hidden="true">' + (done && !cur ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg>' : n) + '</span><span class="l"><b>' + l[0] + '</b><span>' + l[1] + '</span></span></button></li>';
    }).join('');
  }
  $('stepper').addEventListener('click', function (ev) { var b = ev.target.closest('[data-step]'); if (b && !b.disabled) go(+b.dataset.step); });

  /* ---------- passo 2: catalogo ---------- */
  function renderCat() {
    var h = '<h2 style="font-size:17px;margin-bottom:10px">Bundle annuali</h2><div class="cat-b">';
    D.bundles.forEach(function (b) {
      var on = S.bundle === b.id;
      h += '<article class="card bcard' + (on ? ' sel' : '') + '"><div style="display:flex;justify-content:space-between;gap:6px;align-items:center"><h3 style="font-size:17px">' + b.id + '</h3>' + (b.badge ? '<span class="badge">' + b.badge + '</span>' : '') + '</div><div class="price" style="font-size:20px">' + D.eur(b.price) + ' <small>/ anno</small></div><ul class="kv">' +
        D.bundleLines.map(function (l, i) { return '<li><span>' + l + '</span><strong>' + b.inc[i] + '</strong></li>'; }).join('') +
        '</ul><button type="button" class="btn ' + (on ? 'btn-on' : 'btn-p') + '" data-act="bundle" data-v="' + b.id + '" aria-pressed="' + on + '">' + (on ? 'Rimuovi dal carrello' : (S.bundle ? 'Sostituisci il bundle' : 'Aggiungi al carrello')) + '</button></article>';
    });
    h += '</div>';
    var entOn = S.bundle === 'Enterprise', entT = D.entTotal(S.entQty), entN = S.entQty.filter(function (q) { return q > 0; }).length;
    h += '<div class="card ent-ed" style="margin-top:14px;border-style:' + (entOn ? 'solid' : 'dashed') + ';border-color:' + (entOn ? '#0047BB' : '#9AA6B8') + '"><div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;align-items:flex-start"><div><div style="display:flex;gap:8px;align-items:center"><h3 style="font-size:17px">Enterprise</h3><span class="badge">Personalizzabile</span></div><p class="muted" style="margin:4px 0 0;font-size:13px">Scegli servizi e quantità annue. Porta un servizio a zero per escluderlo.' + (entOn ? ' Le modifiche aggiornano subito il carrello.' : '') + '</p></div>' +
      '<div style="text-align:right"><small class="muted">Canone annuo indicativo · ' + entN + ' servizi</small><div style="font-size:20px;font-weight:600">' + D.eur(entT) + '</div></div></div>' +
      '<div class="tscroll"><table class="tbl stack"><thead><tr><th>Servizio</th><th>Quantità annua</th><th class="r">Importo indicativo</th></tr></thead><tbody>' +
      D.services.map(function (s, i) {
        var q = S.entQty[i];
        return '<tr class="' + (q ? '' : 'off') + '"><td><strong>' + e(s.name) + '</strong><small>' + D.unit3(s.unit * D.ENT_DISC) + ' € per unità · passo ' + D.num(s.step) + '</small></td><td><span class="qty"><button type="button" data-act="dec" data-i="' + i + '" aria-label="Riduci ' + e(s.name) + '"' + (q ? '' : ' disabled') + '>−</button><output aria-live="polite">' + (q ? D.num(q) : 'Escluso') + '</output><button type="button" data-act="inc" data-i="' + i + '" aria-label="Aumenta ' + e(s.name) + '">+</button></span></td><td class="r"><strong>' + (q ? D.eur(D.entAmount(i, q)) : '—') + '</strong></td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end">' + (entOn ? '<button type="button" class="btn btn-on" data-act="bundle" data-v="Enterprise">Rimuovi Enterprise dal carrello</button>' : '<button type="button" class="btn btn-l" data-act="bundle" data-v="Enterprise"' + (entN ? '' : ' disabled') + '>' + (S.bundle ? 'Sostituisci con Enterprise' : 'Aggiungi Enterprise al carrello') + '</button>') + '</div></div>';
    h += '<h2 style="font-size:17px;margin:22px 0 10px">Servizi e offerte singole</h2><div class="sgrid">';
    D.services.forEach(function (s) {
      h += '<article class="card scard"><span class="eyebrow">' + e(s.family) + '</span><h3>' + e(s.name) + '</h3><p>' + e(s.desc) + '</p><div style="display:flex;flex-direction:column;gap:8px;margin-top:auto">' +
        s.packs.map(function (k, j) {
          var key = s.id + '|' + j, on = S.packs.indexOf(key) >= 0;
          return '<div class="pack"><div><b>' + D.num(k.qty) + ' unità</b><br><span>' + D.eur(k.price) + ' · ' + D.unit3(k.price / k.qty) + ' €/unità</span></div><button type="button" class="btn ' + (on ? 'btn-on' : 'btn-o') + '" style="min-height:40px;padding:0 12px" data-act="pack" data-v="' + key + '" aria-pressed="' + on + '" aria-label="' + (on ? 'Rimuovi ' : 'Aggiungi ') + e(s.name) + ' ' + D.num(k.qty) + ' unità">' + (on ? 'Nel carrello' : 'Aggiungi') + '</button></div>';
        }).join('') + '</div></article>';
    });
    $('cat').innerHTML = h + '</div>';
    var n = items().length;
    $('buy').disabled = !n;
    $('buy').textContent = n ? 'Acquista · ' + D.eur(total()) : 'Acquista';
    $('buy').title = n ? '' : 'Aggiungi almeno un servizio al carrello';
  }
  $('cat').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-act]'); if (!b || b.disabled || S.submitted) return;
    var a = b.dataset.act, v = b.dataset.v, i = +b.dataset.i;
    if (a === 'bundle') S.bundle = S.bundle === v ? null : v;
    else if (a === 'pack') { var k = S.packs.indexOf(v); if (k >= 0) S.packs.splice(k, 1); else S.packs.push(v); }
    else if (a === 'inc' || a === 'dec') {
      var st = D.services[i].step; S.entQty[i] = Math.max(0, S.entQty[i] + (a === 'inc' ? st : -st));
      if (S.bundle !== 'Enterprise') { S.dirty = true; render(); refocus(a, i, v); return; }
      if (!S.entQty.some(function (q) { return q > 0; })) S.bundle = null;
    }
    cartChanged(); refocus(a, i, v);
  });
  function refocus(a, i, v) {
    var sel = a === 'inc' || a === 'dec' ? '[data-act="' + a + '"][data-i="' + i + '"]' : '[data-act="' + a + '"][data-v="' + v + '"]';
    var el = $('cat').querySelector(sel);
    if (el && !el.disabled) el.focus(); else { var alt = $('cat').querySelector('[data-act="inc"][data-i="' + i + '"]'); if (alt) alt.focus(); }
  }
  $('buy').addEventListener('click', function () {
    if (!items().length || !S.data) return;
    S.purchased = true;
    if (!S.contract) { S.contract = { id: 'DTP-BOZZA-' + String(Math.floor(100000 + Math.random() * 900000)), date: new Date() }; }
    go(3);
  });

  /* ---------- riepilogo laterale ---------- */
  function renderSide() {
    var it = items(), lock = S.submitted || S.step === 3;
    var h = '<h2 id="t-side">Il tuo ordine</h2>';
    if (!it.length) h += '<div class="cempty">Il carrello è vuoto.<br>' + (S.data ? 'Aggiungi un bundle o un\'offerta singola.' : 'Completa i dati per scegliere i servizi.') + '</div>';
    else h += '<ul class="citems">' + it.map(function (i) {
      return '<li><div class="c"><strong>' + e(i.name) + '</strong><small>' + e(i.detail) + '</small><span style="font-weight:600">' + D.eur(i.price) + '</span></div>' +
        (lock || S.step !== 2 ? '' : '<button type="button" class="x" data-rm="' + i.key + '" aria-label="Rimuovi ' + e(i.name) + '"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button>') + '</li>';
    }).join('') + '</ul>';
    h += '<div class="tot"><span class="muted" style="font-size:14px">Totale annuo, IVA esclusa</span><strong>' + D.eur(total()) + '</strong></div>';
    if (S.step === 3 && !S.submitted) h += '<button type="button" class="btn btn-o" data-go="2">Modifica i servizi</button><p class="muted" style="margin:0;font-size:12px">Modificare servizi o dati annulla la bozza scaricata e il file allegato.</p>';
    if (S.bundle === 'Enterprise') h += '<p class="muted" style="margin:0;font-size:12px">Il prezzo di Enterprise è indicativo e viene confermato nel contratto.</p>';
    h += '<p class="muted" style="margin:0;font-size:12px">Durata 12 mesi dalla controfirma di Postel. Nessun addebito in questa fase.</p>';
    $('side').innerHTML = h;
  }
  $('side').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-rm]'); if (!b || S.submitted) return;
    var k = b.dataset.rm;
    if (k === 'b') S.bundle = null; else S.packs.splice(S.packs.indexOf(k), 1);
    cartChanged();
    var next = $('side').querySelector('[data-rm]'); (next || $('t2')).focus();
  });

  /* ---------- passo 3: contratto ---------- */
  function size(b) { return b < 1024 * 1024 ? (b / 1024).toFixed(0) + ' KB' : (b / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB'; }
  function ready() { return S.downloaded && !!S.file && S.acks[0] && S.acks[1]; }
  function renderContract() {
    if (!S.contract) { $('contract').innerHTML = ''; return; }
    var c = S.contract, h = '';
    if (S.invalidNote) h += '<div class="info" role="status">I dati o i servizi sono cambiati: abbiamo generato una nuova bozza. Scaricala di nuovo e allega la versione firmata aggiornata.</div>';
    h += '<div class="task' + (S.downloaded ? ' ok' : '') + '"><span class="dot" aria-hidden="true">' + (S.downloaded ? '✓' : '1') + '</span><div class="b"><h2>Scarica la bozza di contratto</h2><p>Riferimento <strong>' + c.id + '</strong> · ' + items().length + ' articoli · ' + D.eur(total()) + ' annui. Formato: <strong>PDF</strong>, scaricabile direttamente. Bozza dimostrativa senza valore legale; termini da approvare, nessuna firma o attivazione reale.</p><div><button type="button" class="btn ' + (S.downloaded ? 'btn-o' : 'btn-p') + '" id="dl"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 3v12m0 0 5-5m-5 5-5-5M4 21h16"/></svg>' + (S.downloaded ? 'Scarica di nuovo (PDF)' : 'Scarica la bozza (PDF)') + '</button></div>' + (S.downloadErr ? '<p role="alert">' + e(S.downloadErr) + '</p>' : '') + '</div></div>';
    h += '<div class="task' + (S.file ? ' ok' : '') + '"><span class="dot" aria-hidden="true">' + (S.file ? '✓' : '2') + '</span><div class="b"><h2>Firma e allega il contratto firmato</h2><p>Firma il documento fuori da questa pagina con il tuo strumento di firma, poi allega il PDF firmato. Massimo 10 MB.</p>' +
      '<input type="file" id="file" accept=".pdf,application/pdf" class="sr" aria-describedby="file-h"' + (S.downloaded ? '' : ' disabled') + '>' +
      (!S.downloaded ? '<p id="file-h" class="muted" style="font-size:13px">Scarica prima la bozza per poter allegare il file firmato.</p>' :
        S.file ? '<div class="file"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#B42318" stroke-width="1.6" aria-hidden="true"><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z M14 3v5h5"/></svg><div class="n">' + e(S.file.name) + '<small>PDF · ' + size(S.file.size) + ' · tenuto solo in memoria, non caricato</small></div><button type="button" class="btn btn-o" id="replace">Sostituisci</button><button type="button" class="btn btn-o" id="rmfile">Rimuovi</button></div><span id="file-h" class="sr">File allegato</span>' :
        '<label for="file" class="drop" id="drop"><strong style="color:#0047BB">Scegli il PDF firmato</strong><br><span class="muted" style="font-size:13px" id="file-h">oppure trascinalo qui · solo PDF, massimo 10 MB</span></label>') +
      (S.fileErr ? '<div class="ferr" role="alert">' + e(S.fileErr) + '</div>' : '') + '</div></div>';
    h += '<fieldset class="task"><span class="dot" aria-hidden="true">3</span><div class="b"><legend style="font-size:16px;margin:0">Conferme</legend>' +
      ['Confermo che il file allegato è il contratto generato per questa richiesta, firmato dal legale rappresentante indicato.', 'Prendo atto che la richiesta sarà soggetta a verifiche e che l\'attivazione non è immediata: riceverò un\'e-mail al termine dei controlli.'].map(function (t, i) {
        return '<label class="chk"><input type="checkbox" data-ack="' + i + '"' + (S.acks[i] ? ' checked' : '') + '><span>' + t + '</span></label>';
      }).join('') + '</div></fieldset>';
    var miss = [];
    if (!S.downloaded) miss.push('scarica la bozza'); if (!S.file) miss.push('allega il PDF firmato'); if (!(S.acks[0] && S.acks[1])) miss.push('seleziona le conferme');
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
    S.acks = [false, false];
    var isPdf = /\.pdf$/i.test(f.name) && (!f.type || f.type === 'application/pdf' || f.type === 'application/octet-stream');
    if (!isPdf) S.fileErr = 'Il file "' + f.name + '" non è un PDF. Allega il contratto firmato in formato PDF.';
    else if (f.size === 0) S.fileErr = 'Il file selezionato è vuoto.';
    else if (f.size > MAX) S.fileErr = 'Il file pesa ' + size(f.size) + ': il limite è 10 MB.';
    else S.file = { name: f.name, size: f.size, ref: f };
    renderAll(); var t = $('replace') || $('drop'); if (t) t.focus();
  }
  function wireContract() {
    var dl = $('dl');
    if (dl) dl.onclick = function () {
      var url, a;
      try {
        var blob = window.DTPContractPDF({ data: S.data, contract: S.contract, items: items(), bundle: S.bundle, entQty: S.entQty });
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
      renderAll(); $('dl').focus();
    };
    var fi = $('file');
    if (fi) fi.onchange = function () { setFile(fi.files[0]); };
    var rp = $('replace'); if (rp) rp.onclick = function () { fi.click(); };
    var rm = $('rmfile'); if (rm) rm.onclick = function () { S.file = null; S.fileErr = ''; renderAll(); var d = $('drop'); if (d) d.focus(); };
    var dr = $('drop');
    if (dr) {
      dr.tabIndex = 0;
      dr.onkeydown = function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); fi.click(); } };
      dr.ondragover = function (ev) { ev.preventDefault(); dr.classList.add('over'); };
      dr.ondragleave = function () { dr.classList.remove('over'); };
      dr.ondrop = function (ev) { ev.preventDefault(); dr.classList.remove('over'); if (ev.dataTransfer.files.length > 1) { S.fileErr = 'Allega un solo file.'; renderAll(); return; } setFile(ev.dataTransfer.files[0]); };
    }
    Array.prototype.forEach.call($('contract').querySelectorAll('[data-ack]'), function (cb) {
      cb.onchange = function () { S.acks[+cb.dataset.ack] = cb.checked; var i = cb.dataset.ack; renderAll(); $('contract').querySelector('[data-ack="' + i + '"]').focus(); };
    });
  }
  $('submit').addEventListener('click', function () {
    if (S.submitted || !ready() || !canGo(3)) return;
    S.submitted = true;
    S.ref = 'RA-' + String(Math.floor(1000000 + Math.random() * 9000000));
    S.file = { name: S.file.name, size: S.file.size };
    Array.prototype.forEach.call(document.querySelectorAll('#f1 input'), function (i) { i.disabled = true; });
    renderAll(); openDialog();
  });

  /* ---------- stato finale e dialogo ---------- */
  function timeline() {
    return '<ol class="tl"><li class="ok"><span class="dot" aria-hidden="true">✓</span><div>Richiesta inviata<small>Contratto ' + S.contract.id + ' e allegato ' + e(S.file.name) + ' (' + size(S.file.size) + ')</small></div></li>' +
      '<li><span class="dot" aria-hidden="true">2</span><div>Verifiche automatiche in attesa<small>Controllo del contratto firmato, dell\'identità e dei poteri del legale rappresentante.</small></div></li>' +
      '<li><span class="dot" aria-hidden="true">3</span><div>E-mail di attivazione<small>Arriverà a ' + e(S.data.email) + ' dopo l’esito positivo dei controlli, con il nome utente (la tua e-mail) e le istruzioni per il primo accesso. Userai la password scelta: non sarà inclusa nell’e-mail.</small></div></li>' +
      '<li><span class="dot" aria-hidden="true">4</span><div>Primo login del Rappresentante Legale<small>Dopo l’attivazione, al tuo primo accesso completerai PS-01 (Delegati) e poi PS-02 (Soglie e notifiche). Solo dopo il setup accederai alla homepage cliente. Queste fasi non iniziano durante l’attesa di verifica.</small></div></li></ol>';
  }
  function renderDone() {
    var el = $('done');
    if (!S.submitted) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = '<div><span class="pend">In attesa di verifica</span><h1 id="t4" tabindex="-1" style="margin-top:10px">Richiesta di attivazione inviata</h1><p class="lead">Riferimento <strong>' + S.ref + '</strong> · ' + e(S.data.ragione) + '. I servizi non sono ancora attivi e l\'accesso all\'area clienti non è ancora disponibile.</p></div>' + timeline() +
      '<div class="demo" role="note"><span>Nel prototipo nessun file è stato caricato, nessuna e-mail è stata inviata e nessuna verifica è stata avviata. I dati restano in questa scheda fino alla chiusura o al ricaricamento.</span></div>' +
      '<div class="actions" style="justify-content:flex-start"><button type="button" class="btn btn-o" id="reopen">Rivedi la conferma</button><a class="btn btn-o" href="vetrina-V01-catalogo.html">Torna alla vetrina</a></div>';
    $('reopen').onclick = openDialog;
  }
  function openDialog() {
    var root = $('dlg-root');
    root.innerHTML = '<div class="scrim" id="scrim"><div class="dlg" role="dialog" aria-modal="true" aria-labelledby="dlg-t" aria-describedby="dlg-d"><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start"><div><span class="pend">In attesa di verifica</span><h2 id="dlg-t" style="margin-top:10px">Grazie, abbiamo ricevuto la richiesta</h2></div><button type="button" class="x" id="dlg-x" aria-label="Chiudi"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>' +
      '<p id="dlg-d" style="margin:0;font-size:14px;color:#3A424C">La richiesta ' + S.ref + ' passa ora alle verifiche automatiche. Al termine riceverai un\'e-mail di attivazione: fino ad allora i servizi non sono attivi e non è possibile accedere all\'area clienti.</p>' + timeline() +
      '<div class="demo" role="note"><span><strong>Demo:</strong> nessun caricamento, invio di e-mail o verifica è stato eseguito.</span></div><button type="button" class="btn btn-p" id="dlg-ok">Ho capito</button></div></div>';
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

  /* ---------- render ---------- */
  function renderAll() { render(); }
  function render() {
    if (S.step === 3 && !canGo(3)) S.step = S.data ? 2 : 1;
    if (S.step === 2 && !canGo(2)) S.step = 1;
    renderStepper();
    $('s1').hidden = S.submitted || S.step !== 1;
    $('s2').hidden = S.submitted || S.step !== 2;
    $('s3').hidden = S.submitted || S.step !== 3;
    var showOrder = S.step === 2 && !S.submitted;
    $('side').hidden = !showOrder;
    $('activation-layout').classList.toggle('layout-single', !showOrder);
    if (S.step === 2 && !S.submitted) renderCat();
    if (S.step === 3 && !S.submitted) renderContract();
    renderSide(); renderDone();
  }
  window.addEventListener('beforeunload', function (ev) {
    if (S.submitted || !(S.dirty || items().length)) return;
    ev.preventDefault(); ev.returnValue = '';
  });
  render();
})();
