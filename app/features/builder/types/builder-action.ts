import type { DrillDraft } from '~/lib/drills/storage';
import type { Drill } from '~/lib/drills/types';

/** What the builder sends to its route's `clientAction`, as JSON. */
export type BuilderAction = { intent: 'save'; drill: DrillDraft };

/** `created` is true when the drill had no id before: the builder then moves to the drill's own address. */
export type SaveResult =
  { ok: true; drill: Drill; created: boolean } | { ok: false; error: string };
