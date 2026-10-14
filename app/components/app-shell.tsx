// The frame around every screen: header with logo, nav and connection status; tab bar on narrow screens; toasts.
import { GraduationCap, LayoutGrid, Pencil, Settings, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';

import { Toaster } from '~/components/ui/sonner';

type Section = 'drills' | 'plans' | 'builder' | 'settings';

const NAV: { section: Section; to: string; label: string; icon: LucideIcon }[] = [
  { section: 'drills', to: '/', label: 'Drills', icon: LayoutGrid },
  { section: 'plans', to: '/plans', label: 'Plans', icon: GraduationCap },
  { section: 'builder', to: '/builder/new', label: 'Builder', icon: Pencil },
  { section: 'settings', to: '/settings', label: 'Settings', icon: Settings },
];

/** The drill player and import belong to Drills. */
function sectionOf(pathname: string): Section {
  if (pathname.startsWith('/plans')) return 'plans';
  if (pathname.startsWith('/builder')) return 'builder';
  if (pathname.startsWith('/settings')) return 'settings';
  return 'drills';
}

type AppShellProps = {
  /** The connection status, at the right end of the header. */
  status?: ReactNode;
  children: ReactNode;
};

export function AppShell({ status, children }: AppShellProps) {
  const current = sectionOf(useLocation().pathname);
  const ariaCurrent = (section: Section) => (section === current ? 'page' : undefined);

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <a
        href="#main"
        className="sr-only z-30 rounded-md bg-background px-3 py-2 font-medium focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-20 flex h-14 flex-none items-center gap-5 border-b bg-background/88 px-6 backdrop-blur-sm max-wide:px-4">
        <Link to="/" className="flex items-center gap-2 text-base font-semibold tracking-[-0.01em]">
          <Logo />
          TT Rally Bot
        </Link>
        <nav aria-label="Main" className="flex gap-0.5 max-wide:hidden">
          {NAV.map(({ section, to, label, icon: Icon }) => (
            <Link
              key={section}
              to={to}
              aria-current={ariaCurrent(section)}
              className="flex h-8 items-center gap-1.5 rounded-md px-2.5 font-medium text-muted-foreground hover:text-foreground aria-[current=page]:bg-accent aria-[current=page]:text-foreground"
            >
              <Icon aria-hidden="true" className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto">{status}</div>
      </header>

      <main id="main" className="mx-auto w-full max-w-[1200px] flex-1 p-6 max-wide:p-4">
        {children}
      </main>

      <nav
        aria-label="Main"
        className="sticky bottom-0 z-20 grid h-[62px] flex-none grid-cols-4 border-t bg-background/92 backdrop-blur-sm wide:hidden"
      >
        {NAV.map(({ section, to, label, icon: Icon }) => (
          <Link
            key={section}
            to={to}
            aria-current={ariaCurrent(section)}
            className="flex flex-col items-center justify-center gap-[3px] text-[11px] font-medium text-muted-foreground aria-[current=page]:text-foreground"
          >
            <Icon aria-hidden="true" className="size-5" />
            {label}
          </Link>
        ))}
      </nav>

      {/* Below the header, as in the mockup. */}
      <Toaster position="top-center" offset={68} mobileOffset={{ top: 68 }} />
    </div>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6">
      <circle cx="12" cy="12" r="10" className="fill-ball" />
      <path
        d="M6.5 8.5a7 7 0 0 1 6-3.5"
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        className="stroke-white opacity-80"
      />
    </svg>
  );
}
