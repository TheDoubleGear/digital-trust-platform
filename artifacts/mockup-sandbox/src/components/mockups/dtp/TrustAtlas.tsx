import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  CircleHelp,
  Command,
  FileChartColumnIncreasing,
  FileText,
  Fingerprint,
  Gauge,
  Layers3,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UsersRound,
} from "lucide-react";
import "./trustatlas.css";

const screens = [
  { code: "H", name: "Catalogo e acquisti", detail: "Home cliente · offerte, ordini e consumi", group: "client", href: "/mockups/cliente-H-catalogo.html", icon: Layers3, tag: "Ingresso" },
  { code: "U", name: "Utenze e deleghe", detail: "Accessi, poteri e registro attività", group: "client", href: "/mockups/cliente-U-utenze.html", icon: UsersRound, tag: "Accessi" },
  { code: "M1", name: "Contratto e consumi", detail: "Panoramica · servizi, soglie e trend", group: "client", href: "/mockups/cliente-M1-panoramica.html", icon: Gauge, tag: "Contratto" },
  { code: "M2", name: "Dettaglio servizio", detail: "Ritmo, proiezioni e copertura", group: "client", href: "/mockups/cliente-M2-dettaglio.html", icon: FileChartColumnIncreasing, tag: "Contratto" },
  { code: "M3", name: "Qualità dei processi", detail: "Funnel, firma, SDI e disponibilità", group: "client", href: "/mockups/cliente-M3-qualita.html", icon: Check, tag: "Contratto" },
  { code: "M4", name: "Fatture", detail: "Fatture emesse e dettaglio overage", group: "client", href: "/mockups/cliente-M4-fatture.html", icon: FileText, tag: "Contratto" },
  { code: "PS-01", name: "Delegati", detail: "Primo setup · persone e responsabilità", group: "client", href: "/mockups/cliente-PS01-delegati.html", icon: UsersRound, tag: "Setup" },
  { code: "PS-02", name: "Soglie e notifiche", detail: "Primo setup · avvisi e preferenze", group: "client", href: "/mockups/cliente-PS02-soglie.html", icon: SlidersHorizontal, tag: "Setup" },
  { code: "O1", name: "Executive overview", detail: "KPI, ricavi e saturazione bundle", group: "postel", href: "/mockups/postel-O1-executive.html", icon: Gauge, tag: "Direzione" },
  { code: "O2", name: "Portafoglio e contratti", detail: "Segmenti, rinnovi e lista di lavoro", group: "postel", href: "/mockups/postel-O2-portafoglio.html", icon: BriefcaseBusiness, tag: "Clienti" },
  { code: "O3", name: "Operations e SLA", detail: "Volumi, qualità servizio e ticket", group: "postel", href: "/mockups/postel-O3-operations.html", icon: SlidersHorizontal, tag: "Operations" },
  { code: "O4", name: "Ricavi, costi e marginalità", detail: "Margini per servizio e ciclo passivo", group: "postel", href: "/mockups/postel-O4-marginalita.html", icon: FileChartColumnIncreasing, tag: "Finanza" },
  { code: "O5", name: "Scheda cliente 360°", detail: "Vista Postel del cliente e link al portale", group: "postel", href: "/mockups/postel-O5-scheda-cliente.html", icon: Fingerprint, tag: "Clienti" },
] as const;

