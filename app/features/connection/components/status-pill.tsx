// The robot's connection status at the right end of the header. Click it to connect, or to open a menu with the
// robot's serial number and Disconnect.
import { Bluetooth, Loader2, TriangleAlert, type LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

import { buttonVariants } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { useRobot } from '~/hooks/use-robot';
import type { RobotStatus } from '~/lib/robot/client';
import { cn } from '~/lib/utils';
import { ROBOT_NAME, RobotSummary } from '~/features/connection/components/robot-summary';
import { useConnectionToasts } from '~/features/connection/hooks/use-connection-toasts';

type Look = {
  label: string;
  sub?: string;
  /** Shown instead of the dot. */
  icon?: LucideIcon;
  pill?: string;
  dot?: string;
};

const LOOKS: Record<RobotStatus, Look> = {
  disconnected: {
    label: 'Connect robot',
    icon: Bluetooth,
    pill: 'border-primary bg-primary text-primary-foreground hover:bg-primary/80',
  },
  connecting: { label: 'Connecting…', icon: Loader2 },
  standby: { label: ROBOT_NAME, sub: 'Ready', dot: 'bg-ok shadow-[0_0_0_3px_var(--ok-soft)]' },
  playing: { label: 'Playing', dot: 'animate-blink bg-ball' },
  paused: { label: 'Paused', dot: 'bg-warn' },
  unsupported: { label: 'No Bluetooth', icon: TriangleAlert, pill: 'text-destructive' },
};

export function StatusPill() {
  useConnectionToasts();
  const { status, robot, progress, connect, disconnect } = useRobot();
  const navigate = useNavigate();
  const look = LOOKS[status];
  const Icon = look.icon;

  const className = cn(
    'inline-flex h-8 items-center gap-2 rounded-full border bg-background px-3 text-[13px] font-medium whitespace-nowrap outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50',
    look.pill,
  );
  const content = (
    <>
      {Icon ? (
        <Icon
          aria-hidden="true"
          className={cn('size-4', status === 'connecting' && 'animate-spin')}
        />
      ) : (
        <span className={cn('size-2 flex-none rounded-full bg-muted-foreground', look.dot)} />
      )}
      <span>{look.label}</span>
      {look.sub && (
        <span className="font-normal text-muted-foreground max-wide:hidden">{look.sub}</span>
      )}
    </>
  );

  if (status === 'disconnected' || status === 'connecting' || status === 'unsupported') {
    const onClick = () => {
      if (status === 'unsupported')
        toast.error('Open TT Rally Bot in Chrome or Edge to use Bluetooth');
      // Straight from the click: Web Bluetooth only opens its robot picker during a user gesture.
      else if (status === 'disconnected')
        connect().catch((e: unknown) => toast.error(e instanceof Error ? e.message : String(e)));
    };
    return (
      <button
        type="button"
        className={className}
        onClick={onClick}
        aria-disabled={status === 'connecting'}
      >
        {content}
      </button>
    );
  }

  const drillId = status === 'standby' ? null : progress?.drillId;
  const menuButton = buttonVariants({ variant: 'outline', className: 'w-full' });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(className, 'data-popup-open:bg-accent')}>
        {content}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-[260px] p-3">
        <div className="mb-3">
          <RobotSummary serial={robot?.serial ?? '—'} />
        </div>
        {drillId && (
          <DropdownMenuItem
            className={cn(menuButton, 'mb-2')}
            onClick={() => void navigate(`/drills/${drillId}`)}
          >
            Go to the drill that is playing
          </DropdownMenuItem>
        )}
        <DropdownMenuItem className={menuButton} onClick={() => void disconnect()}>
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
