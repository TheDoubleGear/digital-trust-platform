import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const mockups = new URL('../public/mockups/', import.meta.url);
const src = f => readFileSync(new URL(f, mockups), 'utf8');

/* Pagina reale in jsdom con sessione demo; la navigazione è intercettata. */
function openPage(file, role) {
  const dom = new JSDOM(src(file), { runScripts: 'outside-only', url: 'https://example.test/mockups/' + file });
  const w = dom.window;
  w.scrollTo = () => {};
  w.sessionStorage.setItem('dtp-demo-role', role);
  w.localStorage.setItem('dtp-demo-lr-setup', JSON.stringify({ delegates: true, done: true }));
  for (const s of w.document.querySelectorAll('head > script[src]')) w.eval(src(s.getAttribute('src')));
  const nav = [];
  w.DTPAuth._navigate = url => { nav.push(url); };
  for (const s of w.document.querySelectorAll('body > script:not([src])')) w.eval(s.textContent);
  const app = w.document.getElementById('app');
  const text = () => app.textContent.replace(/\s+/g, ' ');
  const click = label => { const b = [...app.querySelectorAll('button')].find(x => x.textContent.trim() === label); assert.ok(b, 'pulsante «' + label + '»'); b.click(); };
  return { w, nav, app, text, click };
}
const M5 = 'cliente-M5-contratto.html';

test('nessun riferimento a rinnovo automatico o tacito e niente «modalità di rinnovo [DA DEFINIRE]»', () => {
  for (const f of readdirSync(mockups).filter(f => /\.(html|js)$/.test(f))) {
    const s = src(f);
    assert.doesNotMatch(s, /rinnovo (automatico|tacito)|tacito rinnovo|si rinnova automaticamente|rinnovo tra \d+ giorni/i, f);
    /* Il testo del contratto (dtp-contract-pdf.js) mantiene il segnaposto «Modalità di rinnovo: [DA DEFINIRE]»: non è oggetto della issue. */
    if (f !== 'dtp-contract-pdf.js') assert.doesNotMatch(s, /modalità di rinnovo/i, f);
    assert.doesNotMatch(s, /Disdetti/, f);
  }
});

test('M5-05 visibile a LR e DA, assente per DO e DT', () => {
  for (const role of ['lr', 'amm']) {
    const t = openPage(M5, role).text();
    assert.match(t, /Scadenza e conservazione dei dati/, role);
    assert.match(t, /Rinnovo non tacito: rinnova entro la scadenza/, role);
    assert.match(t, /Giorni alla scadenza 108 giorni/, role);
    assert.match(t, /Finestre di preavviso/, role);
  }
  const op = openPage(M5, 'op');
  assert.doesNotMatch(op.text(), /Scadenza e conservazione dei dati/);
  const tec = openPage(M5, 'tec');
  assert.doesNotMatch(tec.text(), /Scadenza e conservazione dei dati/);
});

test('stato dimostrativo «Contratto scaduto»: servizio disabilitato, giorni residui e data di cancellazione', () => {
  const lr = openPage(M5, 'lr');
  lr.click('Contratto scaduto');
  const t = lr.text();
  assert.match(t, /servizio disabilitato per mancato rinnovo/);
  assert.match(t, /Conservazione dei dati \[DA DEFINIRE\] giorni giorni residui prima della cancellazione/);
  assert.match(t, /Data di cancellazione \[DA DEFINIRE\]/);
  assert.ok([...lr.app.querySelectorAll('button')].some(b => b.textContent.trim() === 'Rinnova'));
  lr.click('Contratto in corso');
  assert.doesNotMatch(lr.text(), /servizio disabilitato per mancato rinnovo/);
});

test('«Rinnova» in M5-05: il DA invia per approvazione, il LR firma direttamente', () => {
  const amm = openPage(M5, 'amm');
  amm.click('Rinnova');
  const r = amm.w.DTPModifiche.list().find(x => x.what === 'Rinnovo del contratto');
  assert.equal(r.state, 'approval');
  assert.match(amm.text(), /Richiesta di rinnovo creata/);
  const lr = openPage(M5, 'lr');
  lr.click('Rinnova');
  assert.equal(lr.w.DTPModifiche.list().find(x => x.what === 'Rinnovo del contratto').state, 'countersign');
});

test('testate, notifiche e console usano scadenza e conservazione', () => {
  assert.match(openPage('cliente-H-catalogo.html', 'lr').text(), /scadenza tra 124 giorni/);
  assert.match(openPage('cliente-M1-panoramica.html', 'lr').text(), /Scadenza tra 124 giorni/);
  assert.match(openPage('cliente-M2-dettaglio.html', 'lr').text(), /scadenza tra 124 giorni/);
  const np = openPage('cliente-N-notifiche.html', 'lr');
  assert.match(np.text(), /Scadenza del contratto \(preavviso\)/);
  np.click('Preferenze di canale');
  const n = np.text();
  for (const e of ['Scadenza del contratto (preavviso)', 'Servizio disabilitato per mancato rinnovo', 'Cancellazione dei dati imminente']) assert.ok(n.includes(e), e);
  const ps = src('cliente-PS02-soglie.html');
  for (const e of ['Scadenza del contratto (preavviso)', 'Servizio disabilitato per mancato rinnovo', 'Cancellazione dei dati imminente']) assert.ok(ps.includes(e), 'PS-02 ' + e);
  for (const role of ['com', 'ops']) {
    const o2 = openPage('postel-O2-portafoglio.html', role).text();
    assert.match(o2, /In scadenza/, role);
    assert.match(o2, /Scaduto, in conservazione .*giorni residui alla cancellazione/, role);
    assert.match(openPage('postel-O5-scheda-cliente.html', role).text(), /Stato del rinnovo e della conservazione dei dati/, role);
  }
});
