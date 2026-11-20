# Digital Trust Platform

A navigable Postel prototype hub linking 19 screens: eleven customer/setup screens, five operational console screens, two storefront screens and one developer portal.

## Run & Operate

- Install dependencies with `pnpm install --frozen-lockfile`.
- Start the existing managed workflows in Replit:
  - `artifacts/dtp-portal: web` — React portal at `/` (port 21197).
  - `artifacts/api-server: API Server` — Express API at `/api` (port 8080).
  - `artifacts/mockup-sandbox: Component Preview Server` — canvas preview at `/__mockup` (port 8081).
- Managed workflows supply `PORT` and `BASE_PATH`; use them rather than starting duplicate servers.
- `pnpm run typecheck` — full typecheck across all packages
- `BASE_PATH=/ PORT=21197 pnpm --filter @workspace/dtp-portal run build` — build the portal
- `pnpm --filter @workspace/api-server run build` — build the API
- `BASE_PATH=/__mockup PORT=8081 pnpm --filter @workspace/mockup-sandbox run build` — build the canvas preview
- The root build script runs all packages with the same environment; prefer the per-service build commands above for their distinct base paths.
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- No secrets or external services are required for the current prototype. `DATABASE_URL` is required only if using the dormant database package or its schema tools; no database tables or business API routes are implemented.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/dtp-portal/src/App.tsx` — routes: `/` demo login (`src/pages/login.tsx`), `/workspace` searchable screen catalog (`src/pages/workspace.tsx`, session required).
- `artifacts/dtp-portal/public/mockups/dtp-auth.js` + `dtp-auth.css` — shared demo login/session/guard module and its styles.
- `artifacts/dtp-portal/public/mockups/dtp-modifiche.js` — shared offer-modification requests of the sample customer (start, legal representative approval with evidence, signature, Postel countersignature), kept in `localStorage` `dtp-demo-modifiche` and used by H, M5, U, N, O2 and O5. The login's “Ripristina dati demo” button clears these requests and the configuration codes (`dtp-demo-config-codes`).
- `artifacts/dtp-portal/tests/` — `pnpm --filter @workspace/dtp-portal run test` (demo-auth + contract PDF + offer modifications).
- `artifacts/dtp-portal/public/mockups/` — original HTML prototype screens.
- `artifacts/dtp-portal/src/index.css` — portal styles.
- `artifacts/api-server/src/routes/health.ts` — `GET /api/healthz`, returns `{"status":"ok"}`.
- `lib/db/` — unused PostgreSQL/Drizzle scaffold; its schema is empty.

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

The Italian-language portal organizes the imported HTML mockups into storefront, customer, developer and Postel journeys, with search and group filtering. V-01 is a public, read-only storefront: “Attivazione servizio” opens V-02. The offer is composable: there are no predefined bundles (Base, Medium, Pro, Enterprise) and no top-ups; the customer picks services and quantities, the price is computed as variable component, activation fee and periodic fee, and any later change is an upgrade or offer modification. V-02 follows this order: service configuration and cart (required services are added automatically with an explanatory message; “Genera codice di configurazione” and a field to re-enter an existing code); company and legal representative data plus the future-account password, with formal checks on input; contract with only the configured services, signed outside the page and uploaded (PDF or P7M), with an explicit declaration that the signer is the legal representative. After submission: signature and data verification, Postel countersignature, first invoice paid outside the platform, tenant enabled and credentials emailed only after payment, never immediate setup access. Only the legal representative can conclude the first purchase. Offer modifications started by the administrative delegate need the legal representative's approval (kept as evidence); the change of the administrative billing contact is reserved to the legal representative; delegations are hierarchical (the legal representative appoints and edits the powers of every delegate, the administrative delegate only of the operational and technical delegates, the operational delegate only of the technical delegate; replacement and revocation stay with the legal representative); renewal is never tacit; the legal representative change runs through the public V-03 page. Customer screens include contract management, assistance and notifications; the developer portal includes sandbox/production previews. Access is a demo login at `/` with seven fixed pairs (LR/LR1, DA/DA1, DO/DO1, DT/DT1, C/C1, O/O1, CDG/CDG1), each landing on its role's area (LR: PS-01 → PS-02 → H on first login, then H; DA/DO: H; DT: D0; C: O1; O: O3; CDG: O4); V-01/V-02 stay public via the “Vetrina pubblica” link; the sales role (C/C1) can open V-02 in assisted mode from O2-09 “Configurazione assistita”, apply a discount on the overall price within a system-checked threshold (`SOGLIA_SCONTO = [DA DEFINIRE]`, demo value 10%) and generate a configuration code carrying only services, quantities and discount (no company or legal representative data); sales stops at the configuration step and cannot enter data, upload the signed contract or submit the request, which remain with the legal representative; the discount lapses if the legal representative changes the configuration and comes back by re-entering the code; the Workspace hub is at `/workspace` behind the demo session. The linked screens are prototypes, not authenticated live business workflows; displayed customer, billing, and operational information is sample content. Payments, signatures, tickets, notifications and credentials are demonstrations, not live integrations.

## User preferences

The user wants all 19 pages styled after their Poste Italiane reference screenshots: yellow headers and accents, Poste blue, light backgrounds and readable typography, while retaining the Postel identity and all existing workflows.

PS-01 and PS-02 remain part of onboarding. They apply immediately after the customer's first login as Rappresentante Legale, after activation: PS-01 (Delegati) → PS-02 (Soglie e notifiche) → customer homepage. Do not remove them when remodeling acquisition; keep pending verification distinct from first-login setup.

## Gotchas

- HTML filenames under `public/mockups/` must retain their canonical names without the upload timestamp: the screens link to each other using these names.
- Each supplied dashboard includes its own template runtime. Preserve it when updating from source HTML, and re-apply the demo-login wiring afterwards (head links, `DTPAuth.enter(meta)` in `DC.mount`, session bar instead of persona buttons). The persona is no longer a preview control: `props.persona` comes from the demo session role.
- Demo login is NOT security: credentials live in clear text in `public/mockups/dtp-auth.js` and every check runs in the browser. Never describe it as authentication; never store passwords (only the role goes to `sessionStorage` `dtp-demo-role`; LR first-setup progress goes to `localStorage` `dtp-demo-lr-setup`).
- `dtp-auth.js` is the single source of truth for accounts, per-page roles (`PAGES`), destinations and guards. It is loaded by the 19 HTML pages, by the React app (classic script in `index.html`, typed in `src/lib/demo-auth.ts`) and by the node tests. `PAGES` must mirror each page's `DC.mount` persona options — `tests/demo-auth.test.mjs` fails if they drift.
- Guards never switch role: a role that cannot open a page is redirected to its own home (anonymous → login with `?next=`). Postel roles cannot open the customer portal; O5 has no link into M1.
- LR first setup: PS-01 "Continua" unlocks PS-02, only PS-02 "Concludi" completes it (`data-dtp-setup` attributes on those links). Completion survives logout; the login page's demo-credential panel has "Ripristina il primo accesso".

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
