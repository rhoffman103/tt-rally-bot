import { CircleAlert, Copy, Crosshair, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { BallChip } from '~/components/ball-chip';
import { NumberField } from '~/components/number-field';
import { SliderField } from '~/components/slider-field';
import { Stepper } from '~/components/stepper';
import { SwitchRow } from '~/components/switch-row';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { CardAction, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { useRobot } from '~/hooks/use-robot';
import { ballLabel } from '~/lib/drills/describe';
import {
  fromRpm,
  SPEED_LIMITS,
  SPIN_LIMITS,
  type SpeedSpinMapping,
  toRpm,
} from '~/lib/drills/speed-spin';
import { BALL_LIMITS } from '~/lib/robot/protocol';
import type { Ball } from '~/lib/drills/types';
import type { Settings } from '~/lib/settings';
import { ballErrors, wheelProblem } from '~/features/builder/utils/ball-errors';
import {
  type BuilderAction,
  type BuilderState,
  canDelete,
  selectedBall,
} from '~/features/builder/utils/draft';

type BallEditorProps = {
  state: BuilderState;
  dispatch(action: BuilderAction): void;
  speedSpin: SpeedSpinMapping;
  rpmLimits: Settings['rpmLimits'];
};

/** Everything about the selected ball, and a button to shoot it once. */
export function BallEditor({ state, dispatch, speedSpin, rpmLimits }: BallEditorProps) {
  const [advanced, setAdvanced] = useState(false);
  const ball = selectedBall(state);
  const line = state.drill.lines[state.selected.line];
  const label = ballLabel(line, state.selected.line, state.selected.alt);
  const errors = ballErrors(ball, rpmLimits);
  const wheels = fromRpm(ball, speedSpin);
  const problem = advanced ? null : wheelProblem(ball, rpmLimits);
  const change = (changes: Partial<Ball>) => dispatch({ type: 'change', changes });

  return (
    <>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[15px] font-semibold">
          Ball
          <BallChip
            label={label}
            random={line.alternatives.length > 1}
            invalid={Object.keys(errors).length > 0}
          />
        </CardTitle>
        <CardAction className="flex gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Duplicate ball ${label}`}
            title="Duplicate"
            onClick={() => dispatch({ type: 'duplicate' })}
          >
            <Copy aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete ball ${label}`}
            title="Delete"
            disabled={!canDelete(state)}
            onClick={() => dispatch({ type: 'delete' })}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {problem && (
          <Alert variant="destructive" className="mb-4 flex items-start gap-2.5 px-3.5 py-3">
            <CircleAlert aria-hidden="true" className="mt-0.5" />
            <AlertDescription className="flex-1">{problem}</AlertDescription>
          </Alert>
        )}
        <SliderField
          label="Speed"
          value={wheels.speed}
          limits={SPEED_LIMITS}
          scale={['Slow', 'Fast']}
          onChange={(speed) => change(toRpm({ speed, spin: wheels.spin }, speedSpin))}
        />
        <SliderField
          label="Spin"
          value={wheels.spin}
          limits={SPIN_LIMITS}
          scale={['Backspin', 'None', 'Topspin']}
          onChange={(spin) => change(toRpm({ speed: wheels.speed, spin }, speedSpin))}
        />
        <SliderField
          label="Left or right"
          value={ball.dropPoint}
          limits={BALL_LIMITS.dropPoint}
          scale={['Backhand', 'Forehand']}
          error={errors.dropPoint}
          onChange={(dropPoint) => change({ dropPoint })}
        />
        <SliderField
          label="Height"
          value={ball.height}
          limits={BALL_LIMITS.height}
          scale={['Short', 'Long']}
          error={errors.height}
          onChange={(height) => change({ height })}
        />
        <SliderField
          label="Frequency"
          value={ball.frequency}
          limits={BALL_LIMITS.frequency}
          scale={['Slower', 'Faster']}
          error={errors.frequency}
          onChange={(frequency) => change({ frequency })}
        />
        <div className="mb-4">
          <div className="mb-1.5 font-medium">Repeat</div>
          <Stepper
            label="Repeat"
            value={ball.repetitions}
            unit="times in a row"
            {...BALL_LIMITS.repetitions}
            onChange={(n) => change({ repetitions: clampReps(n) })}
          />
        </div>

        <SwitchRow
          title="Wheel speeds"
          description="Set each wheel’s rpm yourself"
          checked={advanced}
          onCheckedChange={setAdvanced}
          className="mb-3"
        />
        {advanced && (
          <div className="mb-4 grid grid-cols-2 gap-2.5">
            <NumberField
              label="Upper wheel"
              value={ball.upperRpm}
              {...BALL_LIMITS.upperRpm}
              error={errors.upperRpm}
              onCommit={(upperRpm) => change({ upperRpm })}
            />
            <NumberField
              label="Lower wheel"
              value={ball.lowerRpm}
              {...BALL_LIMITS.lowerRpm}
              error={errors.lowerRpm}
              onCommit={(lowerRpm) => change({ lowerRpm })}
            />
          </div>
        )}

        <TestFire label={label} ball={ball} invalid={Object.keys(errors).length > 0} />
      </CardContent>
    </>
  );
}

const clampReps = (n: number) => {
  const { min, max } = BALL_LIMITS.repetitions;
  return Math.min(max, Math.max(min, Math.round(n)));
};

function TestFire({ label, ball, invalid }: { label: string; ball: Ball; invalid: boolean }) {
  const { status, fireBall } = useRobot();
  const [firing, setFiring] = useState(false);
  const ready = status === 'standby';

  const fire = async () => {
    setFiring(true);
    try {
      await fireBall(ball);
      toast.success(`Fired ball ${label} once`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setFiring(false);
    }
  };

  let hint: string | null = null;
  if (status === 'playing' || status === 'paused')
    hint = 'Stop the drill that is playing to test fire.';
  else if (!ready) hint = 'Connect the robot to test fire.';
  else if (invalid) hint = 'Fix this ball’s errors to test fire.';

  return (
    <>
      <Button
        variant="outline"
        size="lg"
        className="mt-2 w-full"
        disabled={!ready || invalid || firing}
        onClick={() => void fire()}
      >
        <Crosshair aria-hidden="true" />
        Test fire this ball
      </Button>
      {hint && <p className="mt-2.5 text-[13px] text-muted-foreground">{hint}</p>}
    </>
  );
}
