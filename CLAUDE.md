# Digital Trust Platform · Postel — istruzioni per Claude

Prototipo navigabile in italiano della Digital Trust Platform (DTP) dell'ipotetica compagnia Postel:
vetrina pubblica, attivazione, primo setup, portale cliente, developer portal e console operativa Postel.
Tutti i dati mostrati sono di esempio; nessuna integrazione è reale.

Per avvio, comandi, stack e note tecniche dettagliate vedi anche `README.md` e `replit.md`
(quest'ultimo è il file di istruzioni dell'assistente di Replit: va tenuto allineato con questo).

## Regole di lavoro

- Lavora sempre e soltanto sulla versione attuale del progetto. Confronti con versioni precedenti solo se richiesti.
- Questo repository è la fonte di verità del mockup, anche per la grafica. Le modifiche arrivano da Claude Code
  e da Replit, che si sincronizza su GitHub; prima di intervenire recupera l'ultima versione del ramo `main`.
- Interfaccia, testi e documentazione in italiano, con registro professionale.
- I segnaposto come `[DA DEFINIRE]`, `[IBAN POSTEL]` o `[TESTO DA FORNIRE E APPROVARE A CURA DI POSTEL]`
  indicano decisioni ancora aperte: non sostituirli con valori inventati.
- Mantieni ben visibile la dicitura "Prototipo dimostrativo" e non presentare mai il login come un sistema di sicurezza.

## Flusso di lavoro

L'analisi funzionale si svolge in una sessione separata di Claude, che cura i tre documenti di analisi.
Questa sessione di Claude Code implementa sul repository.

| Attività | Chi la svolge |
|---|---|
| Analisi e cambi dei requisiti | Sessione di analisi: aggiorna i documenti e prepara le istruzioni per Claude Code |
| Design di nuove pagine | Sessione di analisi, partendo dallo stile del sito attuale |
| Rielaborazione grafica di pagine esistenti | Claude Code |
| Implementazione di requisiti e nuove pagine | Claude Code, seguendo le istruzioni ricevute |

- La fonte grafica è solo il sito in questo repository: non esistono altre copie del mockup da tenere allineate.
- Non cambiare di tua iniziativa flussi, ruoli, permessi, regole di business o contenuti funzionali: se una richiesta
  li tocca senza istruzioni dalla sessione di analisi, segnalalo prima di procedere.
- Le rielaborazioni grafiche non devono alterare comportamento e contenuti funzionali delle pagine.
- A fine lavoro riepiloga schermate e file modificati, così la sessione di analisi può verificare l'allineamento
  con i documenti.

### Comunicazione tramite GitHub

Le due sessioni non si parlano direttamente: il canale è questo repository.

- **Dall'analisi a Claude Code: issue con etichetta `analisi`.** Quando l'utente scrive "Lavora sulla issue #N",
  leggi la issue (`gh issue view N --comments`) e segui scopo, modifiche per schermata, regole da preservare,
  fuori ambito e criteri di accettazione. Non andare oltre quanto indicato.
- **Dubbi:** se la issue è ambigua o in conflitto con il codice o con queste istruzioni, scrivi un commento sulla
  issue e fermati su quel punto; la risposta arriva nello stesso posto.
- **Da Claude Code all'analisi: pull request.** Ogni modifica al codice, anche solo grafica, va in un ramo dedicato
  e in una pull request verso `main` che compila il modello `.github/pull_request_template.md`.
  Se nasce da una issue, scrivi `Closes #N` nella sezione "Issue collegata".
- **Etichetta `allineato`:** la aggiunge la sessione di analisi dopo aver recepito la pull request nei documenti.
  Non aggiungerla e non toglierla.

## Struttura

