import { describe, expect, it } from 'vitest';

import { ballLabel, ballSummary, durationText, hasRandomLine } from '~/lib/drills/describe';
import { describeLanding } from '~/lib/drills/landing';
import { DEFAULT_SPEED_SPIN } from '~/lib/drills/speed-spin';
import { testBall, testDrill } from '~/testing/drills';

describe('hasRandomLine', () => {
  it('is true only when a line has more than one ball', () => {
    expect(hasRandomLine(testDrill([testBall(), testBall()]))).toBe(false);
    expect(hasRandomLine(testDrill([testBall(), [testBall(), testBall()]]))).toBe(true);
  });
});

describe('ballLabel', () => {
  it('numbers lines from 1 and letters random balls', () => {
    const { lines } = testDrill([testBall(), [testBall(), testBall()]]);
    expect(ballLabel(lines[0], 0, 0)).toBe('1');
    expect(ballLabel(lines[1], 1, 0)).toBe('2a');
    expect(ballLabel(lines[1], 1, 1)).toBe('2b');
  });
});

describe('durationText', () => {
  it('describes each kind of duration', () => {
    expect(durationText({ kind: 'endless' })).toBe('Endless');
    expect(durationText({ kind: 'minutes', value: 10 })).toBe('10 min');
    expect(durationText({ kind: 'minutes', value: 1.5 })).toBe('1.5 min');
    expect(durationText({ kind: 'combos', value: 1 })).toBe('1 set');
    expect(durationText({ kind: 'combos', value: 5 })).toBe('5 sets');
  });
});

describe('ballSummary', () => {
  it('names the spin from the wheel speeds, then where the ball lands', () => {
    const where = (ball: ReturnType<typeof testBall>) => describeLanding(ball).toLowerCase();
    const top = testBall({ upperRpm: 3000, lowerRpm: 2000 });
    const flat = testBall({ upperRpm: 2500, lowerRpm: 2500 });
    const back = testBall({ upperRpm: 2000, lowerRpm: 3000 });
    expect(ballSummary(top, DEFAULT_SPEED_SPIN)).toBe(`Topspin, ${where(top)}`);
    expect(ballSummary(flat, DEFAULT_SPEED_SPIN)).toBe(`Flat, ${where(flat)}`);
    expect(ballSummary(back, DEFAULT_SPEED_SPIN)).toBe(`Backspin, ${where(back)}`);
  });
});
