import { useEffect } from 'react';
import { useFetcher } from 'react-router';
import { toast } from 'sonner';

import type { PlanAction, PlanCommandResult } from '~/features/plans/types/plan-action';

/**
 * Copies or deletes a plan through the route's `clientAction`. The route moves to the copy's editor or to the plan
 * list when it works, so only errors come back.
 */
export function usePlanCommand() {
  const fetcher = useFetcher<PlanCommandResult>();
  const result = fetcher.data;

  useEffect(() => {
    if (result) toast.error(result.error);
  }, [result]);

  const run = (intent: 'duplicate' | 'delete', planId: string) => {
    const action: PlanAction = { intent, planId };
    void fetcher.submit(action, { method: 'post', encType: 'application/json' });
  };
  return {
    duplicate: (planId: string) => run('duplicate', planId),
    remove: (planId: string) => run('delete', planId),
    pending: fetcher.state !== 'idle',
  };
}
