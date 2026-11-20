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
// opts.role simula la sessione demo (es. 'com' per la modalità assistita), opts.query la query string,
// opts.storage riprende il localStorage di un'altra scheda (i codici di configurazione).
function setup(opts = {}) {
  const dom = new JSDOM(readFileSync(new URL('vetrina-V02-contratto.html', mockups), 'utf8'), {
    runScripts: 'outside-only', url: 'https://example.test/mockups/vetrina-V02-contratto.html' + (opts.query || ''),
  });
  const w = dom.window;
  if (opts.storage) for (const [k, v] of Object.entries(opts.storage)) w.localStorage.setItem(k, v);
  if (opts.role) w.DTPAuth = { getRole: () => opts.role };
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
  // Passo 1: un clic su "+" per ogni indice, poi conferma della configurazione.
  function configure(indexes) {
    for (const i of indexes) $(`[data-act="inc"][data-i="${i}"]`).click();
    $('#confirm').click();
  }
  // Passo 2: dati validi e invio del modulo.
  function form() {
    for (const [key, value] of Object.entries(data)) $('#' + key).value = value;
    $('#pw').value = $('#pw2').value = 'SecretNotInPDF123';
    submitData();
  }
  function submitData() { $('#f1').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); }
  function attach(name, type) {
    const file = new w.File(['%PDF-demo'], name, { type });
    Object.defineProperty($('#file'), 'files', { value: [file], configurable: true });
    $('#file').dispatchEvent(new w.Event('change'));
  }
  return { w, $, dom, downloads, form, configure, submitData, attach };
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
  const { w, $, dom, downloads, form, configure } = setup();
  try {
    const D = w.DTP, chosen = D.services.slice(0, 5);
    configure(chosen.flatMap(service => [D.services.indexOf(service), D.services.indexOf(service)]));
    form();
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
    const flat = text.replace(/\s+/g, ' ');
    assert.ok(flat.includes("Rinnovo non tacito: alla scadenza, in assenza di rinnovo, l'accesso ai servizi è disabilitato e i dati sono conservati per [DA DEFINIRE] giorni, al termine dei quali sono cancellati."));
    assert.ok(!/modalità di rinnovo/i.test(flat));
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
    const { w, $, dom, form, configure, submitData, attach } = setup();
    try {
      configure([0]); form(); $('#dl').click();
      attach('signed.pdf', 'application/pdf');
      for (const i of [0, 1, 2]) $(`[data-ack="${i}"]`).click();
      assert.equal($('#submit').disabled, false, change);
      if (change === 'data') {
        $('[data-go="2"]').click();
        $('#ragione').value = 'Changed Company';
        $('#ragione').dispatchEvent(new w.Event('input', { bubbles: true }));
        submitData();
      } else {
        $('[data-step="1"]').click();
        $(change === 'quantity' ? '[data-act="inc"][data-i="0"]' : '[data-act="inc"][data-i="2"]').click();
        assert.equal($('[data-step="2"]').disabled, true, 'la configurazione va confermata di nuovo');
        $('#confirm').click();
        submitData();
      }
      assert.equal($('#s3').hidden, false, change);
      assert.equal($('#file').disabled, true, change);
      assert.equal($('#rmfile'), null, change);
      for (const i of [0, 1, 2]) assert.equal($(`[data-ack="${i}"]`).checked, false, change);
      assert.match($('#dl').textContent, /Scarica il contratto \(PDF\)/);
    } finally { dom.window.close(); }
  }
});

