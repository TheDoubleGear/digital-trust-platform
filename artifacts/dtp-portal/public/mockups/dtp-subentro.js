/* Cambio del legale rappresentante (subentro) del cliente di esempio (Assicurazioni Aurora S.p.A.), condiviso tra le pagine.
   Percorso: invito da U-02 (legale rappresentante o delegato amministrativo) oppure avvio dall'area pubblica
   -> richiesta in V-03 con dichiarazione firmata digitalmente -> esiti di firma digitale e visura camerale
   -> approvazione di Postel in O2-07 -> nuova utenza attiva, utenza precedente revocata.
   L'utenza precedente resta attiva finché le verifiche non sono positive e Postel non approva: il cliente ha
   sempre almeno un legale rappresentante attivo. I delegati restano attivi.
   Dati dimostrativi salvati in localStorage "dtp-demo-subentro" di questo browser. Se il browser non consente
   di salvare, lo stato vive solo nella pagina aperta. */
(function (root) {
  'use strict';

  var KEY = 'dtp-demo-subentro';
  var PEOPLE = {
    lr: { name: 'Paolo Ferretti', role: 'legale rappresentante' },
    amm: { name: 'Giulia Marchetti', role: 'delegato amministrativo' }
  };
  /* Stati della richiesta di subentro: etichetta e colori. */
  var STATES = {
    invited: { label: 'Invito inviato', bg: '#E5EFFF', fg: '#0047BB' },
    verify: { label: 'Verifiche concluse, da approvare', bg: '#FDE7DC', fg: '#B03A0B' },
    done: { label: 'Nuova utenza attiva, utenza precedente revocata', bg: '#E3F3EA', fg: '#1A6B4A' }
  };

  function storage() {
    try { var s = root.localStorage; if (s && typeof s.getItem === 'function') return s; } catch (e) {}
    return null;
  }
  var memory = null;
  function load() {
    if (memory) return memory;
    var s = storage(), v = null;
    if (s) { try { v = JSON.parse(s.getItem(KEY) || 'null'); } catch (e) { v = null; } }
    memory = v && typeof v === 'object' ? v : { invite: null, request: null };
    return memory;
  }
  function save(v) {
    memory = v;
    var s = storage();
    if (s) { try { s.setItem(KEY, JSON.stringify(v)); } catch (e) {} }
  }
  function copy(x) { return x ? JSON.parse(JSON.stringify(x)) : null; }
  function str(x) { return String(x == null ? '' : x).trim(); }

  /* Chi può avviare il cambio dal portale: legale rappresentante e delegato amministrativo. */
  function canStart(role) { return role === 'lr' || role === 'amm'; }

  function newCode() {
    var A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', out = '';
    for (var i = 0; i < 6; i++) out += A.charAt(Math.floor(Math.random() * A.length));
    return 'SUB' + out;
  }

  /* Invito al nuovo legale rappresentante: nome, cognome ed e-mail. Il codice va usato in V-03. */
  function invite(role, o) {
    o = o || {};
    if (!canStart(role)) return null;
    var nome = str(o.nome), cognome = str(o.cognome), email = str(o.email);
    if (!nome || !cognome || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
    var cur = load();
    if (cur.request && cur.request.state !== 'done') return null; /* un subentro alla volta */
    var inv = { code: newCode(), nome: nome, cognome: cognome, email: email, by: role, at: Date.now() };
    save({ invite: inv, request: null });
    return copy(inv);
  }
  function getInvite() { return copy(load().invite); }
  function findInvite(code) {
    var inv = load().invite, c = str(code).toUpperCase();
    return inv && c && inv.code === c ? copy(inv) : null;
  }

  /* Richiesta inviata da V-03. Esiti dimostrativi: firma digitale valida e nominativo presente nella visura. */
  function submit(o) {
    o = o || {};
    var cur = load(), inv = o.mode === 'invito' ? findInvite(o.code) : null, now = Date.now();
    var req = { mode: o.mode === 'pubblico' ? 'pubblico' : 'invito', code: inv ? inv.code : str(o.code).toUpperCase(),
      nome: str(o.nome), cognome: str(o.cognome), email: str(o.email), at: now, state: 'verify',
      checks: { firma: { ok: true, at: now }, visura: { ok: true, at: now } }, approved: null };
    save({ invite: cur.invite, request: req });
    return copy(req);
  }
  function getRequest() { return copy(load().request); }

  /* Approvazione di Postel, solo a verifiche positive: poi la nuova utenza è attiva e la precedente revocata. */
  function approve() {
    var cur = load(), r = cur.request;
    if (!r || r.state !== 'verify' || !r.checks.firma.ok || !r.checks.visura.ok) return null;
    r.state = 'done'; r.approved = { by: 'postel', at: Date.now() };
    save(cur);
    return copy(r);
  }
  function reset() { memory = null; var s = storage(); if (s) { try { s.removeItem(KEY); } catch (e) {} } }

  /* Stato complessivo per le pagine: invito inviato, verifiche concluse oppure subentro approvato. */
  function state() {
    var cur = load();
    if (cur.request) return cur.request.state;
    return cur.invite ? 'invited' : null;
  }

  /* Registro attività del cliente (U): avvio, invio della richiesta, approvazione di Postel. */
  function events() {
    var cur = load(), out = [];
    if (cur.invite) out.push({ ts: cur.invite.at, who: PEOPLE[cur.invite.by].name,
      what: 'ha avviato il cambio del legale rappresentante e invitato ' + cur.invite.nome + ' ' + cur.invite.cognome + ' (' + cur.invite.email + ')' });
    var r = cur.request;
    if (r) {
      var name = (r.nome + ' ' + r.cognome).trim() || 'Il nuovo legale rappresentante';
      out.push({ ts: r.at, who: name, what: 'ha inviato la richiesta di subentro con la dichiarazione firmata digitalmente' });
      if (r.approved) out.push({ ts: r.approved.at, who: 'Postel', what: 'ha approvato il subentro di ' + name + ': nuova utenza attiva, utenza di ' + PEOPLE.lr.name + ' revocata · evidenze conservate' });
    }
    return out;
  }

  var MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function full(ts) { var d = new Date(ts); return d.getDate() + ' ' + MESI[d.getMonth()] + ' ' + d.getFullYear() + ' alle ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }

  root.DTPSubentro = {
    KEY: KEY, PEOPLE: PEOPLE, STATES: STATES,
    canStart: canStart, invite: invite, getInvite: getInvite, findInvite: findInvite,
    submit: submit, getRequest: getRequest, approve: approve, reset: reset, state: state, events: events, full: full
  };
})(typeof window !== 'undefined' ? window : globalThis);
