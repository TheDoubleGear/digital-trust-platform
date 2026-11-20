import { type ReactNode, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import Login from '@/pages/login';
import NotFound from '@/pages/not-found';
import Workspace from '@/pages/workspace';
import { demoAuth } from '@/lib/demo-auth';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

/* "/" apre la vetrina V-01, pagina iniziale del sito; l'accesso demo vive su "/accesso" e il Workspace
   (indice delle schermate) su "/workspace", che richiede una sessione.
   Le 21 schermate restano pagine HTML indipendenti sotto /mockups/ e applicano la stessa regola con dtp-auth.js. */
function Home() {
  useEffect(() => {
    const auth = demoAuth();
    /* Un vecchio collegamento all'accesso con "?next=" prosegue verso /accesso; altrimenti si apre la vetrina. */
    const query = window.location.search;
    const target = new URLSearchParams(query).has('next')
      ? auth.urls.login() + query
      : auth.urls.page('vetrina-V01-catalogo.html');
    window.location.replace(target);
  }, []);
  return null;
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/accesso" component={Login} />
        <Route path="/workspace" component={Workspace} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
