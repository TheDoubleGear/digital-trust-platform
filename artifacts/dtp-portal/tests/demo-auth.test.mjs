import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
/* Copia senza prototipi del contesto vm, per i confronti profondi. */
const plain = v => JSON.parse(JSON.stringify(v));

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
  // Moduli condivisi caricati in testata dopo dtp-auth.js (es. il catalogo usato da H).
  for (const s of w.document.querySelectorAll('head > script[src]')) {
    const src = s.getAttribute('src');
    if (src !== 'dtp-auth.js') w.eval(readFileSync(new URL(src, mockups), 'utf8'));
  }
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
  assert.deepEqual(plain(A.getSetup()), { delegates: false, done: false, deferred: [] });
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
  assert.deepEqual(Object.keys(A.PAGES).filter(f => A.PAGES[f].open).sort(), ['vetrina-V01-catalogo.html', 'vetrina-V02-contratto.html', 'vetrina-V03-subentro.html', 'vetrina-V04-servizio.html', 'vetrina-V05-consulente.html']);
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
    assert.deepEqual(anon.nav, [{ url: 'https://example.test/accesso?next=' + encodeURIComponent(f), replace: true }], f);
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
      assert.equal(p.app.querySelector('.dtp-projectbar'), null, f + ' barra separata rimossa');
      const home = p.app.querySelector('[data-testid="link-home"]');
      const logout = p.app.querySelector('[data-dtp-logout]');
      assert.equal(home.textContent, 'Workspace');
      assert.equal(home.getAttribute('href'), '../workspace');
      assert.equal(p.app.querySelectorAll('[data-dtp-logout]').length, 1);
      if (f.startsWith('postel-')) {
        const actions = p.app.querySelector('.dtp-sidebar-actions');
        assert.equal(actions.parentElement, p.app.querySelector('.dtp-sidenav'));
        assert.equal(actions.firstElementChild, home);
        assert.equal(actions.lastElementChild, logout);
      } else {
        /* Workspace sta nel gruppo dell'utente, a destra: Workspace, identità, Esci. */
        const header = p.app.querySelector('.dtp-header > div');
        const account = header.lastElementChild;
        assert.ok(account.classList.contains('dtp-client-account'), f);
        assert.equal(account.firstElementChild, home);
        assert.equal(account.lastElementChild, logout);
      }
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
  assert.ok(op.text.includes('Le tue segnalazioni'));
  assert.equal(op.text.includes('Riepilogo della modifica'), false);
  assert.ok(openPage(H, { role: 'amm', setup: done }).text.includes('Riepilogo della modifica'));
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
  assert.deepEqual(p.nav, [{ url: 'https://example.test/accesso', replace: true }]);
  assert.equal(p.w.sessionStorage.getItem('dtp-demo-role'), null);
  assert.equal(p.w.sessionStorage.getItem('dtp-persona-cliente'), null);
  assert.equal(p.w.sessionStorage.getItem('dtp-persona-postel'), null);

  const back = openPage(O1, { role: 'com' });
  back.w.sessionStorage.removeItem('dtp-demo-role');
  back.w.dispatchEvent(new back.w.Event('pageshow'));
  assert.equal(back.app.childElementCount, 0, 'il contenuto ripristinato viene rimosso');
  assert.equal(back.nav[0].url, 'https://example.test/accesso?next=' + encodeURIComponent(O1));
});

