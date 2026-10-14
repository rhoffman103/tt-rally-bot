import { useFetcher } from 'react-router';

import type { PlayerAction } from '~/features/player/types/player-action';

/**
 * Stars a drill as a favorite, or takes the star away, through the route's `clientAction`. `favorite` already shows
 * the change being saved, so the star doesn't jump back while the loader reloads.
 */
export function useFavorite(drillId: string, saved: boolean) {
  const fetcher = useFetcher();
  const pending = fetcher.json as PlayerAction | undefined;
  const favorite = pending?.intent === 'favorite' ? pending.favorite : saved;

  const toggle = () => {
    const action: PlayerAction = { intent: 'favorite', drillId, favorite: !favorite };
    void fetcher.submit(action, { method: 'post', encType: 'application/json' });
  };
  return { favorite, toggle };
}
