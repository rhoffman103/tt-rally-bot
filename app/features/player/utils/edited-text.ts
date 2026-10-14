const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole calendar days from `then` to `now`, in local time. */
function daysBetween(then: Date, now: Date): number {
  const start = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((start(now).getTime() - start(then).getTime()) / DAY_MS);
}

/** "Edited today", "Edited yesterday", "Edited 3 days ago" or "Edited Oct 2" (with the year if it isn't this one). */
export function editedText(updatedAt: string, now = new Date()): string {
  const then = new Date(updatedAt);
  const days = daysBetween(then, now);
  if (days <= 0) return 'Edited today';
  if (days === 1) return 'Edited yesterday';
  if (days < 7) return `Edited ${days} days ago`;
  const date = then.toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
    ...(then.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
  return `Edited ${date}`;
}
