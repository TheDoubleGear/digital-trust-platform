import { type FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, CircleAlert, Eye, EyeOff, Info, LogOut, ShieldCheck, Store } from 'lucide-react';
import { demoAuth, takeFlashOnce, useDemoSession } from '@/lib/demo-auth';

const DESTINATION: Record<string, string> = {
  lr: 'Primo setup (PS-01, PS-02), poi catalogo H',
  amm: 'Catalogo e acquisti · H',
  op: 'Catalogo e richieste · H',
  tec: 'Developer portal · D0',
  com: 'Executive overview · O1',
  ops: 'Operations e SLA · O3',
  cdg: 'Ricavi, costi e marginalità · O4',
};

export default function Login() {
  const auth = demoAuth();
  const [{ role, setup }, refresh] = useDemoSession();
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(() => takeFlashOnce());
  const userRef = useRef<HTMLInputElement>(null);
  const next = new URLSearchParams(window.location.search).get('next');
  const nextPage = next && auth.PAGES[next] && !auth.PAGES[next].open ? auth.PAGES[next] : null;

  useEffect(() => {
    document.title = 'Accesso demo – Digital Trust Platform';
    /* Al ritorno con il tasto Indietro il modulo riparte vuoto. */
    const clear = (event: PageTransitionEvent) => { if (event.persisted) { setPassword(''); setReveal(false); setError(null); } };
    window.addEventListener('pageshow', clear);
    return () => window.removeEventListener('pageshow', clear);
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const account = auth.authenticate(user, password);
    if (!account) {
      setNotice(null);
      setError(user.trim() && password
        ? 'Utente o password non corretti. La password distingue maiuscole e minuscole: riprova oppure scegli una credenziale dall’elenco qui sotto.'
        : 'Inserisci utente e password per accedere.');
      setPassword('');
      userRef.current?.focus();
      return;
    }
    /* Da qui in poi viaggia solo il ruolo: la password resta nel campo e non viene salvata. */
    try {
      auth.login(account.role);
    } catch (err) {
      /* Sessione non salvabile (archiviazione del browser bloccata): si resta qui, senza navigare. */
      setNotice(null);
      setPassword('');
      setError(auth.isStorageError(err) ? err.message : 'Non è stato possibile avviare la sessione demo. Riprova.');
      return;
    }
    setPassword('');
    window.location.assign(auth.urls.page(auth.destinationAfterLogin(account.role, auth.getSetup(), next)));
  };

  const fill = (u: string, p: string) => { setUser(u); setPassword(p); setError(null); userRef.current?.focus(); };
  const logout = () => { auth.logout({ navigate: false }); auth.takeFlash(); refresh(); setNotice('Sei uscito dalla sessione demo.'); setUser(''); setPassword(''); };
  const resetDemoData = () => { auth.resetDemoData(); setNotice('Dati demo ripristinati: richieste di modifica, codici di configurazione e cambio del legale rappresentante sono tornati allo stato iniziale.'); };
  const resetSetup = () => { auth.resetSetup(); refresh(); setNotice('Primo accesso del legale rappresentante ripristinato: al prossimo login con LR riparte il setup.'); };

  return (
    <div className="hub login">
      <a className="skip-link" href="#main-content">Vai ai contenuti</a>
      <header className="topbar">
        <span className="brand" aria-label="Postel, Digital Trust Platform">
          <span className="brand-mark" aria-hidden="true"><ShieldCheck size={21} strokeWidth={1.8} /></span>
          <span className="brand-copy"><strong>postel</strong><small>Digital Trust Platform</small></span>
        </span>
        <div className="topbar-right">
          <a className="top-link" href={auth.urls.page('vetrina-V01-catalogo.html')} data-testid="link-public-storefront"><Store size={15} aria-hidden="true" /> Vetrina pubblica</a>
        </div>
      </header>

      <main id="main-content" className="login-main">
        <section className="login-pitch" aria-labelledby="login-title">
          <div className="eyebrow"><span className="eyebrow-line" /> Accesso demo / 2026</div>
          <h1 id="login-title">Entra con il tuo ruolo.<br /><em>Vedi solo quello che ti spetta.</em></h1>
          <p>Sette utenze dimostrative, una per ruolo. Ognuna apre la propria area: il portale del cliente, il developer portal oppure la console Postel.</p>
          <ul className="login-points">
            <li><b>Cliente</b><span>Legale rappresentante e delegati amministrativo, operativo, tecnico</span></li>
            <li><b>Postel</b><span>Commerciale, Operations, Controllo di gestione</span></li>
            <li><b>Senza accesso</b><span>La vetrina dei servizi e la richiesta di attivazione restano pubbliche</span></li>
          </ul>
        </section>

        <section className="login-panel" aria-label="Accesso">
          {notice && <p className="login-notice" role="status" data-testid="status-login-notice"><Info size={16} aria-hidden="true" /> <span>{notice}</span></p>}

          {role ? (
            <div className="login-card" data-testid="card-active-session">
              <h2>Sessione demo attiva</h2>
              <p className="login-sub">Sei dentro come <strong data-testid="text-current-role">{auth.ROLES[role].label}</strong> · {auth.ROLES[role].area}.</p>
              <div className="login-session-actions">
                <a className="login-submit" href={auth.urls.page(auth.destinationAfterLogin(role, setup, next))} data-testid="link-continue">Continua nella tua area <ArrowRight size={16} aria-hidden="true" /></a>
                <a className="login-secondary" href={auth.urls.workspace()} data-testid="link-workspace">Workspace <ArrowUpRight size={15} aria-hidden="true" /></a>
                <button className="login-secondary" type="button" onClick={logout} data-testid="button-logout"><LogOut size={15} aria-hidden="true" /> Esci</button>
              </div>
              <p className="login-foot">Per entrare con un altro ruolo esci prima da questa sessione.</p>
            </div>
          ) : (
            <form className="login-card" onSubmit={submit} noValidate aria-describedby={error ? 'login-error' : undefined} data-testid="form-login">
              <h2>Accedi</h2>
              <p className="login-sub">{nextPage ? `Per aprire la schermata ${nextPage.code} serve una sessione demo.` : 'Usa una delle credenziali demo.'}</p>
              {error && <p className="login-error" id="login-error" role="alert" data-testid="text-login-error"><CircleAlert size={17} aria-hidden="true" /> <span>{error}</span></p>}
              <label className="login-field" htmlFor="login-user">
                <span>Utente</span>
                <input ref={userRef} id="login-user" name="user" type="text" value={user} onChange={(e) => { setUser(e.target.value); setError(null); }}
                  autoComplete="off" autoCapitalize="characters" autoCorrect="off" spellCheck={false} aria-invalid={error ? true : undefined} data-testid="input-user" />
              </label>
              <div className="login-field">
                <label htmlFor="login-password">Password</label>
                <div className="login-password">
                  <input id="login-password" name="password" type={reveal ? 'text' : 'password'} value={password} onChange={(e) => { setPassword(e.target.value); setError(null); }}
                    autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-invalid={error ? true : undefined} data-testid="input-password" />
                  <button type="button" onClick={() => setReveal((v) => !v)} aria-pressed={reveal} aria-label={reveal ? 'Nascondi la password' : 'Mostra la password'} data-testid="button-toggle-password">
                    {reveal ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  </button>
                </div>
              </div>
              <button className="login-submit" type="submit" data-testid="button-login">Accedi <ArrowRight size={16} aria-hidden="true" /></button>
              <p className="login-foot">Non hai un’utenza? <a href={auth.urls.page('vetrina-V01-catalogo.html')} data-testid="link-storefront">Consulta la vetrina pubblica</a> e richiedi l’attivazione.</p>
            </form>
          )}

          <details className="login-demo" data-testid="details-demo-credentials">
            <summary>Credenziali demo <span>7 ruoli</span></summary>
            <div className="login-demo-body">
              <table>
                <caption className="visually-hidden">Credenziali dimostrative per ruolo</caption>
                <thead><tr><th scope="col">Utente</th><th scope="col">Password</th><th scope="col">Ruolo e destinazione</th><th scope="col"><span className="visually-hidden">Azione</span></th></tr></thead>
                <tbody>
                  {auth.ACCOUNTS.map((a) => (
                    <tr key={a.user}>
                      <td className="mono">{a.user}</td>
                      <td className="mono">{a.password}</td>
                      <td><b>{auth.ROLES[a.role].label}</b><small>{a.role === 'lr' && setup.done ? 'Catalogo e acquisti · H (setup concluso)' : DESTINATION[a.role]}</small></td>
                      <td>{!role && <button type="button" onClick={() => fill(a.user, a.password)} aria-label={`Compila con ${a.user}, ${auth.ROLES[a.role].label}`} data-testid={`button-fill-${a.user.toLowerCase()}`}>Usa</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="login-reset">
                <span>Primo setup del legale rappresentante: <b data-testid="text-setup-state">{setup.done ? 'concluso' : setup.delegates ? 'in corso (PS-02)' : 'da fare'}</b></span>
                <button type="button" onClick={resetSetup} disabled={!setup.done && !setup.delegates} data-testid="button-reset-setup">Ripristina il primo accesso</button>
              </div>
              <div className="login-reset">
                <span>Richieste di modifica e codici di configurazione</span>
                <button type="button" onClick={resetDemoData} data-testid="button-reset-demo-data">Ripristina dati demo</button>
              </div>
            </div>
          </details>

          <p className="login-disclaimer" data-testid="text-demo-disclaimer">
            <strong>Prototipo dimostrativo.</strong> Questo accesso non è un sistema di autenticazione: le credenziali sono fittizie, i controlli avvengono solo in questo browser e tutti i dati mostrati sono di esempio.
          </p>
        </section>
      </main>
    </div>
  );
}
