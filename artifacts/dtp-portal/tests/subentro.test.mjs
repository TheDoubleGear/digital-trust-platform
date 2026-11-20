import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const mockups = new URL('../public/mockups/', import.meta.url);
const src = f => readFileSync(new URL(f, mockups), 'utf8');
const U = 'cliente-U-utenze.html', O2 = 'postel-O2-portafoglio.html', V01 = 'vetrina-V01-catalogo.html', V03 = 'vetrina-V03-subentro.html';

/* Pagina reale in jsdom con sessione demo; localStorage condiviso tra le pagine aperte nello stesso test. */
function openPage(file, role, store, query = '') {
  const dom = new JSDOM(src(file), { runScripts: 'outside-only', url: 'https://example.test/mockups/' + file + query });
  const w = dom.window;
  w.scrollTo = () => {};
  w.HTMLElement.prototype.focus = function () {};
  if (role) w.sessionStorage.setItem('dtp-demo-role', role);
  w.localStorage.setItem('dtp-demo-lr-setup', JSON.stringify({ delegates: true, done: true }));
  for (const [k, v] of Object.entries(store || {})) w.localStorage.setItem(k, v);
  for (const s of w.document.querySelectorAll('head > script[src]')) w.eval(src(s.getAttribute('src')));
  const nav = [];
  w.DTPAuth._navigate = url => { nav.push(url); };
  for (const s of w.document.querySelectorAll('body > script:not([src])')) w.eval(s.textContent);
  const doc = w.document, app = doc.getElementById('app') || doc.body;
  const text = () => app.textContent.replace(/\s+/g, ' ');
  const btn = label => [...app.querySelectorAll('button')].find(x => x.textContent.trim() === label);
  const click = label => { const b = btn(label); assert.ok(b, 'pulsante «' + label + '»'); b.click(); };
  const dump = () => ({ 'dtp-demo-subentro': w.localStorage.getItem('dtp-demo-subentro') });
  return { w, doc, nav, app, text, btn, click, dump };
}

test('V-03 è pubblica, raggiungibile da V-01 e con i quattro passi e i segnaposto', () => {
  const v = openPage(V03, null);
  assert.equal(v.nav.length, 0);
  assert.equal(v.doc.querySelectorAll('#stepper li').length, 4);
  const html = src(V03);
  for (const p of ['[DA DEFINIRE]', '[TESTO DA FORNIRE E APPROVARE A CURA DI POSTEL]', "[RAGIONE SOCIALE DELL'AZIENDA]", '[PARTITA IVA]', '[NOME E COGNOME]', 'Prototipo dimostrativo']) assert.ok(html.includes(p), p);
  const link = openPage(V01, null).doc.querySelector('[data-testid="link-subentro"]');
  assert.equal(link.textContent, "Sei il nuovo legale rappresentante di un'azienda cliente?");
  assert.equal(link.getAttribute('href'), V03);
});

test('U-02: «Avvia cambio del legale rappresentante» per LR e DA, non per DO', () => {
  assert.ok(openPage(U, 'lr').btn('Avvia cambio del legale rappresentante'));
  assert.ok(openPage(U, 'amm').btn('Avvia cambio del legale rappresentante'));
  assert.equal(openPage(U, 'op').btn('Avvia cambio del legale rappresentante'), undefined);
  const html = src('tecnico-D0-developer-portal.html');
  assert.ok(!html.includes('Avvia cambio del legale rappresentante'), 'DT non ha l’azione');
});