- `artifacts/dtp-portal` — applicazione React/Vite.
  - `src/pages/login.tsx`: accesso demo su `/`.
  - `src/pages/workspace.tsx`: indice delle schermate su `/workspace`, richiede una sessione demo.
  - `public/mockups/`: le 19 schermate come pagine HTML indipendenti, più i moduli condivisi
    (`dtp-auth.js`, `dtp-catalogo.js`, `dtp-contract-pdf.js`, `dtp-modifiche.js`, `dtp-theme.css`, `dtp-acquisto.css`).
    `dtp-modifiche.js` tiene le richieste di modifica dell'offerta del cliente di esempio (avvio, approvazione del
    legale rappresentante, firma, controfirma) in `localStorage` `dtp-demo-modifiche`, condivise da H, M5, U, N, O2 e O5.
    Il pulsante "Ripristina dati demo" del login azzera queste richieste e i codici di configurazione (`dtp-demo-config-codes`).
  - `tests/`: test node su accesso demo, PDF del contratto e modifiche dell'offerta.
- `artifacts/api-server`, `lib/db` — scaffolding non usato dalla demo.
- `artifacts/mockup-sandbox` — ambiente di progettazione di Replit.
- `.github/workflows/pages.yml` — pubblicazione su GitHub Pages.

## Schermate