test('generation failure stays gated and reports a retryable error', () => {
  const { w, $, dom, form, configure, downloads } = setup();
  try {
    configure([2]); form();
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

test('configuration comes before data: data and contract stay locked until the cart is confirmed', () => {
  const { $, dom, form, configure } = setup();
  try {
    assert.equal($('#s1').hidden, false);
    assert.equal($('#s2').hidden, true);
    assert.equal($('[data-step="2"]').disabled, true);
    assert.equal($('#confirm').disabled, true, 'carrello vuoto');
    form();
    assert.equal($('#s2').hidden, true, 'i dati non si inviano prima della configurazione');
    assert.equal($('#dl'), null);
    configure([2]);
    assert.equal($('#s2').hidden, false);
    assert.equal($('#side').hidden, true);
  } finally { dom.window.close(); }
});

test('a service with dependencies adds the required one with the minimum quantity and keeps it until removed', () => {
  const { w, $, dom } = setup();
  try {
    const D = w.DTP, app = D.services.findIndex(s => s.id === 'app'), cert = D.services.findIndex(s => s.id === 'cert');
    const certStep = D.byId('cert').step;
    $(`[data-act="inc"][data-i="${app}"]`).click();
    const out = i => $(`[data-act="inc"][data-i="${i}"]`).parentElement.querySelector('output').textContent;
    assert.equal(out(cert), D.num(certStep));
    assert.match($('#cat').textContent, /Aggiunto Nuovi Certificati FEA: è necessario per Apposizioni FEA con COD/);
    assert.equal($(`[data-act="dec"][data-i="${cert}"]`).disabled, true, 'il servizio richiesto non scende sotto il minimo');
    assert.equal($('[data-rm="cert"]'), null, 'il servizio richiesto non si toglie dal carrello');
    assert.match($('#side').textContent, /Necessario per Apposizioni FEA con COD/);
    $(`[data-act="inc"][data-i="${cert}"]`).click();
    assert.equal(out(cert), D.num(certStep * 2), 'la quantità aggiunta resta modificabile');
    $(`[data-act="dec"][data-i="${cert}"]`).click();
    assert.equal($(`[data-act="dec"][data-i="${cert}"]`).disabled, true);
    $('[data-rm="app"]').click();
    assert.equal($(`[data-act="dec"][data-i="${cert}"]`).disabled, false, 'senza Apposizioni il servizio si può togliere');
    assert.ok($('[data-rm="cert"]'));
    assert.doesNotMatch($('#cat').textContent, /Aggiunto Nuovi Certificati FEA/);
  } finally { dom.window.close(); }
});

test('configuration code saves the current cart and restores it later', () => {
  const { w, $, dom } = setup();
  try {
    $('#gen-code').click();
    assert.match($('#code-out').textContent, /Aggiungi almeno un servizio/);
    $('[data-act="inc"][data-i="2"]').click();
    $('[data-act="inc"][data-i="2"]').click();
    $('#gen-code').click();
    const code = $('#code-value').textContent;
    assert.match(code, /^DTP-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    assert.match($('#code-out').textContent, /Validità del codice: \[DA DEFINIRE\]/);
    assert.ok(JSON.parse(w.localStorage.getItem('dtp-demo-config-codes'))[code]);
    $('[data-act="inc"][data-i="5"]').click();
    assert.match($('#code-out').textContent, /La configurazione è cambiata/);
    $('#code-in').value = 'DTP-ZZZZ-ZZZZ';
    $('#code-apply').click();
    assert.match($('#code-in-e').textContent, /non trovato/);
    $('#code-in').value = 'abc';
    $('#code-apply').click();
    assert.match($('#code-in-e').textContent, /formato/);
    $('#code-in').value = code.toLowerCase();
    $('#code-apply').click();
    assert.equal($('#code-in-e').textContent, '');
    assert.match($('#cat').textContent, new RegExp('Configurazione ripristinata dal codice ' + code));
    const svc = w.DTP.services[2];
    assert.equal(w.document.querySelectorAll('[data-rm]').length, 1);
    assert.ok($('#side').textContent.includes(svc.name));
    assert.ok($('#side').textContent.includes(w.DTP.num(svc.step * 2) + ' unità'));
    $('#confirm').click();
    assert.equal($('#s2').hidden, false, 'si riprende il percorso');
  } finally { dom.window.close(); }
});

test('formal checks run when leaving each field and block the contract until data are valid', () => {
  const { w, $, dom, configure, submitData } = setup();
  try {
    configure([2]);
    const blur = id => $('#' + id).dispatchEvent(new w.FocusEvent('focusout', { bubbles: true }));
    for (const [id, bad, msg] of [['piva', '12AB', /11 cifre/], ['cf', 'RSSMRA80A01H50', /codice fiscale/i], ['sdi', '12', /7 caratteri/], ['pec', 'pec@', /PEC/], ['email', 'mail', /e-mail/], ['tel', '12', /cellulare/]]) {
      $('#' + id).value = bad; blur(id);
      assert.equal($('#' + id).getAttribute('aria-invalid'), 'true', id);
      assert.match($('#' + id + '-e').textContent, msg, id);
    }
    submitData();
    assert.equal($('#s3').hidden, true);
    assert.equal($('#dl'), null, 'nessun contratto con dati non validi');
    $('#piva').value = '12345678901'; blur('piva');
    assert.equal($('#piva').getAttribute('aria-invalid'), 'false');
    assert.equal($('#piva-e').textContent, '');
  } finally { dom.window.close(); }
});

test('signed contract accepts PDF and P7M, requires the legal representative declaration and ends with the new timeline', () => {
  const { $, dom, form, configure, attach } = setup();
  try {
    configure([2]); form(); $('#dl').click();
    attach('contratto.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    assert.match($('#contract .ferr').textContent, /PDF o un P7M/);
    attach('contratto.pdf.p7m', 'application/pkcs7-mime');
    assert.ok($('#rmfile'));
    assert.match($('#contract').textContent, /Tipologie di firma ammesse: \[DA DEFINIRE\]/);
    assert.match($('[data-ack="0"]').parentElement.textContent, /legale rappresentante.*primo acquisto può essere concluso solo dal legale rappresentante/);
    for (const i of [0, 1]) $(`[data-ack="${i}"]`).click();
    assert.equal($('#submit').disabled, true, 'servono tutte le conferme');
    $('[data-ack="2"]').click();
    assert.equal($('#submit').disabled, false);
    $('#submit').click();
    const done = $('#done').textContent;
    for (const step of ['Verifica della firma e dei dati', 'Controfirma di Postel', 'fuori dalla piattaforma', 'Pagamento, abilitazione e credenziali', 'PS-01', 'I servizi non sono ancora attivi']) {
      assert.ok(done.includes(step), step);
    }
    assert.doesNotMatch(done, /poteri/);
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

test('discount helpers apply the percentage to every component and block values above the threshold', () => {
  const { w, dom } = setup();
  try {
    const D = w.DTP;
    assert.equal(D.SOGLIA_SCONTO_STATO, 'SOGLIA_SCONTO = [DA DEFINIRE]');
    const p = D.price({ cert: 1000, ver: 20000 });
    const s = D.applySconto(p, 10);
    assert.equal(s.variabile.listino, p.variabile);
    assert.equal(s.variabile.sconto, Math.round(p.variabile * 10) / 100);
    assert.equal(s.fee.netto, p.fee * 0.9);
    assert.equal(s.canone.netto, p.canone * 0.9);
    assert.equal(s.totale.netto, s.variabile.netto + s.fee.netto + s.canone.netto);
    assert.equal(D.applySconto(p, 0).totale.netto, p.totale);
    assert.deepEqual([D.checkSconto('7,5').value, D.checkSconto('').value], [7.5, 0]);
    assert.equal(D.checkSconto(String(D.sogliaSconto)).ok, true);
    assert.match(D.checkSconto(String(D.sogliaSconto + 0.5)).error, /soglia massima/);
    assert.equal(D.checkSconto('abc').ok, false);
  } finally { dom.window.close(); }
});

test('without the sales session V-02 has no assisted band and no discount field', () => {
  const { $, dom } = setup({ role: 'lr', query: '?cliente=Prova' });
  try {
    assert.equal($('#assist-band').hidden, true);
    assert.equal($('#discount-box').hidden, true);
    assert.equal($('#fs-lr').hidden, false);
  } finally { dom.window.close(); }
});

test('assisted mode: sales prepares only configuration and discount, never data, and cannot reach data or contract', () => {
  const { w, $, dom } = setup({ role: 'com', query: '?cliente=Ottica%20Riviera%20S.r.l.' });
  try {
    const D = w.DTP;
    assert.equal($('#assist-band').hidden, false);
    assert.match($('#assist-band').textContent, /Modalità assistita · commerciale Marco Rinaldi/);
    assert.match($('#assist-band').textContent, /Ottica Riviera S\.r\.l\./);
    assert.match($('#assist-band').textContent, /prepari la configurazione e lo sconto; dati e contratto li completa il legale rappresentante/);
    assert.match($('#sconto-h').textContent, /SOGLIA_SCONTO = \[DA DEFINIRE\]/);
    assert.equal($('#confirm').hidden, true, 'il percorso del commerciale si ferma alla configurazione');
    assert.equal($('#gen-code').textContent, 'Genera codice di configurazione');
    $('[data-act="inc"][data-i="2"]').click();
    assert.equal($('[data-step="2"]').disabled, true, 'passo Dati non disponibile');
    assert.match($('[data-step="2"]').getAttribute('aria-label'), /riservato al legale rappresentante/);
    assert.equal($('[data-step="3"]').disabled, true, 'passo Contratto non disponibile');
    assert.match($('[data-step="3"]').getAttribute('aria-label'), /riservato al legale rappresentante/);
    const setSconto = v => { $('#sconto').value = v; $('#sconto').dispatchEvent(new w.Event('input', { bubbles: true })); };
    setSconto(String(D.sogliaSconto + 5));
    assert.equal($('#sconto').getAttribute('aria-invalid'), 'true');
    assert.match($('#sconto-e').textContent, /soglia massima/);
    $('#gen-code').click();
    assert.equal($('#code-value'), null, 'oltre soglia non si genera il codice');
    assert.match($('#code-out').textContent, /Correggi lo sconto/);
    setSconto('8');
    assert.equal($('#sconto-e').textContent, '');
    const x = D.applySconto(D.price({ [D.services[2].id]: D.services[2].step }), 8);
    const side = $('#side').textContent;
    for (const c of [x.variabile, x.fee, x.canone, x.totale]) {
      for (const v of [c.listino, c.sconto, c.netto]) assert.ok(side.includes(D.eur(v)), D.eur(v));
    }
    $('#confirm').click();
    $('[data-step="2"]').click();
    assert.equal($('#s1').hidden, false);
    assert.equal($('#s2').hidden, true, 'il commerciale non vede i dati dell\'azienda');
    for (const f of ['ragione', 'piva', 'sdi', 'sede', 'pec', 'nome', 'cf', 'email', 'pw']) {
      assert.equal($('#' + f).value, '', f);
      assert.equal($('#' + f).disabled, true, f);
    }
    $('#f1').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal($('#s3').hidden, true, 'il commerciale non arriva al contratto');
    assert.equal($('#dl'), null);
    $('#submit').click();
    assert.equal($('#done').hidden, true, 'il commerciale non invia la richiesta');
    $('#gen-code').click();
    const code = $('#code-value').textContent;
    assert.match(code, /^DTP-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    assert.match($('#code-out').textContent, /ritrova servizi, quantità e sconto/);
    const saved = JSON.parse(w.localStorage.getItem('dtp-demo-config-codes'))[code];
    assert.deepEqual(Object.keys(saved).sort(), ['at', 'commerciale', 'origine', 'qty', 'sconto'], 'solo servizi, quantità e sconto con l\'autore');
    assert.deepEqual(saved.qty, { [D.services[2].id]: D.services[2].step });
    assert.equal(saved.sconto, 8);
    assert.equal(saved.origine, 'Commerciale');
    assert.equal(saved.commerciale, 'Marco Rinaldi');
  } finally { dom.window.close(); }
});

test('the legal representative restores the sales code with services, quantities and discount, finds the data step empty and concludes alone', async () => {
  const sales = setup({ role: 'com', query: '?cliente=Ottica%20Riviera%20S.r.l.' });
  let storage, code;
  try {
    sales.$('[data-act="inc"][data-i="0"]').click();
    sales.$('#sconto').value = '10';
    sales.$('#sconto').dispatchEvent(new sales.w.Event('input', { bubbles: true }));
    sales.$('#gen-code').click();
    code = sales.$('#code-value').textContent;
    storage = { 'dtp-demo-config-codes': sales.w.localStorage.getItem('dtp-demo-config-codes') };
  } finally { sales.dom.window.close(); }

  const { w, $, dom, downloads, attach, form } = setup({ storage });
  try {
    const D = w.DTP;
    $('#code-in').value = code;
    $('#code-apply').click();
    assert.match($('#cat').textContent, /predisposta in modalità assistita dal commerciale Marco Rinaldi, con sconto del 10%/);
    assert.doesNotMatch($('#cat').textContent, /Ottica Riviera/);
    const x = D.applySconto(D.price({ cert: D.byId('cert').step }), 10);
    assert.ok($('#side').textContent.includes(D.eur(x.totale.netto)));
    assert.match($('#confirm').textContent, new RegExp(D.eur(x.totale.netto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    $('#confirm').click();
    assert.equal($('#s2').hidden, false);
    for (const f of ['ragione', 'piva', 'sdi', 'sede', 'pec', 'nome', 'cognome', 'cf', 'tel', 'email', 'pw', 'pw2']) {
      assert.equal($('#' + f).value, '', 'passo Dati vuoto: ' + f);
      assert.equal($('#' + f).disabled, false, f);
    }
    assert.equal($('#demo-prefill').hidden, true);
    form();
    assert.equal($('#s3').hidden, false);
    $('#dl').click();
    const text = await extract(downloads[0].blob, 'assisted-discount');
    assert.ok(text.includes('Sconto sul prezzo complessivo: 10%'));
    assert.ok(text.includes('Totale scontato, IVA esclusa: ' + D.eur(x.totale.netto)));
    attach('firmato.pdf', 'application/pdf');
    for (const i of [0, 1, 2]) $(`[data-ack="${i}"]`).click();
    $('#submit').click();
    assert.equal($('#done').hidden, false, 'il legale rappresentante invia la richiesta');
  } finally { dom.window.close(); }
});

test('changing the configuration prepared by sales drops the discount with an explanation', () => {
  const codes = { 'DTP-AAAA-BBBB': { qty: { cert: 500 }, sconto: 5, origine: 'Commerciale', commerciale: 'Marco Rinaldi' } };
  const { w, $, dom } = setup({ storage: { 'dtp-demo-config-codes': JSON.stringify(codes) } });
  try {
    $('#code-in').value = 'DTP-AAAA-BBBB';
    $('#code-apply').click();
    assert.ok($('[data-testid="table-sconto"]'));
    $('[data-act="inc"][data-i="0"]').click();
    assert.equal($('[data-testid="table-sconto"]'), null);
    assert.match($('#cat').textContent, /lo sconto del 5% vale solo per quella configurazione/);
    assert.ok($('#side').textContent.includes(w.DTP.eur(w.DTP.price({ cert: 1000 }).totale)));
  } finally { dom.window.close(); }
});
