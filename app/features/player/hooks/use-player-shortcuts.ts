import { useEffect, useEffectEvent } from 'react';

type Shortcuts = { togglePause(): void; stop(): void };

/** Space pauses and resumes, Esc stops. Only while `active`, so the keys do nothing when no drill plays here. */
export function usePlayerShortcuts(active: boolean, { togglePause, stop }: Shortcuts) {
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.repeat) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target instanceof Element ? event.target : null;
    // Typing in a field, or Esc closing a menu or dialog.
    if (target?.closest('input, textarea, select, [contenteditable], [role=menu], [role=dialog]'))
      return;
    if (event.key === ' ') {
      // Space already presses the focused button or switch.
      if (target?.closest('button, a, [role=switch]')) return;
      event.preventDefault();
      togglePause();
    } else if (event.key === 'Escape') {
      stop();
    }
  });

  useEffect(() => {
    if (!active) return;
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active]);
}
