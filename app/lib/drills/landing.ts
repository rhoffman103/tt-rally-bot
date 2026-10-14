// Where a ball lands on the player's half of the table, for the table diagram and the builder.
// Placeholder model from the mockup: more height and more wheel speed make the ball land deeper. The real landing
// spots will come from captured presets.
import type { Ball } from '~/lib/drills/types';
import { BALL_LIMITS } from '~/lib/robot/protocol';

type LandingBall = Pick<Ball, 'upperRpm' | 'lowerRpm' | 'height'>;

const BASE_DEPTH = 0.08;
const DEPTH_PER_HEIGHT = 0.55; // from the lowest to the highest height
const DEPTH_PER_SPEED = 0.35; // from the slowest to the fastest wheels
const DEPTH_LIMITS = { min: 0.06, max: 0.96 };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const share = (value: number, { min, max }: { min: number; max: number }) =>
  (value - min) / (max - min);

/** 0…1: the average wheel speed, from the slowest to the fastest the robot allows. */
const speedShare = ({ upperRpm, lowerRpm }: LandingBall) =>
  clamp(share((upperRpm + lowerRpm) / 2, BALL_LIMITS.upperRpm), 0, 1);

/** How far past the net the ball lands: 0 is the net, 1 is the end line. */
export function landingDepth(ball: LandingBall): number {
  const depth =
    BASE_DEPTH +
    share(ball.height, BALL_LIMITS.height) * DEPTH_PER_HEIGHT +
    speedShare(ball) * DEPTH_PER_SPEED;
  return clamp(depth, DEPTH_LIMITS.min, DEPTH_LIMITS.max);
}

/** The height that makes this ball land at `depth` (0…1) at its wheel speed, as a whole number in range. */
export function heightForDepth(depth: number, ball: LandingBall): number {
  const { min, max } = BALL_LIMITS.height;
  const heightShare = (depth - BASE_DEPTH - speedShare(ball) * DEPTH_PER_SPEED) / DEPTH_PER_HEIGHT;
  return clamp(Math.round(min + heightShare * (max - min)), min, max) + 0; // + 0 turns −0 into 0
}

/** "Short, backhand", "Half-long, middle" or "Long, forehand". */
export function describeLanding(ball: LandingBall & Pick<Ball, 'dropPoint'>): string {
  const depth = landingDepth(ball);
  const length = depth < 0.4 ? 'Short' : depth > 0.72 ? 'Long' : 'Half-long';
  const side = ball.dropPoint <= -4 ? 'backhand' : ball.dropPoint >= 4 ? 'forehand' : 'middle';
  return `${length}, ${side}`;
}
