import { SwitchRow } from '~/components/switch-row';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Segmented } from '~/features/player/components/segmented';
import { Stepper } from '~/components/stepper';
import {
  type DurationKind,
  type Session,
  SESSION_LIMITS,
  withAmount,
  withDurationKind,
  withPause,
} from '~/features/player/utils/session';

const KINDS: { value: DurationKind; label: string }[] = [
  { value: 'endless', label: 'Endless' },
  { value: 'minutes', label: 'Minutes' },
  { value: 'combos', label: 'Sets' },
];

type SessionCardProps = {
  session: Session;
  onChange(session: Session): void;
  /** While this drill plays: the robot already has the session. */
  locked: boolean;
};

/** How long the drill plays, in which order, and the rest between sets. */
export function SessionCard({ session, onChange, locked }: SessionCardProps) {
  const { duration } = session;
  return (
    <Card className="[--card-spacing:--spacing(5)]">
      <CardHeader>
        <CardTitle className="text-[15px] font-semibold">Session</CardTitle>
        {locked && (
          <CardAction className="text-[13px] text-muted-foreground">Stop to change</CardAction>
        )}
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="mb-1.5 font-medium">How long</div>
          <Segmented
            label="How long"
            full
            options={KINDS}
            value={duration.kind}
            disabled={locked}
            onChange={(kind) => onChange(withDurationKind(session, kind))}
          />
          {duration.kind !== 'endless' && (
            <div className="mt-2.5">
              <Stepper
                label={duration.kind === 'minutes' ? 'Minutes' : 'Sets'}
                unit={duration.kind === 'minutes' ? 'minutes' : 'sets'}
                value={duration.value}
                {...SESSION_LIMITS[duration.kind]}
                disabled={locked}
                onChange={(value) => onChange(withAmount(session, value))}
              />
            </div>
          )}
        </div>
        <SwitchRow
          className="border-t py-3"
          title="Random order"
          description="Shuffle the balls in each set"
          checked={session.randomOrder}
          disabled={locked}
          onCheckedChange={(randomOrder) => onChange({ ...session, randomOrder })}
        />
        <div className="flex items-center justify-between gap-4 border-t pt-3">
          <div>
            <b className="block font-medium">Rest between sets</b>
            <small className="block text-[13px] text-muted-foreground">
              The robot waits, then goes on
            </small>
          </div>
          <Stepper
            label="Rest between sets in seconds"
            unit="s"
            value={session.pauseBetweenSetsSec}
            {...SESSION_LIMITS.pauseBetweenSetsSec}
            disabled={locked}
            onChange={(seconds) => onChange(withPause(session, seconds))}
          />
        </div>
      </CardContent>
    </Card>
  );
}
