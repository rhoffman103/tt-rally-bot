import { BALL_LIMITS } from '~/lib/robot/protocol';
import type { Settings } from '~/lib/settings';
import { NumberField } from '~/components/number-field';
import { SettingsCard } from '~/features/settings/components/settings-card';
import { useSaveSettings } from '~/features/settings/hooks/use-save-settings';
import { formatRpm } from '~/utils/format';

const ROBOT = BALL_LIMITS.upperRpm;

export function RpmLimitsCard({ saved }: { saved: Settings }) {
  const { settings, save } = useSaveSettings(saved);
  const { min, max } = settings.rpmLimits;
  return (
    <SettingsCard
      title="Wheel speed limits"
      description={`The robot accepts ${formatRpm(ROBOT.min)} to ${formatRpm(ROBOT.max)} rpm. Lower the top limit to keep every drill slower.`}
    >
      <div className="grid max-w-[420px] grid-cols-2 gap-3">
        <NumberField
          label="Lowest"
          value={min}
          min={ROBOT.min}
          max={ROBOT.max}
          step={10}
          onCommit={(value) => save({ rpmLimits: { min: value, max } })}
        />
        <NumberField
          label="Highest"
          value={max}
          min={ROBOT.min}
          max={ROBOT.max}
          step={10}
          onCommit={(value) => save({ rpmLimits: { min, max: value } })}
        />
      </div>
    </SettingsCard>
  );
}
