import { describe, expect, it } from 'vitest';

import { changedOn, compareCopies, sameDay } from '~/features/sharing/utils/copies';

describe('compareCopies', () => {
  it('compares the times the copies were changed', () => {
    const at = (updatedAt: string) => ({ updatedAt });
    expect(compareCopies(at('2026-10-08T10:00:00Z'), at('2026-10-06T10:00:00Z'))).toBe('newer');
    expect(compareCopies(at('2026-10-06T10:00:00Z'), at('2026-10-08T10:00:00Z'))).toBe('older');
    expect(compareCopies(at('2026-10-08T10:00:00Z'), at('2026-10-08T10:00:00Z'))).toBe('same');
  });
});

describe('changedOn', () => {
  const now = new Date(2026, 9, 9);

  it('gives the day, and the year only when it isn’t this year', () => {
    expect(changedOn(new Date(2026, 9, 8, 15, 5).toISOString(), { now })).toBe('Oct 8');
    expect(changedOn(new Date(2025, 9, 8).toISOString(), { now })).toBe('Oct 8, 2025');
  });

  it('adds the time when asked', () => {
    expect(changedOn(new Date(2026, 9, 8, 15, 5).toISOString(), { now, time: true })).toBe(
      'Oct 8, 3:05 PM',
    );
  });
});

describe('sameDay', () => {
  it('is true for two times on the same local day', () => {
    expect(
      sameDay(new Date(2026, 9, 8, 1).toISOString(), new Date(2026, 9, 8, 23).toISOString()),
    ).toBe(true);
    expect(sameDay(new Date(2026, 9, 8).toISOString(), new Date(2026, 9, 9).toISOString())).toBe(
      false,
    );
  });
});
