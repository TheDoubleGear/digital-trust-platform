import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const mockups = new URL('../public/mockups/', import.meta.url);
const src = f => readFileSync(new URL(f, mockups), 'utf8');
const modSrc = src('dtp-modifiche.js');
const KEY = 'dtp-demo-modifiche';

function memoryStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => { m.delete(k); } };
}
/* Modulo puro, senza DOM. */
function core(local = memoryStorage()) {
  const ctx = { localStorage: local, Date };
  ctx.globalThis = ctx;
  vm.runInNewContext(modSrc, ctx);
  return { M: ctx.DTPModifiche, local };
}
/* Pagina reale in jsdom con sessione demo e archivio delle modifiche condiviso. */
function openPage(file, role, stored) {
  const dom = new JSDOM(src(file), { runScripts: 'outside-only', url: 'https://example.test/mockups/' + file });
  const w = dom.window;
  w.scrollTo = () => {};
  w.sessionStorage.setItem('dtp-demo-role', role);
  w.localStorage.setItem('dtp-demo-lr-setup', JSON.stringify({ delegates: true, done: true }));
  if (stored) w.localStorage.setItem(KEY, stored);
  for (const s of w.document.querySelectorAll('head > script[src]')) w.eval(src(s.getAttribute('src')));
  w.DTPAuth._navigate = () => {};
  for (const s of w.document.querySelectorAll('body > script:not([src])')) w.eval(s.textContent);
  const app = w.document.getElementById('app');
  const text = () => app.textContent.replace(/\s+/g, ' ');
  const buttons = label => [...app.querySelectorAll('button')].filter(b => b.textContent.trim() === label);
  const click = label => { const b = buttons(label)[0]; assert.ok(b, 'pulsante «' + label + '»'); b.click(); };
  return { w, text, buttons, click, stored: () => w.localStorage.getItem(KEY) };
}

test('la modifica avviata dal delegato amministrativo resta in approvazione finché il LR non decide', () => {
  const { M } = core();
  const r = M.create({ role: 'amm', what: 'Upgrade di prova', amount: 100 });
  assert.equal(r.state, 'approval');
  assert.equal(M.sign(r.id), null, 'senza approvazione non si firma');
  assert.equal(M.countersign(r.id), null, 'senza firma non si controfirma');
  assert.equal(M.get(r.id).state, 'approval');
  const a = M.approve(r.id);
  assert.equal(a.state, 'sign');
  assert.equal(a.approval.outcome, 'approved');
  assert.equal(typeof a.approval.at, 'number');
  assert.equal(M.sign(r.id).state, 'countersign');
  assert.equal(M.countersign(r.id).state, 'done');
  const kinds = [...M.events().filter(e => e.id === r.id).map(e => e.kind)].sort();
  assert.deepEqual(kinds, ['approvazione', 'avvio', 'controfirma', 'firma']);
});

test('il legale rappresentante avvia e firma senza passaggio di approvazione', () => {
  const { M } = core();
  const r = M.create({ role: 'lr', what: 'Upgrade del LR' });
  assert.equal(r.state, 'countersign');
  assert.equal(r.approval, null);
  assert.equal(r.signed.by, 'lr');
  assert.match(M.approvalText(r), /approvazione non necessaria/);
});

test('il rifiuto richiede la motivazione e la conserva come evidenza', () => {
  const { M } = core();
  const r = M.create({ role: 'amm', what: 'Upgrade da rifiutare' });
  assert.equal(M.reject(r.id, '   '), null);
  const x = M.reject(r.id, 'Quantità eccessiva');
  assert.equal(x.state, 'rejected');
  assert.equal(x.approval.reason, 'Quantità eccessiva');
  assert.match(M.approvalText(x), /rifiutata da Paolo Ferretti .* motivazione: Quantità eccessiva · evidenza conservata/);
});

test('solo LR e delegato amministrativo avviano modifiche; lo stato sopravvive al cambio di pagina', () => {
  const local = memoryStorage();
  const { M } = core(local);
  for (const role of ['op', 'tec', 'com', undefined]) assert.equal(M.create({ role, what: 'x' }), null, String(role));
  const r = M.create({ role: 'amm', what: 'Persistente' });
  const again = core(local).M;
  assert.equal(again.get(r.id).state, 'approval');
  again.reset();
  assert.equal(local.getItem(KEY), null);
});

