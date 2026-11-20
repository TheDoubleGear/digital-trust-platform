import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const mockups = new URL('../public/mockups/', import.meta.url);
const src = f => readFileSync(new URL(f, mockups), 'utf8');

/* Pagina pubblica in jsdom con i suoi script, nell'ordine della pagina. */
function open(file, query = '') {
  const dom = new JSDOM(src(file), { runScripts: 'outside-only', url: 'https://example.test/mockups/' + file + query });
  const w = dom.window;
  w.scrollTo = () => {};
  for (const s of w.document.querySelectorAll('script[src]')) w.eval(src(s.getAttribute('src')));
  return { w, d: w.document, close: () => w.close() };
}

test('V-04 funziona per tutti i servizi del catalogo, con «Acquista» verso V-02 e il consulente verso V-05', () => {
  const ids = open('vetrina-V04-servizio.html').w.DTP.services.map(s => s.id);
  assert.ok(ids.length > 0);
  for (const id of ids) {
    const p = open('vetrina-V04-servizio.html', '?servizio=' + id);
    try {
      const s = p.w.DTP.byId(id), $ = sel => p.d.querySelector(sel);
      assert.equal($('#titolo-servizio').textContent, s.name, id);
      assert.equal(p.d.title, s.name + ' – Digital Trust Platform');
      assert.deepEqual([...p.d.querySelectorAll('#crumb li')].map(li => li.textContent), ['Digital Trust Platform', 'Catalogo dei servizi', s.family, s.name]);
      assert.equal(p.d.querySelectorAll('#crumb li:nth-child(3) a').length, 0, 'la famiglia resta testo');
      for (const k of ['h-buy', 't-buy', 'b-buy']) assert.equal($('#' + k).getAttribute('href'), 'vetrina-V02-contratto.html?servizio=' + id, k);
      for (const k of ['h-ask', 'b-ask']) assert.equal($('#' + k).getAttribute('href'), 'vetrina-V05-consulente.html?servizio=' + id, k);
      assert.equal($('#buy-box a.btn-p').getAttribute('href'), 'vetrina-V02-contratto.html?servizio=' + id);
      assert.equal(p.d.querySelectorAll('#tiles .pv-tile').length, 4);
      assert.match($('#price-card').textContent, /Fee di attivazione\[DA DEFINIRE\]/);
      assert.equal(p.d.querySelectorAll('#videos .pv-video').length, 2);
      assert.match($('#videos').textContent, /\[VIDEO DA FORNIRE A CURA DI POSTEL\]/);
      assert.ok(p.d.querySelectorAll('#faq-list details').length >= 7);
      assert.match($('#doc-box').textContent, /\[CONTENUTO DA FORNIRE A CURA DI POSTEL\]/);
      for (const sec of ['tabs', 'caratteristiche', 'offerta', 'video', 'faq', 'documentazione']) assert.equal($('#' + sec).hidden, false, sec);
    } finally { p.close(); }
  }
});

test('V-04 con un identificativo assente o sconosciuto mostra «Servizio non trovato» e il ritorno alla vetrina', () => {
  for (const q of ['', '?servizio=', '?servizio=sconosciuto', '?servizio=__proto__']) {
    const p = open('vetrina-V04-servizio.html', q);
    try {
      const $ = sel => p.d.querySelector(sel);
      assert.equal($('#titolo-servizio').textContent, 'Servizio non trovato', q);
      assert.equal($('#h-buy').textContent, 'Torna alla vetrina');
      assert.equal($('#h-buy').getAttribute('href'), 'vetrina-V01-catalogo.html');
      for (const sec of ['tabs', 'caratteristiche', 'offerta', 'video', 'faq', 'documentazione']) assert.equal($('#' + sec).hidden, true, sec);
    } finally { p.close(); }
  }
});

test('V-01: ogni card apre la scheda del proprio servizio e la finestra «Approfondisci» non c\'è più', () => {
  const p = open('vetrina-V01-catalogo.html');
  try {
    const cards = [...p.d.querySelectorAll('#results .scard')];
    assert.equal(cards.length, p.w.DTP.services.length);
    cards.forEach((card, i) => {
      const s = p.w.DTP.services[i];
      const links = card.querySelectorAll('a');
      assert.equal(links.length, 1, 'un solo collegamento per card');
      const a = links[0];
      assert.ok(a.classList.contains('scard-link'));
      assert.equal(a.getAttribute('href'), 'vetrina-V04-servizio.html?servizio=' + encodeURIComponent(s.id));
      assert.equal(a.getAttribute('aria-label'), 'Scopri il servizio ' + s.name, 'il nome accessibile contiene il testo visibile');
      assert.equal(a.textContent, 'Scopri il servizio');
    });
    assert.equal(p.d.querySelector('dialog'), null);
    assert.equal(p.d.querySelector('[data-more]'), null);
    assert.doesNotMatch(src('vetrina-V01-catalogo.html') + src('vetrina-V01.js'), /Approfondisci/);
    assert.match(src('dtp-vetrina.css'), /\.scard-link::after\{content:"";position:absolute;inset:0/);
    assert.equal(p.d.querySelectorAll('.citems, #side').length, 0, 'V-01 resta senza carrello');
  } finally { p.close(); }
});

test('V-04 carica il menu condiviso e non gestisce il pulsante da sé', () => {
  assert.match(src('vetrina-V04-servizio.html'), /<script src="dtp-vetrina\.js"><\/script>/);
  assert.doesNotMatch(src('vetrina-V04.js'), /pv-toggle/);
  const p = open('vetrina-V04-servizio.html', '?servizio=cert');
  try {
    const tg = p.d.querySelector('.pv-toggle');
    tg.click();
    assert.equal(tg.getAttribute('aria-expanded'), 'true', 'un clic apre il menu una sola volta');
    assert.ok(p.d.getElementById('pv-menu').classList.contains('open'));
    assert.equal(p.d.querySelector('[data-testid="link-login"]').getAttribute('href'), 'https://example.test/accesso');
  } finally { p.close(); }
});