test('percorso completo: invito da U-02, richiesta in V-03, approvazione del commerciale in O2-07', () => {
  const u = openPage(U, 'amm');
  u.click('Avvia cambio del legale rappresentante');
  u.click("Invia l'invito");
  assert.match(u.text(), /Inserisci nome, cognome e un indirizzo e-mail valido/);
  u.doc.getElementById('sub-nome').value = 'Chiara';
  u.doc.getElementById('sub-cognome').value = 'Bassi';
  u.doc.getElementById('sub-email').value = 'c.bassi@aurora.example';
  u.click("Invia l'invito");
  const code = u.doc.querySelector('[data-testid="text-invite-code"]').textContent;
  assert.match(code, /^SUB[A-Z0-9]{6}$/);
  assert.equal(u.doc.querySelector('[data-testid="link-invite-v03"]').getAttribute('href'), V03 + '?invito=' + code);
  assert.match(u.text(), /Giulia Marchetti ha avviato il cambio del legale rappresentante e invitato Chiara Bassi/);
  assert.equal(u.btn('Avvia cambio del legale rappresentante'), undefined, 'un subentro alla volta');

  const o2a = openPage(O2, 'com', u.dump());
  assert.match(o2a.text(), /Subentro del legale rappresentante.*invito inviato a Chiara Bassi/);
  assert.equal(o2a.btn('Approva subentro') && o2a.text().match(/Approva subentro/g).length, 1, 'solo l’esempio già verificato è approvabile');

  const v = openPage(V03, null, u.dump(), '?invito=' + code);
  assert.equal(v.doc.getElementById('invito').value, code);
  v.doc.getElementById('f1').dispatchEvent(new v.w.Event('submit', { cancelable: true }));
  assert.equal(v.doc.getElementById('s2').hidden, false);
  assert.equal(v.doc.getElementById('nome').value, 'Chiara');
  assert.equal(v.doc.getElementById('email').value, 'c.bassi@aurora.example');
  v.doc.getElementById('cf').value = 'BSSCHR80A41F205X';
  v.doc.getElementById('tel').value = '+39 333 1234567';
  v.doc.getElementById('data').value = '2026-11-02';
  v.doc.getElementById('f2').dispatchEvent(new v.w.Event('submit', { cancelable: true }));
  v.doc.getElementById('submit').click();
  assert.equal(v.doc.getElementById('s4').hidden, true, 'senza dichiarazione e conferme non si invia');
  v.doc.getElementById('dl').click();
  const file = v.doc.getElementById('file');
  Object.defineProperty(file, 'files', { value: [{ name: 'dichiarazione.pdf.p7m' }] });
  file.dispatchEvent(new v.w.Event('change'));
  v.doc.getElementById('ack1').checked = true;
  v.doc.getElementById('ack2').checked = true;
  v.doc.getElementById('submit').click();
  assert.equal(v.doc.getElementById('s4').hidden, false);

  const ops = openPage(O2, 'ops', v.dump());
  assert.match(ops.text(), /nuovo LR: Chiara Bassi · Firma digitale: valida · Visura camerale: corrispondente · utenza di Paolo Ferretti attiva fino all’approvazione/);
  assert.equal(ops.btn('Approva subentro'), undefined, 'Operations non approva');

  const com = openPage(O2, 'com', v.dump());
  const row = [...com.app.querySelectorAll('[role="row"]')].find(r => /Assicurazioni Aurora/.test(r.textContent) && /Chiara Bassi/.test(r.textContent));
  row.querySelector('button').click();
  assert.match(com.text(), /Nuova utenza attiva, utenza precedente revocata/);
  assert.match(com.text(), /utenza di Paolo Ferretti revocata, delegati attivi · evidenze conservate/);

  const lr = openPage(U, 'lr', com.dump());
  assert.match(lr.text(), /Subentro di Chiara Bassi approvato da Postel/);
  assert.match(lr.text(), /Postel ha approvato il subentro di Chiara Bassi/);
  assert.ok(lr.btn('Avvia cambio del legale rappresentante'), 'dopo l’approvazione si può avviare un nuovo cambio');
});

test('O2-07: il commerciale approva il subentro di esempio, dopo verifiche positive', () => {
  const com = openPage(O2, 'com');
  assert.match(com.text(), /Farmacie Riunite Sud S\.r\.l\. Subentro del legale rappresentante/);
  assert.match(com.text(), /Verifiche concluse, da approvare/);
  com.click('Approva subentro');
  assert.match(com.text(), /Farmacie Riunite Sud S\.r\.l\. Subentro del legale rappresentante.*utenza di Michele Russo revocata/);
  assert.match(com.text(), /Nuova utenza attiva, utenza precedente revocata/);
  assert.equal(openPage(O2, 'cdg').btn('Approva subentro'), undefined);
});

test('senza verifiche positive il modulo non approva e l’utenza precedente resta attiva', () => {
  const w = openPage(V03, null).w, S = w.DTPSubentro;
  assert.equal(S.approve(), null);
  assert.equal(S.invite('op', { nome: 'A', cognome: 'B', email: 'a@b.it' }), null);
  assert.equal(S.invite('tec', { nome: 'A', cognome: 'B', email: 'a@b.it' }), null);
  assert.ok(S.invite('lr', { nome: 'A', cognome: 'B', email: 'a@b.it' }));
  assert.equal(S.approve(), null, 'con il solo invito non si approva');
  assert.equal(S.state(), 'invited');
});
