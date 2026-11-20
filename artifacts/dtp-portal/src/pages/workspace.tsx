import { type ComponentPropsWithoutRef, createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  CircleHelp,
  Code,
  Command,
  FileChartColumnIncreasing,
  FileSignature,
  FileText,
  Fingerprint,
  Gauge,
  Headset,
  Layers3,
  LifeBuoy,
  Lock,
  LogOut,
  Search,
  ShieldCheck,
  Store,
  SlidersHorizontal,
  UserCheck,
  UsersRound,
} from 'lucide-react';
import { type DemoSession, demoAuth, useDemoSession } from '@/lib/demo-auth';

type Group = 'all' | 'storefront' | 'client' | 'technical' | 'postel';

const SessionContext = createContext<DemoSession>({ role: null, setup: { delegates: false, done: false, deferred: [] } });

/* Collegamento a una schermata: se il ruolo della sessione non può aprirla diventa un'etichetta non attivabile,
   con il motivo leggibile anche dagli screen reader. Le pagine applicano comunque la stessa regola all'ingresso. */
/* "query" apre la schermata su un esempio (es. la scheda V-04 di un servizio); i permessi dipendono solo dal file. */
function GuardedLink({ file, query, className, children, ...rest }: { file: string; query?: string } & Omit<ComponentPropsWithoutRef<'a'>, 'href'>) {
  const auth = demoAuth();
  const { role, setup } = useContext(SessionContext);
  const decision = auth.decide(file, role, setup);
  if (decision.allow) return <a className={className} href={auth.urls.page(file) + (query ?? '')} {...rest}>{children}</a>;
  const reason = auth.reasonText(decision.reason, role);
  return (
    <span className={`${className ?? ''} is-locked`.trim()} aria-disabled="true" title={reason} data-locked={decision.reason} data-testid={rest['data-testid' as keyof typeof rest] as string | undefined}>
      {children}
      <span className="visually-hidden"> — non disponibile. {reason}</span>
    </span>
  );
}

