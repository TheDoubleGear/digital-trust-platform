# Digital Trust Platform · Postel — istruzioni per Claude

Prototipo navigabile in italiano della Digital Trust Platform (DTP) dell'ipotetica compagnia Postel:
vetrina pubblica, attivazione, primo setup, portale cliente, developer portal e console operativa Postel.
Tutti i dati mostrati sono di esempio; nessuna integrazione è reale.

Per avvio, comandi, stack e note tecniche dettagliate vedi anche `README.md` e `replit.md`
(quest'ultimo è il file di istruzioni dell'assistente di Replit: va tenuto allineato con questo).

## Regole di lavoro

- Lavora sempre e soltanto sulla versione attuale del progetto. Confronti con versioni precedenti solo se richiesti.
- Questo repository è la fonte di verità del mockup. Le modifiche si fanno su Replit, che si sincronizza su GitHub;
  prima di intervenire recupera l'ultima versione del ramo `main`.
- Interfaccia, testi e documentazione in italiano, con registro professionale.
- I segnaposto come `[DA DEFINIRE]`, `[IBAN POSTEL]` o `[TESTO DA FORNIRE E APPROVARE A CURA DI POSTEL]`
  indicano decisioni ancora aperte: non sostituirli con valori inventati.
- Mantieni ben visibile la dicitura "Prototipo dimostrativo" e non presentare mai il login come un sistema di sicurezza.

## Struttura

- `artifacts/dtp-portal` — applicazione React/Vite.
  - `src/pages/login.tsx`: accesso demo su `/`.
  - `src/pages/workspace.tsx`: indice delle schermate su `/workspace`, richiede una sessione demo.
  - `public/mockups/`: le 19 schermate come pagine HTML indipendenti, più i moduli condivisi
    (`dtp-auth.js`, `dtp-catalogo.js`, `dtp-contract-pdf.js`, `dtp-theme.css`, `dtp-acquisto.css`).
  - `tests/`: test node su accesso demo e PDF del contratto.
- `artifacts/api-server`, `lib/db` — scaffolding non usato dalla demo.
- `artifacts/mockup-sandbox` — ambiente di progettazione di Replit.
- `.github/workflows/pages.yml` — pubblicazione su GitHub Pages.

## Schermate

| Gruppo | Codici | File |
|---|---|---|
| Vetrina (pubblica) | V-01 vetrina, V-02 attivazione | `vetrina-V01-catalogo.html`, `vetrina-V02-contratto.html` |
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

- V-01 è in sola consultazione: nessun carrello, solo il collegamento "Attivazione servizio" verso V-02.
- V-02 ha tre passi: dati di azienda, legale rappresentante e password; scelta dei servizi con carrello e "Acquista";
  bozza di contratto in PDF, firma fuori dalla pagina, caricamento del PDF firmato e invio.
  Dopo l'invio la richiesta resta "In attesa di verifica"; l'accesso arriva via e-mail dopo le verifiche.
- PS-01 e PS-02 fanno parte dell'onboarding e non vanno rimossi: valgono al primo login del legale rappresentante,
  dopo l'attivazione. Solo "Concludi" in PS-02 completa il setup.
- Bundle: Base, Medium, Pro ed Enterprise personalizzabile. Il prezzo di Enterprise è indicativo.
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
