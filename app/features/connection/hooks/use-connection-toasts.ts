import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

import { useRobot } from '~/hooks/use-robot';
import type { RobotStatus } from '~/lib/robot/client';

const CONNECTED: RobotStatus[] = ['standby', 'playing', 'paused'];
const DRILL_RUNNING: RobotStatus[] = ['playing', 'paused'];

/** Toasts when the robot connects or disconnects, and for every robot error. Use it once, in the header. */
export function useConnectionToasts() {
  const { status, error } = useRobot();
  const previous = useRef(status);

  useEffect(() => {
    const before = previous.current;
    previous.current = status;
    if (before === 'connecting' && status === 'standby') toast.success('Connected to the robot');
    // A robot that drops out sets `error` instead, and that has its own toast below.
    if (CONNECTED.includes(before) && !CONNECTED.includes(status) && !error) {
      toast.info(
        DRILL_RUNNING.includes(before) ? 'Disconnected. The drill stopped.' : 'Disconnected',
      );
    }
  }, [status, error]);

  // The id is the message, so a screen that also shows the error that `play()` throws doesn't add a second toast.
  useEffect(() => {
    if (error) toast.error(error, { id: error });
  }, [error]);
}