export default function Workspace() {
  const auth = demoAuth();
  const [session] = useDemoSession();
  const { role, setup } = session;
  const [onlyMine, setOnlyMine] = useState(false);
  useEffect(() => { document.title = 'Workspace – Digital Trust Platform'; }, []);
  /* Senza sessione demo il Workspace non si apre: si torna al login (vale anche per il tasto Indietro). */
  useEffect(() => { if (!role) window.location.replace(auth.urls.login()); }, [role, auth]);
  const [query, setQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState<Group>('all');
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey &&
          target?.tagName !== 'INPUT' && target?.tagName !== 'TEXTAREA' && !target?.isContentEditable) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const catalog = [
    { code: 'V-01', name: 'Vetrina pubblica dei servizi', detail: 'Pagina iniziale · consulta i servizi, poi acquista o contatta un consulente', group: 'storefront', file: 'vetrina-V01-catalogo.html', icon: Store, tag: 'Vetrina' },
    { code: 'V-02', name: 'Richiesta di attivazione', detail: 'Dati, catalogo e carrello, contratto firmato e attesa verifica', group: 'storefront', file: 'vetrina-V02-contratto.html', icon: FileSignature, tag: 'Attivazione' },
    { code: 'V-03', name: 'Subentro del legale rappresentante', detail: 'Il nuovo legale rappresentante subentra con invito o dall’area pubblica, firma e verifiche', group: 'storefront', file: 'vetrina-V03-subentro.html', icon: UserCheck, tag: 'Subentro' },
    { code: 'V-04', name: 'Scheda del servizio', detail: 'Caratteristiche, prezzi, video, domande frequenti e documentazione; «Acquista» con il servizio nel carrello', group: 'storefront', file: 'vetrina-V04-servizio.html', query: '?servizio=cert', icon: BookOpen, tag: 'Servizio' },
    { code: 'V-05', name: 'Contatta un consulente', detail: 'Richiesta di contatto con i servizi di interesse, informativa e conferma', group: 'storefront', file: 'vetrina-V05-consulente.html', icon: Headset, tag: 'Contatto' },
    { code: 'H', name: 'Catalogo e acquisti', detail: 'Home cliente · offerte, ordini e consumi', group: 'client', file: 'cliente-H-catalogo.html', icon: Layers3, tag: 'Ingresso' },
    { code: 'U', name: 'Utenze e deleghe', detail: 'Accessi, poteri e registro attività', group: 'client', file: 'cliente-U-utenze.html', icon: UsersRound, tag: 'Accessi' },
    { code: 'M1', name: 'Contratto e consumi', detail: 'Panoramica · servizi, soglie e trend', group: 'client', file: 'cliente-M1-panoramica.html', icon: Gauge, tag: 'Contratto' },
    { code: 'M2', name: 'Dettaglio servizio', detail: 'Ritmo, proiezioni e copertura', group: 'client', file: 'cliente-M2-dettaglio.html', icon: FileChartColumnIncreasing, tag: 'Contratto' },
    { code: 'M3', name: 'Qualità dei processi', detail: 'Funnel, firma, SDI e disponibilità', group: 'client', file: 'cliente-M3-qualita.html', icon: Check, tag: 'Contratto' },
    { code: 'M4', name: 'Fatture', detail: 'Fatture emesse e dettaglio overage', group: 'client', file: 'cliente-M4-fatture.html', icon: FileText, tag: 'Contratto' },
    { code: 'M5', name: 'Contratto', detail: 'Rinnovo, modifiche dell’offerta, recesso e documenti', group: 'client', file: 'cliente-M5-contratto.html', icon: FileSignature, tag: 'Contratto' },
    { code: 'A', name: 'Assistenza', detail: 'Guide, stato dei servizi e richieste', group: 'client', file: 'cliente-A-assistenza.html', icon: LifeBuoy, tag: 'Supporto' },
    { code: 'N', name: 'Notifiche', detail: 'Centro notifiche, canali ed esiti di consegna', group: 'client', file: 'cliente-N-notifiche.html', icon: Bell, tag: 'Avvisi' },
    { code: 'PS-01', name: 'Delegati', detail: 'Primo setup · persone e responsabilità', group: 'client', file: 'cliente-PS01-delegati.html', icon: UsersRound, tag: 'Setup' },
    { code: 'PS-02', name: 'Soglie e notifiche', detail: 'Primo setup · avvisi e preferenze', group: 'client', file: 'cliente-PS02-soglie.html', icon: SlidersHorizontal, tag: 'Setup' },
    { code: 'D0', name: 'Home tecnica e catalogo API', detail: 'Developer portal · sandbox, collaudi e credenziali', group: 'technical', file: 'tecnico-D0-developer-portal.html', icon: Code, tag: 'Developer' },
    { code: 'O1', name: 'Executive overview', detail: 'KPI, ricavi e saturazione per servizio e settore', group: 'postel', file: 'postel-O1-executive.html', icon: Gauge, tag: 'Direzione' },
    { code: 'O2', name: 'Portafoglio e contratti', detail: 'Segmenti, rinnovi e lista di lavoro', group: 'postel', file: 'postel-O2-portafoglio.html', icon: BriefcaseBusiness, tag: 'Clienti' },
    { code: 'O3', name: 'Operations e SLA', detail: 'Volumi, qualità servizio e ticket', group: 'postel', file: 'postel-O3-operations.html', icon: SlidersHorizontal, tag: 'Operations' },
    { code: 'O4', name: 'Ricavi, costi e marginalità', detail: 'Margini per servizio e ciclo passivo', group: 'postel', file: 'postel-O4-marginalita.html', icon: FileChartColumnIncreasing, tag: 'Finanza' },
    { code: 'O5', name: 'Scheda cliente 360°', detail: 'Vista Postel del cliente, in sola lettura', group: 'postel', file: 'postel-O5-scheda-cliente.html', icon: Fingerprint, tag: 'Clienti' },
  ] as const;
  const filters: { id: Group; label: string; count: string }[] = [
    { id: 'all', label: 'Tutte', count: '22' },
    { id: 'storefront', label: 'Vetrina', count: '05' },
    { id: 'client', label: 'Cliente', count: '11' },
    { id: 'technical', label: 'Tecnico', count: '01' },
    { id: 'postel', label: 'Postel', count: '05' },
  ];
  const visibleCatalog = useMemo(() => catalog.filter((item) => {
    const matchesGroup = (activeGroup === 'all' || item.group === activeGroup) && (!onlyMine || auth.decide(item.file, role, setup).allow);
    const needle = query.trim().toLocaleLowerCase('it');
    return matchesGroup && (!needle || `${item.code} ${item.name} ${item.detail} ${item.tag}`.toLocaleLowerCase('it').includes(needle));
  }), [activeGroup, query, onlyMine, role, setup, auth]);

  if (!role) return null;
  const me = auth.ROLES[role];
  const inSetup = role === 'lr' && !setup.done;
  const logout = () => { auth.logout({ navigate: false }); window.location.replace(auth.urls.login()); };

  return (
    <SessionContext.Provider value={session}>
    <div className="hub">
      <a className="skip-link" href="#main-content">Vai ai contenuti</a>
      <header className="topbar">
        <a className="brand" href={auth.urls.workspace()} aria-label="Digital Trust Platform, Workspace">
          <span className="brand-mark" aria-hidden="true"><ShieldCheck size={21} strokeWidth={1.8} /></span>
          <span className="brand-copy"><strong>postel</strong><small>Digital Trust Platform</small></span>
        </a>
        <div className="topbar-right">
          <a className="top-link top-link-quiet" href="#screen-library">Schermate <ArrowDownRight size={15} aria-hidden="true" /></a>
          <span className="session-chip"><small>Accesso demo</small><b data-testid="text-current-role">{me.label}</b></span>
          <button className="top-link" type="button" onClick={logout} data-testid="button-logout"><LogOut size={15} aria-hidden="true" /> Esci</button>
        </div>
      </header>

      <main id="main-content">
        <section className="intro section-wrap" aria-labelledby="page-title">
          <div className="intro-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> Workspace / 2026</div>
            <h1 id="page-title">Una piattaforma.<br /><em>Ogni ruolo, il suo ingresso.</em></h1>
            <p className="intro-role" data-testid="text-session-summary">Sei dentro come <strong>{me.label}</strong>. {inSetup ? 'Fino alla conclusione del primo setup restano aperti solo PS-01, PS-02 e la vetrina.' : 'Le schermate riservate ad altri ruoli sono indicate con un lucchetto.'}</p>
            <p className="intro-lead">Un accesso ordinato alle esperienze Digital Trust: dalla vetrina e dall’acquisto al portale self-service del cliente, dal developer portal del delegato tecnico agli strumenti quotidiani del team Postel.</p>
            <div className="intro-actions">
              <a className="button button-primary" href={auth.urls.page(auth.homeFor(role, setup))} data-testid="link-my-area">{inSetup ? 'Completa il primo setup' : `Apri la tua area · ${me.area}`} <ArrowRight size={16} /></a>
              <GuardedLink className="button button-quiet" file="vetrina-V01-catalogo.html">Vetrina pubblica <ArrowUpRight size={15} /></GuardedLink>
            </div>
          </div>
          <div className="intro-aside" aria-label="Riepilogo del prototipo">
            <div className="aside-topline"><span>Indice schermate</span><span className="mono">DTP / 01—22</span></div>
            <div className="big-count">22<span>pagine navigabili</span></div>
            <div className="aside-rule" />
            <div className="aside-meta">
              <span><b>05</b> vetrina</span><span><b>11</b> cliente</span><span><b>01</b> tecnico</span><span><b>05</b> Postel</span>
            </div>
            <div className="aside-foot"><span className="mini-shield"><ShieldCheck size={14} /></span> Le schermate originali restano la fonte di verità</div>
          </div>
        </section>

        <section className="flow-section section-wrap" aria-labelledby="flows-heading">
          <div className="section-heading">
            <div><div className="eyebrow">Mappa del prodotto</div><h2 id="flows-heading">Segui il percorso, non solo la pagina.</h2></div>
            <p>Le viste si tengono insieme: dalla vetrina all’acquisto, dal setup del cliente fino alla lettura operativa e alla vista completa in Postel.</p>
          </div>
          <div className="flow-grid">
            <article className="flow-card flow-setup">
              <div className="flow-card-head"><span className="flow-number">01</span><span className="flow-type">Acquisto e avvio</span><span className="flow-icon"><SlidersHorizontal size={17} /></span></div>
              <h3>Consulta, scegli e richiedi l’attivazione.</h3>
              <p>Esplora la vetrina senza acquistare. In V-02 inserisci i dati, scegli i servizi e alleghi il contratto firmato. Verifica dell’identità e accesso avvengono solo dopo l’invio e la conferma via email.</p>
              <div className="setup-track">
                <div className="setup-sequence"><GuardedLink file="vetrina-V01-catalogo.html"><b>V-01</b><span>Vetrina</span></GuardedLink><span className="sequence-arrow"><ArrowRight size={14} /></span><GuardedLink file="vetrina-V02-contratto.html"><b>V-02</b><span>Dati e acquisto</span></GuardedLink><span className="sequence-arrow"><ArrowRight size={14} /></span><div><b>Verifica</b><span>Attesa email</span></div></div>
                <p>Dopo l’attivazione, al primo login del Rappresentante Legale:</p>
                <div className="setup-sequence" aria-label="Setup al primo accesso del Rappresentante Legale"><GuardedLink file="cliente-PS01-delegati.html"><b>PS-01</b><span>Delegati</span></GuardedLink><span className="sequence-arrow"><ArrowRight size={14} /></span><GuardedLink file="cliente-PS02-soglie.html"><b>PS-02</b><span>Soglie e notifiche</span></GuardedLink><span className="sequence-arrow"><ArrowRight size={14} /></span><GuardedLink file="cliente-H-catalogo.html"><b>H</b><span>Home cliente</span></GuardedLink></div>
              </div>
              <GuardedLink className="flow-cta" file="vetrina-V01-catalogo.html">Apri il percorso di acquisto <ChevronRight size={16} /></GuardedLink>
            </article>
            <article className="flow-card flow-client">
              <div className="flow-card-head"><span className="flow-number">02</span><span className="flow-type">Esperienza cliente</span><span className="flow-icon"><UsersRound size={17} /></span></div>
              <h3>Self-service, dal catalogo al dettaglio</h3>
              <p>Dal catalogo H il cliente passa a U per utenze e deleghe, poi consulta consumi, qualità, fatture e contratto, con assistenza e notifiche sempre a portata.</p>
              <div className="flow-track" aria-label="H Catalogo, U Utenze e deleghe, M1 Panoramica, poi M2 Dettaglio, M3 Qualità, M4 Fatture e M5 Contratto">
                <GuardedLink file="cliente-H-catalogo.html" className="track-node"><b>H</b><span>Catalogo</span></GuardedLink><span className="track-line" />
                <GuardedLink file="cliente-U-utenze.html" className="track-node"><b>U</b><span>Utenze e deleghe</span></GuardedLink><span className="track-line" />
                <GuardedLink file="cliente-M1-panoramica.html" className="track-node"><b>M1</b><span>Panoramica</span></GuardedLink><span className="track-line" />
                <span className="track-branch" aria-hidden="true"><i /><i /><i /><i /></span>
                <div className="track-endpoints"><GuardedLink file="cliente-M2-dettaglio.html"><b>M2</b><span>Dettaglio</span></GuardedLink><GuardedLink file="cliente-M3-qualita.html"><b>M3</b><span>Qualità</span></GuardedLink><GuardedLink file="cliente-M4-fatture.html"><b>M4</b><span>Fatture</span></GuardedLink><GuardedLink file="cliente-M5-contratto.html"><b>M5</b><span>Contratto</span></GuardedLink></div>
              </div>
              <GuardedLink className="flow-cta" file="cliente-H-catalogo.html">Apri il percorso cliente <ChevronRight size={16} /></GuardedLink>
            </article>
            <article className="flow-card flow-postel">
              <div className="flow-card-head"><span className="flow-number">03</span><span className="flow-type">Strumenti Postel</span><span className="flow-icon"><BriefcaseBusiness size={17} /></span></div>
              <h3>Dalla lettura d’insieme al singolo cliente.</h3>
              <p>La console attraversa le cinque viste, dal quadro direzionale fino al dettaglio del singolo cliente.</p>
              <div className="postel-track" aria-label="O1 Executive, O2 Portafoglio, O3 Operations, O4 Finanza, O5 Cliente 360">
                <GuardedLink className="track-node" file="postel-O1-executive.html"><b>O1</b><span>Executive</span></GuardedLink><span className="track-line" />
                <GuardedLink className="track-node" file="postel-O2-portafoglio.html"><b>O2</b><span>Portafoglio</span></GuardedLink><span className="track-line" />
                <GuardedLink className="track-node" file="postel-O3-operations.html"><b>O3</b><span>Operations</span></GuardedLink><span className="track-line" />
                <GuardedLink className="track-node" file="postel-O4-marginalita.html"><b>O4</b><span>Finanza</span></GuardedLink><span className="track-line" />
                <GuardedLink className="track-node" file="postel-O5-scheda-cliente.html"><b>O5</b><span>Cliente 360°</span></GuardedLink>
              </div>
              <GuardedLink className="flow-cta" file="postel-O1-executive.html">Apri la console Postel <ChevronRight size={16} /></GuardedLink>
            </article>
          </div>
          <div className="bridge-note"><span className="bridge-icon"><ArrowRight size={16} /></span><p><strong>Una vista condivisa:</strong> O5 mostra a Postel gli stessi dati del cliente in sola lettura; il portale del cliente resta riservato alle sue utenze.</p><GuardedLink file="postel-O5-scheda-cliente.html">Apri O5 <ArrowUpRight size={14} /></GuardedLink></div>
          <div className="bridge-note bridge-dev"><span className="bridge-icon"><Code size={16} /></span><p><strong>Ingresso tecnico:</strong> il delegato tecnico entra dal developer portal D0 per sandbox, collaudi, catalogo API e credenziali.</p><GuardedLink file="tecnico-D0-developer-portal.html" data-testid="link-developer-entry">Apri D0 <ArrowUpRight size={14} /></GuardedLink></div>
        </section>

        <section className="library-section" id="screen-library" aria-labelledby="library-title">
          <div className="section-wrap">
            <div className="library-top">
              <div><div className="eyebrow">Libreria schermate <span className="count-pill">22</span></div><h2 id="library-title">Apri una vista specifica.</h2><p>Ogni link porta al mockup HTML originale. Si aprono le schermate previste per il tuo ruolo.</p></div>
              <label className="search-box"><Search size={17} aria-hidden="true" /><span className="visually-hidden">Cerca schermata</span><input ref={searchRef} type="search" placeholder="Cerca una schermata…" value={query} onChange={(event) => setQuery(event.target.value)} data-testid="input-search-pages" /><kbd aria-hidden="true">/</kbd></label>
            </div>
            <div className="library-controls">
              <div className="filter-tabs" role="group" aria-label="Filtra le schermate">
                {filters.map((f) => (
                  <button key={f.id} type="button" className={activeGroup === f.id ? 'selected' : ''} aria-pressed={activeGroup === f.id} onClick={() => setActiveGroup(f.id)} data-testid={`filter-${f.id}`}>{f.label} <span>{f.count}</span></button>
                ))}
              </div>
              <button type="button" className={`mine-toggle ${onlyMine ? 'selected' : ''}`} aria-pressed={onlyMine} onClick={() => setOnlyMine((v) => !v)} data-testid="toggle-only-mine">Solo quelle del mio ruolo</button>
              <span className="results-count">{visibleCatalog.length} {visibleCatalog.length === 1 ? 'schermata' : 'schermate'}</span>
            </div>
            {visibleCatalog.length > 0 ? (
              <div className="screen-grid">
                {visibleCatalog.map((item) => {
                  const Icon = item.icon;
                  const open = auth.decide(item.file, role, setup).allow;
                  return (
                    <GuardedLink className={`screen-card ${item.group === 'postel' ? 'postel-card' : item.group === 'storefront' ? 'store-card' : item.group === 'technical' ? 'tech-card' : ''}`} file={item.file} query={'query' in item ? item.query : undefined} key={item.code} data-testid={`link-screen-${item.code.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
                      <div className="screen-card-top"><span className="screen-code">{item.code}</span><span className="screen-tag">{item.tag}</span></div>
                      <div className="screen-icon"><Icon size={18} strokeWidth={1.8} /></div>
                      <h3>{item.name}</h3><p>{item.detail}</p>
                      <span className="screen-open">{open ? <>Apri schermata <ArrowUpRight size={15} /></> : <><Lock size={13} aria-hidden="true" /> Riservata ad altri ruoli</>}</span>
                    </GuardedLink>
                  );
                })}
              </div>
            ) : (
              <div className="empty-search" role="status"><Search size={22} /><strong>Nessun risultato</strong><span>Prova con un codice o un’altra parola.</span><button type="button" onClick={() => { setQuery(''); setActiveGroup('all'); setOnlyMine(false); }}>Mostra tutte le schermate</button></div>
            )}
          </div>
        </section>

        <section className="principles section-wrap" aria-label="Note sul prototipo">
          <div className="principle"><span className="principle-symbol"><ShieldCheck size={18} /></span><div><b>Accesso dimostrativo</b><p>Il ruolo della sessione decide cosa si apre. È una simulazione nel browser, non un controllo di sicurezza.</p></div></div>
          <div className="principle"><span className="principle-symbol"><BookOpen size={18} /></span><div><b>Solo dati dimostrativi</b><p>Persone, aziende e metriche sono esempi inventati.</p></div></div>
          <div className="principle"><span className="principle-symbol"><CircleHelp size={18} /></span><div><b>Hub di navigazione</b><p>Questo indice orienta; non sostituisce le schermate originali.</p></div></div>
        </section>
      </main>
      <footer className="footer"><div className="section-wrap footer-inner"><span>postel <i>·</i> Digital Trust Platform</span><span><Command size={13} /> Prototype hub <b>·</b> dati di esempio</span><a href="#main-content">Torna all’inizio <ArrowUpRight size={13} /></a></div></footer>
    </div>
    </SessionContext.Provider>
  );
}
