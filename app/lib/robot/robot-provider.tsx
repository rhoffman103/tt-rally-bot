// Holds the one RobotClient for the whole app, so the connection survives moving between screens.
// Shared code, not part of the connection feature: the player, builder and connection features all use it.
import { createContext, useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';

import type { Ball, Drill } from '~/lib/drills/types';
import {
  type DrillProgress,
  type LogEntry,
  ROBOT_EVENTS,
  RobotClient,
  type RobotSnapshot,
  type RobotStatus,
  type RobotInfo,
} from '~/lib/robot/client';
import { SimulatedTransport } from '~/lib/robot/simulated-transport';
import { WebBluetoothTransport } from '~/lib/robot/web-bluetooth-transport';
import { loadSettings, subscribeToSettings } from '~/lib/settings';

export type RobotContextValue = {
  status: RobotStatus;
  robot: RobotInfo | null;
  progress: DrillProgress | null;
  error: string | null;
  log: LogEntry[];
  connect(): Promise<void>; // call only from a click handler (Web Bluetooth needs a user gesture)
  disconnect(): Promise<void>;
  play(drill: Drill): Promise<void>; // the drill already has the session's duration, order and pause
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  fireBall(ball: Ball): Promise<void>; // one ball, once: the builder's "Test fire"
};

export const RobotContext = createContext<RobotContextValue | null>(null);

function createClient(simulated: boolean): RobotClient | null {
  if (simulated) return new RobotClient(new SimulatedTransport());
  if (!navigator.bluetooth) return null;
  return new RobotClient(new WebBluetoothTransport());
}

// The "Simulated robot" setting, which `?robot=sim` also turns on (~/lib/settings).
const getSimulatedSetting = () => loadSettings().simulatedRobot;

const OFFLINE: RobotSnapshot = {
  status: 'disconnected',
  robot: null,
  progress: null,
  error: null,
  log: [],
};
const getOffline = () => OFFLINE;
const subscribeToNothing = () => () => {};
const getTrue = () => true;
const getFalse = () => false;

export function RobotProvider({ children }: { children: React.ReactNode }) {
  // False while the root route is pre-rendered at build time and while it hydrates, so nothing touches
  // `window` or `navigator` until the app runs in the browser.
  const hydrated = useSyncExternalStore(subscribeToNothing, getTrue, getFalse);
  const simulated = useSyncExternalStore(subscribeToSettings, getSimulatedSetting, getFalse);
  // One client until the simulated-robot switch changes. Then the old one disconnects (below) and a new one starts.
  const client = useMemo(() => (hydrated ? createClient(simulated) : null), [hydrated, simulated]);

  useEffect(() => {
    return () => void client?.disconnect().catch(() => {});
  }, [client]);

  const subscribe = useCallback(
    (onChange: () => void) => {
      const stops = client ? ROBOT_EVENTS.map((event) => client.on(event, onChange)) : [];
      return () => stops.forEach((stop) => stop());
    },
    [client],
  );
  const snapshot = useSyncExternalStore(subscribe, client?.getSnapshot ?? getOffline, getOffline);

  const value = useMemo(
    () => contextValue(snapshot, client, hydrated && client === null),
    [snapshot, client, hydrated],
  );
  return <RobotContext value={value}>{children}</RobotContext>;
}

function contextValue(
  snapshot: RobotSnapshot,
  client: RobotClient | null,
  unsupported: boolean,
): RobotContextValue {
  const noRobot = () =>
    Promise.reject(new Error('This browser can’t connect to the robot. Use Chrome or Edge.'));
  return {
    ...snapshot,
    status: unsupported ? 'unsupported' : snapshot.status,
    connect: () => client?.connect() ?? noRobot(),
    disconnect: () => client?.disconnect() ?? Promise.resolve(),
    play: (drill) => client?.play(drill) ?? noRobot(),
    pause: () => client?.pause() ?? Promise.resolve(),
    resume: () => client?.resume() ?? Promise.resolve(),
    stop: () => client?.stop() ?? Promise.resolve(),
    fireBall: (ball) => client?.fireBall(ball) ?? noRobot(),
  };
}
