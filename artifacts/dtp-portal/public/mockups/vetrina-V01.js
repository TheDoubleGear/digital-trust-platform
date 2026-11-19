/* V01 – vetrina in sola lettura: filtri per famiglia e ricerca, nessun carrello. */
(function () {
  var D = window.DTP, e = D.esc;
  var st = { fam: 'all', q: '' };
  function chips(el, list, key) {
    el.innerHTML = list.map(function (t) { return '<button type="button" class="chip" data-v="' + e(t[0]) + '" aria-pressed="' + (st[key] === t[0]) + '">' + e(t[1]) + '</button>'; }).join('');
    el.onclick = function (ev) { var b = ev.target.closest('button'); if (!b) return; st[key] = b.dataset.v; render(); };
  }
  function match(text) { return !st.q || text.toLowerCase().indexOf(st.q) >= 0; }
  function deps(s) {
    return s.deps.length ? s.deps.map(function (d) { return D.byId(d).name; }).join(', ') : 'Nessuna';
  }
  function requiredBy(s) {
    return D.services.filter(function (x) { return x.deps.indexOf(s.id) >= 0; }).map(function (x) { return x.name; });
  }
  function svcCard(s) {
    return '<article class="card scard reveal"><span class="eyebrow">' + e(s.family) + '</span><h3>' + e(s.name) + '</h3>' +
      '<ul class="kv" style="gap:8px"><li style="flex-direction:column;gap:2px"><span>Caratteristiche</span><strong style="font-weight:500">' + e(s.desc) + '</strong></li>' +
      '<li style="flex-direction:column;gap:2px"><span>Finalità</span><strong style="font-weight:500">' + e(s.purpose) + '</strong></li>' +
      '<li style="flex-direction:column;gap:2px"><span>Dipendenze</span><strong style="font-weight:500">' + e(deps(s)) + '</strong></li>' +
      '<li style="flex-direction:column;gap:2px"><span>Condizioni di utilizzo</span><strong style="font-weight:500">' + e(s.terms) + '</strong></li></ul>' +
      '<div style="display:flex;flex-direction:column;gap:10px;margin-top:auto"><div class="pack"><div><b>' + D.unit3(s.unit) + ' € per unità</b><br><span>Quantità a multipli di ' + D.num(s.step) + ' unità</span></div><div class="pr">Listino</div></div>' +
      '<button type="button" class="btn btn-l more" data-more="' + e(s.id) + '" aria-haspopup="dialog">Approfondisci<span class="sr"> ' + e(s.name) + '</span></button></div></article>';
  }
  /* Approfondimento: contenuto dedicato in una finestra di dialogo, con il collegamento alla documentazione. */
  var dlg = document.getElementById('detail'), opener = null;
  function openDetail(id, btn) {
    var s = D.byId(id); if (!s) return;
    var req = requiredBy(s);
    dlg.innerHTML = '<div class="in"><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start"><div><span class="eyebrow">' + e(s.family) + '</span><h2 id="detail-t" style="margin-top:6px">' + e(s.name) + '</h2></div>' +
      '<button type="button" class="x" id="detail-x" aria-label="Chiudi"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>' +
      '<dl><div><dt>Caratteristiche</dt><dd>' + e(s.desc) + '</dd></div>' +
      '<div><dt>Finalità</dt><dd>' + e(s.purpose) + '</dd></div>' +
      '<div><dt>Dipendenze</dt><dd>' + (s.deps.length ? 'Richiede ' + e(deps(s)) + ': durante l\'attivazione viene aggiunto automaticamente al carrello.' : 'Nessuna: si può attivare da solo.') + '</dd></div>' +
      (req.length ? '<div><dt>Richiesto da</dt><dd>' + e(req.join(', ')) + '</dd></div>' : '') +
      '<div><dt>Condizioni di utilizzo</dt><dd>' + e(s.terms) + '</dd></div>' +
      '<div><dt>Prezzo di listino</dt><dd>' + D.unit3(s.unit) + ' € per unità, IVA esclusa · quantità a multipli di ' + D.num(s.step) + ' unità. Al prezzo dei servizi si aggiungono fee di attivazione e canone periodico.</dd></div>' +
      '<div><dt>Approfondimento</dt><dd>[CONTENUTO DA FORNIRE A CURA DI POSTEL]</dd></div></dl>' +
      '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center"><a class="btn btn-o" aria-disabled="true" role="link" tabindex="0" id="detail-doc">Scarica la documentazione</a><span class="muted" style="font-size:13px">' + e(s.doc) + '</span></div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end;border-top:1px solid #EAEFF5;padding-top:14px"><button type="button" class="btn btn-o" id="detail-close">Chiudi</button><a class="btn btn-p" href="vetrina-V02-contratto.html">Attivazione servizio</a></div></div>';
    opener = btn;
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    document.getElementById('detail-x').onclick = closeDetail;
    document.getElementById('detail-close').onclick = closeDetail;
    document.getElementById('detail-doc').onclick = function (ev) { ev.preventDefault(); };
    document.getElementById('detail-x').focus();
  }
  function closeDetail() {
    if (typeof dlg.close === 'function' && dlg.open) dlg.close(); else dlg.removeAttribute('open');
  }
  dlg.addEventListener('close', function () { if (opener && document.body.contains(opener)) opener.focus(); });
  dlg.addEventListener('click', function (ev) { if (ev.target === dlg) closeDetail(); });
  document.getElementById('results').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-more]'); if (b) openDetail(b.dataset.more, b);
  });
  function render() {
    chips(document.getElementById('f-fam'), [['all', 'Tutte le famiglie']].concat(D.families.map(function (f) { return [f, f]; })), 'fam');
    var sl = D.services.filter(function (s) { return (st.fam === 'all' || s.family === st.fam) && match(s.name + ' ' + s.desc + ' ' + s.family + ' ' + s.purpose + ' ' + s.terms); });
    var n = sl.length;
    document.getElementById('count').textContent = n + (n === 1 ? ' servizio' : ' servizi');
    var h = '';
    if (n) h = '<section aria-labelledby="t-s" style="display:flex;flex-direction:column;gap:12px"><div class="sec-h"><div><h2 id="t-s">Servizi</h2><p>Ogni servizio si configura con la quantità che ti serve; apri «Approfondisci» per i dettagli e la documentazione. Il prezzo è dato dalla componente variabile (quantità × prezzo unitario), dalla fee di attivazione e dal canone periodico.</p></div></div><div class="sgrid">' + sl.map(svcCard).join('') + '</div></section>';
    else h = '<div class="empty"><strong>Nessun servizio corrisponde ai filtri</strong><span class="muted" style="font-size:14px">Prova un altro termine o mostra di nuovo tutto il catalogo.</span><button type="button" class="btn btn-o" id="reset">Mostra tutto il catalogo</button></div>';
    document.getElementById('results').innerHTML = h;
    var r = document.getElementById('reset');
    if (r) r.onclick = function () { st = { fam: 'all', q: '' }; document.getElementById('q').value = ''; render(); };
  }
  document.getElementById('q').addEventListener('input', function (ev) { st.q = ev.target.value.trim().toLowerCase(); render(); });
  render();
})();
