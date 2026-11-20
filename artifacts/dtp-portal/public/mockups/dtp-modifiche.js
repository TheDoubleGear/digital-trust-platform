/* Modifiche dell'offerta del cliente di esempio (Assicurazioni Aurora S.p.A.), condivise tra le pagine.
   Percorso: avvio del delegato amministrativo -> approvazione del legale rappresentante (evidenza conservata)
   -> firma dell'atto da parte del delegato amministrativo -> verifica automatica della firma -> modifica attiva.
   Postel non controfirma: la verifica è automatica e viene registrata, senza azioni in console.
   Il legale rappresentante può avviare e firmare direttamente: la sua modifica è subito verificata e attiva.
   Dati dimostrativi salvati in localStorage "dtp-demo-modifiche" di questo browser, così il percorso prosegue
   cambiando utenza demo. Se il browser non consente di salvare, lo stato vive solo nella pagina aperta. */
(function (root) {
  'use strict';

  var KEY = 'dtp-demo-modifiche';
  var PEOPLE = {
    lr: { name: 'Paolo Ferretti', role: 'legale rappresentante' },
    amm: { name: 'Giulia Marchetti', role: 'delegato amministrativo' },
    sistema: { name: 'Piattaforma', role: 'verifica automatica' }
  };
  /* Stati della richiesta: etichetta per il cliente, etichetta per la console Postel, colori. */
  var STATES = {
    approval: { label: 'In approvazione del LR', postel: 'In approvazione del LR del cliente', bg: '#FDF1D6', fg: '#855800' },
    rejected: { label: 'Rifiutata dal LR', postel: 'Rifiutata dal LR del cliente', bg: '#FBE3E1', fg: '#A3201A' },
    sign: { label: 'Approvata, da firmare', postel: 'Approvata dal LR, in firma del cliente', bg: '#E5EFFF', fg: '#0047BB' },
    done: { label: 'Firmata e attiva', postel: 'Attivata', bg: '#E3F3EA', fg: '#1A6B4A' }
  };
  var PENDING = ['approval', 'sign'];

  function at(daysAgo, h, m) {
    var d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(h, m, 0, 0); return d.getTime();
  }
  function fixed(y, mo, d, h, m) { return new Date(y, mo - 1, d, h, m, 0, 0).getTime(); }

  function seed() {
    return [
      { id: 'RM-014', what: 'Upgrade Identificazioni Full Prospect: +3.000 unità', detail: 'da 5.000 a 8.000 unità', amount: 3600,
        by: 'amm', created: at(0, 9, 14), state: 'approval', approval: null, signed: null, verified: null },
      { id: 'RM-013', what: 'Upgrade Verifiche Contatti: +10.000 unità', detail: 'da 25.000 a 35.000 unità', amount: 500,
        by: 'amm', created: at(1, 10, 20), state: 'sign',
        approval: { outcome: 'approved', by: 'lr', at: at(1, 17, 5), reason: '' }, signed: null, verified: null },
      /* La variazione del referente amministrativo per la fatturazione è riservata al legale rappresentante:
         la avvia e la firma lui, senza passaggio di approvazione. */
      { id: 'RM-011', kind: 'referente', what: 'Variazione del referente amministrativo', detail: 'nuovo referente: Ufficio acquisti', amount: null,
        by: 'lr', created: fixed(2026, 10, 2, 9, 30), state: 'done', approval: null,
        signed: { by: 'lr', at: fixed(2026, 10, 2, 9, 30) }, verified: { at: fixed(2026, 10, 2, 9, 30) } }
    ];
  }

  function storage() {
    try { var s = root.localStorage; if (s && typeof s.getItem === 'function') return s; } catch (e) {}
    return null;
  }
  var memory = null;
  function load() {
    if (memory) return memory;
    var s = storage(), list = null;
    if (s) { try { list = JSON.parse(s.getItem(KEY) || 'null'); } catch (e) { list = null; } }
    memory = Array.isArray(list) ? list.map(migrate) : seed();
    return memory;
  }
  /* Dati salvati da versioni precedenti del prototipo, con la controfirma di Postel: una richiesta firmata
     e in attesa di controfirma diventa attiva, la controfirma lascia il posto alla verifica automatica. */
  function migrate(r) {
    if (!r || typeof r !== 'object') return r;
    if (r.state === 'countersign') r.state = 'done';
    if (!r.verified && r.state === 'done' && r.signed) r.verified = { at: r.signed.at };
    delete r.countersigned;
    return r;
  }
  function save(list) {
    memory = list;
    var s = storage();
    if (s) { try { s.setItem(KEY, JSON.stringify(list)); } catch (e) {} }
  }
  function copy(r) { return r ? JSON.parse(JSON.stringify(r)) : null; }
  function find(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }

  function list() { return load().map(copy).sort(function (a, b) { return b.created - a.created; }); }
  function get(id) { return copy(find(load(), id)); }
  function pending() { return list().filter(function (r) { return PENDING.indexOf(r.state) >= 0; }); }
  function nextId(all) {
    var n = all.reduce(function (a, r) { var k = Number(String(r.id).replace(/\D/g, '')); return k > a ? k : a; }, 0) + 1;
    return 'RM-' + (n < 100 ? ('00' + n).slice(-3) : String(n));
  }

  /* Tipi di modifica riservati al legale rappresentante: il delegato amministrativo non può avviarli né firmarli. */
  var LR_ONLY = ['referente'];
  function canStart(role, kind) {
    if (role === 'lr') return true;
    return role === 'amm' && LR_ONLY.indexOf(kind) < 0;
  }

  /* Avvio di una modifica. Solo legale rappresentante e delegato amministrativo, nei limiti di canStart.
     Con il delegato amministrativo la richiesta resta "in approvazione" finché il legale rappresentante non decide. */
  function create(o) {
    if (!o || !canStart(o.role, o.kind) || !o.what) return null;
    var all = load().slice(), now = Date.now();
    var r = { id: nextId(all), kind: o.kind ? String(o.kind) : 'offerta', what: String(o.what), detail: String(o.detail || ''), amount: typeof o.amount === 'number' ? o.amount : null,
      by: o.role, created: now, state: 'approval', approval: null, signed: null, verified: null };
    if (o.role === 'lr') { r.state = 'done'; r.signed = { by: 'lr', at: now }; r.verified = { at: now }; }
    all.push(r); save(all);
    return copy(r);
  }
  function change(id, from, fn) {
    var all = load().slice(), r = find(all, id);
    if (!r || r.state !== from) return null;
    fn(r); save(all);
    return copy(r);
  }
  function approve(id) {
    return change(id, 'approval', function (r) { r.approval = { outcome: 'approved', by: 'lr', at: Date.now(), reason: '' }; r.state = 'sign'; });
  }
  /* Il rifiuto richiede una motivazione. */
  function reject(id, reason) {
    var why = String(reason == null ? '' : reason).trim();
    if (!why) return null;
    return change(id, 'approval', function (r) { r.approval = { outcome: 'rejected', by: 'lr', at: Date.now(), reason: why }; r.state = 'rejected'; });
  }
  /* Firma dell'atto di modifica da parte del delegato amministrativo, dopo l'approvazione. La piattaforma verifica
     subito la firma in modo automatico e la modifica diventa attiva. */
  function sign(id) {
    var cur = find(load(), id);
    if (cur && LR_ONLY.indexOf(cur.kind) >= 0) return null;
    return change(id, 'sign', function (r) { var now = Date.now(); r.signed = { by: 'amm', at: now }; r.verified = { at: now }; r.state = 'done'; });
  }
  function reset() { memory = null; var s = storage(); if (s) { try { s.removeItem(KEY); } catch (e) {} } return list(); }

  /* Registro: avvio, approvazione o rifiuto, firma e verifica automatica, dal più recente. */
  function events() {
    var out = [];
    load().forEach(function (r) {
      out.push({ ts: r.created, by: r.by, kind: 'avvio', id: r.id, text: (r.by === 'lr' ? 'ha avviato e firmato la modifica ' : 'ha avviato la modifica ') + r.id + ': ' + r.what + (r.state === 'approval' ? ' (in approvazione del legale rappresentante)' : '') });
      if (r.approval) out.push({ ts: r.approval.at, by: 'lr', kind: r.approval.outcome === 'approved' ? 'approvazione' : 'rifiuto', id: r.id,
        text: (r.approval.outcome === 'approved' ? 'ha approvato la modifica ' : 'ha rifiutato la modifica ') + r.id + ': ' + r.what + (r.approval.reason ? ' · motivazione: ' + r.approval.reason : '') + ' · evidenza conservata' });
      if (r.signed && r.by !== 'lr') out.push({ ts: r.signed.at, by: r.signed.by, kind: 'firma', id: r.id, text: 'ha firmato l’atto di modifica ' + r.id + ': ' + r.what });
      if (r.verified) out.push({ ts: r.verified.at, by: 'sistema', kind: 'verifica', id: r.id, text: 'ha verificato in automatico la firma della modifica ' + r.id + ': esito positivo, modifica attiva' });
    });
    /* A parità di orario la verifica automatica segue la firma (e l'avvio diretto del legale rappresentante). */
    var ORDER = { avvio: 0, approvazione: 1, rifiuto: 1, firma: 2, verifica: 3 };
    return out.sort(function (a, b) { return (b.ts - a.ts) || (ORDER[b.kind] - ORDER[a.kind]); });
  }

  /* Stato dell'approvazione del legale rappresentante in una riga di testo. */
  function approvalText(r) {
    if (r.by === 'lr') return 'avviata e firmata dal legale rappresentante: approvazione non necessaria';
    if (!r.approval) return 'approvazione del legale rappresentante in attesa';
    var a = r.approval, base = (a.outcome === 'approved' ? 'approvata da ' : 'rifiutata da ') + PEOPLE.lr.name + ' il ' + full(a.at);
    return base + (a.reason ? ' · motivazione: ' + a.reason : '') + ' · evidenza conservata';
  }

  var MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function day(d) { return d.getDate() + ' ' + MESI[d.getMonth()] + ' ' + d.getFullYear(); }
  function hm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  /* Data e ora complete, per le evidenze: "19 nov 2026 alle 10:42". */
  function full(ts) { var d = new Date(ts); return day(d) + ' alle ' + hm(d); }
  /* Data relativa per elenchi e registri: "oggi, 09:14", "ieri, 17:05", "3 ott 2026, 11:00". */
  function when(ts) {
    var d = new Date(ts), t = new Date(), y = new Date(); y.setDate(t.getDate() - 1);
    var same = function (a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); };
    return (same(d, t) ? 'oggi' : (same(d, y) ? 'ieri' : day(d))) + ', ' + hm(d);
  }

  root.DTPModifiche = {
    KEY: KEY, PEOPLE: PEOPLE, STATES: STATES, PENDING: PENDING, LR_ONLY: LR_ONLY,
    canStart: canStart, list: list, get: get, pending: pending, create: create, approve: approve, reject: reject, sign: sign,
    reset: reset, events: events, approvalText: approvalText, full: full, when: when
  };
})(typeof window !== 'undefined' ? window : globalThis);
