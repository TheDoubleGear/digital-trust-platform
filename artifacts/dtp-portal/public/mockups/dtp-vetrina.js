/* Area pubblica (V-01, V-02, V-03, V-05): menu delle aree di offerta, che sotto 980 px si apre con il pulsante «Menu». */
(function () {
  function init() {
    var tg = document.querySelector('.pv-toggle'), menu = document.getElementById('pv-menu');
    if (!tg || !menu) return;
    tg.addEventListener('click', function () {
      var open = tg.getAttribute('aria-expanded') !== 'true';
      tg.setAttribute('aria-expanded', String(open)); menu.classList.toggle('open', open);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
