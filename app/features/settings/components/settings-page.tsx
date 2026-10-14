import type { ReactNode } from 'react';

import type { Settings } from '~/lib/settings';
import { CaptureCard } from '~/features/settings/components/capture-card';
import { DebugLogCard } from '~/features/settings/components/debug-log-card';
import { DrillsCard } from '~/features/settings/components/drills-card';
import { RpmLimitsCard } from '~/features/settings/components/rpm-limits-card';
import { SpeedSpinCard } from '~/features/settings/components/speed-spin-card';

type SettingsPageProps = {
  settings: Settings;
  myDrillCount: number;
  /** The Robot card, from the connection feature. */
  robotCard: ReactNode;
};

export function SettingsPage({ settings, myDrillCount, robotCard }: SettingsPageProps) {
  return (
    <>
      <div className="mb-5">
        <h1 className="text-[26px]/[1.2] font-semibold tracking-[-0.02em] max-wide:text-[22px]">
          Settings
        </h1>
        <p className="mt-1 text-muted-foreground">Saved in this browser.</p>
      </div>
      <div className="grid max-w-[760px] gap-4">
        {robotCard}
        <RpmLimitsCard saved={settings} />
        <SpeedSpinCard saved={settings} />
        <DrillsCard myDrillCount={myDrillCount} />
        <CaptureCard />
        <DebugLogCard saved={settings} />
      </div>
    </>
  );
}
