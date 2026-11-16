/* Catalogo DTP condiviso da V01 (vetrina) e V02 (attivazione). Dati invariati dal listino originale. */
(function () {
  // [id, famiglia, nome, descrizione, pacchetti [[quantita, prezzo]], prezzo unitario listino, passo Enterprise]
  var S = [
    ['cert', 'Firma elettronica', 'Nuovi Certificati FEA', 'Emissione del certificato di firma elettronica avanzata per ciascun firmatario.', [[500, 1275], [1000, 2550]], 3.00, 2500],
    ['app', 'Firma elettronica', 'Apposizioni FEA con COD', 'Firma elettronica avanzata di un documento, confermata con codice dal firmatario.', [[5000, 640], [12500, 1600]], 0.15, 12500],
    ['fp', 'Identità e verifica', 'Identificazioni Full Prospect', 'Identificazione da remoto di un nuovo cliente con verifica del documento di identità.', [[1000, 1020], [2500, 2550]], 1.20, 5000],
    ['fun', 'Identità e verifica', 'Full Prospect con funnel completato', 'Identificazione Full Prospect conteggiata solo quando l\'utente completa il percorso.', [[1000, 680], [2500, 1700]], 0.80, 4000],
    ['pro', 'Identità e verifica', 'Identificazioni Proprietarie', 'Identificazione con il metodo proprietario della piattaforma.', [[500, 385], [1000, 765]], 0.90, 2500],
    ['ver', 'Identità e verifica', 'Verifiche Contatti', 'Verifica di indirizzo e-mail e numero di telefono con codice di conferma.', [[10000, 425], [25000, 1000]], 0.05, 25000],
    ['doc', 'Contratti e documenti', 'Doc Composition Contratti', 'Composizione automatica dei contratti a partire da modelli e dati.', [[1000, 170], [2500, 425]], 0.20, 5000],
    ['con', 'Contratti e documenti', 'Contratti', 'Gestione del contratto digitale: invio, raccolta delle firme e archiviazione.', [[1000, 425], [2500, 1060]], 0.50, 5000],
    ['fat', 'Fatturazione', 'Fatture Elettroniche', 'Emissione e invio delle fatture elettroniche al Sistema di Interscambio.', [[2000, 170], [6000, 480]], 0.10, 6000]
  ];
  var services = S.map(function (s) {
    return { id: s[0], family: s[1], name: s[2], desc: s[3], packs: s[4].map(function (p) { return { qty: p[0], price: p[1] }; }), unit: s[5], step: s[6] };
  });
  var bundles = [
    { id: 'Base', price: 4900, desc: 'Per iniziare con volumi contenuti su tutti i servizi.', inc: ['1.000', '500', '2.500'] },
    { id: 'Medium', price: 19900, desc: 'Per aziende con processi digitali già avviati.', inc: ['5.000', '2.500', '12.500'], badge: 'Il più scelto' },
    { id: 'Pro', price: 64900, desc: 'Per volumi elevati su più canali.', inc: ['20.000', '10.000', '50.000'] }
  ];
  var bundleLines = ['Identificazioni Full Prospect', 'Nuovi Certificati FEA', 'Apposizioni FEA con COD'];
  var ENT_DISC = 0.8;
  function grp(n, opt) { return n.toLocaleString('it-IT', Object.assign({ useGrouping: 'always' }, opt || {})); }
  function eur(n) { return '€ ' + grp(n, { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); }
  function num(n) { return grp(n); }
  function unit3(n) { return grp(n, { minimumFractionDigits: 3, maximumFractionDigits: 3 }); }
  function entDefault() { return services.map(function (s) { return s.step * 4; }); }
  function entAmount(i, q) { return Math.round(q * services[i].unit * ENT_DISC); }
  function entTotal(qty) { return qty.reduce(function (a, q, i) { return a + entAmount(i, q); }, 0); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  window.DTP = {
    services: services, bundles: bundles, bundleLines: bundleLines, ENT_DISC: ENT_DISC,
    families: ['Identità e verifica', 'Firma elettronica', 'Contratti e documenti', 'Fatturazione'],
    eur: eur, num: num, unit3: unit3, entDefault: entDefault, entAmount: entAmount, entTotal: entTotal, esc: esc
  };
})();
