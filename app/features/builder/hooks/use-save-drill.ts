import { useEffect } from 'react';
import { useFetcher, useNavigate } from 'react-router';
import { toast } from 'sonner';

import type { DrillDraft } from '~/lib/drills/storage';
import type { BuilderAction, SaveResult } from '~/features/builder/types/builder-action';
import { AFTER_SAVE } from '~/hooks/use-unsaved-warning';

/** Saves the drill through the route's `clientAction`. A new drill then moves to its own address. */
export function useSaveDrill() {
  const fetcher = useFetcher<SaveResult>();
  const navigate = useNavigate();
  const result = fetcher.data;

  useEffect(() => {
    if (!result) return;
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const { drill } = result;
    toast.success(`Saved “${drill.name}”`, {
      action: { label: 'Play', onClick: () => void navigate(`/drills/${drill.id}`) },
    });
    if (result.created) {
      void navigate(`/builder/${drill.id}`, { replace: true, state: AFTER_SAVE });
    }
  }, [result, navigate]);

  const save = (drill: DrillDraft) => {
    const action: BuilderAction = { intent: 'save', drill };
    void fetcher.submit(action, { method: 'post', encType: 'application/json' });
  };
  return { save, saving: fetcher.state !== 'idle' };
}
