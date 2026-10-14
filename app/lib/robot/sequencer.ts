// Plans how a drill is fed to the robot. Pure functions; client.ts runs the plan.
import type { Ball, Drill } from '~/lib/drills/types';
import { MAX_BALLS_PER_MESSAGE } from '~/lib/robot/protocol';

/**
 * The robot holds at most 9 balls and can't pick "one of these at random", so longer drills and drills with a
 * random line are played one line at a time: the app sends each line with `0x84` while the drill runs.
 * Other drills go to the robot in one `0x81` message and the robot plays them by itself.
 */
export function needsSequencer(drill: Drill): boolean {
  return (
    drill.lines.length > MAX_BALLS_PER_MESSAGE ||
    drill.lines.some((line) => line.alternatives.length > 1)
  );
}

export type PlannedBall = { line: number; ball: Ball };

/**
 * One set of a sequenced drill: every line once, with one ball picked for each random line, shuffled when the
 * drill has random order. `random` returns a number in [0, 1), like `Math.random`.
 */
export function planSet(drill: Drill, random: () => number = Math.random): PlannedBall[] {
  const set = drill.lines.map((line, i) => ({
    line: i,
    ball: line.alternatives[Math.floor(random() * line.alternatives.length)],
  }));
  if (drill.randomOrder) {
    for (let i = set.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [set[i], set[j]] = [set[j], set[i]];
    }
  }
  return set;
}

/** The first ball of each line, for a drill the robot plays by itself. */
export function robotBalls(drill: Drill): Ball[] {
  return drill.lines.map((line) => line.alternatives[0]);
}

/** How many balls one pass through `balls` fires. */
export function ballsPerSet(balls: Ball[]): number {
  return balls.reduce((sum, ball) => sum + ball.repetitions, 0);
}

export type RobotCount = { sets: number; balls: number };

/**
 * Balls fired between two drill-status notifications. `balls` counts the balls in the current set and `sets`
 * the sets finished, so the total is `sets · setSize + balls`. If the total went down, the robot reset its
 * counters (perhaps after `0x84`), so the new count is all new balls. (verify) docs/robot-protocol.md
 * "Notifications".
 */
export function ballsBetween(previous: RobotCount, next: RobotCount, setSize: number): number {
  const before = previous.sets * setSize + previous.balls;
  const after = next.sets * setSize + next.balls;
  return after >= before ? after - before : after;
}
