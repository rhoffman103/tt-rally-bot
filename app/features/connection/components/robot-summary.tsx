import { Bluetooth } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '~/lib/utils';

/** The title of a connected robot. The robot only reports its serial number. */
export const ROBOT_NAME = 'Robot';

type RobotSummaryProps = {
  /** The connected robot's serial number, or null when no robot is connected. */
  serial: string | null;
  /** Shown under the title when no robot is connected. */
  hint?: string;
  /** A button at the end of the row. */
  action?: ReactNode;
};

/** A Bluetooth icon, the robot's name and serial number, and an optional button. */
export function RobotSummary({ serial, hint, action }: RobotSummaryProps) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          'grid size-10 flex-none place-items-center rounded-lg',
          serial ? 'bg-ok-soft text-ok' : 'bg-muted text-muted-foreground',
        )}
      >
        <Bluetooth aria-hidden="true" className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <b className="block font-medium">{serial ? ROBOT_NAME : 'No robot connected'}</b>
        <small className={cn('block text-[13px] text-muted-foreground', serial && 'font-mono')}>
          {serial ?? hint}
        </small>
      </div>
      {action}
    </div>
  );
}
