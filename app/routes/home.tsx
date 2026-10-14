import type { Route } from './+types/home';
import {
  deleteDrill,
  duplicateDrill,
  getDrill,
  listDrills,
  listFavorites,
  setFavorite,
} from '~/lib/drills/storage';
import { DrillLibrary } from '~/features/player/components/drill-library';
import type { PlayerResult, PlayerAction } from '~/features/player/types/player-action';

export function meta(): Route.MetaDescriptors {
  return [{ title: 'Drills · TT Rally Bot' }];
}

export async function clientLoader() {
  return { drills: await listDrills(), favorites: await listFavorites() };
}

export async function clientAction({
  request,
}: Route.ClientActionArgs): Promise<PlayerResult | null> {
  const action = (await request.json()) as PlayerAction;
  if (action.intent === 'favorite') {
    await setFavorite(action.drillId, action.favorite);
    return null;
  }
  try {
    if (action.intent === 'delete') {
      const drill = await getDrill(action.drillId);
      await deleteDrill(action.drillId);
      return { ok: true, name: drill?.name ?? 'the drill' };
    }
    const copy = await duplicateDrill(action.drillId);
    return { ok: true, name: copy.name };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return <DrillLibrary drills={loaderData.drills} favorites={loaderData.favorites} />;
}