test('percorso nelle pagine: DA invia da H, LR vede H-10 e approva in M5-03, evidenza in M5-04 e nel registro', () => {
  const amm = openPage('cliente-H-catalogo.html', 'amm');
  amm.click('Aggiungi upgrade +2.000');
  assert.match(amm.text(), /Riepilogo della modifica.*Componente variabile.*Nuovo valore del contratto.*Decorrenza/);
  amm.click('Invia per approvazione');
  assert.match(amm.text(), /Modifica RM-015 inviata a Paolo Ferretti per l’approvazione/);
  let stored = amm.stored();
  assert.match(openPage('cliente-H-catalogo.html', 'amm', stored).text(), /RM-015 .*In approvazione del LR/);

  const lrH = openPage('cliente-H-catalogo.html', 'lr', stored);
  assert.match(lrH.text(), /Da decidere · 5 .*Modifica da approvare Upgrade Nuovi Certificati FEA: \+2.000 unità/);

  const lrM5 = openPage('cliente-M5-contratto.html', 'lr', stored);
  assert.equal(lrM5.buttons('Approva').length, 2);
  /* Approva proprio RM-015: l'ordine delle righe dipende dall'ora in cui gira il test. */
  const row = [...lrM5.w.document.querySelectorAll('#app [id^="richiesta-"]')].find(r => r.textContent.includes('RM-015') && [...r.querySelectorAll('button')].some(b => b.textContent.trim() === 'Approva'));
  assert.ok(row, 'riga RM-015');
  [...row.querySelectorAll('button')].find(b => b.textContent.trim() === 'Approva').click();
  stored = lrM5.stored();
  const t = openPage('cliente-M5-contratto.html', 'amm', stored).text();
  assert.match(t, /RM-015 .*Approvata da Paolo Ferretti il .* · evidenza conservata .*Approvata, da firmare/);
  assert.match(t, /Evidenza di approvazione RM-015/);
  assert.match(openPage('cliente-U-utenze.html', 'lr', stored).text(), /Paolo Ferretti ha approvato la modifica RM-015/);
  assert.match(openPage('cliente-N-notifiche.html', 'amm', stored).text(), /Esito dell’approvazione: RM-015 approvata/);
  assert.match(openPage('postel-O2-portafoglio.html', 'com', stored).text(), /RM-015 .*approvata da Paolo Ferretti/);
});

test('rifiuto in M5-03 senza motivazione bloccato, con motivazione registrato', () => {
  const lr = openPage('cliente-M5-contratto.html', 'lr');
  lr.click('Rifiuta');
  lr.click('Conferma il rifiuto');
  assert.match(lr.text(), /Indica la motivazione del rifiuto/);
  lr.w.document.querySelector('textarea').value = 'Fuori budget';
  lr.click('Conferma il rifiuto');
  assert.match(lr.text(), /Rifiutata da Paolo Ferretti il .* motivazione: Fuori budget/);
  assert.match(lr.text(), /Evidenza di rifiuto RM-014/);
});

test('con LR la modifica da H si conferma e firma direttamente', () => {
  const lr = openPage('cliente-H-catalogo.html', 'lr');
  lr.click('Aggiungi upgrade +2.000');
  lr.click('Conferma e firma');
  assert.match(lr.text(), /Modifica RM-015 confermata e firmata/);
  assert.match(lr.text(), /RM-015 .*Firmata, in controfirma Postel/);
});

test('il delegato operativo non vede importi in H e invia segnalazioni', () => {
  const op = openPage('cliente-H-catalogo.html', 'op');
  assert.doesNotMatch(op.text(), /€/);
  assert.equal(op.buttons('Invia per approvazione').length, 0);
  op.click('Segnala');
  assert.match(op.text(), /Segnalazione inviata/);
});

