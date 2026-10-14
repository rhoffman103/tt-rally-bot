import type { PlanDraft } from '~/lib/plans/storage';
import type { Plan } from '~/lib/plans/types';

/** What the plan screens send to their route's `clientAction`, as JSON. */
export type PlanAction =
  | { intent: 'save'; plan: PlanDraft }
  | { intent: 'duplicate'; planId: string }
  | { intent: 'delete'; planId: string };

/** `created` is true when the plan had no id before. */
export type SavePlanResult =
  { ok: true; plan: Plan; created: boolean } | { ok: false; error: string };

/** Copy and delete move to another screen when they work, so they return only errors. */
export type PlanCommandResult = { ok: false; error: string };
