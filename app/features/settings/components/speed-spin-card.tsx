import { useState } from 'react';

import { NumberField } from '~/components/number-field';
import { SliderField } from '~/components/slider-field';
import {
  SPEED_LIMITS,
  SPIN_LIMITS,
  type SpeedSpin,
  type SpeedSpinMapping,
  toRpm,
} from '~/lib/drills/speed-spin';
import { BALL_LIMITS } from '~/lib/robot/protocol';
import type { Settings } from '~/lib/settings';
import { cn } from '~/lib/utils';
import { SettingsCard } from '~/features/settings/components/settings-card';
import { useSaveSettings } from '~/features/settings/hooks/use-save-settings';
import { formatRpm } from '~/utils/format';

const MAPPING_FIELDS: { key: keyof SpeedSpinMapping; label: string }[] = [
  { key: 'baseRpm', label: 'At speed 0' },
  { key: 'rpmPerSpeed', label: 'Per speed point' },
  { key: 'rpmPerSpin', label: 'Per spin point' },
];

/** How the builder's Speed and Spin sliders turn into wheel rpm, with sliders to try it. */
export function SpeedSpinCard({ saved }: { saved: Settings }) {
  const { settings, save } = useSaveSettings(saved);
  const [tryBall, setTryBall] = useState<SpeedSpin>({ speed: 5, spin: 3 });
  const rpm = toRpm(tryBall, settings.speedSpin);

  return (
    <SettingsCard
      title="Speed and spin"
      description="The Speed and Spin sliders set both wheels at once. Topspin makes the upper wheel faster. Backspin makes the lower wheel faster. Try it:"
    >
      <SliderField
        label="Speed"
        value={tryBall.speed}
        limits={SPEED_LIMITS}
        scale={['Slow', 'Fast']}
        onChange={(speed) => setTryBall({ ...tryBall, speed })}
      />
      <SliderField
        label="Spin"
        value={tryBall.spin}
        limits={SPIN_LIMITS}
        scale={['Backspin', 'None', 'Topspin']}
        onChange={(spin) => setTryBall({ ...tryBall, spin })}
      />
      <div className="mt-1 grid gap-2">
        <WheelBar name="Upper wheel" rpm={rpm.upperRpm} limits={settings.rpmLimits} />
        <WheelBar name="Lower wheel" rpm={rpm.lowerRpm} limits={settings.rpmLimits} />
      </div>

      <p className="mt-5 mb-3 max-w-[60ch] text-muted-foreground">
        Both wheels start at the first value and add the second for each point of Speed. Each point
        of Spin moves the third value from one wheel to the other.
      </p>
      <div className="grid gap-3 wide:grid-cols-3">
        {MAPPING_FIELDS.map(({ key, label }) => (
          <NumberField
            key={key}
            label={label}
            value={settings.speedSpin[key]}
            min={0}
            step={10}
            onCommit={(value) => save({ speedSpin: { ...settings.speedSpin, [key]: value } })}
          />
        ))}
      </div>
    </SettingsCard>
  );
}

function WheelBar({
  name,
  rpm,
  limits,
}: {
  name: string;
  rpm: number;
  limits: Settings['rpmLimits'];
}) {
  const outside = rpm < limits.min || rpm > limits.max;
  const width = Math.min(100, Math.max(2, (rpm / BALL_LIMITS.upperRpm.max) * 100));
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)_90px] items-center gap-2.5 text-[13px]">
      <span>{name}</span>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        <i
          className={cn('block h-full rounded-full', outside ? 'bg-destructive' : 'bg-primary')}
          style={{ width: `${width}%` }}
        />
      </div>
      <b className={cn('text-right font-mono font-medium', outside && 'text-destructive')}>
        {formatRpm(rpm)} rpm
        {outside && <span className="sr-only"> (outside your limits)</span>}
      </b>
    </div>
  );
}
