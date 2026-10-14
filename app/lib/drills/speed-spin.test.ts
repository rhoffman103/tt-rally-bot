import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SPEED_SPIN,
  fromRpm,
  SPEED_LIMITS,
  SPIN_LIMITS,
  toRpm,
} from '~/lib/drills/speed-spin';

describe('toRpm', () => {
  it('matches the mockup’s placeholder mapping', () => {
    expect(toRpm({ speed: 6, spin: 4 }, DEFAULT_SPEED_SPIN)).toEqual({
      upperRpm: 5220,
      lowerRpm: 3860,
    });
    expect(toRpm({ speed: 3, spin: -5 }, DEFAULT_SPEED_SPIN)).toEqual({
      upperRpm: 1620,
      lowerRpm: 3320,
    });
  });

  it('gives both wheels the same speed with no spin', () => {
    expect(toRpm({ speed: 0, spin: 0 }, DEFAULT_SPEED_SPIN)).toEqual({
      upperRpm: 400,
      lowerRpm: 400,
    });
  });

  it('rounds to 10 rpm', () => {
    const { upperRpm, lowerRpm } = toRpm({ speed: 0.5, spin: 0 }, DEFAULT_SPEED_SPIN);
    expect(upperRpm).toBe(750); // 745 rounded
    expect(lowerRpm).toBe(750);
  });

  it('uses the mapping it is given', () => {
    const mapping = { baseRpm: 1000, rpmPerSpeed: 500, rpmPerSpin: 100 };
    expect(toRpm({ speed: 2, spin: 3 }, mapping)).toEqual({ upperRpm: 2300, lowerRpm: 1700 });
  });

  it('does not clamp: out-of-range rpm is left for validateBall to report', () => {
    expect(toRpm({ speed: 10, spin: 10 }, DEFAULT_SPEED_SPIN).upperRpm).toBe(9000);
    expect(toRpm({ speed: 0, spin: 10 }, DEFAULT_SPEED_SPIN).lowerRpm).toBe(-1300);
  });
});

describe('fromRpm', () => {
  it('undoes toRpm for every slider position', () => {
    for (let speed = SPEED_LIMITS.min; speed <= SPEED_LIMITS.max; speed += SPEED_LIMITS.step) {
      for (let spin = SPIN_LIMITS.min; spin <= SPIN_LIMITS.max; spin += SPIN_LIMITS.step) {
        expect(fromRpm(toRpm({ speed, spin }, DEFAULT_SPEED_SPIN), DEFAULT_SPEED_SPIN)).toEqual({
          speed,
          spin,
        });
      }
    }
  });

  it('rounds rpm set by hand to the nearest slider step', () => {
    expect(fromRpm({ upperRpm: 5300, lowerRpm: 3800 }, DEFAULT_SPEED_SPIN)).toEqual({
      speed: 6,
      spin: 4.5,
    });
  });

  it('keeps the result in the sliders’ ranges', () => {
    expect(fromRpm({ upperRpm: 7500, lowerRpm: 7500 }, DEFAULT_SPEED_SPIN).speed).toBe(10);
    expect(fromRpm({ upperRpm: 400, lowerRpm: 7500 }, DEFAULT_SPEED_SPIN).spin).toBe(-10);
    expect(fromRpm({ upperRpm: 400, lowerRpm: 400 }, DEFAULT_SPEED_SPIN)).toEqual({
      speed: 0,
      spin: 0,
    });
  });
});
