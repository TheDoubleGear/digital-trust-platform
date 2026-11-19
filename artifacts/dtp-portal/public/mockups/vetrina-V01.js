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
  function svcCard(s) {
    return '<article class="card scard reveal"><span class="eyebrow">' + e(s.family) + '</span><h3>' + e(s.name) + '</h3><p>' + e(s.desc) + '</p>' +
      '<ul class="kv" style="gap:8px"><li style="flex-direction:column;gap:2px"><span>Finalità</span><strong style="font-weight:500">' + e(s.purpose) + '</strong></li>' +
      '<li style="flex-direction:column;gap:2px"><span>Dipendenze</span><strong style="font-weight:500">' + e(deps(s)) + '</strong></li>' +
      '<li style="flex-direction:column;gap:2px"><span>Condizioni di utilizzo</span><strong style="font-weight:500">' + e(s.terms) + '</strong></li></ul>' +
      '<div style="display:flex;flex-direction:column;gap:8px;margin-top:auto"><div class="pack"><div><b>' + D.unit3(s.unit) + ' € per unità</b><br><span>Quantità a multipli di ' + D.num(s.step) + ' unità</span></div><div class="pr">Listino</div></div>' +
      '<p style="font-size:12px">Approfondimenti e documentazione: ' + e(s.doc) + '</p></div></article>';
  }
  function render() {
    chips(document.getElementById('f-fam'), [['all', 'Tutte le famiglie']].concat(D.families.map(function (f) { return [f, f]; })), 'fam');
    var sl = D.services.filter(function (s) { return (st.fam === 'all' || s.family === st.fam) && match(s.name + ' ' + s.desc + ' ' + s.family + ' ' + s.purpose); });
    var n = sl.length;
    document.getElementById('count').textContent = n + (n === 1 ? ' servizio' : ' servizi');
    var h = '';
    if (n) h = '<section aria-labelledby="t-s" style="display:flex;flex-direction:column;gap:12px"><div class="sec-h"><div><h2 id="t-s">Servizi</h2><p>Ogni servizio si configura con la quantità che ti serve. Il prezzo è dato dalla componente variabile (quantità × prezzo unitario), dalla fee di attivazione e dal canone periodico.</p></div></div><div class="sgrid">' + sl.map(svcCard).join('') + '</div></section>';
    else h = '<div class="empty"><strong>Nessun servizio corrisponde ai filtri</strong><span class="muted" style="font-size:14px">Prova un altro termine o mostra di nuovo tutto il catalogo.</span><button type="button" class="btn btn-o" id="reset">Mostra tutto il catalogo</button></div>';
    document.getElementById('results').innerHTML = h;
    var r = document.getElementById('reset');
    if (r) r.onclick = function () { st = { fam: 'all', q: '' }; document.getElementById('q').value = ''; render(); };
  }
  document.getElementById('q').addEventListener('input', function (ev) { st.q = ev.target.value.trim().toLowerCase(); render(); });
  render();
})();
