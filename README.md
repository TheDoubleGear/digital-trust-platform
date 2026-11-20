# Digital Trust Platform — Postel

Prototipo navigabile in italiano con login dimostrativo per ruolo, vetrina servizi,
attivazione, primo setup cliente e dashboard cliente e operative.

## Avvio locale

Requisiti: Node.js 24 e pnpm 10.

```sh
pnpm install --frozen-lockfile
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/dtp-portal dev
```

Aprire http://localhost:5173: la radice apre la vetrina V-01, l'accesso demo è su
http://localhost:5173/accesso. I comandi con variabili inline sono per shell
Linux/macOS; in PowerShell impostare prima `$env:PORT="5173"` e `$env:BASE_PATH="/"`.

## Verifiche e build

```sh
pnpm --filter @workspace/dtp-portal typecheck
pnpm --filter @workspace/dtp-portal test
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/dtp-portal build
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/dtp-portal serve
```

La build genera `artifacts/dtp-portal/dist/public`. Per ospitarla occorre
servire i file statici e configurare il fallback a `index.html` per le rotte
dell'applicazione. Il comando di avvio prepara automaticamente la libreria PDF.

## Struttura

- `artifacts/dtp-portal`: applicazione React/Vite e pagine HTML in `public/mockups`.
- `artifacts/api-server`: API Express di base; non necessaria per la demo.
- `artifacts/mockup-sandbox`: ambiente di progettazione.
- `lib`: pacchetti condivisi del workspace pnpm.
- `scripts`: strumenti di esportazione e manutenzione.

## Limiti della demo

Il login simula i ruoli nel browser: **non è un sistema di autenticazione sicuro**.
Gli account di esempio sono mostrati nella pagina di login. Non inserire dati reali
o password personali. Invio contratti, verifiche d'identità, pagamenti ed email
non sono servizi reali. PS-01 e PS-02 seguono il primo login del Legale Rappresentante.

Questa esportazione contiene il codice corrente, senza la cronologia dei checkpoint
Replit, gli allegati di lavoro, i segreti o gli output generati.
Il repository GitHub non pubblica automaticamente il sito e non si aggiorna
automaticamente a ogni modifica su Replit.
