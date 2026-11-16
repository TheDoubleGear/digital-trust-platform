/* V01 – vetrina in sola lettura: filtri, nessun carrello. */
(function () {
  var D = window.DTP, e = D.esc;
  var st = { type: 'all', fam: 'all', q: '' };
  var types = [['all', 'Tutto'], ['bundle', 'Bundle'], ['service', 'Servizi singoli']];
  function chips(el, list, key) {
    el.innerHTML = list.map(function (t) { return '<button type="button" class="chip" data-v="' + e(t[0]) + '" aria-pressed="' + (st[key] === t[0]) + '">' + e(t[1]) + '</button>'; }).join('');
    el.onclick = function (ev) { var b = ev.target.closest('button'); if (!b) return; st[key] = b.dataset.v; render(); };
  }
  function match(text) { return !st.q || text.toLowerCase().indexOf(st.q) >= 0; }
  function bundleCard(b) {
    return '<article class="card bcard reveal"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;min-height:24px"><h3 style="font-size:18px">' + e(b.id) + '</h3>' + (b.badge ? '<span class="badge">' + e(b.badge) + '</span>' : '') + '</div>' +
      '<div class="price">' + D.eur(b.price) + ' <small>/ anno</small></div><p style="margin:0;font-size:13px;color:#4D5762;min-height:38px">' + e(b.desc) + '</p>' +
      '<ul class="kv">' + D.bundleLines.map(function (l, i) { return '<li><span>' + e(l) + '</span><strong>' + b.inc[i] + '</strong></li>'; }).join('') + '</ul>' +
      '<p style="margin:auto 0 0;font-size:12px;color:#4D5762">Canone annuale · tutti i servizi del catalogo</p></article>';
  }
  function entCard() {
    var q = D.entDefault(), tot = D.entTotal(q);
    var rows = D.services.map(function (s, i) { return '<tr><td>' + e(s.name) + '<small>' + D.unit3(s.unit * D.ENT_DISC) + ' € per unità · passo ' + D.num(s.step) + '</small></td><td class="r">' + D.num(q[i]) + '</td><td class="r"><strong>' + D.eur(D.entAmount(i, q[i])) + '</strong></td></tr>'; }).join('');
    return '<article class="card bcard ent reveal" style="grid-column:1/-1"><div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;align-items:flex-start"><div><div style="display:flex;gap:8px;align-items:center"><h3 style="font-size:18px">Enterprise</h3><span class="badge">Personalizzabile</span></div><p style="margin:6px 0 0;font-size:13px;color:#4D5762;max-width:560px">Scegli tu servizi e quantità; il prezzo si calcola mentre componi, con lo sconto Enterprise sul listino unitario. Composizione e quantità si definiscono durante l\'attivazione.</p></div>' +
      '<div style="text-align:right"><div class="price">Su misura</div><small class="muted">Esempio di composizione: ' + D.eur(tot) + ' / anno indicativi</small></div></div>' +
      '<details class="ent-d"><summary>Vedi la composizione di esempio (' + D.services.length + ' servizi)</summary><div class="tscroll"><table class="tbl stack"><thead><tr><th>Servizio</th><th class="r">Quantità annua</th><th class="r">Importo indicativo</th></tr></thead><tbody>' + rows + '</tbody></table></div></details></article>';
  }
  function svcCard(s) {
    return '<article class="card scard reveal"><span class="eyebrow">' + e(s.family) + '</span><h3>' + e(s.name) + '</h3><p style="min-height:38px">' + e(s.desc) + '</p><div style="display:flex;flex-direction:column;gap:8px;margin-top:auto">' +
      s.packs.map(function (k) { return '<div class="pack"><div><b>' + D.num(k.qty) + ' unità</b><br><span>' + D.unit3(k.price / k.qty) + ' €/unità</span></div><div class="pr">' + D.eur(k.price) + '</div></div>'; }).join('') + '</div></article>';
  }
  function render() {
    chips(document.getElementById('f-type'), types, 'type');
    chips(document.getElementById('f-fam'), [['all', 'Tutte le famiglie']].concat(D.families.map(function (f) { return [f, f]; })), 'fam');
    var famDisabled = st.type === 'bundle';
    document.getElementById('f-fam').hidden = famDisabled;
    var showB = st.type !== 'service' && st.fam === 'all';
    var bl = showB ? D.bundles.filter(function (b) { return match('bundle ' + b.id + ' ' + b.desc); }) : [];
    var showEnt = showB && match('bundle enterprise personalizzabile su misura');
    var sl = st.type === 'bundle' ? [] : D.services.filter(function (s) { return (st.fam === 'all' || s.family === st.fam) && match(s.name + ' ' + s.desc + ' ' + s.family); });
    var n = bl.length + (showEnt ? 1 : 0) + sl.length;
    document.getElementById('count').textContent = n + (n === 1 ? ' offerta' : ' offerte');
    var h = '';
    if (bl.length || showEnt) h += '<section aria-labelledby="t-b" style="display:flex;flex-direction:column;gap:12px"><div class="sec-h"><div><h2 id="t-b">Bundle annuali</h2><p>Tutti i servizi del catalogo in un canone annuale, con quantità incluse crescenti. Enterprise si compone su misura.</p></div></div><div class="bgrid">' + bl.map(bundleCard).join('') + (showEnt ? entCard() : '') + '</div></section>';
    if (sl.length) h += '<section aria-labelledby="t-s" style="display:flex;flex-direction:column;gap:12px"><div class="sec-h"><div><h2 id="t-s">Servizi e offerte singole</h2><p>Ogni servizio è disponibile anche da solo, in pacchetti a quantità definita.</p></div></div><div class="sgrid">' + sl.map(svcCard).join('') + '</div></section>';
    if (!n) h = '<div class="empty"><strong>Nessuna offerta corrisponde ai filtri</strong><span class="muted" style="font-size:14px">Prova un altro termine o mostra di nuovo tutto il catalogo.</span><button type="button" class="btn btn-o" id="reset">Mostra tutto il catalogo</button></div>';
    document.getElementById('results').innerHTML = h;
    var r = document.getElementById('reset');
    if (r) r.onclick = function () { st = { type: 'all', fam: 'all', q: '' }; document.getElementById('q').value = ''; render(); };
  }
  document.getElementById('q').addEventListener('input', function (ev) { st.q = ev.target.value.trim().toLowerCase(); render(); });
  render();
})();
