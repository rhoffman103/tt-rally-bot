import { afterEach, describe, expect, it, vi } from 'vitest';

import { ROBOT_EVENTS, RobotClient, type RobotSnapshot } from '~/lib/robot/client';
import {
  encodeDeviceStatusNotification,
  encodeDrillRejectedNotification,
  encodeDrillStatusNotification,
} from '~/lib/robot/protocol';
import { SimulatedTransport } from '~/lib/robot/simulated-transport';
import { listeners, type RobotTransport } from '~/lib/robot/transport';
import { testBall, testDrill } from '~/testing/drills';

let robot: SimulatedTransport;
let client: RobotClient;

function setUp() {
  robot = new SimulatedTransport({ speed: 200 });
  client = new RobotClient(robot, { timeoutMs: 500 });
}

async function connected() {
  setUp();
  await client.connect();
  expect(client.getSnapshot().status).toBe('standby');
}

/** Resolves with the snapshot as soon as `check` passes. */
function waitFor(check: (s: RobotSnapshot) => boolean, timeoutMs = 3000): Promise<RobotSnapshot> {
  return new Promise((resolve, reject) => {
    const stops: (() => void)[] = [];
    const done = (error?: Error) => {
      clearTimeout(timer);
      stops.forEach((stop) => stop());
      if (error) reject(error);
      else resolve(client.getSnapshot());
    };
    const timer = setTimeout(
      () => done(new Error(`Timed out. Status: ${client.getSnapshot().status}`)),
      timeoutMs,
    );
    const test = () => {
      if (check(client.getSnapshot())) done();
    };
    stops.push(...ROBOT_EVENTS.map((event) => client.on(event, test)));
    test();
  });
}

const sent = (s: RobotSnapshot, firstByte: string) =>
  s.log.filter((entry) => entry.dir === 'out' && entry.hex.startsWith(firstByte));

afterEach(async () => {
  await client?.disconnect();
});

/**
 * The simulated robot for the handshake. After `mute()` its notifications no longer reach the client, and the
 * test sends its own with `notify()`.
 */
class ScriptedRobot implements RobotTransport {
  private readonly inner = new SimulatedTransport({ speed: 200 });
  private readonly scripted = listeners<[Uint8Array]>();
  private muted = false;
  connect = () => this.inner.connect();
  disconnect = () => this.inner.disconnect();
  write = (bytes: Uint8Array) => this.inner.write(bytes);
  onDisconnect = (listener: () => void) => this.inner.onDisconnect(listener);
  onNotify(listener: (bytes: Uint8Array) => void) {
    const stopInner = this.inner.onNotify((bytes) => this.muted || listener(bytes));
    const stopScripted = this.scripted.add(listener);
    return () => {
      stopInner();
      stopScripted();
    };
  }
  mute() {
    this.muted = true;
  }
  notify(bytes: Uint8Array) {
    this.scripted.emit(bytes);
  }
}

async function scripted() {
  const scriptedRobot = new ScriptedRobot();
  client = new RobotClient(scriptedRobot, { timeoutMs: 500 });
  await client.connect();
  scriptedRobot.mute();
  return scriptedRobot;
}

const drillStatus = (sets: number, balls: number) =>
  encodeDrillStatusNotification({ runtime: 0, sets, balls, ballIndex: 0 });
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('RobotClient connection', () => {
  it('runs the handshake and reaches standby', async () => {
    setUp();
    const statuses: string[] = [];
    client.on('status', (status) => statuses.push(status));
    await client.connect();
    const s = client.getSnapshot();
    expect(statuses).toEqual(['connecting', 'standby']);
    expect(s.robot).toEqual({ serial: 'NSP0SIM00001', firmware: 'sim-1.0' });
    expect(s.error).toBeNull();
    expect(s.log.filter((e) => e.dir === 'out').map((e) => e.hex.slice(0, 2))).toEqual([
      '07',
      '08',
      '01',
      '02',
      '80',
    ]);
    expect(s.log.find((e) => e.dir === 'out')?.hex).toBe('07 00 00 00');
  });

  it('gives up with a plain message when the robot never answers', async () => {
    const silent: RobotTransport = {
      connect: async () => {},
      disconnect: async () => {},
      write: async () => {},
      onNotify: () => () => {},
      onDisconnect: () => () => {},
    };
    client = new RobotClient(silent, { timeoutMs: 20 });
    await client.connect();
    expect(client.getSnapshot().status).toBe('disconnected');
    expect(client.getSnapshot().error).toMatch(/did not answer/);
  });

  it('disconnects when asked, without an error', async () => {
    await connected();
    await client.disconnect();
    expect(client.getSnapshot()).toMatchObject({
      status: 'disconnected',
      robot: null,
      error: null,
    });
    expect(robot.state).toBe('off');
  });

  it('refuses to play before it is connected', async () => {
    setUp();
    await expect(client.play(testDrill([testBall()]))).rejects.toThrow(/Connect/);
  });
});