test('nessun testo «presa visione» residuo nelle pagine', () => {
  for (const f of ['cliente-H-catalogo.html', 'cliente-M5-contratto.html', 'cliente-U-utenze.html', 'cliente-N-notifiche.html', 'postel-O2-portafoglio.html', 'postel-O5-scheda-cliente.html']) {
    assert.doesNotMatch(src(f), /presa visione|prendi visione/i, f);
  }
});

test('la variazione del referente amministrativo è riservata al legale rappresentante', () => {
  const { M } = core();
  const seed = M.get('RM-011');
  assert.equal(seed.kind, 'referente');
  assert.equal(seed.by, 'lr');
  assert.equal(seed.approval, null, 'avviata e firmata dal LR senza approvazione');
  assert.equal(seed.signed.by, 'lr');
  assert.equal(M.canStart('amm', 'referente'), false);
  assert.equal(M.create({ role: 'amm', kind: 'referente', what: 'Variazione del referente amministrativo' }), null);
  const r = M.create({ role: 'lr', kind: 'referente', what: 'Variazione del referente amministrativo' });
  assert.equal(r.state, 'countersign');
  assert.equal(r.approval, null);
});

test('M5: la variazione del referente amministrativo compare tra le azioni del LR, non del DA', () => {
  const card = p => [...p.w.document.querySelectorAll('#app article h3')].map(h => h.textContent.trim());
  assert.ok(card(openPage('cliente-M5-contratto.html', 'lr')).includes('Referente amministrativo'));
  const amm = openPage('cliente-M5-contratto.html', 'amm');
  assert.equal(card(amm).includes('Referente amministrativo'), false);
  assert.doesNotMatch(amm.text(), /referenti amministrativi/);
  assert.ok(card(amm).includes('Modifica'));
});

test('U: deleghe gerarchiche per nomina e modifica dei poteri; sostituzione e revoca solo con il LR', () => {
  const types = p => [...p.w.document.querySelectorAll('input[name="delega"]')].map(i => i.value);
  const expect = { lr: ['amm', 'op', 'tec'], amm: ['op', 'tec'], op: ['tec'] };
  const editable = { lr: 3, amm: 2, op: 1 };
  for (const role of ['lr', 'amm', 'op']) {
    const u = openPage('cliente-U-utenze.html', role);
    assert.equal(u.buttons('Modifica poteri').length, editable[role], role + ' modifica poteri');
    assert.equal(u.buttons('Revoca').length, role === 'lr' ? 3 : 0, role + ' revoca');
    assert.equal(u.buttons('Sostituisci').length, role === 'lr' ? 3 : 0, role + ' sostituisci');
    u.click('Nomina delegato');
    assert.deepEqual(types(u), expect[role], role + ' tipi di delega');
    assert.match(u.text(), /Chi firma l'atto quando nomina un delegato: \[DA DEFINIRE\]/);
  }
  const t = openPage('cliente-U-utenze.html', 'lr').text();
  assert.match(t, /Nominare e modificare i poteri dei delegati tutti operativo e tecnico tecnico —/);
  assert.match(t, /Sostituire e revocare i delegati ✓ — — —/);
});

test('U: la nomina e la modifica dei poteri registrano chi le ha fatte, che firma l\'atto', () => {
  const amm = openPage('cliente-U-utenze.html', 'amm');
  amm.click('Nomina delegato');
  amm.w.document.getElementById('nomina-nome').value = 'Sara';
  amm.w.document.getElementById('nomina-cognome').value = 'Neri';
  amm.w.document.querySelector('input[name="delega"][value="tec"]').checked = true;
  amm.click('Genera l\'atto e firma');
  assert.match(amm.text(), /Giulia Marchetti ha nominato Sara Neri delegato tecnico e firmato l’atto di delega/);
  const op = openPage('cliente-U-utenze.html', 'op');
  op.click('Modifica poteri');
  assert.match(op.text(), /Firmatario dell'atto di modifica: Davide Sala/);
  op.click('Genera l\'atto e firma');
  assert.match(op.text(), /Davide Sala ha modificato i poteri della delega tecnica di Andrea Colombo/);
  assert.match(op.text(), /atto di modifica dei poteri firmato da Davide Sala .* chi firma l’atto: \[DA DEFINIRE\]/);
});
