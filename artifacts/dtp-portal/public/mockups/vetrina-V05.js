/* V05 – richiesta di contatto con un consulente. Prototipo: nessun invio, nessun salvataggio.
   Con ?servizio=<id> (da V-04) il servizio è già indicato tra quelli di interesse.
   Nel sistema reale la richiesta è registrata in commercial orchestration e assegnata a un commerciale (RF-O26). */
(function () {
  var D = window.DTP, e = D.esc;
  var $ = function (id) { return document.getElementById(id); };

  var tg = document.querySelector('.pv-toggle'), menu = $('pv-menu');
  if (tg && menu) tg.addEventListener('click', function () {
    var open = tg.getAttribute('aria-expanded') !== 'true';
    tg.setAttribute('aria-expanded', String(open)); menu.classList.toggle('open', open);
  });

  var pre = '';
  try { pre = (new URLSearchParams(window.location.search).get('servizio') || '').trim(); } catch (x) {}
  if (!D.byId(pre)) pre = '';

  /* Servizi di interesse, raggruppati per famiglia */
  $('svc').innerHTML = D.families.map(function (f) {
    var list = D.services.filter(function (s) { return s.family === f; });
    if (!list.length) return '';
    return '<div class="pv-group" role="group" aria-label="' + e(f) + '"><h3>' + e(f) + '</h3><div class="pv-checks">' + list.map(function (s) {
      return '<label><input type="checkbox" name="svc" value="' + e(s.id) + '"' + (s.id === pre ? ' checked' : '') + '><span>' + e(s.name) + '<small>' + D.unit3(s.unit) + ' € per unità</small></span></label>';
    }).join('') + '</div></div>';
  }).join('');
  if (pre) {
    $('svc').insertAdjacentHTML('beforebegin', '<div class="info" role="status" style="margin-bottom:10px">Hai aperto la richiesta dalla scheda di <strong>' + e(D.byId(pre).name) + '</strong>: il servizio è già indicato tra quelli di interesse.</div>');
    var buy = 'vetrina-V02-contratto.html?servizio=' + encodeURIComponent(pre);
    $('side-buy').href = buy; $('done-buy').href = buy;
  }

  /* Controlli formali al momento dell'inserimento */
  var RULES = {
    nome: function (v) { return v ? '' : 'Inserisci il nome.'; },
    cognome: function (v) { return v ? '' : 'Inserisci il cognome.'; },
    email: function (v) { return !v ? 'Inserisci l\'indirizzo e-mail.' : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'L\'indirizzo e-mail non ha un formato valido.'; },
    tel: function (v) { var d = v.replace(/[\s.\-]/g, ''); return !v ? 'Inserisci il numero di telefono.' : /^\+?\d{9,15}$/.test(d) ? '' : 'Il numero deve avere da 9 a 15 cifre, con prefisso internazionale facoltativo.'; },
    ragione: function (v) { return v ? '' : 'Inserisci la ragione sociale.'; },
    piva: function (v) { var d = v.replace(/\s/g, '').replace(/^IT/i, ''); return !v ? 'Inserisci la partita IVA.' : /^\d{11}$/.test(d) ? '' : 'La partita IVA deve avere 11 cifre.'; }
  };
  var LABELS = { nome: 'Nome', cognome: 'Cognome', email: 'E-mail', tel: 'Telefono', ragione: 'Ragione sociale', piva: 'Partita IVA', privacy: 'Informativa sulla privacy' };
  var touched = {};
  function check(k) {
    var inp = $(k), msg = RULES[k](inp.value.trim());
    inp.setAttribute('aria-invalid', String(!!msg));
    $(k + '-e').textContent = msg;
    return msg;
  }
  Object.keys(RULES).forEach(function (k) {
    $(k).addEventListener('blur', function () { touched[k] = true; check(k); });
    $(k).addEventListener('input', function () { if (touched[k]) check(k); });
  });
  function checkPrivacy() {
    var msg = $('privacy').checked ? '' : 'Per inviare la richiesta conferma di aver letto l\'informativa.';
    $('privacy').setAttribute('aria-invalid', String(!!msg));
    $('privacy-e').textContent = msg;
    return msg;
  }
  $('privacy').addEventListener('change', checkPrivacy);
  $('msg').addEventListener('input', function () { $('msg-h').textContent = $('msg').value.length + '/1000 caratteri'; });

  $('lead').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var errs = [];
    Object.keys(RULES).forEach(function (k) { touched[k] = true; var m = check(k); if (m) errs.push([k, m]); });
    var pm = checkPrivacy(); if (pm) errs.push(['privacy', pm]);
    var sum = $('errsum');
    if (errs.length) {
      sum.innerHTML = '<strong>Controlla ' + (errs.length === 1 ? 'il campo indicato' : 'i ' + errs.length + ' campi indicati') + '</strong><ul>' + errs.map(function (x) { return '<li><a href="#' + x[0] + '">' + e(LABELS[x[0]]) + ': ' + e(x[1]) + '</a></li>'; }).join('') + '</ul>';
      sum.hidden = false; sum.focus();
      return;
    }
    sum.hidden = true;
    var svc = [].slice.call(document.querySelectorAll('input[name=svc]:checked')).map(function (i) { return D.byId(i.value).name; });
    var pref = document.querySelector('input[name=pref]:checked').value;
    $('recap').innerHTML = [
      ['Richiedente', $('nome').value.trim() + ' ' + $('cognome').value.trim()],
      ['Azienda', $('ragione').value.trim()],
      ['Contatto preferito', pref === 'Telefono' ? 'Telefono · ' + $('tel').value.trim() : 'E-mail · ' + $('email').value.trim()],
      ['Servizi di interesse', svc.length ? svc.join(', ') : 'Da definire con il consulente']
    ].map(function (r) { return '<div><dt>' + e(r[0]) + '</dt><dd>' + e(r[1]) + '</dd></div>'; }).join('');
    /* Prototipo: i dati inseriti non vengono conservati. */
    $('lead').reset();
    $('form-box').hidden = true; $('done-box').hidden = false; $('t2').focus();
  });
})();
