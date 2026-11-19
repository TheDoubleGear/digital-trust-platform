/* Catalogo DTP condiviso. Offerta componibile: il cliente sceglie servizi e quantità, la piattaforma calcola il prezzo.
   Prezzi unitari di listino invariati; fee di attivazione e canone periodico sono valori segnaposto da definire. */
(function () {
  var DOC = '[DOCUMENTAZIONE DA FORNIRE]';
  var TERMS = 'Conteggio per unità utilizzata nel periodo contrattuale. Oltre la quantità configurata si applica l\'overage al prezzo unitario di listino.';
  // [id, famiglia, nome, descrizione, finalità, dipendenze, prezzo unitario di listino, passo di quantità]
  var S = [
    ['cert', 'Firma elettronica', 'Nuovi Certificati FEA', 'Emissione del certificato di firma elettronica avanzata per ciascun firmatario.', 'Abilitare i firmatari alla firma elettronica avanzata dei documenti.', [], 3.00, 500],
    ['app', 'Firma elettronica', 'Apposizioni FEA con COD', 'Firma elettronica avanzata di un documento, confermata con codice dal firmatario.', 'Far firmare documenti con firma elettronica avanzata confermata da codice.', ['cert'], 0.15, 2500],
    ['fp', 'Identità e verifica', 'Identificazioni Full Prospect', 'Identificazione da remoto di un nuovo cliente con verifica del documento di identità.', 'Identificare da remoto nuovi clienti in fase di acquisizione.', [], 1.20, 1000],
    ['fun', 'Identità e verifica', 'Full Prospect con funnel completato', 'Identificazione Full Prospect conteggiata solo quando l\'utente completa il percorso.', 'Pagare l\'identificazione solo per i percorsi portati a termine.', [], 0.80, 1000],
    ['pro', 'Identità e verifica', 'Identificazioni Proprietarie', 'Identificazione con il metodo proprietario della piattaforma.', 'Identificare i clienti con il metodo proprietario della piattaforma.', [], 0.90, 500],
    ['ver', 'Identità e verifica', 'Verifiche Contatti', 'Verifica di indirizzo e-mail e numero di telefono con codice di conferma.', 'Accertare che e-mail e cellulare indicati appartengano al cliente.', [], 0.05, 5000],
    ['doc', 'Contratti e documenti', 'Doc Composition Contratti', 'Composizione automatica dei contratti a partire da modelli e dati.', 'Generare contratti personalizzati a partire da modelli e dati del cliente.', ['con'], 0.20, 1000],
    ['con', 'Contratti e documenti', 'Contratti', 'Gestione del contratto digitale: invio, raccolta delle firme e archiviazione.', 'Gestire l\'intero ciclo del contratto digitale, dall\'invio all\'archiviazione.', [], 0.50, 1000],
    ['fat', 'Fatturazione', 'Fatture Elettroniche', 'Emissione e invio delle fatture elettroniche al Sistema di Interscambio.', 'Emettere e trasmettere le fatture elettroniche al Sistema di Interscambio.', [], 0.10, 2000]
  ];
  var services = S.map(function (s) {
    return { id: s[0], family: s[1], name: s[2], desc: s[3], purpose: s[4], deps: s[5], terms: TERMS, unit: s[6], step: s[7], doc: DOC };
  });
  var index = {};
  services.forEach(function (s) { index[s.id] = s; });

  // Valori segnaposto evidenti: importi e periodicità sono da definire a cura di Postel.
  var feeAttivazione = 1000;
  var canonePeriodico = 1000;
  var periodicita = '[DA DEFINIRE]';
  var SEGNAPOSTO = 'valore segnaposto [DA DEFINIRE]';

  function byId(id) { return index[id] || null; }
  function lines(config) {
    return services.filter(function (s) { return config && config[s.id] > 0; }).map(function (s) {
      var q = config[s.id];
      return { id: s.id, name: s.name, family: s.family, qty: q, unit: s.unit, amount: round(q * s.unit) };
    });
  }
  /* Prezzo di una configurazione {idServizio: quantità}: componente variabile, fee di attivazione, canone periodico e totale.
     opts.fee = false esclude la fee (es. modifica di un'offerta già attiva). */
  function price(config, opts) {
    var l = lines(config), any = l.length > 0, withFee = !opts || opts.fee !== false;
    var variabile = round(l.reduce(function (a, x) { return a + x.amount; }, 0));
    var fee = any && withFee ? feeAttivazione : 0;
    var canone = any ? canonePeriodico : 0;
    return { lines: l, variabile: variabile, fee: fee, canone: canone, totale: round(variabile + fee + canone) };
  }
  // Dipendenze non soddisfatte: [{ id, name, missing: [nomi] }]
  function missingDeps(config) {
    return lines(config).map(function (x) {
      var miss = byId(x.id).deps.filter(function (d) { return !(config[d] > 0); }).map(function (d) { return byId(d).name; });
      return { id: x.id, name: x.name, missing: miss };
    }).filter(function (x) { return x.missing.length; });
  }
  /* Cliente di esempio della demo (Assicurazioni Aurora S.p.A.): unica fonte degli importi mostrati nelle pagine.
     consumi[id] = [usato ad oggi, consumo previsto a fine periodo, stato]. */
  var esempio = {
    cliente: 'Assicurazioni Aurora S.p.A.',
    config: { cert: 2500, app: 12500, fp: 5000, fun: 4000, pro: 2500, ver: 25000, doc: 5000, con: 5000, fat: 6000 },
    consumi: {
      cert: [2640, 4302, 'out'], fp: [4610, 7505, 'crit'], fun: [3320, 5402, 'warn'], ver: [19850, 32307, 'warn'],
      doc: [3610, 5871, 'warn'], app: [8920, 14514, 'warn'], con: [3480, 5659, 'ok'], pro: [1140, 1857, 'ok'], fat: [2380, 3869, 'ok']
    },
    upgradeInCorso: { id: 'cert', qty: 500, ordine: 'ORD-2026-1187' }
  };
  // Valore annuo del contratto in corso (rinnovo: senza fee di attivazione) e primo contratto (con fee).
  esempio.contratto = function () { return price(esempio.config, { fee: false }); };
  esempio.primoContratto = function () { return price(esempio.config); };
  // Rata trimestrale della componente variabile.
  esempio.trimestre = function () { return round(esempio.contratto().variabile / 4); };
  // Overage per servizio: unità oltre la quantità configurata, ad oggi e a fine periodo, al prezzo unitario di listino.
  esempio.overage = function () {
    return services.map(function (s) {
      var c = esempio.consumi[s.id], q = esempio.config[s.id] || 0;
      var ora = Math.max(0, c[0] - q), fine = Math.max(0, c[1] - q);
      return { id: s.id, name: s.name, unit: s.unit, ora: ora, oraEur: round(ora * s.unit), fine: fine, fineEur: round(fine * s.unit) };
    });
  };
  esempio.overageTotale = function () { return round(esempio.overage().reduce(function (a, o) { return a + o.fineEur; }, 0)); };
  esempio.overageOra = function () { return round(esempio.overage().reduce(function (a, o) { return a + o.oraEur; }, 0)); };
  esempio.prezzoUpgrade = function (id, qty) { return round(qty * byId(id).unit); };
  esempio.upgradeInCorsoPrezzo = function () { return esempio.prezzoUpgrade(esempio.upgradeInCorso.id, esempio.upgradeInCorso.qty); };

  function round(n) { return Math.round(n * 100) / 100; }
  function grp(n, opt) { return n.toLocaleString('it-IT', Object.assign({ useGrouping: 'always' }, opt || {})); }
  function eur(n) { return '€ ' + grp(n, { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); }
  function num(n) { return grp(n); }
  function unit3(n) { return grp(n, { minimumFractionDigits: 3, maximumFractionDigits: 3 }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  window.DTP = {
    services: services, byId: byId,
    families: ['Identità e verifica', 'Firma elettronica', 'Contratti e documenti', 'Fatturazione'],
    feeAttivazione: feeAttivazione, canonePeriodico: canonePeriodico, periodicita: periodicita, SEGNAPOSTO: SEGNAPOSTO,
    lines: lines, price: price, missingDeps: missingDeps, esempio: esempio,
    eur: eur, num: num, unit3: unit3, esc: esc
  };
})();
