import { Bluetooth } from 'lucide-react';
import { toast } from 'sonner';

import { Alert, AlertDescription } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { useRobot } from '~/hooks/use-robot';

/** On the library while no robot is connected. */
export function ConnectBanner() {
  const { status, connect } = useRobot();
  if (status !== 'disconnected') return null;
  return (
    <Alert className="mb-5 flex items-start gap-2.5 px-3.5 py-3 max-wide:flex-wrap">
      <Bluetooth aria-hidden="true" className="mt-0.5" />
      <AlertDescription className="flex-1 text-foreground">
        <b className="font-semibold">Robot not connected.</b> Turn the robot on and close the
        robot’s phone app, then connect.
      </AlertDescription>
      <Button
        size="sm"
        className="ml-auto"
        // Straight from the click: Web Bluetooth only opens its robot picker during a user gesture.
        onClick={() =>
          connect().catch((e: unknown) => toast.error(e instanceof Error ? e.message : String(e)))
        }
      >
        Connect
      </Button>
    </Alert>
  );
}
