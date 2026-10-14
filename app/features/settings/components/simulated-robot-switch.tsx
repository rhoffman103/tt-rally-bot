import type { Settings } from '~/lib/settings';
import { SwitchRow } from '~/components/switch-row';
import { useSaveSettings } from '~/features/settings/hooks/use-save-settings';

/** Turns the simulated robot on or off. The robot connection follows the setting (RobotProvider). */
export function SimulatedRobotSwitch({ saved }: { saved: Settings }) {
  const { settings, save } = useSaveSettings(saved);
  return (
    <SwitchRow
      className="mt-4 border-t pt-3"
      title="Simulated robot"
      description="A pretend robot in this browser, to try the app without one. Turning it on or off disconnects the robot."
      checked={settings.simulatedRobot}
      onCheckedChange={(simulatedRobot) => save({ simulatedRobot })}
    />
  );
}
