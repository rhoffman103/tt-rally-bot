import type { ReactNode } from 'react';
import { toast } from 'sonner';

import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { useRobot } from '~/hooks/use-robot';
import { RobotSummary } from '~/features/connection/components/robot-summary';

/** The Robot card on /settings: which robot is connected, with Connect or Disconnect. `children` go below. */
export function RobotCard({ children }: { children?: ReactNode }) {
  const { status, robot, connect, disconnect } = useRobot();
  const connected = status === 'standby' || status === 'playing' || status === 'paused';

  return (
    <Card className="[--card-spacing:--spacing(5)]">
      <CardHeader>
        <CardTitle className="text-[15px] font-semibold">Robot</CardTitle>
        {connected && (
          <CardAction>
            <Badge className="bg-ok-soft text-ok">Connected</Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {connected ? (
          <RobotSummary
            serial={robot?.serial ?? '—'}
            action={
              <Button variant="outline" size="lg" onClick={() => void disconnect()}>
                Disconnect
              </Button>
            }
          />
        ) : (
          <RobotSummary
            serial={null}
            hint="The robot takes one connection at a time. Close the robot’s phone app first."
            action={
              <Button
                size="lg"
                disabled={status !== 'disconnected'}
                // Straight from the click: Web Bluetooth only opens its robot picker during a user gesture.
                onClick={() =>
                  connect().catch((e: unknown) =>
                    toast.error(e instanceof Error ? e.message : String(e)),
                  )
                }
              >
                {status === 'connecting' ? 'Connecting…' : 'Connect'}
              </Button>
            }
          />
        )}
        {children}
      </CardContent>
    </Card>
  );
}