test('vetrina pubblica: aperta a tutti, con Accedi oppure ruolo e uscita', () => {
  for (const f of ['vetrina-V01-catalogo.html', 'vetrina-V02-contratto.html', 'vetrina-V03-subentro.html', 'vetrina-V04-servizio.html', 'vetrina-V05-consulente.html']) {
    const anon = openPage(f);
    assert.equal(anon.nav.length, 0, f);
    const bar = anon.w.document.querySelector('[data-dtp-publicbar]');
    assert.equal(bar.querySelector('[data-testid="link-login"]').href, 'https://example.test/accesso');
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
    assert.deepEqual(plain(A.getSetup()), { delegates: false, done: false, deferred: [] });
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

test('dati del cliente di esempio coerenti tra le pagine (valore, upgrade in corso, overage previsto)', () => {
  const pages = {
    H: openPage(H, { role: 'lr', setup: done }),
    M4: openPage('cliente-M4-fatture.html', { role: 'lr', setup: done }),
    M5: openPage('cliente-M5-contratto.html', { role: 'lr', setup: done }),
    O5: openPage(O5, { role: 'cdg' }),
  };
  const D = pages.H.w.DTP, E = D.esempio, c = E.contratto();
  assert.equal(c.totale, c.variabile + c.canone);
  assert.equal(c.fee, 0, 'il contratto in corso è un rinnovo: niente fee di attivazione');
  const value = D.eur(c.totale), upgrade = D.eur(E.upgradeInCorsoPrezzo()), overage = D.eur(E.overageTotale());
  for (const name of ['H', 'M5', 'O5']) assert.ok(pages[name].text.includes(value), name + ' valore annuo');
  assert.ok(pages.M4.text.includes(D.eur(E.trimestre())), 'M4 rata trimestrale della componente variabile');
  assert.ok(pages.M4.text.includes(D.eur(c.canone)), 'M4 canone periodico');
  for (const name of ['H', 'M4', 'O5']) assert.ok(pages[name].text.includes(upgrade), name + ' upgrade in corso');
  for (const name of ['H', 'M4', 'O5']) assert.ok(pages[name].text.includes(overage), name + ' overage previsto');
  for (const [name, p] of Object.entries(pages)) {
    assert.ok(!/\b(Base|Medium|Pro|Enterprise)\b/.test(p.text.replace(/Identificazioni Proprietarie/g, '')), name + ' senza livelli di offerta');
  }
});

test('«Ripristina dati demo» azzera modifiche, codici di configurazione e subentro, non il primo accesso del LR', () => {
  const c = core();
  c.local.setItem('dtp-demo-modifiche', '[]');
  c.local.setItem('dtp-demo-config-codes', '{}');
  c.local.setItem('dtp-demo-subentro', '{}');
  c.local.setItem('dtp-demo-lr-setup', JSON.stringify(done));
  c.A.resetDemoData();
  assert.equal(c.local.getItem('dtp-demo-modifiche'), null);
  assert.equal(c.local.getItem('dtp-demo-config-codes'), null);
  assert.equal(c.local.getItem('dtp-demo-subentro'), null);
  assert.deepEqual(plain(c.A.getSetup()), { ...done, deferred: [] });
});

test('area pubblica: stessa testata a due livelli, V-01 con «Acquista» e «Contatta un consulente»', () => {
  const pub = ['vetrina-V01-catalogo.html', 'vetrina-V02-contratto.html', 'vetrina-V03-subentro.html', 'vetrina-V04-servizio.html', 'vetrina-V05-consulente.html'];
  for (const f of pub) {
    const { w } = openPage(f);
    const d = w.document;
    assert.ok(d.querySelector('.pv-util [data-dtp-publicbar]'), f + ': barra di sessione nel primo livello');
    assert.equal(d.querySelector('.pv-seg [aria-current]').textContent, 'Imprese', f);
    assert.ok(d.querySelector('.pv-util-r a[href="vetrina-V05-consulente.html"]'), f + ': «Contatta un consulente» in testata');
    assert.equal(d.querySelector('.pv-menu a[aria-current="page"]').getAttribute('href'), 'vetrina-V01-catalogo.html', f);
    assert.equal(d.querySelectorAll('.pv-menu a').length, 1, f + ': le altre voci del menu non sono navigabili');
    assert.ok(d.querySelector('.pv-toggle[aria-controls="pv-menu"]'), f);
    assert.equal(d.querySelector('header.top'), null, f + ': nessuna testata precedente');
  }
  const crumb = f => [...openPage(f).w.document.querySelectorAll('.pv-crumb li')].map(li => li.textContent);
  assert.deepEqual(crumb('vetrina-V02-contratto.html'), ['Digital Trust Platform', 'Attivazione']);
  assert.deepEqual(crumb('vetrina-V03-subentro.html'), ['Digital Trust Platform', 'Subentro del legale rappresentante']);

  const v01 = html['vetrina-V01-catalogo.html'] + readFileSync(new URL('vetrina-V01.js', mockups), 'utf8');
  assert.doesNotMatch(v01, /Attivazione servizio|Parla con un commerciale/);
  const { w } = openPage('vetrina-V01-catalogo.html');
  const hero = w.document.querySelector('.pv-hero');
  assert.equal(hero.querySelector('img').getAttribute('src'), 'img/dtp-hero.svg');
  assert.deepEqual([...hero.querySelectorAll('.pv-cta a')].map(a => [a.textContent, a.getAttribute('href')]),
    [['Acquista', 'vetrina-V02-contratto.html'], ['Contatta un consulente', 'vetrina-V05-consulente.html']]);
  assert.deepEqual([...w.document.querySelectorAll('#contatti a.btn')].map(a => a.textContent), ['Acquista', 'Contatta un consulente']);
  assert.equal(w.document.querySelectorAll('.pv-how li').length, 4);
  assert.match(w.document.body.textContent, /Prototipo dimostrativo\./);
});

test('deleghe rinviate nel primo setup: salvate con lo stato, conservate alla conclusione, azzerate dal ripristino', () => {
  const { A, local } = core();
  assert.deepEqual(plain(A.getSetup().deferred), []);
  A.markDelegates(['tec', 'sconosciuta', 'amm']);
  assert.deepEqual(JSON.parse(local.getItem('dtp-demo-lr-setup')), { delegates: true, done: false, deferred: ['amm', 'tec'] });
  A.markDelegates([]);
  assert.deepEqual(JSON.parse(local.getItem('dtp-demo-lr-setup')), { delegates: true, done: false }, 'tornando su PS-01 la scelta si aggiorna');
  A.markDelegates(['op']);
  A.completeSetup();
  assert.deepEqual(plain(A.getSetup()), { delegates: true, done: true, deferred: ['op'] });
  A.markDelegates([]);
  assert.deepEqual(plain(A.getSetup().deferred), ['op'], 'a setup concluso PS-01 non cambia più nulla');
  A.resetSetup();
  assert.deepEqual(plain(A.getSetup()), { delegates: false, done: false, deferred: [] });
});

test('PS-01: terza scelta «Configura in un secondo momento», «Continua» con una scelta per delega, PS-02 senza delegato', () => {
  const p = openPage(PS01, { role: 'lr' });
  const cards = () => [...p.app.querySelectorAll('article')];
  const pick = (i, label) => [...cards()[i].querySelectorAll('[role="group"] button')].find(b => b.textContent.trim() === label).click();
  for (const c of cards()) {
    assert.deepEqual([...c.querySelectorAll('[role="group"] button')].map(b => b.textContent.trim()), ['Nomina un delegato', 'La gestisco io', 'Configura in un secondo momento']);
  }
  assert.equal(p.app.querySelector('[data-dtp-setup="delegates"]'), null);
  pick(2, 'Configura in un secondo momento');
  pick(1, 'Configura in un secondo momento');
  const tec = cards()[2];
  assert.equal([...tec.querySelectorAll('button')].find(b => b.textContent.includes('secondo momento')).getAttribute('aria-pressed'), 'true');
  assert.match(tec.textContent, /Potrai nominare il delegato in seguito da «Utenze e deleghe»/);
  assert.match(tec.textContent, /gestirai tu queste funzioni e riceverai le notifiche collegate/);
  const cont = p.app.querySelector('[data-dtp-setup="delegates"]');
  assert.ok(cont, 'Continua abilitato con tre scelte');
  cont.dispatchEvent(new p.w.MouseEvent('click', { bubbles: true, cancelable: true }));
  const saved = JSON.parse(p.w.localStorage.getItem('dtp-demo-lr-setup'));
  assert.deepEqual(saved, { delegates: true, done: false, deferred: ['op', 'tec'] });

  const ps02 = openPage(PS02, { role: 'lr', setup: saved });
  const t = ps02.text.replace(/\s+/g, ' ');
  assert.match(t, /Delegato operativo ?da configurare · nessun delegato/);
  assert.match(t, /Delegato amministrativo ?invito in preparazione/);
  assert.equal(ps02.app.querySelectorAll('input[aria-label$=": delegato operativo"]').length, 0, 'nessun delegato operativo tra i destinatari');
  assert.ok(ps02.app.querySelectorAll('input[aria-label$=": delegato amministrativo"]').length > 0);
  assert.equal(ps02.app.querySelector('input[aria-label="Soglia di attenzione superata: legale rappresentante"]').checked, false);
  const ps02amm = openPage(PS02, { role: 'lr', setup: { delegates: true, done: false, deferred: ['amm'] } });
  assert.equal(ps02amm.app.querySelectorAll('input[aria-label$=": delegato amministrativo"]').length, 0);
  assert.equal(ps02amm.app.querySelector('input[aria-label="Soglia di attenzione superata: legale rappresentante"]').checked, true, 'gli avvisi del delegato rinviato restano al LR');

  const back = openPage(PS01, { role: 'lr', setup: saved });
  assert.equal([...back.app.querySelectorAll('article')[2].querySelectorAll('button')].find(b => b.textContent.includes('secondo momento')).getAttribute('aria-pressed'), 'true', 'tornando su PS-01 le deleghe rinviate restano selezionate');
});

test('U-02: deleghe rinviate «Da configurare» con la nomina secondo le deleghe gerarchiche', () => {
  const U = 'cliente-U-utenze.html';
  const setup = { delegates: true, done: true, deferred: ['amm', 'tec'] };
  const card = (p, type) => [...p.app.querySelectorAll('#app span')].find(s => s.textContent.trim() === type).closest('div[style*="border: 1px solid #D9E1EC"]');
  const lr = openPage(U, { role: 'lr', setup });
  for (const type of ['Delegato amministrativo', 'Delegato tecnico']) {
    const c = card(lr, type);
    assert.match(c.textContent, /Da configurare/, type);
    assert.match(c.textContent, /rinviata nel primo setup/, type);
    assert.ok([...c.querySelectorAll('button')].some(b => b.textContent.trim() === 'Nomina il delegato'), type);
  }
  assert.match(card(lr, 'Delegato operativo').textContent, /Davide Sala.*Attivo|Attivo.*Davide Sala/s, 'le altre deleghe non cambiano');
  assert.doesNotMatch(card(lr, 'Delegato amministrativo').textContent, /Giulia Marchetti/);
  assert.doesNotMatch(card(lr, 'Delegato tecnico').textContent, /Andrea Colombo/);
  assert.match(lr.text.replace(/\s+/g, ' '), /Deleghe attive ?1 di 3/);
  [...card(lr, 'Delegato tecnico').querySelectorAll('button')].find(b => b.textContent.trim() === 'Nomina il delegato').click();
  assert.equal(lr.app.querySelector('input[name="delega"]:checked').value, 'tec', 'la nomina parte dalla delega da configurare');
  [...lr.app.querySelectorAll('button')].find(b => b.textContent.trim() === 'Genera l\'atto e firma').click();
  assert.match(card(lr, 'Delegato tecnico').textContent, /Invito in attesa/);

  const amm = openPage(U, { role: 'amm', setup: { delegates: true, done: true, deferred: ['op', 'tec'] } });
  for (const type of ['Delegato operativo', 'Delegato tecnico']) {
    assert.ok([...card(amm, type).querySelectorAll('button')].some(b => b.textContent.trim() === 'Nomina il delegato'), 'DA: ' + type);
  }
  const ammOnAmm = openPage(U, { role: 'amm', setup });
  const c = card(ammOnAmm, 'Delegato amministrativo');
  assert.match(c.textContent, /Da configurare/);
  assert.equal([...c.querySelectorAll('button')].some(b => b.textContent.trim() === 'Nomina il delegato'), false, 'il DA non nomina il delegato amministrativo');
  assert.match(c.textContent, /non rientra nei tuoi poteri/);

  assert.doesNotMatch(openPage(U, { role: 'lr', setup: done }).text, /Da configurare/, 'senza deleghe rinviate U-02 non cambia');
});
