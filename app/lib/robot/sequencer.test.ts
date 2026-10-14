import { describe, expect, it } from 'vitest';

import {
  ballsBetween,
  ballsPerSet,
  needsSequencer,
  planSet,
  robotBalls,
} from '~/lib/robot/sequencer';
import { testBall, testDrill } from '~/testing/drills';

const balls = (count: number) =>
  Array.from({ length: count }, (_, i) => testBall({ upperRpm: 1000 + i }));

/** A fixed list of "random" numbers, repeated. */
const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('needsSequencer', () => {
  it('leaves drills of up to 9 single-ball lines to the robot', () => {
    expect(needsSequencer(testDrill(balls(9)))).toBe(false);
  });

  it('plays drills of more than 9 lines line by line', () => {
    expect(needsSequencer(testDrill(balls(10)))).toBe(true);
  });

  it('plays drills with a random line line by line', () => {
    expect(needsSequencer(testDrill([testBall(), balls(2)]))).toBe(true);
  });
});

describe('planSet', () => {
  it('plays every line once, in order, and picks one ball for each random line', () => {
    const [a, b, c] = balls(3);
    const set = planSet(testDrill([a, [b, c]]), sequence(0.9));
    expect(set).toEqual([
      { line: 0, ball: a },
      { line: 1, ball: c },
    ]);
  });

  it('shuffles the lines when the drill has random order', () => {
    const drill = testDrill(balls(5), { randomOrder: true });
    const set = planSet(drill, sequence(0));
    expect(set.map((p) => p.line)).not.toEqual([0, 1, 2, 3, 4]);
    expect(set.map((p) => p.line).sort()).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('robotBalls and ballsPerSet', () => {
  it('takes the first ball of each line and counts the repetitions', () => {
    const a = testBall({ repetitions: 3 });
    const b = testBall({ repetitions: 2 });
    const drill = testDrill([a, b]);
    expect(robotBalls(drill)).toEqual([a, b]);
    expect(ballsPerSet(robotBalls(drill))).toBe(5);
  });
});

describe('ballsBetween', () => {
  it('counts balls within a set', () => {
    expect(ballsBetween({ sets: 0, balls: 1 }, { sets: 0, balls: 3 }, 5)).toBe(2);
  });

  it('counts balls across the end of a set', () => {
    expect(ballsBetween({ sets: 0, balls: 4 }, { sets: 1, balls: 1 }, 5)).toBe(2);
  });

  it('counts nothing when nothing changed', () => {
    expect(ballsBetween({ sets: 2, balls: 1 }, { sets: 2, balls: 1 }, 5)).toBe(0);
  });

  it('starts again from zero when the robot reset its counters', () => {
    expect(ballsBetween({ sets: 4, balls: 0 }, { sets: 0, balls: 1 }, 3)).toBe(1);
  });
});
