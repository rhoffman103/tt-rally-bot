// Turns the builder's Speed and Spin sliders into wheel rpm, and back.
// Placeholder mapping from the mockup. The real one will come from captured presets.
import type { Ball } from '~/lib/drills/types';

export type SpeedSpin = {
  speed: number; // 0…10, step 0.5
  spin: number; // −10 (backspin) … 10 (topspin), step 0.5
};
export type WheelRpm = Pick<Ball, 'upperRpm' | 'lowerRpm'>;

/** Both wheels run at `baseRpm + speed · rpmPerSpeed`. Topspin adds `spin · rpmPerSpin` to the upper wheel and
 * takes it from the lower one; backspin does the opposite. Saved in settings. */
export type SpeedSpinMapping = {
  baseRpm: number;
  rpmPerSpeed: number;
  rpmPerSpin: number;
};

export const DEFAULT_SPEED_SPIN: SpeedSpinMapping = {
  baseRpm: 400,
  rpmPerSpeed: 690,
  rpmPerSpin: 170,
};

export const SPEED_LIMITS = { min: 0, max: 10, step: 0.5 } as const;
export const SPIN_LIMITS = { min: -10, max: 10, step: 0.5 } as const;

const RPM_STEP = 10;

const roundTo = (value: number, step: number) => Math.round(value / step) * step + 0; // + 0 turns −0 into 0
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Wheel rpm for a speed and spin, rounded to 10 rpm. Not clamped: check the result with `validateBall`. */
export function toRpm({ speed, spin }: SpeedSpin, mapping: SpeedSpinMapping): WheelRpm {
  const both = mapping.baseRpm + speed * mapping.rpmPerSpeed;
  const diff = spin * mapping.rpmPerSpin;
  return { upperRpm: roundTo(both + diff, RPM_STEP), lowerRpm: roundTo(both - diff, RPM_STEP) };
}

/** The slider values closest to these wheel rpm, rounded to the sliders' steps and kept in their ranges. */
export function fromRpm({ upperRpm, lowerRpm }: WheelRpm, mapping: SpeedSpinMapping): SpeedSpin {
  const speed = ((upperRpm + lowerRpm) / 2 - mapping.baseRpm) / mapping.rpmPerSpeed;
  const spin = (upperRpm - lowerRpm) / 2 / mapping.rpmPerSpin;
  return {
    speed: clamp(roundTo(speed, SPEED_LIMITS.step), SPEED_LIMITS.min, SPEED_LIMITS.max),
    spin: clamp(roundTo(spin, SPIN_LIMITS.step), SPIN_LIMITS.min, SPIN_LIMITS.max),
  };
}