describe('RobotClient playing', () => {
  it('pauses, resumes and stops', async () => {
    await connected();
    await client.play(testDrill([testBall(), testBall({ upperRpm: 4000 })]));
    await waitFor((s) => (s.progress?.ballsShot ?? 0) >= 1);
    expect(client.getSnapshot().status).toBe('playing');

    await client.pause();
    expect(client.getSnapshot().status).toBe('paused');
    expect(robot.state).toBe('paused');

    await client.resume();
    expect(client.getSnapshot().status).toBe('playing');
    expect(robot.state).toBe('playing');

    await client.stop();
    expect(client.getSnapshot().status).toBe('standby');
    expect(robot.state).toBe('standby');
    expect(sent(client.getSnapshot(), '80 01 00 0').map((e) => e.hex.slice(-2))).toEqual([
      '00', // wake up
      '02',
      '03',
      '01',
    ]);
  });

  it('sends a short drill in one message and lets the robot finish it', async () => {
    await connected();
    const drill = testDrill([testBall({ repetitions: 2 }), testBall(), testBall()], {
      duration: { kind: 'combos', value: 2 },
    });
    await client.play(drill);
    await waitFor((s) => s.status === 'standby');
    const s = client.getSnapshot();
    expect(s.progress).toMatchObject({ drillId: 'test-drill', set: 2, ballsShot: 8 });
    expect(sent(s, '81')).toHaveLength(1);
    expect(sent(s, '84')).toHaveLength(0);
  });

  it('plays a 12-line drill with a random line to the end without help', async () => {
    await connected();
    const lines = Array.from({ length: 12 }, (_, i) =>
      i === 4
        ? [testBall({ dropPoint: -5, repetitions: 2 }), testBall({ dropPoint: 5, repetitions: 2 })]
        : testBall({ upperRpm: 2000 + i * 100, repetitions: (i % 2) + 1 }),
    );
    const drill = testDrill(lines, { duration: { kind: 'combos', value: 2 } });
    const ballsPerSet = lines.reduce(
      (sum, line) => sum + (Array.isArray(line) ? line[0] : line).repetitions,
      0,
    );
    const linesSeen = new Set<number>();
    client.on('progress', (p) => p && linesSeen.add(p.currentLine));

    await client.play(drill);
    await waitFor((s) => s.status === 'standby');

    const s = client.getSnapshot();
    expect(s.progress).toMatchObject({ set: 2, ballsShot: 2 * ballsPerSet });
    expect(s.error).toBeNull();
    expect(sent(s, '81')).toHaveLength(1);
    expect(sent(s, '84')).toHaveLength(2 * 12 - 1);
    expect(linesSeen.size).toBe(12);
    expect(robot.state).toBe('standby');
  });

  it('stops a drill of half a minute itself, because the robot counts whole minutes', async () => {
    vi.useFakeTimers();
    try {
      // Real time: the robot would stop after a whole minute.
      robot = new SimulatedTransport();
      client = new RobotClient(robot);
      const connecting = client.connect();
      await vi.advanceTimersByTimeAsync(5_000);
      await connecting;
      await client.play(testDrill([testBall()], { duration: { kind: 'minutes', value: 0.5 } }));
      await vi.advanceTimersByTimeAsync(29_000);
      expect(client.getSnapshot().status).toBe('playing');
      await vi.advanceTimersByTimeAsync(2_000);
      const s = client.getSnapshot();
      expect(s.status).toBe('standby');
      expect(sent(s, '80 01 00 01').map((e) => e.text)).toEqual(['stop: drill done']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rests between sets, also when paused during the rest', async () => {
    await connected();
    const drill = testDrill([testBall(), testBall()], {
      duration: { kind: 'combos', value: 2 },
      pauseBetweenSetsSec: 0.1,
    });
    await client.play(drill);
    await waitFor((s) => s.log.some((e) => e.text.startsWith('rest')));
    expect(robot.state).toBe('paused');

    await client.pause();
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(client.getSnapshot().log.some((e) => e.text === 'resume after rest')).toBe(false);

    await client.resume();
    await waitFor((s) => s.status === 'standby');
    const s = client.getSnapshot();
    expect(s.log.some((e) => e.text === 'resume after rest')).toBe(true);
    expect(s.progress).toMatchObject({ set: 2, ballsShot: 4 });
  });

  it('ends in disconnected when the robot drops mid-drill, then reconnects', async () => {
    await connected();
    const drill = testDrill(
      Array.from({ length: 10 }, () => testBall()),
      { duration: { kind: 'endless' } },
    );
    await client.play(drill);
    await waitFor((s) => (s.progress?.ballsShot ?? 0) >= 2);

    robot.simulateDisconnect();
    const s = client.getSnapshot();
    expect(s.status).toBe('disconnected');
    expect(s.error).toBe('Robot disconnected. The drill stopped.');
    expect(s.progress).toBeNull();
    expect(s.robot).toBeNull();

    await client.connect();
    expect(client.getSnapshot()).toMatchObject({ status: 'standby', error: null });
    await client.play(drill);
    await waitFor((s) => (s.progress?.ballsShot ?? 0) >= 1);
  });

  it('fires one test ball without starting a drill', async () => {
    await connected();
    await client.fireBall(testBall({ repetitions: 5 }));
    const [message] = sent(client.getSnapshot(), '81');
    // 81 | length | mode 1 (combos) | amount 1 | random 0 | ball … repetitions 1
    expect(message.hex.startsWith('81 1c 00 01 01 00 00')).toBe(true);
    expect(message.hex.endsWith('01 00 00 00')).toBe(true);
    expect(client.getSnapshot().status).toBe('standby');
  });

  it('waits for resume when a set ends while paused, then rests once', async () => {
    const scriptedRobot = await scripted();
    const drill = testDrill([testBall(), testBall()], {
      duration: { kind: 'combos', value: 3 },
      pauseBetweenSetsSec: 0.05,
    });
    await client.play(drill);
    await client.pause();
    scriptedRobot.notify(drillStatus(1, 0)); // the set ended just as Pause was pressed
    await pause(100);
    const resumes = () =>
      client.getSnapshot().log.filter((e) => e.text === 'resume after rest').length;
    expect(client.getSnapshot().status).toBe('paused');
    expect(resumes()).toBe(0);

    await client.resume();
    await pause(100);
    expect(resumes()).toBe(1);
  });

  it('ignores a drill-ended status until the robot reports on the new drill', async () => {
    const scriptedRobot = await scripted();
    await client.play(testDrill([testBall()]));
    scriptedRobot.notify(encodeDeviceStatusNotification('stopping')); // left over from a test fire
    expect(client.getSnapshot().status).toBe('playing');

    scriptedRobot.notify(drillStatus(0, 1));
    scriptedRobot.notify(encodeDeviceStatusNotification('stopping'));
    expect(client.getSnapshot()).toMatchObject({ status: 'standby', progress: { ballsShot: 1 } });
  });

  it('keeps no progress when the robot rejects the drill', async () => {
    const scriptedRobot = await scripted();
    await client.play(testDrill([testBall()]));
    scriptedRobot.notify(encodeDrillRejectedNotification());
    expect(client.getSnapshot()).toMatchObject({
      status: 'standby',
      progress: null,
      error: 'The robot did not accept the drill.',
    });
  });
});
