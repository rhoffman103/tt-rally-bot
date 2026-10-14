import { useEffect } from 'react';
import { useFetcher } from 'react-router';
import { toast } from 'sonner';

import type { PlayerAction, PlayerResult } from '~/features/player/types/player-action';

/** Deletes a custom drill through the route's `clientAction`. */
export function useDeleteDrill() {
  const fetcher = useFetcher<PlayerResult>();
  const result = fetcher.data;

  useEffect(() => {
    if (!result) return;
    if (result.ok) toast.success(`Deleted “${result.name}”`);
    else toast.error(result.error);
  }, [result]);

  const remove = (drillId: string) => {
    const action: PlayerAction = { intent: 'delete', drillId };
    void fetcher.submit(action, { method: 'post', encType: 'application/json' });
  };
  return { remove, pending: fetcher.state !== 'idle' };
}
