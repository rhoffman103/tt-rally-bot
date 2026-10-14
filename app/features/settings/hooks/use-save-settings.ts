import { useFetcher } from 'react-router';

import type { Settings } from '~/lib/settings';
import type { SettingsAction } from '~/features/settings/types/settings-action';

/**
 * Saves settings through the route's `clientAction`. `settings` already has the changes being saved, so the screen
 * doesn't jump back while the loader reloads.
 */
export function useSaveSettings(saved: Settings) {
  const fetcher = useFetcher();
  const pending = fetcher.json as SettingsAction | undefined;
  const settings = pending?.intent === 'save' ? { ...saved, ...pending.changes } : saved;

  const save = (changes: Partial<Settings>) => {
    const action: SettingsAction = { intent: 'save', changes };
    void fetcher.submit(action, { method: 'post', encType: 'application/json' });
  };
  return { settings, save };
}
