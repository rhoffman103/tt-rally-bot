import { data, redirect } from 'react-router';

import type { Route } from './+types/drill';
import { deleteDrill, duplicateDrill, getDrill } from '~/lib/drills/storage';
import { loadSettings } from '~/lib/settings';
import { DrillPlayer } from '~/features/player/components/drill-player';
import type { PlayerResult, PlayerAction } from '~/features/player/types/player-action';
import { ShareButton } from '~/features/sharing/components/share-button';

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  return [{ title: `${loaderData?.drill.name ?? 'Drill'} · TT Rally Bot` }];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const drill = await getDrill(params.id);
  if (!drill) throw data('This drill doesn’t exist.', { status: 404 });
  return { drill, speedSpin: loadSettings().speedSpin };
}

/** "Copy and edit" on a preset saves a copy, then opens it in the builder. Delete goes back to the library. */
export async function clientAction({ request }: Route.ClientActionArgs) {
  const action = (await request.json()) as PlayerAction;
  try {
    if (action.intent === 'delete') {
      await deleteDrill(action.drillId);
      return redirect('/');
    }
    const copy = await duplicateDrill(action.drillId);
    return redirect(`/builder/${copy.id}`);
  } catch (error) {
    const result: PlayerResult = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    return result;
  }
}

export default function DrillRoute({ loaderData }: Route.ComponentProps) {
  const { drill, speedSpin } = loaderData;
  return (
    <DrillPlayer
      key={drill.id}
      drill={drill}
      speedSpin={speedSpin}
      share={<ShareButton drill={drill} />}
    />
  );
}