function TrustAtlas() {
  const [filter, setFilter] = useState<"all" | "client" | "postel">("all");
  const [query, setQuery] = useState("");
  const visibleScreens = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("it");
    return screens.filter((screen) => {
      const inGroup = filter === "all" || screen.group === filter;
      const inSearch = !needle || `${screen.code} ${screen.name} ${screen.detail}`.toLocaleLowerCase("it").includes(needle);
      return inGroup && inSearch;
    });
  }, [filter, query]);

  return (
    <div className="trust-atlas">
      <a className="ta-skip" href="#ta-main">Salta ai contenuti</a>
      <header className="ta-topbar">
        <a className="ta-brand" href="/" aria-label="Postel Digital Trust Platform">
          <span className="ta-brand-mark"><ShieldCheck size={20} strokeWidth={1.8} /></span>
          <span><strong>postel</strong><small>Digital Trust Platform</small></span>
        </a>
        <div className="ta-topbar-right"><span className="ta-status"><i /> AREA PROTOTIPO</span><a href="#ta-library">Indice schermate <ArrowDownRight size={14} /></a></div>
      </header>

      <main id="ta-main">
        <section className="ta-intro ta-wrap">
          <div className="ta-intro-copy">
            <div className="ta-kicker"><span /> WORKSPACE · 2026</div>
            <h1>Una piattaforma.<br /><em>Due prospettive.</em></h1>
            <p className="ta-lead">Un accesso ordinato alle esperienze Digital Trust: il portale self-service del cliente e gli strumenti quotidiani del team Postel.</p>
            <div className="ta-actions">
              <a className="ta-button ta-primary" href="/mockups/cliente-H-catalogo.html">Apri il portale cliente <ArrowRight size={15} /></a>
              <a className="ta-button ta-secondary" href="/mockups/postel-O1-executive.html">Vai alla console Postel <ArrowUpRight size={14} /></a>
            </div>
          </div>
          <aside className="ta-index-card">
            <div className="ta-index-top"><span>REPERTORIO DIGITALE</span><span>01—13</span></div>
            <div className="ta-count">13<span>schermate navigabili</span></div>
            <div className="ta-index-rule" />
            <div className="ta-index-groups"><span><b>08</b> area cliente</span><span><b>05</b> area Postel</span></div>
            <div className="ta-index-note"><ShieldCheck size={14} /> Le schermate originali restano la fonte di verità</div>
            <span className="ta-index-stamp">DTP / INDEX</span>
          </aside>
          <div className="ta-section-no">01 / 13</div>
        </section>

        <section className="ta-flows ta-wrap">
          <div className="ta-section-head">
            <div><div className="ta-kicker">MAPPA DEL PRODOTTO</div><h2>Segui il percorso,<br />non solo la pagina.</h2></div>
            <p>Le viste si tengono insieme: dall’ingresso del cliente fino alla lettura operativa e alla vista completa in Postel.</p>
          </div>
          <div className="ta-flow-grid">
            <article className="ta-flow-card ta-client">
              <div className="ta-flow-heading"><span className="ta-flow-no">01</span><span>ESPERIENZA CLIENTE</span><UsersRound size={17} /></div>
              <h3>Self-service, dal catalogo al dettaglio</h3><p>Il cliente entra dalla home, governa il contratto e approfondisce consumi, processi e fatture.</p>
              <div className="ta-track"><a className="ta-node" href="/mockups/cliente-H-catalogo.html"><b>H</b><span>Catalogo</span></a><i className="ta-track-line" /><a className="ta-node" href="/mockups/cliente-M1-panoramica.html"><b>M1</b><span>Panoramica</span></a><i className="ta-track-fork"><u /><u /><u /></i><div className="ta-endpoints"><a href="/mockups/cliente-M2-dettaglio.html"><b>M2</b> Dettaglio</a><a href="/mockups/cliente-M3-qualita.html"><b>M3</b> Qualità</a><a href="/mockups/cliente-M4-fatture.html"><b>M4</b> Fatture</a></div></div>
              <a className="ta-flow-link" href="/mockups/cliente-H-catalogo.html">Apri il percorso cliente <ChevronRight size={15} /></a>
            </article>
            <article className="ta-flow-card ta-setup">
              <div className="ta-flow-heading"><span className="ta-flow-no">02</span><span>ACCESSI E AVVIO</span><SlidersHorizontal size={17} /></div>
              <h3>Prima le persone.<br />Poi le regole.</h3><p>Il legale rappresentante definisce le deleghe e le notifiche prima di arrivare alla home.</p>
              <a className="ta-setup-side" href="/mockups/cliente-U-utenze.html"><UsersRound size={15} /><span><b>U</b> Gestione accessi</span></a>
              <div className="ta-sequence"><a href="/mockups/cliente-PS01-delegati.html"><b>PS-01</b><span>Delegati</span></a><ArrowRight size={14} /><a href="/mockups/cliente-PS02-soglie.html"><b>PS-02</b><span>Soglie</span></a><ArrowRight size={14} /><a href="/mockups/cliente-H-catalogo.html"><b>H</b><span>Home</span></a></div>
              <a className="ta-flow-link" href="/mockups/cliente-PS01-delegati.html">Apri il setup iniziale <ChevronRight size={15} /></a>
            </article>
            <article className="ta-flow-card ta-postel">
              <div className="ta-flow-heading"><span className="ta-flow-no">03</span><span>STRUMENTI POSTEL</span><BriefcaseBusiness size={17} /></div>
              <h3>Dalla lettura d’insieme<br />al singolo cliente.</h3><p>La console collega quadro direzionale, portafoglio e scheda cliente. Operations e finanza completano il quadro.</p>
              <div className="ta-postel-track"><a className="ta-node" href="/mockups/postel-O1-executive.html"><b>O1</b><span>Executive</span></a><i className="ta-track-line" /><a className="ta-node" href="/mockups/postel-O2-portafoglio.html"><b>O2</b><span>Portafoglio</span></a><i className="ta-track-line" /><a className="ta-node ta-current" href="/mockups/postel-O5-scheda-cliente.html"><b>O5</b><span>Cliente 360°</span></a><div className="ta-aside-links"><a href="/mockups/postel-O3-operations.html">O3 <span>Operations</span><ArrowUpRight size={12} /></a><a href="/mockups/postel-O4-marginalita.html">O4 <span>Finanza</span><ArrowUpRight size={12} /></a></div></div>
              <a className="ta-flow-link" href="/mockups/postel-O1-executive.html">Apri la console Postel <ChevronRight size={15} /></a>
            </article>
          </div>
          <div className="ta-bridge"><span className="ta-bridge-symbol"><ArrowRight size={15} /></span><p><b>Una vista condivisa.</b> Da O5 si apre direttamente la panoramica M1 del cliente, in sola lettura.</p><a href="/mockups/postel-O5-scheda-cliente.html">Apri O5 <ArrowUpRight size={13} /></a></div>
        </section>

        <section className="ta-library" id="ta-library">
          <div className="ta-wrap">
            <div className="ta-library-head"><div><div className="ta-kicker">LIBRERIA SCHERMATE <span className="ta-pill">13</span></div><h2>Apri una vista specifica.</h2><p>Ogni link porta al mockup HTML originale, senza copie intermedie.</p></div><label className="ta-search"><Search size={16} /><span className="ta-visually-hidden">Cerca schermata</span><input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Cerca una schermata…" /><kbd>/</kbd></label></div>
            <div className="ta-library-controls"><div className="ta-tabs" role="group" aria-label="Filtra le schermate">
              <button type="button" className={filter === "all" ? "is-selected" : ""} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>Tutte <span>13</span></button>
              <button type="button" className={filter === "client" ? "is-selected" : ""} aria-pressed={filter === "client"} onClick={() => setFilter("client")}>Cliente <span>08</span></button>
              <button type="button" className={filter === "postel" ? "is-selected" : ""} aria-pressed={filter === "postel"} onClick={() => setFilter("postel")}>Postel <span>05</span></button>
            </div><span className="ta-result-count">{visibleScreens.length} {visibleScreens.length === 1 ? "schermata" : "schermate"}</span></div>
            {visibleScreens.length > 0 ? <div className="ta-screen-grid">{visibleScreens.map((screen) => {
              const Icon = screen.icon;
              return <a className={`ta-screen-card ${screen.group === "postel" ? "is-postel" : ""}`} href={screen.href} key={screen.code}>
                <span className="ta-card-meta"><b>{screen.code}</b><i>{screen.tag}</i></span><Icon className="ta-screen-icon" size={18} strokeWidth={1.8} />
                <strong>{screen.name}</strong><span className="ta-card-detail">{screen.detail}</span><span className="ta-card-open">Apri schermata <ArrowUpRight size={14} /></span>
              </a>;
            })}</div> : <div className="ta-empty"><Search size={21} /><b>Nessun risultato</b><span>Prova con un codice o un’altra parola.</span><button type="button" onClick={() => { setQuery(""); setFilter("all"); }}>Mostra tutte le schermate</button></div>}
          </div>
        </section>

        <section className="ta-principles ta-wrap" aria-label="Note sul prototipo">
          <div><span><ShieldCheck size={17} /></span><p><b>Accesso diretto</b><small>Le destinazioni sono link alle pagine HTML indipendenti.</small></p></div>
          <div><span><BookOpen size={17} /></span><p><b>Solo dati dimostrativi</b><small>Persone, aziende e metriche sono esempi inventati.</small></p></div>
          <div><span><CircleHelp size={17} /></span><p><b>Hub di navigazione</b><small>Questo indice orienta; non sostituisce le schermate originali.</small></p></div>
        </section>
      </main>
      <footer className="ta-footer"><div className="ta-wrap"><span>postel <i>·</i> Digital Trust Platform</span><span><Command size={12} /> AREA PROTOTIPO <b>·</b> DATI DI ESEMPIO</span><a href="#ta-main">Torna all’inizio <ArrowUpRight size={12} /></a></div></footer>
    </div>
  );
}

export default TrustAtlas;
