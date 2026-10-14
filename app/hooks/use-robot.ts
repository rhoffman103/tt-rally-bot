import { use } from 'react';

import { RobotContext, type RobotContextValue } from '~/lib/robot/robot-provider';

/** Robot status, drill progress, the debug log and the robot commands. Use it inside `RobotProvider`. */
export function useRobot(): RobotContextValue {
  const value = use(RobotContext);
  if (!value) throw new Error('useRobot() must be used inside <RobotProvider>.');
  return value;
}
