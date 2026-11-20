/* Accesso dimostrativo: involucro tipizzato di window.DTPAuth (public/mockups/dtp-auth.js).
   La logica vive in quel file, condiviso con le pagine HTML e con i test: qui non va duplicata.
   Non è un sistema di sicurezza: credenziali in chiaro, controlli solo nel browser. */
import { useEffect, useState } from 'react';

export type DemoRole = 'lr' | 'amm' | 'op' | 'tec' | 'com' | 'ops' | 'cdg';
/** deferred: deleghe rinviate in PS-01 («Configura in un secondo momento»). */
export type SetupState = { delegates: boolean; done: boolean; deferred: string[] };
export type Decision = { allow: boolean; reason: string; redirect?: string };

interface DemoAuthApi {
  ROLES: Record<DemoRole, { label: string; area: string }>;
  ACCOUNTS: { user: string; password: string; role: DemoRole }[];
  PAGES: Record<string, { code: string; open?: boolean; roles?: DemoRole[]; setup?: number }>;
  authenticate(user: string, password: string): { user: string; role: DemoRole } | null;
  /** Solleva un errore (isStorageError) se il browser non consente di salvare la sessione. */
  login(role: DemoRole): boolean;
  isStorageError(error: unknown): error is Error;
  clearSession(): void;
  getRole(): DemoRole | null;
  getSetup(): SetupState;
  resetSetup(): SetupState;
  /** Azzera richieste di modifica e codici di configurazione; non tocca il primo accesso del LR. */
  resetDemoData(): void;
  homeFor(role: DemoRole, setup?: SetupState): string;
  decide(file: string, role: DemoRole | null, setup?: SetupState): Decision;
  destinationAfterLogin(role: DemoRole, setup?: SetupState, next?: string | null): string;
  reasonText(reason: string, role: DemoRole | null): string;
  setFlash(text: string): void;
  takeFlash(): string | null;
  logout(opts?: { navigate?: boolean }): void;
  urls: { login(next?: string): string; workspace(): string; page(file: string): string };
}

declare global {
  interface Window { DTPAuth?: DemoAuthApi }
}

export function demoAuth(): DemoAuthApi {
  const api = window.DTPAuth;
  if (!api) throw new Error('Modulo di accesso demo non caricato (mockups/dtp-auth.js).');
  return api;
}

/* Il messaggio di cortesia va letto una sola volta per caricamento di pagina (StrictMode rimonta i componenti). */
let flash: string | null | undefined;
export function takeFlashOnce(): string | null {
  if (flash === undefined) flash = demoAuth().takeFlash();
  return flash;
}

export type DemoSession = { role: DemoRole | null; setup: SetupState };
const readSession = (): DemoSession => ({ role: demoAuth().getRole(), setup: demoAuth().getSetup() });

/* Ruolo e setup correnti, riletti a ogni ritorno sulla pagina (tasto Indietro, bfcache, altra scheda). */
export function useDemoSession(): [DemoSession, () => void] {
  const [session, setSession] = useState<DemoSession>(readSession);
  useEffect(() => {
    const refresh = () => setSession(readSession());
    window.addEventListener('pageshow', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('pageshow', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  return [session, () => setSession(readSession())];
}
