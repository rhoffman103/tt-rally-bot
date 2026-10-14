import type { Route } from './+types/settings';
import { importDrillFile, listDrills, saveDrill, type ImportResult } from '~/lib/drills/storage';
import { loadSettings, saveSettings } from '~/lib/settings';
import { RobotCard } from '~/features/connection/components/robot-card';
import { SettingsPage } from '~/features/settings/components/settings-page';
import { SimulatedRobotSwitch } from '~/features/settings/components/simulated-robot-switch';
import type { SettingsAction } from '~/features/settings/types/settings-action';

export function meta(): Route.MetaDescriptors {
  return [{ title: 'Settings · TT Rally Bot' }];
}

export async function clientLoader() {
  const drills = await listDrills();
  return {
    settings: loadSettings(),
    myDrillCount: drills.filter((drill) => drill.source === 'custom').length,
  };
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const action = (await request.json()) as SettingsAction;
  if (action.intent === 'import-drills') return importDrillFile(action.fileName, action.text);
  if (action.intent === 'save-drills') {
    const saved = [];
    for (const draft of action.drills) saved.push(await saveDrill(draft));
    return { ok: true, drills: saved } satisfies ImportResult;
  }
  saveSettings(action.changes);
  return null;
}

export default function Settings({ loaderData }: Route.ComponentProps) {
  const { settings, myDrillCount } = loaderData;
  return (
    <SettingsPage
      settings={settings}
      myDrillCount={myDrillCount}
      robotCard={
        <RobotCard>
          <SimulatedRobotSwitch saved={settings} />
        </RobotCard>
      }
    />
  );
}