| Gruppo | Codici | File |
|---|---|---|
| Vetrina (pubblica) | V-01 vetrina, V-02 attivazione, V-03 subentro del legale rappresentante | `vetrina-V01-catalogo.html`, `vetrina-V02-contratto.html`, `vetrina-V03-subentro.html` (da integrare, issue #10) |
| Cliente | H, U, M1–M5, A, N | `cliente-*.html` |
| Primo setup | PS-01 delegati, PS-02 soglie e notifiche | `cliente-PS01-delegati.html`, `cliente-PS02-soglie.html` |
| Tecnico | D0 developer portal | `tecnico-D0-developer-portal.html` |
| Console Postel | O1–O5 | `postel-O*.html` |

I nomi dei file non vanno cambiati: le pagine si collegano tra loro con questi nomi e `dtp-auth.js` li usa per i permessi.

## Accesso demo e ruoli

`public/mockups/dtp-auth.js` è l'unica fonte per utenze, permessi per pagina (`PAGES`), destinazioni e controlli.
È usato dalle pagine HTML, dall'app React (tramite `src/lib/demo-auth.ts`) e dai test.

| Utente / password | Ruolo | Destinazione |
|---|---|---|
| LR / LR1 | Legale rappresentante | PS-01 → PS-02 → H al primo accesso, poi H |
| DA / DA1 | Delegato amministrativo | H |
| DO / DO1 | Delegato operativo | H |
| DT / DT1 | Delegato tecnico | D0 |
| C / C1 | Commerciale | O1 |
| O / O1 | Operations | O3 |
| CDG / CDG1 | Controllo di gestione | O4 |

- Il ruolo arriva dalla sessione demo, non da un selettore in pagina.
- Chi non può aprire una pagina viene reindirizzato alla propria area; gli anonimi vanno al login.
- I ruoli Postel non aprono il portale cliente.
- Se cambi i ruoli ammessi in una pagina, aggiorna `PAGES` in `dtp-auth.js`: il test `demo-auth.test.mjs` fallisce se non coincidono.

## Regole di prodotto da preservare

Sono le regole decise dall'analisi. Dove il sito non è ancora allineato, l'allineamento avviene tramite le
issue con etichetta `analisi` aperte: in caso di dubbio prevale la issue.

- Offerta componibile: non esistono bundle predefiniti (Base, Medium, Pro, Enterprise) né ricariche. Il cliente
  sceglie servizi e quantità; il prezzo è calcolato dalla piattaforma come componente variabile, fee di attivazione
  e canone periodico. Ogni variazione è un upgrade o una modifica dell'offerta e del contratto.
- V-01 è in sola consultazione, senza carrello: per ogni servizio caratteristiche, finalità, dipendenze, condizioni
  di utilizzo e approfondimenti o documentazione; collegamento "Attivazione servizio" verso V-02.
- V-02 segue l'ordine: configurazione di servizi e quantità con carrello, con "Genera codice di configurazione" e
  campo per inserire un codice esistente; dati di azienda e legale rappresentante con controlli formali
  all'inserimento; contratto con i soli servizi configurati, firmato fuori dalla pagina e caricato; verifica della
  firma, controfirma Postel, prima fattura pagata fuori dalla piattaforma, abilitazione del tenant e credenziali
  via e-mail solo dopo il pagamento.
- Il primo acquisto è concluso solo dal legale rappresentante. Il commerciale può preparare in V-02, in modalità
  assistita, solo la configurazione di servizi e quantità con uno sconto entro una soglia controllata dal sistema,
  e genera il codice per il legale rappresentante. Il codice contiene solo servizi, quantità e sconto. Lo sconto
  decade se il legale rappresentante modifica la configurazione. Il commerciale non inserisce dati, non carica il
  contratto e non invia la richiesta.
- Modifiche dell'offerta: il delegato amministrativo avvia, il legale rappresentante approva (evidenza conservata),
  il delegato firma l'atto, Postel controfirma. Il legale rappresentante può avviare e firmare direttamente.
- La variazione del referente amministrativo per la fatturazione è riservata al legale rappresentante, che la avvia
  e la firma; il delegato amministrativo non può avviarla né firmarla.
- Deleghe gerarchiche (U): il legale rappresentante nomina e modifica i poteri di tutti i delegati, il delegato
  amministrativo dei soli delegati operativo e tecnico, il delegato operativo del solo delegato tecnico. Sostituzione
  e revoca restano al legale rappresentante. Chi firma l'atto di delega quando nomina è `[DA DEFINIRE]`.
- Il rinnovo non è tacito: alla scadenza senza rinnovo il servizio è disabilitato e i dati sono conservati per
  `[DA DEFINIRE]` giorni, poi cancellati.
- Cambio del legale rappresentante: percorso pubblico V-03, avviato da U-02 (legale rappresentante o delegato
  amministrativo) o dall'area pubblica; l'utenza precedente è revocata solo dopo verifica della firma digitale,
  visura camerale e approvazione di Postel.
- PS-01 e PS-02 fanno parte dell'onboarding e non vanno rimossi: valgono al primo login del legale rappresentante,
  dopo l'attivazione. Solo "Concludi" in PS-02 completa il setup.
- Stile ispirato a Poste Italiane su tutte le pagine: testata gialla, blu `#0047BB`, sfondi chiari, font Inter,
  mantenendo l'identità Postel.

## Comandi

```sh
pnpm install --frozen-lockfile
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/dtp-portal dev
pnpm --filter @workspace/dtp-portal typecheck
pnpm --filter @workspace/dtp-portal test
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/dtp-portal build
```

`PORT` e `BASE_PATH` sono obbligatori: senza, Vite si ferma con un errore.

## Pubblicazione su GitHub Pages

Il sito è pubblicato su `https://thedoublegear.github.io/digital-trust-platform/`.
Ogni push su `main` avvia `.github/workflows/pages.yml`, che compila il portale e lo pubblica.

Per non rompere il sito pubblicato:

- Il sito vive nella sottocartella `/digital-trust-platform/`. Nelle pagine di `public/mockups/` usa solo
  collegamenti relativi (`cliente-H-catalogo.html`, `../workspace`), mai percorsi che iniziano con `/`.
- Se il repository viene rinominato, aggiorna `BASE_PATH` in `pages.yml`.
- Non togliere la copia di `index.html` in `404.html`: serve perché `/workspace` funzioni quando viene ricaricata.
- Le librerie usate dalle pagine vanno servite localmente (come `vendor/jspdf.umd.min.js`, preparato da
  `scripts/prepare-pdf.mjs`), non da CDN.

## Documentazione di analisi collegata

Il mockup è accompagnato da tre documenti di analisi: Personas, Legale rappresentante e Requisiti.
Quando cambiano flussi, ruoli, permessi o schermate, segnala quali documenti vanno aggiornati.
Nei documenti non si citano esempi o dati presi dal mockup.
