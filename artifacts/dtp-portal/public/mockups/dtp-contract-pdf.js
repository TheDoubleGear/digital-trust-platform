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
    var pr = D.price(input.config);
    heading('3. Servizi configurati e quantità (Allegato A)');
    pr.lines.forEach(function (line, index) {
      if (y + 30 > bottom) newPage();
      text((index + 1) + '. ' + line.name, true);
      text('Quantità: ' + D.num(line.qty) + ' unità · prezzo unitario di listino ' + D.unit3(line.unit) + ' €');
      text('Importo, IVA esclusa: ' + D.eur(line.amount));
    });
    heading('4. Corrispettivi, IVA esclusa');
    field('Componente variabile (quantità × prezzo unitario)', D.eur(pr.variabile));
    field('Fee di attivazione', D.eur(pr.fee) + ' (' + D.SEGNAPOSTO + ')');
    field('Canone periodico', D.eur(pr.canone) + ' (' + D.SEGNAPOSTO + ') · periodicità ' + D.periodicita);
    /* Sconto della configurazione assistita del commerciale: listino, sconto e prezzo scontato per componente. */
    var sc = input.sconto > 0 ? D.applySconto(pr, input.sconto) : null;
    if (sc) {
      var pct = D.num(sc.pct) + '%';
      heading('Sconto sul prezzo complessivo: ' + pct);
      [['Componente variabile', sc.variabile], ['Fee di attivazione', sc.fee], ['Canone periodico', sc.canone]].forEach(function (x) {
        field(x[0] + ' (con sconto)', 'listino ' + D.eur(x[1].listino) + ' · sconto ' + pct + ' -' + D.eur(x[1].sconto) + ' · prezzo scontato ' + D.eur(x[1].netto));
      });
      field('Totale di listino', D.eur(sc.totale.listino));
      field('Sconto complessivo', '-' + D.eur(sc.totale.sconto));
      heading('Totale scontato, IVA esclusa: ' + D.eur(sc.totale.netto));
    } else heading('Totale, IVA esclusa: ' + D.eur(pr.totale));
    text('Oltre le quantità configurate si applica l\'overage al prezzo unitario di listino. Ogni variazione successiva è una modifica dell\'offerta e del contratto. Modalità di fatturazione: [DA DEFINIRE].');
    heading('5. Durata');
    text('12 mesi dall\'attivazione dell\'area clienti. Rinnovo non tacito: alla scadenza, in assenza di rinnovo, l\'accesso ai servizi è disabilitato e i dati sono conservati per [DA DEFINIRE] giorni, al termine dei quali sono cancellati.');
    heading('6. Firma, verifica e attivazione');
    text('Il contratto è firmato dal legale rappresentante fuori dalla piattaforma e caricato in formato PDF o P7M. Tipologie di firma ammesse: [DA DEFINIRE].');
    text("Nel processo definitivo la piattaforma verifica in automatico la firma e la corrispondenza con i dati indicati. Una prima e-mail al legale rappresentante comunica l'esito della verifica e allega la prima fattura con il collegamento per il pagamento, che avviene fuori dalla piattaforma. Dopo il pagamento una seconda e-mail conferma il pagamento, allega il contratto e comunica l'attivazione dell'area clienti con i servizi e le credenziali di accesso. Questa bozza non avvia alcuna attivazione.");
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
