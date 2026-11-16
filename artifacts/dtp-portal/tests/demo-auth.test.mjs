import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const mockups = new URL('../public/mockups/', import.meta.url);
const authSrc = readFileSync(new URL('dtp-auth.js', mockups), 'utf8');
const pageFiles = readdirSync(mockups).filter(f => f.endsWith('.html') && f !== 'index.html');
const html = Object.fromEntries(pageFiles.map(f => [f, readFileSync(new URL(f, mockups), 'utf8')]));

const H = 'cliente-H-catalogo.html', PS01 = 'cliente-PS01-delegati.html', PS02 = 'cliente-PS02-soglie.html';
const D0 = 'tecnico-D0-developer-portal.html', M1 = 'cliente-M1-panoramica.html';
const O1 = 'postel-O1-executive.html', O3 = 'postel-O3-operations.html', O4 = 'postel-O4-marginalita.html', O5 = 'postel-O5-scheda-cliente.html';
const ROLES = ['lr', 'amm', 'op', 'tec', 'com', 'ops', 'cdg'];

function memoryStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => { m.delete(k); }, dump: () => Object.fromEntries(m) };
}
/* Logica pura, senza DOM: stessi sorgenti delle pagine. */
function core(storages) {
  const ctx = storages || { sessionStorage: memoryStorage(), localStorage: memoryStorage() };
  ctx.globalThis = ctx;
  vm.runInNewContext(authSrc, ctx);
  return { A: ctx.DTPAuth, get session() { return ctx.sessionStorage; }, get local() { return ctx.localStorage; } };
}
/* Pagina reale in jsdom: modulo di sessione + script in linea, con la navigazione intercettata. */
function openPage(file, { role = null, setup = null, legacy = false } = {}) {
  const dom = new JSDOM(html[file], { runScripts: 'outside-only', url: 'https://example.test/mockups/' + file });
  const w = dom.window;
  w.scrollTo = () => {};
  if (role) w.sessionStorage.setItem('dtp-demo-role', role);
  if (setup) w.localStorage.setItem('dtp-demo-lr-setup', JSON.stringify(setup));
  if (legacy) { w.sessionStorage.setItem('dtp-persona-cliente', 'lr'); w.sessionStorage.setItem('dtp-persona-postel', 'com'); }
  w.eval(authSrc);
  const nav = [];
  w.DTPAuth._navigate = (url, replace) => { nav.push({ url, replace }); };
  for (const s of w.document.querySelectorAll('body > script:not([src])')) w.eval(s.textContent);
  const app = w.document.getElementById('app');
  return { w, nav, app, rendered: !!app && app.childElementCount > 0, text: app ? app.textContent : '' };
}
const done = { delegates: true, done: true };

test('le sette credenziali demo portano ciascuna alla propria destinazione', () => {
  const expected = [
    ['LR', 'LR1', 'lr', PS01], ['DA', 'DA1', 'amm', H], ['DO', 'DO1', 'op', H], ['DT', 'DT1', 'tec', D0],
    ['C', 'C1', 'com', O1], ['O', 'O1', 'ops', O3], ['CDG', 'CDG1', 'cdg', O4],
  ];
  const { A } = core();
  assert.equal(A.ACCOUNTS.length, 7);
  for (const [user, password, role, dest] of expected) {
    const account = A.authenticate(user, password);
    assert.deepEqual({ ...account }, { user, role });
    assert.equal(A.destinationAfterLogin(role, A.getSetup()), dest, user);
    assert.ok(A.decide(dest, role, A.getSetup()).allow, 'la destinazione di ' + user + ' deve essere apribile');
  }
  assert.equal(A.authenticate(' lr ', 'LR1').role, 'lr', 'utente senza distinzione di maiuscole');
  for (const [u, p] of [['LR', 'lr1'], ['LR', 'DA1'], ['LR', ''], ['', ''], ['ADMIN', 'ADMIN1'], ['CDG', 'CDG'], ['O', 'O1 ']]) {
    assert.equal(A.authenticate(u, p), null, u + '/' + p);
  }
});

