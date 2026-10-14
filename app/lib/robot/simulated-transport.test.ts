import { afterEach, describe, expect, it } from 'vitest';

import {
  challengeResponse,
  encodeControl,
  encodeDrill,
  encodeRequestChallenge,
  encodeRequestVersion,
  type Notification,
  parseNotification,
} from '~/lib/robot/protocol';
import { SimulatedTransport } from '~/lib/robot/simulated-transport';
import { testBall } from '~/testing/drills';

let robot: SimulatedTransport;
let received: Notification[];

async function connect() {
  robot = new SimulatedTransport({ speed: 200 });
  received = [];
  robot.onNotify((bytes) => received.push(parseNotification(bytes)));
  await robot.connect();
}

/** Waits until a notification matches, then returns it. */
function waitFor(match: (n: Notification) => boolean): Promise<Notification> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 2000;
    const check = () => {
      const found = received.find(match);
      if (found) resolve(found);
      else if (Date.now() > deadline) reject(new Error('No matching notification'));
      else setTimeout(check, 1);
    };
    check();
  });
}

async function unlockAndWake() {
  await robot.write(encodeRequestChallenge());
  const challenge = await waitFor((n) => n.kind === 'challenge');
  if (challenge.kind !== 'challenge') throw new Error('unreachable');
  await robot.write(challengeResponse(challenge.serial, challenge.code));
  await robot.write(encodeControl('wakeUp'));
  await waitFor((n) => n.kind === 'device-status' && n.stateName === 'free');
}

afterEach(() => robot?.simulateDisconnect());

describe('SimulatedTransport', () => {
  it('sends its serial in the challenge', async () => {
    await connect();
    await robot.write(encodeRequestChallenge());
    const challenge = await waitFor((n) => n.kind === 'challenge');
    expect(challenge).toMatchObject({ kind: 'challenge', serial: 'NSP0SIM00001' });
  });

  it('ignores other messages until the challenge is answered correctly', async () => {
    await connect();
    await robot.write(encodeRequestChallenge());
    await waitFor((n) => n.kind === 'challenge');
    await robot.write(challengeResponse('WRONGSERIAL0', 'nope'));
    await waitFor((n) => n.type === 8 && !n.ok);
    await robot.write(encodeRequestVersion());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(received.some((n) => n.kind === 'version')).toBe(false);
  });

  it('plays a drill, reports each ball and says when it ends', async () => {
    await connect();
    await unlockAndWake();
    const balls = [testBall({ repetitions: 2 }), testBall()];
    await robot.write(
      encodeDrill(balls, { duration: { kind: 'combos', value: 2 }, random: false }),
    );
    expect(robot.state).toBe('playing');
    await waitFor((n) => n.kind === 'device-status' && n.stateName === 'stopping');
    const statuses = received.filter((n) => n.kind === 'drill-status');
    expect(statuses).toHaveLength(6);
    expect(statuses.at(-1)).toMatchObject({ sets: 2, balls: 0 });
    expect(robot.state).toBe('standby');
  });

  it('holds the drill while paused', async () => {
    await connect();
    await unlockAndWake();
    await robot.write(encodeDrill([testBall()], { duration: { kind: 'endless' }, random: false }));
    await waitFor((n) => n.kind === 'drill-status');
    await robot.write(encodeControl('pause'));
    expect(robot.state).toBe('paused');
    const ballsFired = () => received.filter((n) => n.kind === 'drill-status').length;
    const before = ballsFired();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(ballsFired()).toBe(before);
    await robot.write(encodeControl('resume'));
    expect(robot.state).toBe('playing');
    await robot.write(encodeControl('stop'));
    expect(robot.state).toBe('standby');
  });

  it('reports a disconnect and refuses writes afterwards', async () => {
    await connect();
    let disconnects = 0;
    robot.onDisconnect(() => disconnects++);
    robot.simulateDisconnect();
    expect(disconnects).toBe(1);
    expect(robot.state).toBe('off');
    await expect(robot.write(encodeRequestChallenge())).rejects.toThrow();
  });
});
