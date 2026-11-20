/* V01 – vetrina in sola lettura: filtri per famiglia e ricerca, nessun carrello. Ogni card apre la scheda del servizio V-04. */
(function () {
  var D = window.DTP, e = D.esc;
  var st = { fam: 'all', q: '' };
  function chips(el, list, key) {
    el.innerHTML = list.map(function (t) { return '<button type="button" class="chip" data-v="' + e(t[0]) + '" aria-pressed="' + (st[key] === t[0]) + '">' + e(t[1]) + '</button>'; }).join('');
    el.onclick = function (ev) { var b = ev.target.closest('button'); if (!b) return; st[key] = b.dataset.v; render(); };
  }
  function match(text) { return !st.q || text.toLowerCase().indexOf(st.q) >= 0; }
  /* Card essenziale: immagine, famiglia, nome, descrizione breve e prezzo «a partire da»; il resto è nella scheda V-04. */
  function svcCard(s) {
    var m = D.prezzoMinimo(s.id);
    return '<article class="card scard scard-img reveal"><div class="scard-pic"><img src="' + e(s.img) + '" alt="" width="240" height="140" loading="lazy"></div>' +
      '<div class="scard-body"><span class="eyebrow">' + e(s.family) + '</span><h3>' + e(s.name) + '</h3><p class="scard-desc">' + e(s.desc) + '</p>' +
      '<div class="scard-foot"><p class="scard-price"><span>A partire da</span> <strong>' + D.eur(m.amount) + '</strong> · ' + D.num(m.qty) + ' unità</p>' +
      '<p class="scard-note">IVA esclusa, più fee di attivazione e canone</p>' +
      '<a class="btn btn-l more scard-link" href="vetrina-V04-servizio.html?servizio=' + encodeURIComponent(s.id) + '" aria-label="Scopri il servizio ' + e(s.name) + '">Scopri il servizio</a></div></div></article>';
  }
  function render() {
    chips(document.getElementById('f-fam'), [['all', 'Tutte le famiglie']].concat(D.families.map(function (f) { return [f, f]; })), 'fam');
    var sl = D.services.filter(function (s) { return (st.fam === 'all' || s.family === st.fam) && match(s.name + ' ' + s.desc + ' ' + s.family + ' ' + s.purpose + ' ' + s.terms); });
    var n = sl.length;
    document.getElementById('count').textContent = n + (n === 1 ? ' servizio' : ' servizi');
    var h = '';
    if (n) h = '<section aria-labelledby="t-s" style="display:flex;flex-direction:column;gap:12px"><h2 id="t-s" class="sr">Servizi</h2><div class="sgrid">' + sl.map(svcCard).join('') + '</div></section>';
    else h = '<div class="empty"><strong>Nessun servizio corrisponde ai filtri</strong><span class="muted" style="font-size:14px">Prova un altro termine o mostra di nuovo tutto il catalogo.</span><button type="button" class="btn btn-o" id="reset">Mostra tutto il catalogo</button></div>';
    document.getElementById('results').innerHTML = h;
    var r = document.getElementById('reset');
    if (r) r.onclick = function () { st = { fam: 'all', q: '' }; document.getElementById('q').value = ''; render(); };
  }
  document.getElementById('q').addEventListener('input', function (ev) { st.q = ev.target.value.trim().toLowerCase(); render(); });
  render();
})();
