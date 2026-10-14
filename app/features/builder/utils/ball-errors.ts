// What is wrong with a ball: the robot's limits (validateBall), and the wheel speed limits from Settings, which
// always lie inside the robot's.
import type { Ball, BallErrors, DrillLine } from '~/lib/drills/types';
import { validateBall } from '~/lib/robot/protocol';
import type { Settings } from '~/lib/settings';
import { formatRpm } from '~/utils/format';

type RpmLimits = Settings['rpmLimits'];

export function ballErrors(ball: Ball, limits: RpmLimits): BallErrors {
  const errors = validateBall(ball);
  for (const field of ['upperRpm', 'lowerRpm'] as const) {
    if (errors[field]) continue;
    if (ball[field] > limits.max) {
      errors[field] = `Faster than your limit of ${formatRpm(limits.max)} rpm (Settings).`;
    } else if (ball[field] < limits.min) {
      errors[field] = `Slower than your limit of ${formatRpm(limits.min)} rpm (Settings).`;
    }
  }
  return errors;
}

export const hasErrors = (ball: Ball, limits: RpmLimits) =>
  Object.keys(ballErrors(ball, limits)).length > 0;

/** The first ball with an error, or null when every ball is fine. */
export function firstBadBall(lines: DrillLine[], limits: RpmLimits) {
  for (const [line, { alternatives }] of lines.entries()) {
    const alt = alternatives.findIndex((ball) => hasErrors(ball, limits));
    if (alt >= 0) return { line, alt };
  }
  return null;
}

/** One sentence for the Speed and Spin sliders, which set both wheels: too fast or too slow. */
export function wheelProblem(ball: Ball, limits: RpmLimits): string | null {
  const errors = ballErrors(ball, limits);
  if (!errors.upperRpm && !errors.lowerRpm) return null;
  if (ball.upperRpm > limits.max || ball.lowerRpm > limits.max) {
    return `Too fast: a wheel would need more than ${formatRpm(limits.max)} rpm. Lower the speed or the spin.`;
  }
  if (ball.upperRpm < limits.min || ball.lowerRpm < limits.min) {
    return `Too slow: a wheel would need less than ${formatRpm(limits.min)} rpm. Raise the speed or lower the spin.`;
  }
  return 'Set the wheel speeds to whole numbers of rpm.';
}
