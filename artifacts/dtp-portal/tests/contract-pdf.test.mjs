import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { JSDOM } from 'jsdom';
import { jsPDF } from 'jspdf';

const mockups = new URL('../public/mockups/', import.meta.url);
const output = new URL('../../../generated-artifacts/contract-tests/', import.meta.url);
mkdirSync(output, { recursive: true });
const data = {
  ragione: 'Società Caffè & Qualità S.r.l.', piva: '12345678901', sdi: 'ABC1234',
  sede: 'Via Roma 1, 00100 Roma', pec: 'demo@pec.example.it', nome: 'Niccolò',
  cognome: 'D’Angelo', cf: 'RSSMRA80A01H501U', tel: '+393331234567', email: 'demo@example.it',
};
function setup() {
  const dom = new JSDOM(readFileSync(new URL('vetrina-V02-contratto.html', mockups), 'utf8'), {
    runScripts: 'outside-only', url: 'https://example.test/mockups/vetrina-V02-contratto.html',
  });
  const w = dom.window;
  w.scrollTo = () => {};
  w.jspdf = { jsPDF };
  const downloads = [];
  w.URL.createObjectURL = blob => { downloads.push({ blob }); return 'blob:demo'; };
  w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = function () { downloads.at(-1).filename = this.download; };
  for (const file of ['dtp-catalogo.js', 'dtp-contract-pdf.js', 'vetrina-V02.js']) {
    w.eval(readFileSync(new URL(file, mockups), 'utf8'));
  }
  const $ = selector => w.document.querySelector(selector);
  function form() {
    for (const [key, value] of Object.entries(data)) $('#' + key).value = value;
    $('#pw').value = $('#pw2').value = 'SecretNotInPDF123';
    $('#f1').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  }
  return { w, $, dom, downloads, form };
}
async function extract(blob, name) {
  assert.equal(blob.type, 'application/pdf');
  const bytes = Buffer.from(await blob.arrayBuffer());
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  const file = new URL(name + '.pdf', output);
  writeFileSync(file, bytes);
  return execFileSync('pdftotext', ['-layout', file.pathname, '-'], { encoding: 'utf8' });
}

test('price calculation returns variable component, activation fee, periodic fee and total', () => {
  const { w, dom } = setup();
  try {
    const D = w.DTP;
    assert.equal(D.bundles, undefined);
    assert.equal(D.ENT_DISC, undefined);
    const p = D.price({ cert: 1000, ver: 20000 });
    assert.equal(p.variabile, 1000 * 3 + 20000 * 0.05);
    assert.equal(p.fee, D.feeAttivazione);
    assert.equal(p.canone, D.canonePeriodico);
    assert.equal(p.totale, p.variabile + p.fee + p.canone);
    assert.equal(p.lines.map(l => l.id).join(), 'cert,ver');
    assert.equal(D.price({}).totale, 0);
    assert.equal(D.price({ cert: 500 }, { fee: false }).fee, 0);
    for (const s of D.services) {
      for (const key of ['family', 'name', 'desc', 'purpose', 'terms', 'doc']) assert.ok(s[key], s.id + ' ' + key);
      assert.ok(Array.isArray(s.deps));
      assert.ok(s.unit > 0 && s.step > 0);
    }
    assert.equal(D.missingDeps({ app: 5000 }).map(m => m.id).join(), 'app');
    assert.equal(D.missingDeps({ app: 5000, cert: 500 }).length, 0);
  } finally { dom.window.close(); }
});

