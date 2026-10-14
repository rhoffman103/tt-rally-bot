import { useEffect } from 'react';
import { useFetcher, useNavigate } from 'react-router';
import { toast } from 'sonner';

import type { PlanDraft } from '~/lib/plans/storage';
import { AFTER_SAVE } from '~/hooks/use-unsaved-warning';
import type { PlanAction, SavePlanResult } from '~/features/plans/types/plan-action';

/** Saves the plan through the route's `clientAction`, then shows the saved plan. */
export function useSavePlan() {
  const fetcher = useFetcher<SavePlanResult>();
  const navigate = useNavigate();
  const result = fetcher.data;

  useEffect(() => {
    if (result?.ok) {
      toast.success(`Saved “${result.plan.name}”`);
      void navigate(`/plans/${result.plan.id}`, { replace: result.created, state: AFTER_SAVE });
    } else if (result) {
      toast.error(result.error);
    }
  }, [result, navigate]);

  const save = (plan: PlanDraft) => {
    const action: PlanAction = { intent: 'save', plan };
    void fetcher.submit(action, { method: 'post', encType: 'application/json' });
  };
  return { save, saving: fetcher.state !== 'idle' };
}
