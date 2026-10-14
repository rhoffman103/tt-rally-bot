import { useEffect } from 'react';
import { useFetcher } from 'react-router';
import { toast } from 'sonner';

import type { PlayerResult, PlayerAction } from '~/features/player/types/player-action';

/** Saves a copy of a drill as a custom drill, through the route's `clientAction`. */
export function useDuplicateDrill() {
  const fetcher = useFetcher<PlayerResult>();
  const result = fetcher.data;

  useEffect(() => {
    if (!result) return;
    if (result.ok) toast.success(`Saved “${result.name}” in My drills`);
    else toast.error(result.error);
  }, [result]);

  const duplicate = (drillId: string) => {
    const action: PlayerAction = { intent: 'duplicate', drillId };
    void fetcher.submit(action, { method: 'post', encType: 'application/json' });
  };
  return { duplicate, pending: fetcher.state !== 'idle' };
}
