// App settings, saved in this browser. The only module besides ~/lib/drills/storage that touches localStorage.
// Synchronous, with a change listener, so RobotProvider can follow the simulated-robot switch.
import { DEFAULT_SPEED_SPIN, type SpeedSpinMapping } from '~/lib/drills/speed-spin';
import { BALL_LIMITS } from '~/lib/robot/protocol';

type RpmLimits = { min: number; max: number };

export type Settings = {
  /** Lowest and highest wheel speed the app lets you use. Inside the robot's 400–7500 rpm. */
  rpmLimits: RpmLimits;
  speedSpin: SpeedSpinMapping;
  simulatedRobot: boolean;
  debugLog: boolean;
};

const ROBOT_RPM_LIMITS: RpmLimits = {
  min: BALL_LIMITS.upperRpm.min,
  max: BALL_LIMITS.upperRpm.max,
};

export const DEFAULT_SETTINGS: Settings = {
  rpmLimits: ROBOT_RPM_LIMITS,
  speedSpin: DEFAULT_SPEED_SPIN,
  simulatedRobot: false,
  debugLog: true, // on in the mockup; the debug log is how the (verify) protocol items get settled
};

const KEY = 'tt-rally-bot.settings';

export function loadSettings(): Settings {
  const settings = readStored();
  return { ...settings, simulatedRobot: settings.simulatedRobot || simulatedByUrl() };
}

/** Saves the changed settings and returns all of them. Values out of range are moved into range. */
export function saveSettings(changes: Partial<Settings>): Settings {
  localStorage.setItem(KEY, JSON.stringify(sanitize({ ...readStored(), ...changes })));
  if ('simulatedRobot' in changes) simulatedThisVisit = false; // the switch replaces ?robot=sim
  notify();
  return loadSettings();
}

export function resetSettings(): Settings {
  localStorage.removeItem(KEY);
  simulatedThisVisit = false;
  notify();
  return DEFAULT_SETTINGS;
}

const listeners = new Set<() => void>();

/** Calls `listener` after every save or reset in this tab. Returns a function that stops listening. */
export function subscribeToSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

function notify() {
  for (const listener of [...listeners]) listener();
}

function readStored(): Settings {
  try {
    return sanitize(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// `?robot=sim` in the address the app started with turns the simulated robot on for this visit, without saving
// it. Read once, so it stays on when you move to a screen without it in the address.
let simulatedThisVisit: boolean | undefined;

function simulatedByUrl(): boolean {
  if (simulatedThisVisit === undefined && typeof window !== 'undefined') {
    simulatedThisVisit = new URLSearchParams(window.location.search).get('robot') === 'sim';
  }
  return simulatedThisVisit ?? false;
}

// ---------- Reading stored values ----------

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const numberOr = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const booleanOr = (value: unknown, fallback: boolean) =>
  typeof value === 'boolean' ? value : fallback;
const clamp = (value: number, { min, max }: RpmLimits) => Math.min(max, Math.max(min, value));

/** Fills missing or broken values with the defaults, so old or hand-edited settings never break the app. */
function sanitize(stored: unknown): Settings {
  const value = isRecord(stored) ? stored : {};
  const limits = isRecord(value.rpmLimits) ? value.rpmLimits : {};
  const mapping = isRecord(value.speedSpin) ? value.speedSpin : {};
  const min = clamp(Math.round(numberOr(limits.min, ROBOT_RPM_LIMITS.min)), ROBOT_RPM_LIMITS);
  const max = clamp(Math.round(numberOr(limits.max, ROBOT_RPM_LIMITS.max)), ROBOT_RPM_LIMITS);
  return {
    rpmLimits: { min: Math.min(min, max), max: Math.max(min, max) },
    speedSpin: {
      baseRpm: numberOr(mapping.baseRpm, DEFAULT_SPEED_SPIN.baseRpm),
      rpmPerSpeed: numberOr(mapping.rpmPerSpeed, DEFAULT_SPEED_SPIN.rpmPerSpeed),
      rpmPerSpin: numberOr(mapping.rpmPerSpin, DEFAULT_SPEED_SPIN.rpmPerSpin),
    },
    simulatedRobot: booleanOr(value.simulatedRobot, DEFAULT_SETTINGS.simulatedRobot),
    debugLog: booleanOr(value.debugLog, DEFAULT_SETTINGS.debugLog),
  };
}