test('la sessione salva solo il ruolo, mai la password, e il logout ripulisce anche le vecchie chiavi', () => {
  const { A, session, local } = core();
  session.setItem('dtp-persona-cliente', 'amm');
  session.setItem('dtp-persona-postel', 'cdg');
  const account = A.authenticate('CDG', 'CDG1');
  assert.ok(A.login(account.role));
  assert.deepEqual(session.dump(), { 'dtp-demo-role': 'cdg' });
  assert.deepEqual(local.dump(), {});
  assert.equal(JSON.stringify([session.dump(), local.dump()]).includes('CDG1'), false);
  assert.equal(A.getRole(), 'cdg');
  assert.equal(A.login('root'), false);
  session.setItem('dtp-persona-postel', 'com');
  A.clearSession();
  assert.deepEqual(session.dump(), {});
  assert.equal(A.getRole(), null);
  session.setItem('dtp-demo-role', 'superuser');
  assert.equal(A.getRole(), null, 'un valore sconosciuto non è una sessione');
});

test('primo setup LR: PS-01, poi PS-02, poi H; completamento solo da PS-02 e persistente', () => {
  const { A, local } = core();
  A.login('lr');
  assert.equal(A.homeFor('lr'), PS01);
  assert.ok(A.decide(PS01, 'lr').allow);
  assert.deepEqual({ ...A.decide(PS02, 'lr') }, { allow: false, reason: 'setup-order', redirect: PS01 });
  for (const f of [H, M1, 'cliente-U-utenze.html', 'cliente-N-notifiche.html']) {
    assert.deepEqual({ ...A.decide(f, 'lr') }, { allow: false, reason: 'setup', redirect: PS01 }, f);
  }
  assert.equal(A.destinationAfterLogin('lr', A.getSetup(), H), PS01, 'un deep link non salta il setup');

  A.markDelegates();
  assert.equal(A.getSetup().done, false, 'PS-01 non conclude il setup');
  assert.ok(A.decide(PS02, 'lr').allow);
  assert.ok(A.decide(PS01, 'lr').allow, 'PS-01 resta rivedibile finché il setup è aperto');
  assert.equal(A.decide(H, 'lr').allow, false);
  assert.equal(A.homeFor('lr'), PS01);

  A.completeSetup();
  A.clearSession();
  assert.ok(local.getItem('dtp-demo-lr-setup'), 'il completamento sopravvive al logout');
  A.login('lr');
  assert.equal(A.homeFor('lr'), H);
  assert.ok(A.decide(H, 'lr').allow);
  assert.deepEqual({ ...A.decide(PS01, 'lr') }, { allow: false, reason: 'setup-done', redirect: H });
  assert.deepEqual({ ...A.decide(PS02, 'lr') }, { allow: false, reason: 'setup-done', redirect: H });
  assert.equal(A.destinationAfterLogin('lr', A.getSetup(), M1), M1);

  local.setItem('dtp-demo-lr-setup', '{non json');
  assert.deepEqual({ ...A.getSetup() }, { delegates: false, done: false });
});

test('la tabella dei permessi coincide con le persone dichiarate in DC.mount', () => {
  const { A } = core();
  assert.deepEqual(Object.keys(A.PAGES).sort(), [...pageFiles].sort());
  for (const f of pageFiles) {
    const m = html[f].match(/DC\.mount\(Component, (\{.*\})\);/);
    if (!m) { assert.equal(A.PAGES[f].open, true, f + ' senza runtime deve essere pubblica'); continue; }
    const meta = JSON.parse(m[1]);
    if (meta.persona) assert.deepEqual([...A.PAGES[f].roles].sort(), [...meta.persona.options].sort(), f);
    else assert.ok(A.PAGES[f].roles.length === 1, f + ' senza persone ha un solo ruolo');
  }
  assert.deepEqual(Object.keys(A.PAGES).filter(f => A.PAGES[f].open).sort(), ['vetrina-V01-catalogo.html', 'vetrina-V02-contratto.html']);
});

test('guardia delle rotte: anonimi al login, ruoli non ammessi alla propria area, mai un cambio di ruolo', () => {
  const { A } = core();
  for (const f of pageFiles) {
    const page = A.PAGES[f];
    const anon = A.decide(f, null, done);
    if (page.open) { assert.ok(anon.allow, f); continue; }
    assert.deepEqual({ ...anon }, { allow: false, reason: 'anon', redirect: 'login' }, f);
    for (const role of ROLES) {
      const d = A.decide(f, role, done);
      const expected = page.roles.includes(role) && !(page.setup && role === 'lr');
      assert.equal(d.allow, expected, f + ' / ' + role);
      if (!d.allow) {
        assert.equal(d.redirect, A.homeFor(role, done), f + ' / ' + role);
        assert.ok(A.decide(d.redirect, role, done).allow, 'nessun ciclo di reindirizzamenti: ' + f + ' / ' + role);
      }
    }
  }
  for (const staff of ['com', 'ops', 'cdg']) {
    for (const f of pageFiles.filter(x => x.startsWith('cliente-') || x.startsWith('tecnico-'))) {
      assert.equal(A.decide(f, staff, done).allow, false, 'lo staff Postel non entra nel portale cliente: ' + f);
    }
  }
  assert.equal(A.destinationAfterLogin('ops', done, O1), O3, 'next non ammesso: si torna alla propria area');
  assert.equal(A.destinationAfterLogin('com', done, O5), O5);
  assert.equal(A.destinationAfterLogin('com', done, 'https://evil.example/'), O1, 'next sconosciuto ignorato');
});

