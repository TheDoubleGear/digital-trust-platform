/* V04 – scheda del servizio: contenuti dal catalogo condiviso (dtp-catalogo.js), servizio indicato con ?servizio=<id>.
   «Acquista» apre V-02 con il servizio già nel carrello alla quantità minima (V-02 aggiunge i servizi richiesti);
   «Contatta un consulente» apre V-05 con il servizio già indicato tra quelli di interesse. */
(function () {
  var D = window.DTP, e = D.esc;
  var $ = function (id) { return document.getElementById(id); };

  var id = '';
  try { id = (new URLSearchParams(window.location.search).get('servizio') || '').trim(); } catch (x) {}
  var s = D.services.indexOf(D.byId(id)) >= 0 ? D.byId(id) : null;

  if (!s) {
    document.title = 'Servizio non trovato – Digital Trust Platform';
    $('titolo-servizio').textContent = 'Servizio non trovato';
    $('h-desc').textContent = 'Il servizio richiesto non è nel catalogo. Torna alla vetrina per consultare tutti i servizi.';
    $('h-fam').textContent = 'Catalogo dei servizi';
    $('h-buy').textContent = 'Torna alla vetrina'; $('h-buy').href = 'vetrina-V01-catalogo.html';
    ['tabs', 'caratteristiche', 'offerta', 'video', 'faq', 'documentazione'].forEach(function (k) { $(k).hidden = true; });
    return;
  }

  var deps = s.deps.map(D.byId);
  var requiredBy = D.services.filter(function (x) { return x.deps.indexOf(s.id) >= 0; });
  var sameFam = D.services.filter(function (x) { return x.family === s.family && x.id !== s.id && s.deps.indexOf(x.id) < 0 && x.deps.indexOf(s.id) < 0; });
  var minPrice = D.price((function () { var c = {}; c[s.id] = s.step; return c; })());
  var buyUrl = 'vetrina-V02-contratto.html?servizio=' + encodeURIComponent(s.id);
  var askUrl = 'vetrina-V05-consulente.html?servizio=' + encodeURIComponent(s.id);
  function names(list) { return list.map(function (x) { return x.name; }).join(', '); }

  /* Presentazione */
  document.title = s.name + ' – Digital Trust Platform';
  $('crumb').insertAdjacentHTML('beforeend', '<li><span>' + e(s.family) + '</span></li><li><span aria-current="page">' + e(s.name) + '</span></li>');
  $('h-fam').textContent = s.family;
  $('titolo-servizio').textContent = s.name;
  $('h-desc').textContent = s.desc;
  $('h-price').innerHTML = '<b>' + D.unit3(s.unit) + ' €</b><span>per unità · quantità minima ' + D.num(s.step) + ' unità</span>';
  ['h-buy', 't-buy', 'b-buy'].forEach(function (k) { $(k).href = buyUrl; $(k).setAttribute('aria-label', 'Acquista ' + s.name); });
  ['h-ask', 'b-ask'].forEach(function (k) { $(k).href = askUrl; });
  var utilAsk = document.querySelector('.pv-util-r > a'); if (utilAsk) utilAsk.href = askUrl;

  /* Caratteristiche */
  var IC = {
    cosa: '<path d="M5 4h10l4 4v12H5z"/><path d="M15 4v4h4M8 12h8M8 16h6"/>',
    perche: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>',
    dip: '<path d="M8 7h8M8 17h8"/><rect x="3" y="4" width="5" height="6" rx="1.5"/><rect x="16" y="4" width="5" height="6" rx="1.5"/><rect x="16" y="14" width="5" height="6" rx="1.5"/><path d="M5.5 10v7H16"/>',
    cond: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>'
  };
  function tile(ic, title, text) {
    return '<article class="card pv-tile"><span class="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[ic] + '</svg></span><h3>' + title + '</h3><p>' + text + '</p></article>';
  }
  $('car-lead').textContent = 'Cosa fa ' + s.name + ', a cosa serve e a quali condizioni si utilizza.';
  $('tiles').innerHTML =
    tile('cosa', 'Cosa fa', e(s.desc)) +
    tile('perche', 'A cosa serve', e(s.purpose)) +
    tile('dip', 'Dipendenze', deps.length ? 'Richiede ' + e(names(deps)) + ': all\'acquisto viene aggiunto automaticamente al carrello.' : 'Nessuna: si può acquistare da solo.') +
    tile('cond', 'Condizioni di utilizzo', e(s.terms));

  /* Offerta e prezzi */
  $('price-card').innerHTML =
    '<span class="eyebrow">Prezzo unitario di listino</span>' +
    '<div class="pv-amount"><b>' + D.unit3(s.unit) + ' €</b><span>per unità, IVA esclusa</span></div>' +
    '<ul class="pv-facts">' +
    '<li><span>Quantità minima acquistabile</span><strong>' + D.num(s.step) + ' unità</strong></li>' +
    '<li><span>Quantità acquistabili</span><strong>multipli di ' + D.num(s.step) + ' unità</strong></li>' +
    '<li><span>Componente variabile alla quantità minima</span><strong class="nw">' + D.eur(minPrice.variabile) + '</strong></li>' +
    '<li><span>Fee di attivazione</span><strong>[DA DEFINIRE]</strong></li>' +
    '<li><span>Canone periodico</span><strong>[DA DEFINIRE] · periodicità ' + e(D.periodicita) + '</strong></li>' +
    '<li><span>Oltre la quantità configurata</span><strong>overage al prezzo unitario di listino</strong></li>' +
    '<li><span>Durata</span><strong>12 mesi dall\'attivazione, rinnovo non tacito</strong></li>' +
    '</ul>';
  var depLine = deps.length ? ' e ' + deps.map(function (d) { return D.num(d.step) + ' unità di ' + e(d.name); }).join(', ') + ', necessari' + (deps.length === 1 ? 'o' : '') + ' per questo servizio' : '';
  $('buy-box').innerHTML =
    '<h3 id="t-buy-box">Acquista ' + e(s.name) + '</h3>' +
    '<p>Si apre la configurazione con <strong>' + D.num(s.step) + ' unità di ' + e(s.name) + '</strong>' + depLine + ' già nel carrello.</p>' +
    '<ul><li>Prima di proseguire puoi cambiare le quantità o aggiungere altri servizi.</li><li>Puoi generare un codice e completare l\'acquisto in un secondo momento.</li><li>Il contratto è firmato dal legale rappresentante dell\'azienda.</li></ul>' +
    '<a class="btn btn-p btn-lg" href="' + buyUrl + '">Acquista</a>' +
    '<a class="btn btn-o" href="' + askUrl + '">Contatta un consulente</a>';

  /* Video */
  var play = '<span aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>';
  $('videos').innerHTML = [['Presentazione del servizio', 'Cosa offre ' + s.name + ' e in quali processi si usa.'], ['Come si usa', 'I passi principali per usare il servizio nei tuoi processi.']].map(function (v) {
    return '<article class="card pv-video"><div class="frame">' + play + '<small>[VIDEO DA FORNIRE A CURA DI POSTEL]</small></div><div class="meta"><h3>' + e(v[0]) + '</h3><p>' + e(v[1]) + ' Video non disponibile nel prototipo.</p></div></article>';
  }).join('');

  /* Domande frequenti: risposte dalle regole del percorso di acquisto. */
  var faq = [
    ['Come si acquista ' + s.name + '?', 'Con «Acquista» si apre la configurazione con il servizio già nel carrello alla quantità minima. Puoi cambiare le quantità, poi inserisci i dati dell\'azienda e del legale rappresentante, scarichi il contratto, lo firmi e lo carichi. Dopo la verifica della firma e il pagamento della prima fattura ricevi via e-mail il contratto e l’accesso all’area clienti.'],
    ['Qual è la quantità minima acquistabile?', 'La quantità minima è di ' + D.num(s.step) + ' unità; si possono acquistare quantità maggiori a multipli di ' + D.num(s.step) + ' unità.'],
    ['Cosa succede se supero la quantità acquistata?', s.terms],
    ['Il servizio richiede altri servizi?', deps.length ? 'Sì: richiede ' + names(deps) + ', che viene aggiunto automaticamente al carrello con la quantità minima. Puoi modificarne la quantità ma non toglierlo finché ' + s.name + ' resta nel carrello.' : 'No, si può acquistare da solo.'],
    ['Posso completare l\'acquisto in un secondo momento?', 'Sì. Dal riepilogo dell\'ordine puoi generare un codice di configurazione: inserendolo più tardi ritrovi i servizi e le quantità scelti e riprendi il percorso.'],
    ['Il contratto si rinnova automaticamente?', 'No, il rinnovo non è tacito. Prima della scadenza ricevi gli avvisi; senza rinnovo l\'accesso al servizio è disabilitato e i dati sono conservati per [DA DEFINIRE] giorni, poi cancellati.'],
    ['Chi può firmare il contratto?', 'Il contratto del primo acquisto è firmato dal legale rappresentante dell\'azienda con firma digitale.'],
    ['Domande specifiche sul servizio', '[CONTENUTO DA FORNIRE A CURA DI POSTEL]']
  ];
  $('faq-list').innerHTML = faq.map(function (q, i) {
    return '<details' + (i === 0 ? ' open' : '') + '><summary>' + e(q[0]) + '</summary><div><p>' + e(q[1]) + '</p></div></details>';
  }).join('');

  /* Documentazione e servizi correlati */
  $('doc-box').innerHTML =
    '<h3 style="font-size:18px">Documentazione</h3>' +
    '<div class="file"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0047BB" stroke-width="1.8" aria-hidden="true"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/></svg><span class="n">Scheda tecnica di ' + e(s.name) + '<small>' + e(s.doc) + '</small></span><a class="btn btn-o" aria-disabled="true" role="link" tabindex="0" id="doc-dl">Scarica</a></div>' +
    '<p class="muted" style="margin:0;font-size:13px">Approfondimenti: [CONTENUTO DA FORNIRE A CURA DI POSTEL]</p>';
  $('doc-dl').addEventListener('click', function (ev) { ev.preventDefault(); });
  function relGroup(title, list, tag) {
    if (!list.length) return '';
    return '<div class="pv-group"><h3>' + title + '</h3><div class="pv-rel">' + list.map(function (x) {
      return '<a href="vetrina-V04-servizio.html?servizio=' + encodeURIComponent(x.id) + '"><em>' + tag + '</em><b>' + e(x.name) + '</b><small>' + D.unit3(x.unit) + ' € per unità · minimo ' + D.num(x.step) + ' unità</small></a>';
    }).join('') + '</div></div>';
  }
  var rel = relGroup('Servizi richiesti', deps, 'Richiesto') + relGroup('Servizi che lo richiedono', requiredBy, 'Lo richiede') + relGroup('Altri servizi della famiglia ' + s.family, sameFam, s.family);
  $('rel-box').innerHTML = rel || '<p class="muted">Nessun servizio correlato.</p>';

  /* Sezione corrente nella navigazione interna */
  var links = [].slice.call(document.querySelectorAll('#tabs nav a'));
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (x) {
        if (!x.isIntersecting) return;
        links.forEach(function (a) { a.setAttribute('aria-current', String(a.getAttribute('href') === '#' + x.target.id)); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    links.forEach(function (a) { var t = document.querySelector(a.getAttribute('href')); if (t) io.observe(t); });
  }
})();
