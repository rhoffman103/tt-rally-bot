// Short texts about drills and balls, shared by the screens.
import { describeLanding } from '~/lib/drills/landing';
import { fromRpm, type SpeedSpinMapping } from '~/lib/drills/speed-spin';
import type { Ball, Drill, DrillLine } from '~/lib/drills/types';

/** True when a line picks one of several balls at random. */
export const hasRandomLine = (drill: Pick<Drill, 'lines'>) =>
  drill.lines.some((line) => line.alternatives.length > 1);

/** The ball's number in the drill: "3", or "3b" for the second ball of a random line. */
export function ballLabel(line: DrillLine, lineIndex: number, altIndex: number): string {
  const number = String(lineIndex + 1);
  return line.alternatives.length > 1 ? number + String.fromCharCode(97 + altIndex) : number;
}

/** "Endless", "1.5 min" or "5 sets". */
export function durationText(duration: Drill['duration']): string {
  switch (duration.kind) {
    case 'endless':
      return 'Endless';
    case 'minutes':
      return `${duration.value} min`;
    case 'combos':
      return `${duration.value} ${duration.value === 1 ? 'set' : 'sets'}`;
  }
}

/** "Topspin, short, backhand": the kind of spin and where the ball lands. */
export function ballSummary(ball: Ball, mapping: SpeedSpinMapping): string {
  const { spin } = fromRpm(ball, mapping);
  const kind = spin >= 2 ? 'Topspin' : spin <= -2 ? 'Backspin' : 'Flat';
  return `${kind}, ${describeLanding(ball).toLowerCase()}`;
}
