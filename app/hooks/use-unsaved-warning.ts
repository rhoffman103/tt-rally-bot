import { useEffect } from 'react';
import { useBlocker } from 'react-router';

/** Location state for a move after saving, for example from /builder/new to the saved drill's address. It is never
 * blocked. */
export const AFTER_SAVE = { afterSave: true };

const isAfterSave = (state: unknown) =>
  typeof state === 'object' && state !== null && 'afterSave' in state;

/**
 * Asks before leaving an editor with unsaved changes: the returned blocker for moves inside the app, and the
 * browser's own question for closing or reloading the tab.
 */
export function useUnsavedWarning(dirty: boolean) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty &&
      currentLocation.pathname !== nextLocation.pathname &&
      !isAfterSave(nextLocation.state),
  );

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  return blocker;
}
