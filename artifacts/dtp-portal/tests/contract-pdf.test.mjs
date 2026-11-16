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

test('direct PDF download includes the longest cart, Enterprise, totals and no password', async () => {
  const { w, $, dom, downloads, form } = setup();
  try {
    form();
    $('[data-act="bundle"][data-v="Enterprise"]').click();
    // Both offers of every service: 18 packs plus Enterprise.
    for (const service of w.DTP.services) {
      service.packs.forEach((_, i) => $(`[data-act="pack"][data-v="${service.id}|${i}"]`).click());
    }
    $('#buy').click();
    assert.match($('#dl').textContent, /PDF/);
    $('#dl').click();
    assert.match(downloads[0].filename, /^bozza-contratto-DTP-BOZZA-\d+\.pdf$/);
    assert.equal($('#file').disabled, false);
    const text = await extract(downloads[0].blob, 'full-cart');
    for (const value of Object.values(data)) assert.ok(text.includes(value), value);
    for (const service of w.DTP.services) {
      assert.ok(text.includes(service.name));
      for (const pack of service.packs) assert.ok(text.includes(w.DTP.eur(pack.price)));
    }
    const qty = w.DTP.entDefault();
    const total = w.DTP.entTotal(qty) + w.DTP.services.reduce((sum, s) => sum + s.packs.reduce((a, p) => a + p.price, 0), 0);
    assert.ok(text.includes('Totale annuo, IVA esclusa: ' + w.DTP.eur(total)));
    assert.ok(text.includes('Composizione Enterprise'));
    for (const q of qty.filter(Boolean)) assert.ok(text.includes(w.DTP.num(q) + ' unità'));
    assert.ok(text.includes('TESTO DA FORNIRE E APPROVARE A CURA DI POSTEL'));
    assert.ok(!text.includes('SecretNotInPDF123'));
    assert.ok(!text.toLowerCase().includes('password'));
    const pages = text.split('\f').filter(p => p.trim());
    assert.ok(pages.length >= 3);
    pages.forEach((p, i) => {
      assert.ok(p.includes('BOZZA DIMOSTRATIVA'));
      assert.ok(p.includes(`Pagina ${i + 1} di ${pages.length}`));
    });
    $('#dl').click();
    assert.equal(downloads[1].filename, downloads[0].filename);
  } finally { dom.window.close(); }
});

test('service, Enterprise quantity and company changes invalidate download, attachment and acknowledgements', () => {
  for (const change of ['service', 'quantity', 'data']) {
    const { w, $, dom, form } = setup();
    try {
      form(); $('[data-act="bundle"][data-v="Enterprise"]').click(); $('#buy').click(); $('#dl').click();
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
        $(change === 'quantity' ? '[data-act="inc"][data-i="0"]' : '[data-act="pack"]').click();
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
    form(); $('[data-act="bundle"][data-v="Base"]').click(); $('#buy').click();
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
      items: [{ name: 'Servizio di prova', detail: 'Quantità 100', price: 1234.56 }],
      bundle: 'Base', entQty: [],
    });
    const text = await extract(blob, 'long-fields');
    assert.ok(text.includes('FINE INDIRIZZO'));
    assert.ok(text.includes('1.234,56'));
    assert.ok(text.includes('Nessuna firma acquisita'));
  } finally { dom.window.close(); }
});
