import { TriangleAlert } from 'lucide-react';

import { Alert, AlertDescription } from '~/components/ui/alert';
import { useRobot } from '~/hooks/use-robot';

/** Shown at the top of every screen in browsers without Web Bluetooth, such as Safari and Firefox. */
export function NoBluetoothBanner() {
  const { status } = useRobot();
  if (status !== 'unsupported') return null;
  return (
    <Alert
      variant="destructive"
      className="mb-5 gap-x-2.5 border-destructive/35 bg-destructive/10 px-3.5 py-3"
    >
      <TriangleAlert aria-hidden="true" />
      <AlertDescription className="text-destructive">
        <b className="font-semibold">This browser can’t use Bluetooth.</b> Open TT Rally Bot in
        Chrome or Edge to connect to the robot. You can still look at and build drills.
      </AlertDescription>
    </Alert>
  );
}
