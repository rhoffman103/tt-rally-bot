import type { DrillDraft } from '~/lib/drills/storage';
import type { Settings } from '~/lib/settings';

/** What the /settings screen sends to its `clientAction`, as JSON. */
export type SettingsAction =
  | { intent: 'save'; changes: Partial<Settings> }
  | { intent: 'import-drills'; fileName: string; text: string }
  | { intent: 'save-drills'; drills: DrillDraft[] };
