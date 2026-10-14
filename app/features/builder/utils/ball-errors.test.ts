import { describe, expect, it } from 'vitest';

import { testBall } from '~/testing/drills';
import { ballErrors, firstBadBall, wheelProblem } from '~/features/builder/utils/ball-errors';

const robot = { min: 400, max: 7500 };
const mine = { min: 1000, max: 6000 };

describe('ballErrors', () => {
  it('uses the robot’s limits, then your own', () => {
    expect(ballErrors(testBall(), robot)).toEqual({});
    expect(ballErrors(testBall({ upperRpm: 8000 }), robot).upperRpm).toMatch(/400 to 7500/);
    expect(ballErrors(testBall({ upperRpm: 6500, lowerRpm: 900 }), mine)).toEqual({
      upperRpm: 'Faster than your limit of 6,000 rpm (Settings).',
      lowerRpm: 'Slower than your limit of 1,000 rpm (Settings).',
    });
    expect(ballErrors(testBall({ frequency: 55 }), robot)).toHaveProperty('frequency');
  });
});

describe('firstBadBall', () => {
  it('finds the first ball with an error', () => {
    const lines = [
      { alternatives: [testBall()] },
      { alternatives: [testBall(), testBall({ height: 200 })] },
    ];
    expect(firstBadBall(lines, robot)).toEqual({ line: 1, alt: 1 });
    expect(firstBadBall(lines.slice(0, 1), robot)).toBeNull();
  });
});

describe('wheelProblem', () => {
  it('says whether the wheels are too fast or too slow', () => {
    expect(wheelProblem(testBall(), robot)).toBeNull();
    expect(wheelProblem(testBall({ upperRpm: 7600 }), robot)).toMatch(/^Too fast: .* 7,500 rpm/);
    expect(wheelProblem(testBall({ lowerRpm: 900 }), mine)).toMatch(/^Too slow: .* 1,000 rpm/);
    expect(wheelProblem(testBall({ height: 200 }), robot)).toBeNull();
  });
});
