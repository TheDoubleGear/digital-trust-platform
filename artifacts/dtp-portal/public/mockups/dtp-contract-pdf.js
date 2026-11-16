/* Local, synchronous PDF generation: no customer data leaves the browser. */
(function (root) {
  'use strict';
  root.DTPContractPDF = function (input) {
    if (!root.jspdf) throw new Error('Generatore PDF non disponibile. Ricarica la pagina e riprova.');
    var doc = new root.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    var y = 25, bottom = 273, width = 174;
    var d = input.data, c = input.contract, D = root.DTP;
    doc.setProperties({ title: 'Bozza dimostrativa ' + c.id, author: 'Digital Trust Platform' });

    function newPage() { doc.addPage(); y = 25; }
    function text(value, bold, size) {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size || 10);
      doc.setTextColor(15, 30, 54);
      var lines = doc.splitTextToSize(String(value), width);
      var height = (size || 10) * 0.3528 * 1.4;
      // Keep ordinary paragraphs together; very long fields split safely by line.
      if (lines.length * height < bottom - 25 && y + lines.length * height > bottom) newPage();
      lines.forEach(function (line) {
        if (y + height > bottom) newPage();
        doc.text(line, 18, y);
        y += height;
      });
      y += 2;
    }
    function heading(value) {
      if (y + 24 > bottom) newPage();
      y += 4; text(value, true, 12);
    }
    function field(label, value) { text(label + ': ' + value); }

    text('BOZZA DIMOSTRATIVA - NON VALIDA LEGALMENTE', true, 12);
    text('Documento generato da un prototipo. Testo contrattuale definitivo, condizioni generali e allegati da fornire e approvare a cura di Postel. Nessuna firma, richiesta o attivazione reale.');
    text('Contratto di fornitura dei servizi Digital Trust Platform', true, 17);
    text('Riferimento ' + c.id + ' · bozza generata il ' + c.date.toLocaleDateString('it-IT'));
    heading('1. Parti');
    text('Fornitore: Postel S.p.A. - dati societari [DA DEFINIRE].');
    field('Cliente (ragione sociale)', d.ragione);
    field('Partita IVA', 'IT' + d.piva);
    field('Sede legale', d.sede);
    field('PEC', d.pec);
    field('Codice destinatario SdI', d.sdi);
    heading('2. Legale rappresentante');
    field('Nome e cognome', d.nome + ' ' + d.cognome);
    field('Codice fiscale', d.cf);
    field('E-mail', d.email);
    field('Cellulare', d.tel);
    heading('3. Servizi oggetto del contratto (Allegato A)');
    input.items.forEach(function (item, index) {
      if (y + 30 > bottom) newPage();
      text((index + 1) + '. ' + item.name, true);
      text(item.detail);
      text('Importo annuo, IVA esclusa: ' + D.eur(item.price));
    });
    if (input.bundle === 'Enterprise') {
      heading('Composizione Enterprise - prezzo indicativo');
      D.services.forEach(function (service, index) {
        if (input.entQty[index] > 0) field(service.name, D.num(input.entQty[index]) + ' unità');
      });
    }
    heading('Totale annuo, IVA esclusa: ' + D.eur(input.items.reduce(function (sum, item) { return sum + item.price; }, 0)));
    heading('4. Durata');
    text('12 mesi dalla data di controfirma di Postel. Modalità di rinnovo: [DA DEFINIRE].');
    heading('5. Corrispettivi e fatturazione');
    text('Prezzi IVA esclusa secondo il listino in vigore. Il prezzo di Enterprise è indicativo e viene confermato da Postel. Modalità di fatturazione: [DA DEFINIRE].');
    heading('6. Attivazione');
    text("Nel processo definitivo la richiesta sarà soggetta alle verifiche di Postel. L'esito e le istruzioni di accesso saranno comunicati all'e-mail del legale rappresentante. Questa bozza non avvia alcuna attivazione.");
    heading('7. Condizioni generali e trattamento dei dati');
    text('[TESTO DA FORNIRE E APPROVARE A CURA DI POSTEL]');
    text('Nessuna firma acquisita. Documento esclusivamente dimostrativo.', true);

    var pages = doc.getNumberOfPages();
    for (var page = 1; page <= pages; page++) {
      doc.setPage(page);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(86, 98, 122);
      doc.text('DIGITAL TRUST PLATFORM · BOZZA DIMOSTRATIVA', 18, 13);
      doc.text(c.id + ' · Non valida legalmente', 18, 286);
      doc.text('Pagina ' + page + ' di ' + pages, 192, 286, { align: 'right' });
    }
    return doc.output('blob');
  };
})(window);