test('pagine reali: ogni ruolo vede la propria vista oppure viene reindirizzato senza che nulla sia disegnato', () => {
  const who = { lr: 'Paolo Ferretti', com: 'Marco Rinaldi', ops: 'Chiara Ferri', cdg: 'Elena Moretti', tec: 'Andrea Colombo' };
  const { A } = core();
  for (const f of pageFiles.filter(x => !A.PAGES[x].open)) {
    const anon = openPage(f);
    assert.equal(anon.rendered, false, f + ' anonimo');
    assert.deepEqual(anon.nav, [{ url: 'https://example.test/?next=' + encodeURIComponent(f), replace: true }], f);
    for (const role of ROLES) {
      const p = openPage(f, { role, setup: done, legacy: true });
      const d = A.decide(f, role, done);
      assert.equal(p.rendered, d.allow, f + ' / ' + role);
      assert.equal(p.w.sessionStorage.getItem('dtp-demo-role'), role, 'il ruolo non cambia: ' + f + ' / ' + role);
      if (!d.allow) {
        assert.deepEqual(p.nav, [{ url: 'https://example.test/mockups/' + d.redirect, replace: true }], f + ' / ' + role);
        continue;
      }
      assert.equal(p.nav.length, 0);
      assert.equal(p.app.querySelector('[data-testid="text-current-role"]').textContent, A.ROLES[role].label, f + ' / ' + role);
      assert.ok(p.app.querySelector('[data-dtp-logout]'), f + ' ha Esci');
      assert.equal(p.app.querySelector('a.dtp-home').getAttribute('href'), '../workspace', f);
      assert.equal(p.app.querySelectorAll('.dtp-projectbar .dtp-chip').length, 0, f + ' senza selettore di persona');
      assert.doesNotMatch(p.text, /Anteprima per persona|strumento di progetto|anteprima di progetto/i, f);
      assert.doesNotMatch(p.text, /undefined/, f + ' / ' + role);
      if (who[role] && f !== D0) assert.ok(p.text.includes(who[role]), f + ' mostra ' + who[role] + ' per ' + role);
      for (const a of p.app.querySelectorAll('a[href$=".html"]')) {
        const target = a.getAttribute('href').split(/[?#]/)[0];
        if (!A.PAGES[target]) continue;
        assert.equal(a.hasAttribute('data-dtp-locked'), !A.decide(target, role, done).allow, f + ' / ' + role + ' -> ' + target);
      }
    }
  }
});

test('pagine reali: regole di business per ruolo restano quelle originali', () => {
  assert.ok(openPage(H, { role: 'lr', setup: done }).text.includes('Da decidere'));
  assert.equal(openPage(H, { role: 'amm', setup: done }).text.includes('Da decidere'), false);
  const op = openPage(H, { role: 'op' });
  assert.ok(op.text.includes('Le tue richieste'));
  assert.equal(op.text.includes('Riepilogo ordine'), false);
  assert.ok(openPage('cliente-M4-fatture.html', { role: 'op' }).text.includes('non sono visibili per il delegato operativo'));
  const tec = openPage(M1, { role: 'tec' });
  assert.ok(tec.app.querySelector('a[href="' + D0 + '"]'), 'il delegato tecnico torna al developer portal');
  const o3com = openPage(O3, { role: 'com' });
  assert.ok(o3com.text.includes('Marco Rinaldi'));
  assert.ok(o3com.app.querySelector('a[href="' + O4 + '"]'));
  const o3ops = openPage(O3, { role: 'ops' });
  assert.equal(o3ops.app.querySelector('a[href="' + O4 + '"]'), null, 'Operations non ha il menu dei margini');
  assert.equal(o3ops.app.querySelector('a[href="' + O1 + '"]'), null);
});

test('O5 non apre più il portale cliente con un ruolo Postel', () => {
  for (const role of ['com', 'ops', 'cdg']) {
    const p = openPage(O5, { role });
    assert.ok(p.rendered);
    assert.equal(p.app.querySelectorAll('a[href^="cliente-"]').length, 0, role);
  }
  assert.equal(openPage(M1, { role: 'com' }).rendered, false);
});

test('setup nelle pagine reali: PS-01 sblocca PS-02, solo PS-02 conclude, i link bloccati non navigano', () => {
  const click = (p, sel) => {
    const ev = new p.w.MouseEvent('click', { bubbles: true, cancelable: true });
    p.app.querySelector(sel).dispatchEvent(ev);
    return ev.defaultPrevented;
  };
  const direct = openPage(PS02, { role: 'lr' });
  assert.equal(direct.rendered, false);
  assert.equal(direct.nav[0].url, 'https://example.test/mockups/' + PS01);
  assert.equal(openPage(H, { role: 'lr' }).nav[0].url, 'https://example.test/mockups/' + PS01);

  const ps01 = openPage(PS01, { role: 'lr' });
  assert.ok(ps01.rendered);
  assert.equal(ps01.app.querySelector('[data-dtp-setup="delegates"]'), null, 'Continua compare solo con le tre deleghe definite');
  ps01.app.querySelectorAll('article')[2].querySelector('button').click();
  assert.equal(ps01.w.localStorage.getItem('dtp-demo-lr-setup'), null, 'scegliere le deleghe non sblocca ancora PS-02');
  assert.equal(click(ps01, '[data-dtp-setup="delegates"]'), false, 'Continua naviga');
  assert.deepEqual(JSON.parse(ps01.w.localStorage.getItem('dtp-demo-lr-setup')), { delegates: true, done: false });

  const ps02 = openPage(PS02, { role: 'lr', setup: { delegates: true, done: false } });
  assert.ok(ps02.rendered);
  assert.equal(click(ps02, 'a[href="' + PS01 + '"]'), false, 'PS-01 resta rivedibile');
  assert.equal(JSON.parse(ps02.w.localStorage.getItem('dtp-demo-lr-setup')).done, false);
  assert.equal(click(ps02, '[data-dtp-setup="complete"]'), false, 'Concludi naviga verso H');
  assert.deepEqual(JSON.parse(ps02.w.localStorage.getItem('dtp-demo-lr-setup')), done);

  assert.equal(openPage(PS01, { role: 'lr', setup: done }).nav[0].url, 'https://example.test/mockups/' + H);
  const amm = openPage(PS02, { role: 'amm', setup: { delegates: true, done: false } });
  assert.equal(amm.rendered, false, 'solo il legale rappresentante entra nel setup');
  assert.equal(amm.w.localStorage.getItem('dtp-demo-lr-setup'), JSON.stringify({ delegates: true, done: false }));
});

test('logout: sessione e vecchie chiavi cancellate, ritorno al login, il tasto Indietro non riapre la pagina', () => {
  const p = openPage(H, { role: 'amm', legacy: true });
  assert.ok(p.rendered);
  p.app.querySelector('[data-dtp-logout]').dispatchEvent(new p.w.MouseEvent('click', { bubbles: true, cancelable: true }));
  assert.deepEqual(p.nav, [{ url: 'https://example.test/', replace: true }]);
  assert.equal(p.w.sessionStorage.getItem('dtp-demo-role'), null);
  assert.equal(p.w.sessionStorage.getItem('dtp-persona-cliente'), null);
  assert.equal(p.w.sessionStorage.getItem('dtp-persona-postel'), null);

  const back = openPage(O1, { role: 'com' });
  back.w.sessionStorage.removeItem('dtp-demo-role');
  back.w.dispatchEvent(new back.w.Event('pageshow'));
  assert.equal(back.app.childElementCount, 0, 'il contenuto ripristinato viene rimosso');
  assert.equal(back.nav[0].url, 'https://example.test/?next=' + encodeURIComponent(O1));
});

test('vetrina pubblica: aperta a tutti, con Accedi oppure ruolo e uscita', () => {
  for (const f of ['vetrina-V01-catalogo.html', 'vetrina-V02-contratto.html']) {
    const anon = openPage(f);
    assert.equal(anon.nav.length, 0, f);
    const bar = anon.w.document.querySelector('[data-dtp-publicbar]');
    assert.equal(bar.querySelector('[data-testid="link-login"]').href, 'https://example.test/');
    assert.equal(bar.querySelector('[data-dtp-logout]'), null);

    const ops = openPage(f, { role: 'ops' });
    const b = ops.w.document.querySelector('[data-dtp-publicbar]');
    assert.equal(ops.nav.length, 0);
    assert.equal(b.querySelector('[data-testid="text-current-role"]').textContent, 'Operations');
    assert.equal(b.querySelector('[data-testid="link-my-area"]').href, 'https://example.test/mockups/' + O3);
    assert.equal(b.querySelector('[data-testid="link-home"]').href, 'https://example.test/workspace');
    assert.ok(b.querySelector('[data-dtp-logout]'));
  }
});

/* ---------- archiviazione bloccata: errore esplicito, nessun ripiego in memoria ---------- */
const quotaStorage = () => ({ ...memoryStorage(), setItem() { throw new Error('QuotaExceededError'); } });
const droppingStorage = () => ({ ...memoryStorage(), setItem() {} });
const isStorageErr = kind => err => err.name === 'DTPStorageError' && err.code === 'storage-unavailable' && err.storage === kind && /browser non consente/.test(err.message);

test('archiviazione bloccata: il login fallisce in modo esplicito e non resta alcuna sessione in memoria', () => {
  const variants = {
    'setItem solleva': () => ({ sessionStorage: quotaStorage(), localStorage: memoryStorage() }),
    'setItem non salva': () => ({ sessionStorage: droppingStorage(), localStorage: memoryStorage() }),
    'sessionStorage assente': () => ({ localStorage: memoryStorage() }),
    'accesso a sessionStorage negato': () => Object.defineProperty({ localStorage: memoryStorage() }, 'sessionStorage', { get() { throw new Error('SecurityError'); } }),
  };
  for (const [name, make] of Object.entries(variants)) {
    const { A } = core(make());
    assert.ok(A.authenticate('C', 'C1'), name);
    assert.throws(() => A.login('com'), isStorageErr('sessionStorage'), name);
    assert.equal(A.getRole(), null, name + ': nessuna sessione effimera');
    assert.equal(A.decide(O1, A.getRole()).redirect, 'login', name);
    assert.doesNotThrow(() => { A.setFlash('x'); A.clearSession(); A.resetSetup(); }, name);
    assert.equal(A.takeFlash(), null, name);
    assert.equal(A.isStorageError(new Error('altro')), false);
  }
});

test('archiviazione bloccata: l\'avanzamento del setup non viene finto', () => {
  for (const local of [quotaStorage, droppingStorage, null]) {
    const storages = { sessionStorage: memoryStorage() };
    if (local) storages.localStorage = local();
    const { A } = core(storages);
    A.login('lr');
    assert.throws(() => A.markDelegates(), isStorageErr('localStorage'));
    assert.throws(() => A.completeSetup(), isStorageErr('localStorage'));
    assert.deepEqual({ ...A.getSetup() }, { delegates: false, done: false });
    assert.equal(A.decide(PS02, 'lr').allow, false);
    assert.equal(A.homeFor('lr'), PS01);
  }
});

test('archiviazione bloccata nelle pagine reali: Continua e Concludi non navigano e avvisano', () => {
  const block = p => {
    const local = p.w.localStorage;
    p.w.Storage.prototype.setItem = function () { if (this === local) throw new Error('QuotaExceededError'); };
  };
  const click = (p, sel) => {
    const ev = new p.w.MouseEvent('click', { bubbles: true, cancelable: true });
    p.app.querySelector(sel).dispatchEvent(ev);
    return ev.defaultPrevented;
  };
  const toast = p => p.w.document.getElementById('dtp-demo-toast');

  const ps01 = openPage(PS01, { role: 'lr' });
  ps01.app.querySelectorAll('article')[2].querySelector('button').click();
  block(ps01);
  assert.equal(click(ps01, '[data-dtp-setup="delegates"]'), true, 'Continua non naviga');
  assert.equal(toast(ps01).getAttribute('data-show'), 'true');
  assert.match(toast(ps01).textContent, /avanzamento del primo setup/);
  assert.equal(ps01.w.localStorage.getItem('dtp-demo-lr-setup'), null);
  assert.equal(ps01.nav.length, 0);

  const ps02 = openPage(PS02, { role: 'lr', setup: { delegates: true, done: false } });
  block(ps02);
  assert.equal(click(ps02, '[data-dtp-setup="complete"]'), true, 'Concludi non naviga');
  assert.match(toast(ps02).textContent, /avanzamento del primo setup/);
  assert.deepEqual(JSON.parse(ps02.w.localStorage.getItem('dtp-demo-lr-setup')), { delegates: true, done: false });
  assert.equal(click(ps02, 'a[href="' + PS01 + '"]'), false, 'Indietro resta disponibile');
});
