import { data } from 'react-router';

import type { Route } from './+types/builder';
import { getDrill, saveDrill } from '~/lib/drills/storage';
import { loadSettings } from '~/lib/settings';
import { DrillBuilder } from '~/features/builder/components/drill-builder';
import type { BuilderAction, SaveResult } from '~/features/builder/types/builder-action';
import { ShareButton } from '~/features/sharing/components/share-button';

// Serves two route ids: builder-new (/builder/new) and builder-edit (/builder/:id).
export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  const name = loaderData?.drill?.name;
  return [{ title: name ? `Edit ${name} · TT Rally Bot` : 'New drill · TT Rally Bot' }];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { speedSpin, rpmLimits } = loadSettings();
  const id = 'id' in params ? params.id : undefined;
  const drill = id ? await getDrill(id) : null;
  if (id && !drill) throw data('This drill doesn’t exist.', { status: 404 });
  return { drill, speedSpin, rpmLimits };
}

export async function clientAction({ request }: Route.ClientActionArgs): Promise<SaveResult> {
  const action = (await request.json()) as BuilderAction;
  try {
    const drill = await saveDrill(action.drill);
    return { ok: true, drill, created: !action.drill.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export default function Builder({ loaderData }: Route.ComponentProps) {
  const { drill, speedSpin, rpmLimits } = loaderData;
  // A new key starts the builder again, for example after a new drill is saved and gets its own address.
  return (
    <DrillBuilder
      key={drill?.id ?? 'new'}
      drill={drill}
      speedSpin={speedSpin}
      rpmLimits={rpmLimits}
      share={(shared) => <ShareButton drill={shared} />}
    />
  );
}
