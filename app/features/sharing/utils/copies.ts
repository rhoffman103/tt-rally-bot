// Compares a shared drill with the copy already saved, for "You already have this drill".
import type { Drill } from '~/lib/drills/types';

/** Whether the shared copy was changed after the saved one, before it, or at the same time. */
export function compareCopies(
  shared: Pick<Drill, 'updatedAt'>,
  mine: Pick<Drill, 'updatedAt'>,
): 'newer' | 'older' | 'same' {
  const diff = Date.parse(shared.updatedAt) - Date.parse(mine.updatedAt);
  return diff > 0 ? 'newer' : diff < 0 ? 'older' : 'same';
}

/**
 * "Oct 8", or "Oct 8, 2025" in another year. With `time`, also the time of day, to tell two changes on the same day
 * apart.
 */
export function changedOn(iso: string, { time = false, now = new Date() } = {}): string {
  const date = new Date(iso);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
    ...(time ? { hour: 'numeric', minute: '2-digit' } : {}),
  });
}

export const sameDay = (a: string, b: string) =>
  new Date(a).toDateString() === new Date(b).toDateString();
