import { ArrowRight, ShieldCheck } from 'lucide-react';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export default function NotFound() {
  return (
    <div className="hub login">
      <header className="topbar">
        <a className="brand" href={`${BASE}/`} aria-label="Digital Trust Platform, vetrina">
          <span className="brand-mark" aria-hidden="true"><ShieldCheck size={21} strokeWidth={1.8} /></span>
          <span className="brand-copy"><strong>postel</strong><small>Digital Trust Platform</small></span>
        </a>
      </header>
      <main className="login-main login-main-single">
        <section className="login-panel">
          <div className="login-card" data-testid="card-not-found">
            <h1 className="login-h1">Pagina non trovata</h1>
            <p className="login-sub">L’indirizzo non corrisponde a nessuna schermata del prototipo.</p>
            <div className="login-session-actions">
              <a className="login-submit" href={`${BASE}/mockups/vetrina-V01-catalogo.html`} data-testid="link-storefront">Vetrina pubblica <ArrowRight size={16} aria-hidden="true" /></a>
              <a className="login-secondary" href={`${BASE}/accesso`} data-testid="link-back-login">Vai all’accesso</a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
