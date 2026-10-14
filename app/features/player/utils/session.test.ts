import { describe, expect, it } from 'vitest';

import { testBall, testDrill } from '~/testing/drills';
import {
  clock,
  drillForSession,
  remaining,
  sessionOf,
  withAmount,
  withDurationKind,
  withPause,
} from '~/features/player/utils/session';

const drill = testDrill([testBall()], {
  duration: { kind: 'minutes', value: 5 },
  randomOrder: true,
  pauseBetweenSetsSec: 3,
});

describe('sessionOf', () => {
  it('starts with the drill’s own settings', () => {
    expect(sessionOf(drill)).toEqual({
      duration: { kind: 'minutes', value: 5 },
      randomOrder: true,
      pauseBetweenSetsSec: 3,
    });
  });

  it('has no rest when the drill has none', () => {
    expect(sessionOf(testDrill([testBall()])).pauseBetweenSetsSec).toBe(0);
  });
});

describe('withDurationKind', () => {
  const session = sessionOf(drill);

  it('keeps the number between minutes and sets', () => {
    expect(withDurationKind(session, 'combos').duration).toEqual({ kind: 'combos', value: 5 });
  });

  it('starts at 1 minute or 10 sets when coming from endless', () => {
    const endless = withDurationKind(session, 'endless');
    expect(endless.duration).toEqual({ kind: 'endless' });
    expect(withDurationKind(endless, 'minutes').duration).toEqual({ kind: 'minutes', value: 1 });
    expect(withDurationKind(endless, 'combos').duration).toEqual({ kind: 'combos', value: 10 });
  });

  it('rounds half a minute to a whole number of sets', () => {
    const half = withAmount(session, 1.5);
    expect(withDurationKind(half, 'combos').duration).toEqual({ kind: 'combos', value: 2 });
  });

  it('keeps a number that is too big for the new kind in range', () => {
    const sets = withAmount(withDurationKind(session, 'combos'), 500);
    expect(withDurationKind(sets, 'minutes').duration).toEqual({ kind: 'minutes', value: 120 });
  });

  it('returns the same session for the same kind', () => {
    expect(withDurationKind(session, 'minutes')).toBe(session);
  });
});

describe('withAmount and withPause', () => {
  const session = sessionOf(drill);

  it('rounds minutes to 30 seconds and keeps values in range', () => {
    expect(withAmount(session, 1.5).duration).toEqual({ kind: 'minutes', value: 1.5 });
    expect(withAmount(session, 7.6).duration).toEqual({ kind: 'minutes', value: 7.5 });
    expect(withAmount(session, 0).duration).toEqual({ kind: 'minutes', value: 0.5 });
    expect(withAmount(session, Number.NaN).duration).toEqual({ kind: 'minutes', value: 0.5 });
    expect(withAmount(withDurationKind(session, 'combos'), 7.6).duration).toEqual({
      kind: 'combos',
      value: 8,
    });
    expect(withPause(session, -2).pauseBetweenSetsSec).toBe(0);
    expect(withPause(session, 600).pauseBetweenSetsSec).toBe(60);
  });

  it('does nothing to an endless session’s number', () => {
    const endless = withDurationKind(session, 'endless');
    expect(withAmount(endless, 5)).toBe(endless);
  });
});

describe('drillForSession', () => {
  it('puts the session’s settings into the drill', () => {
    const played = drillForSession(drill, {
      duration: { kind: 'combos', value: 2 },
      randomOrder: false,
      pauseBetweenSetsSec: 10,
    });
    expect(played).toMatchObject({
      id: drill.id,
      lines: drill.lines,
      duration: { kind: 'combos', value: 2 },
      randomOrder: false,
      pauseBetweenSetsSec: 10,
    });
  });

  it('leaves out a rest of 0 seconds', () => {
    const played = drillForSession(drill, { ...sessionOf(drill), pauseBetweenSetsSec: 0 });
    expect(played).not.toHaveProperty('pauseBetweenSetsSec');
  });
});

describe('clock', () => {
  it('shows minutes and seconds', () => {
    expect(clock(0)).toBe('00:00');
    expect(clock(247.9)).toBe('04:07');
    expect(clock(4500)).toBe('75:00');
    expect(clock(-3)).toBe('00:00');
  });
});

describe('remaining', () => {
  it('has no bar for an endless drill', () => {
    expect(remaining({ kind: 'endless' }, { set: 3, elapsedSec: 90 })).toEqual({
      share: null,
      label: 'Plays until you stop it',
    });
  });

  it('counts down minutes', () => {
    expect(remaining({ kind: 'minutes', value: 2 }, { set: 0, elapsedSec: 30 })).toEqual({
      share: 0.25,
      label: '01:30 left',
    });
  });

  it('counts down sets', () => {
    expect(remaining({ kind: 'combos', value: 4 }, { set: 3, elapsedSec: 0 })).toEqual({
      share: 0.75,
      label: '1 set left',
    });
    expect(remaining({ kind: 'combos', value: 4 }, { set: 5, elapsedSec: 0 })).toEqual({
      share: 1,
      label: '0 sets left',
    });
  });
});
