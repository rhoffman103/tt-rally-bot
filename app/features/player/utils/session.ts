// The session: how long a drill plays, in which order, and the rest between sets. It starts as the drill's own
// settings and changes only on the player screen, never in the saved drill.
import type { Drill } from '~/lib/drills/types';
import type { DrillProgress } from '~/lib/robot/client';

export type Session = {
  duration: Drill['duration'];
  randomOrder: boolean;
  pauseBetweenSetsSec: number;
};

export type DurationKind = Drill['duration']['kind'];

type Range = { min: number; max: number; step: number };

// Minutes go in steps of 30 seconds. The robot holds about 130 balls, about 2 minutes of play.
export const SESSION_LIMITS = {
  minutes: { min: 0.5, max: 120, step: 0.5 },
  combos: { min: 1, max: 999, step: 1 },
  pauseBetweenSetsSec: { min: 0, max: 60, step: 1 },
} as const satisfies Record<string, Range>;

// The number a session starts with when you switch to minutes or sets and the drill has none.
const DEFAULT_AMOUNT = { minutes: 1, combos: 10 } as const;

/** Rounds to the nearest step and keeps it in range. */
const clampToStep = (value: number, { min, max, step }: Range) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value / step) * step)) : min;

export function sessionOf(drill: Drill): Session {
  return {
    duration: drill.duration,
    randomOrder: drill.randomOrder,
    pauseBetweenSetsSec: drill.pauseBetweenSetsSec ?? 0,
  };
}

/** Plays endless, for minutes or for sets. Keeps the number when you switch between minutes and sets. */
export function withDurationKind(session: Session, kind: DurationKind): Session {
  if (kind === session.duration.kind) return session;
  if (kind === 'endless') return { ...session, duration: { kind } };
  const value = session.duration.kind === 'endless' ? DEFAULT_AMOUNT[kind] : session.duration.value;
  return { ...session, duration: { kind, value: clampToStep(value, SESSION_LIMITS[kind]) } };
}

/** Sets the number of minutes or sets, kept in range. Does nothing for an endless session. */
export function withAmount(session: Session, value: number): Session {
  const { duration } = session;
  if (duration.kind === 'endless') return session;
  return {
    ...session,
    duration: { kind: duration.kind, value: clampToStep(value, SESSION_LIMITS[duration.kind]) },
  };
}

export function withPause(session: Session, seconds: number): Session {
  return {
    ...session,
    pauseBetweenSetsSec: clampToStep(seconds, SESSION_LIMITS.pauseBetweenSetsSec),
  };
}

/** The drill to send to the robot: the drill with the session's settings. */
export function drillForSession(drill: Drill, session: Session): Drill {
  const played: Drill = {
    ...drill,
    duration: session.duration,
    randomOrder: session.randomOrder,
    pauseBetweenSetsSec: session.pauseBetweenSetsSec,
  };
  if (session.pauseBetweenSetsSec <= 0) delete played.pauseBetweenSetsSec;
  return played;
}

/** "04:07". Hours count as minutes: "75:00". */
export function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(whole / 60))}:${pad(whole % 60)}`;
}

type Remaining = {
  /** 0…1 for the progress bar. Null for an endless drill, which has no bar. */
  share: number | null;
  label: string;
};

/** How much of the session is left. */
export function remaining(
  duration: Drill['duration'],
  progress: Pick<DrillProgress, 'set' | 'elapsedSec'>,
): Remaining {
  switch (duration.kind) {
    case 'endless':
      return { share: null, label: 'Plays until you stop it' };
    case 'minutes': {
      const total = duration.value * 60;
      return {
        share: Math.min(1, progress.elapsedSec / total),
        label: `${clock(total - progress.elapsedSec)} left`,
      };
    }
    case 'combos': {
      const left = Math.max(0, duration.value - progress.set);
      return {
        share: Math.min(1, progress.set / duration.value),
        label: `${left} ${left === 1 ? 'set' : 'sets'} left`,
      };
    }
  }
}
