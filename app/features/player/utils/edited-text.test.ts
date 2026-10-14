import { describe, expect, it } from 'vitest';

import { editedText } from '~/features/player/utils/edited-text';

// Local times, so the tests pass in every time zone.
const now = new Date(2026, 9, 9, 9, 30);
const at = (...parts: [number, number, number, number?]) =>
  new Date(parts[0], parts[1], parts[2], parts[3] ?? 12).toISOString();

describe('editedText', () => {
  it('counts calendar days, not 24-hour periods', () => {
    expect(editedText(at(2026, 9, 9, 1), now)).toBe('Edited today');
    expect(editedText(at(2026, 9, 8, 23), now)).toBe('Edited yesterday');
    expect(editedText(at(2026, 9, 6), now)).toBe('Edited 3 days ago');
  });

  it('shows the date after a week', () => {
    expect(editedText(at(2026, 9, 2), now)).toBe('Edited Oct 2');
    expect(editedText(at(2025, 11, 31), now)).toBe('Edited Dec 31, 2025');
  });

  it('says today for a time in the future', () => {
    expect(editedText(at(2026, 9, 10), now)).toBe('Edited today');
  });
});
