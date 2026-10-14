import { describe, expect, it } from 'vitest';

import { describeLanding, heightForDepth, landingDepth } from '~/lib/drills/landing';
import { testBall } from '~/testing/drills';

describe('landingDepth', () => {
  it('lands deeper with more height', () => {
    expect(landingDepth(testBall({ height: 80 }))).toBeGreaterThan(
      landingDepth(testBall({ height: 0 })),
    );
  });

  it('lands deeper with faster wheels', () => {
    expect(landingDepth(testBall({ upperRpm: 6000, lowerRpm: 5000 }))).toBeGreaterThan(
      landingDepth(testBall({ upperRpm: 2000, lowerRpm: 1000 })),
    );
  });

  it('stays on the table', () => {
    expect(landingDepth(testBall({ height: -50, upperRpm: 400, lowerRpm: 400 }))).toBe(0.08);
    expect(landingDepth(testBall({ height: 100, upperRpm: 7500, lowerRpm: 7500 }))).toBe(0.96);
  });
});

describe('heightForDepth', () => {
  it('undoes landingDepth', () => {
    for (const height of [-50, -10, 0, 35, 70]) {
      const ball = testBall({ height });
      expect(heightForDepth(landingDepth(ball), ball)).toBe(height);
    }
  });

  it('keeps the height in range', () => {
    expect(heightForDepth(0, testBall())).toBe(-50);
    expect(heightForDepth(1, testBall({ upperRpm: 400, lowerRpm: 400 }))).toBe(100);
  });
});

describe('describeLanding', () => {
  it('names the length and the side', () => {
    expect(
      describeLanding(testBall({ height: -50, upperRpm: 400, lowerRpm: 400, dropPoint: -6 })),
    ).toBe('Short, backhand');
    expect(describeLanding(testBall({ height: 20, dropPoint: 0 }))).toBe('Half-long, middle');
    expect(describeLanding(testBall({ height: 100, dropPoint: 4 }))).toBe('Long, forehand');
  });
});