test('direct PDF download lists only configured services, the three components, the total and no password', async () => {
  const { w, $, dom, downloads, form } = setup();
  try {
    form();
    const D = w.DTP, chosen = D.services.slice(0, 5);
    chosen.forEach((service) => {
      const i = D.services.indexOf(service);
      $(`[data-act="inc"][data-i="${i}"]`).click();
      $(`[data-act="inc"][data-i="${i}"]`).click();
    });
    $('#buy').click();
    assert.match($('#dl').textContent, /PDF/);
    $('#dl').click();
    assert.match(downloads[0].filename, /^bozza-contratto-DTP-BOZZA-\d+\.pdf$/);
    assert.equal($('#file').disabled, false);
    const text = await extract(downloads[0].blob, 'full-cart');
    for (const value of Object.values(data)) assert.ok(text.includes(value), value);
    const config = Object.fromEntries(chosen.map(s => [s.id, s.step * 2]));
    for (const service of chosen) {
      assert.ok(text.includes(service.name), service.name);
      assert.ok(text.includes(D.num(service.step * 2) + ' unità'), service.name);
    }
    for (const service of D.services.slice(5)) assert.ok(!text.includes(service.name), service.name);
    const p = D.price(config);
    assert.ok(text.includes('Componente variabile'));
    assert.ok(text.includes(D.eur(p.variabile)));
    assert.ok(text.includes('Fee di attivazione: ' + D.eur(p.fee)));
    assert.ok(text.includes('Canone periodico: ' + D.eur(p.canone)));
    assert.ok(text.includes('Totale, IVA esclusa: ' + D.eur(p.totale)));
    assert.ok(text.includes('DA DEFINIRE'));
    assert.ok(!/bundle|enterprise|ricaric/i.test(text));
    assert.ok(text.includes('TESTO DA FORNIRE E APPROVARE A CURA DI POSTEL'));
    assert.ok(!text.includes('SecretNotInPDF123'));
    assert.ok(!text.toLowerCase().includes('password'));
    const pages = text.split('\f').filter(p => p.trim());
    assert.ok(pages.length >= 2);
    pages.forEach((p, i) => {
      assert.ok(p.includes('BOZZA DIMOSTRATIVA'));
      assert.ok(p.includes(`Pagina ${i + 1} di ${pages.length}`));
    });
    $('#dl').click();
    assert.equal(downloads[1].filename, downloads[0].filename);
  } finally { dom.window.close(); }
});

test('service, quantity and company changes invalidate download, attachment and acknowledgements', () => {
  for (const change of ['service', 'quantity', 'data']) {
    const { w, $, dom, form } = setup();
    try {
      form(); $('[data-act="inc"][data-i="0"]').click(); $('#buy').click(); $('#dl').click();
      const file = new w.File(['%PDF-demo'], 'signed.pdf', { type: 'application/pdf' });
      Object.defineProperty($('#file'), 'files', { value: [file] });
      $('#file').dispatchEvent(new w.Event('change'));
      for (const i of [0, 1]) $(`[data-ack="${i}"]`).click();
      if (change === 'data') {
        $('[data-go="1"]').click();
        $('#ragione').value = 'Changed Company';
        $('#ragione').dispatchEvent(new w.Event('input', { bubbles: true }));
        $('#f1').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
      } else {
        $('[data-go="2"]').click();
        $(change === 'quantity' ? '[data-act="inc"][data-i="0"]' : '[data-act="inc"][data-i="1"]').click();
      }
      $('#buy').click();
      assert.equal($('#file').disabled, true, change);
      assert.equal($('#rmfile'), null, change);
      assert.equal($('[data-ack="0"]').checked, false, change);
      assert.equal($('[data-ack="1"]').checked, false, change);
      assert.match($('#dl').textContent, /Scarica la bozza \(PDF\)/);
    } finally { dom.window.close(); }
  }
});

test('generation failure stays gated and reports a retryable error', () => {
  const { w, $, dom, form, downloads } = setup();
  try {
    form(); $('[data-act="inc"][data-i="2"]').click(); $('#buy').click();
    w.jspdf = null;
    $('#dl').click();
    assert.equal(downloads.length, 0);
    assert.equal($('#file').disabled, true);
    assert.match($('#contract [role="alert"]').textContent, /Impossibile/);
    w.jspdf = { jsPDF };
    $('#dl').click();
    assert.equal(downloads.length, 1);
    assert.equal($('#contract [role="alert"]'), null);
  } finally { dom.window.close(); }
});

test('extremely long fields paginate without dropping the final content', async () => {
  const { w, dom } = setup();
  try {
    const blob = w.DTPContractPDF({
      data: { ...data, sede: ('Indirizzo molto lungo '.repeat(1200)) + 'FINE INDIRIZZO' },
      contract: { id: 'DTP-BOZZA-TEST', date: new Date('2026-11-16') },
      config: { cert: 411.52 },
    });
    const text = await extract(blob, 'long-fields');
    assert.ok(text.includes('FINE INDIRIZZO'));
    assert.ok(text.includes('1.234,56'));
    assert.ok(text.includes('Nessuna firma acquisita'));
  } finally { dom.window.close(); }
});
