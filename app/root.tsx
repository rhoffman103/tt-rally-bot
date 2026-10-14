import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from 'react-router';

import type { Route } from './+types/root';
import './app.css';
import { AppShell } from '~/components/app-shell';
import { NoBluetoothBanner } from '~/features/connection/components/no-bluetooth-banner';
import { StatusPill } from '~/features/connection/components/status-pill';
import { RobotProvider } from '~/lib/robot/robot-provider';

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

// Pre-rendered into index.html at build time and shown until the app hydrates.
export function HydrateFallback() {
  return (
    <main className="grid min-h-svh place-items-center p-4">
      <p className="text-sm text-muted-foreground">Loading…</p>
    </main>
  );
}

export default function App() {
  // Here, not in Layout, so the robot connection lives inside the router and survives navigation.
  return (
    <RobotProvider>
      <AppShell status={<StatusPill />}>
        <NoBluetoothBanner />
        <Outlet />
      </AppShell>
    </RobotProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = 'Oops!';
  let details = 'An unexpected error occurred.';
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? '404' : 'Error';
    details =
      error.status === 404 ? 'The requested page could not be found.' : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold">{message}</h1>
      <p className="mt-1 text-muted-foreground">{details}</p>
      {stack && (
        <pre className="mt-4 w-full overflow-x-auto p-4">
          <code>{stack}</code>
        </pre>
      )}
    </AppShell>
  );
}
