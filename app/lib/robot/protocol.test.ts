import { describe, expect, it } from 'vitest';

import type { Ball } from '~/lib/drills/types';
import {
  BALL_BYTES,
  challengeHash,
  challengeResponse,
  encodeBall,
  encodeChallengeNotification,
  encodeControl,
  encodeDeviceStatusNotification,
  encodeDrill,
  encodeDrillRejectedNotification,
  encodeDrillStatusNotification,
  encodeNotification,
  encodeReplaceBalls,
  encodeRequestChallenge,
  encodeRequestDeviceStatus,
  encodeRequestVersion,
  encodeVersionNotification,
  fromHex,
  parseBall,
  parseCommand,
  parseDrill,
  parseNotification,
  parseReplaceBalls,
  toHex,
  validateBall,
} from '~/lib/robot/protocol';

const ball = (
  upperRpm: number,
  lowerRpm: number,
  height: number,
  dropPoint: number,
  frequency: number,
  repetitions: number,
): Ball => ({ upperRpm, lowerRpm, height, dropPoint, frequency, repetitions });

// Edge values of every field, values that are not exact in binary, and a known example drill,
// each with the bytes a reference encoder writes for it.
const CASES: [Ball, string][] = [
  [ball(400, 400, -50, -10, 0, 1), '90010000900100000000a0c10000b0c10000003f01000000'],
  [ball(7500, 7500, 100, 10, 100, 200), '4c1d00004c1d00000000f0410000b0410000c03fc8000000'],
  [ball(400, 7500, 0, 0, 50, 1), '900100004c1d0000555555c0000000000000803f01000000'],
  [ball(7500, 400, 1, 0.5, 10, 2), '4c1d000090010000000040c0cdcc8c3f9a99193f02000000'],
  [ball(1234, 5678, -49, -9.5, 90, 199), 'd20400002e16000055559dc13333a7c13333b33fc7000000'],
  [ball(3333, 2222, 33, 3.5, 30, 7), '050d0000ae0800005555f5406666f640cdcc4c3f07000000'],
  [ball(500, 4000, -50, 6, 0, 1), 'f4010000a00f00000000a0c1333353410000003f01000000'],
  [ball(1000, 4000, 20, 5, 30, 1), 'e8030000a00f00005555554000003041cdcc4c3f01000000'],
  [ball(5000, 700, 40, 7, 20, 1), '88130000bc02000000002041666676413333333f01000000'],
  [ball(4500, 700, 50, 4, 30, 1), '94110000bc02000055555541cdcc0c41cdcc4c3f01000000'],
  [ball(4800, 700, 70, 7, 30, 1), 'c0120000bc0200000000a04166667641cdcc4c3f01000000'],
  [ball(4000, 700, 100, 2, 20, 1), 'a00f0000bc0200000000f041cdcc8c403333333f01000000'],
];
const BALLS = CASES.map(([b]) => b);
const ballsHex = (start: number, end: number) =>
  CASES.slice(start, end)
    .map(([, hex]) => hex)
    .join('');

describe('encodeBall', () => {
  it.each(CASES)('matches the reference bytes for %o', (b, hex) => {
    expect(toHex(encodeBall(b))).toBe(hex);
  });

  it('encodes a known ball', () => {
    // 1000 rpm, 2000 rpm, height 25 → 5.0, drop 0 → 0.0, frequency 50 → 1.0, 3 repetitions
    expect(toHex(encodeBall(ball(1000, 2000, 25, 0, 50, 3)))).toBe(
      'e8030000' + 'd0070000' + '0000a040' + '00000000' + '0000803f' + '03000000',
    );
  });
});

describe('encodeDrill', () => {
  it('matches the reference bytes for endless (mode 3, amount 0)', () => {
    const balls = BALLS.slice(0, 9);
    expect(toHex(encodeDrill(balls, { duration: { kind: 'endless' }, random: false }))).toBe(
      '81dc00' + '03' + '0000' + '00' + ballsHex(0, 9),
    );
  });

  it('matches the reference bytes for minutes (mode 0)', () => {
    const balls = BALLS.slice(3, 4);
    expect(
      toHex(encodeDrill(balls, { duration: { kind: 'minutes', value: 5 }, random: false })),
    ).toBe('811c00' + '00' + '0500' + '00' + ballsHex(3, 4));
  });

  it('rounds half a minute up, because the robot counts whole minutes', () => {
    const bytes = encodeDrill([BALLS[0]], {
      duration: { kind: 'minutes', value: 1.5 },
      random: false,
    });
    expect(toHex(bytes.subarray(3, 6))).toBe('00' + '0200');
  });

  it('matches the reference bytes for random order', () => {
    // The reference encoder always sends 10 minutes for a random drill.
    const balls = BALLS.slice(6, 12);
    expect(
      toHex(encodeDrill(balls, { duration: { kind: 'minutes', value: 10 }, random: true })),
    ).toBe('819400' + '00' + '0a00' + '01' + ballsHex(6, 12));
  });

  it('writes combos as mode 1 with the count in the amount field', () => {
    const bytes = encodeDrill([BALLS[0]], {
      duration: { kind: 'combos', value: 300 },
      random: false,
    });
    expect(toHex(bytes.subarray(0, 7))).toBe('81' + '1c00' + '01' + '2c01' + '00');
    expect(bytes.length).toBe(7 + BALL_BYTES);
  });

  it('rejects 0 or more than 9 balls', () => {
    const endless = { duration: { kind: 'endless' }, random: false } as const;
    expect(() => encodeDrill([], endless)).toThrow(RangeError);
    expect(() => encodeDrill(BALLS.slice(0, 10), endless)).toThrow(RangeError);
  });

  it('rejects an amount that does not fit in 16 bits', () => {
    expect(() =>
      encodeDrill([BALLS[0]], { duration: { kind: 'minutes', value: 70000 }, random: false }),
    ).toThrow(RangeError);
  });
});

describe('encodeReplaceBalls', () => {
  it('writes 84, the length 1 + 24·n and the balls', () => {
    const balls = BALLS.slice(0, 2);
    const bytes = encodeReplaceBalls(balls);
    expect(toHex(bytes.subarray(0, 3))).toBe('84' + '3100');
    expect(toHex(bytes.subarray(3))).toBe(ballsHex(0, 2));
  });

  it('rejects 0 or more than 9 balls', () => {
    expect(() => encodeReplaceBalls([])).toThrow(RangeError);
    expect(() => encodeReplaceBalls(BALLS.slice(0, 10))).toThrow(RangeError);
  });
});

describe('round trips', () => {
  it.each(BALLS)('parseBall(encodeBall(x)) gives x back for %o', (b) => {
    expect(parseBall(encodeBall(b))).toEqual(b);
  });

  it('parseDrill(encodeDrill(x)) gives the drill back', () => {
    const balls = BALLS.slice(0, 9);
    for (const duration of [
      { kind: 'endless' },
      { kind: 'minutes', value: 12 },
      { kind: 'combos', value: 65535 },
    ] as const) {
      for (const random of [false, true]) {
        const parsed = parseDrill(encodeDrill(balls, { duration, random }));
        expect(parsed).toMatchObject({ balls, duration, random });
      }
    }
  });

  it('parseReplaceBalls(encodeReplaceBalls(x)) gives the balls back', () => {
    const balls = BALLS.slice(4, 9);
    expect(parseReplaceBalls(encodeReplaceBalls(balls))).toEqual(balls);
  });

  it('keeps values that are off the editor steps', () => {
    const odd = ball(1000, 1000, 12.5, 1.25, 33, 1);
    expect(parseBall(encodeBall(odd))).toEqual(odd);
  });

  it('reads a ball at an offset inside a larger buffer', () => {
    const drill = encodeDrill(BALLS.slice(0, 3), { duration: { kind: 'endless' }, random: false });
    expect(parseBall(drill.subarray(7), BALL_BYTES * 2)).toEqual(BALLS[2]);
  });
});

describe('parseDrill', () => {
  it('reports an unknown mode with a null duration', () => {
    const bytes = encodeDrill([BALLS[0]], { duration: { kind: 'endless' }, random: false });
    bytes[3] = 7;
    expect(parseDrill(bytes)).toMatchObject({ mode: 7, amount: 0, duration: null });
  });

  it('rejects other messages and broken lengths', () => {
    expect(() => parseDrill(encodeControl('stop'))).toThrow();
    expect(() => parseDrill(fromHex('81 1c 00 03 00 00 00'))).toThrow(RangeError);
    const bytes = encodeDrill([BALLS[0]], { duration: { kind: 'endless' }, random: false });
    expect(() => parseDrill(bytes.subarray(0, bytes.length - 1))).toThrow(RangeError);
  });
});

describe('validateBall', () => {
  it.each(BALLS)('accepts %o', (b) => {
    expect(validateBall(b)).toEqual({});
  });

  it('reports each field that is out of range', () => {
    expect(validateBall(ball(399, 7501, -51, 10.5, 110, 0))).toEqual({
      upperRpm: 'Use a whole number from 400 to 7500.',
      lowerRpm: 'Use a whole number from 400 to 7500.',
      height: 'Use a whole number from -50 to 100.',
      dropPoint: 'Use a number from -10 to 10, in steps of 0.5.',
      frequency: 'Use a number from 0 to 100, in steps of 10.',
      repetitions: 'Use a whole number from 1 to 200.',
    });
  });

  it('reports values between steps and values that are not numbers', () => {
    expect(Object.keys(validateBall(ball(1000.5, 1000, 1.5, 0.25, 15, 2.5)))).toEqual([
      'upperRpm',
      'height',
      'dropPoint',
      'frequency',
      'repetitions',
    ]);
    expect(Object.keys(validateBall(ball(NaN, Infinity, 0, 0, 0, 1)))).toEqual([
      'upperRpm',
      'lowerRpm',
    ]);
  });
});

describe('commands', () => {
  it('builds the control commands', () => {
    expect(toHex(encodeControl('wakeUp'))).toBe('80010000');
    expect(toHex(encodeControl('stop'))).toBe('80010001');
    expect(toHex(encodeControl('pause'))).toBe('80010002');
    expect(toHex(encodeControl('resume'))).toBe('80010003');
  });

  it('builds the handshake requests', () => {
    expect(toHex(encodeRequestChallenge())).toBe('07000000');
    expect(toHex(encodeRequestVersion())).toBe('010000');
    expect(toHex(encodeRequestDeviceStatus())).toBe('020000');
  });
});

describe('challengeResponse', () => {
  // Made-up serial and code. The expected salt and hash were worked out separately with Python's hashlib.
  // A real robot accepted our hash on connect, so no recorded pair is kept (it would put the serial in the repo).
  const serial = 'NS2024000123';
  const code = 'a1b2c3d4';
  const hash = 'b74fb8aa18e7f58750bc0cc7662fd999'; // md5('NS2024000123' + 'AacMcCMMMFcx' + 'a1b2c3d4')

  it('hashes serial + salt + code', () => {
    expect(challengeHash(serial, code)).toBe(hash);
  });

  it('sends 08 20 00 and the hash as ASCII', () => {
    const bytes = challengeResponse(serial, code);
    expect(toHex(bytes.subarray(0, 3))).toBe('082000');
    expect(new TextDecoder().decode(bytes.subarray(3))).toBe(hash);
  });
});

describe('parseNotification', () => {
  const ascii = (text: string) => toHex(new TextEncoder().encode(text));

  it('reads the challenge: serial at bytes 6–17, code from byte 18', () => {
    const hex = '01 07 1a00 0000' + ascii('NS2024000123') + ascii('a1b2c3d4');
    expect(parseNotification(fromHex(hex))).toMatchObject({
      kind: 'challenge',
      ok: true,
      type: 7,
      serial: 'NS2024000123',
      code: 'a1b2c3d4',
    });
  });

  it('reads device status', () => {
    expect(parseNotification(fromHex('01 02 0100 05'))).toMatchObject({
      kind: 'device-status',
      state: 5,
      stateName: 'stopping',
    });
    expect(parseNotification(fromHex('01 02 0100 03'))).toMatchObject({ stateName: 'free' });
    expect(parseNotification(fromHex('01 02 0100 09'))).toMatchObject({
      state: 9,
      stateName: null,
    });
  });

  it('reads drill status', () => {
    expect(parseNotification(fromHex('01 05 0700 2c01 0200 0400 03'))).toMatchObject({
      kind: 'drill-status',
      runtime: 300,
      sets: 2,
      balls: 4,
      ballIndex: 3,
    });
  });

  it('reads version info: three strings after their lengths', () => {
    const hex = '01 01 1300 03 02 05' + ascii('NS1') + ascii('H2') + ascii('1.2.3');
    expect(parseNotification(fromHex(hex))).toMatchObject({
      kind: 'version',
      serial: 'NS1',
      hardware: 'H2',
      firmware: '1.2.3',
    });
  });

  it('reads the drill-rejected message', () => {
    expect(parseNotification(fromHex('01810000'))).toMatchObject({ kind: 'drill-rejected' });
  });

  it('reads other responses without failing', () => {
    expect(parseNotification(fromHex('01 80 0000'))).toMatchObject({
      kind: 'other',
      ok: true,
      type: 0x80,
    });
    expect(parseNotification(fromHex('00 83 0000'))).toMatchObject({ kind: 'other', ok: false });
  });

  it('does not throw on messages that are too short', () => {
    expect(parseNotification(new Uint8Array())).toMatchObject({ kind: 'other', type: -1 });
    expect(parseNotification(fromHex('01 05 0700 2c01'))).toMatchObject({ kind: 'other' });
    expect(parseNotification(fromHex('01 07 0200 0000'))).toMatchObject({ kind: 'other' });
    expect(parseNotification(fromHex('01 01 0300 09 09 09'))).toMatchObject({ kind: 'other' });
  });
});

describe('hex', () => {
  it('round trips and ignores spaces', () => {
    expect(toHex(fromHex('80 01 00 0A'))).toBe('8001000a');
  });

  it('puts a separator between bytes when asked', () => {
    expect(toHex(fromHex('8001000a'), ' ')).toBe('80 01 00 0a');
  });

  it('rejects text that is not hex', () => {
    expect(() => fromHex('abc')).toThrow();
    expect(() => fromHex('zz')).toThrow();
  });
});

describe('parseCommand', () => {
  it('reads every message the app sends', () => {
    const balls = [ball(1000, 2000, 25, 0, 50, 3)];
    expect(parseCommand(encodeRequestChallenge())).toEqual({ kind: 'request-challenge' });
    expect(parseCommand(challengeResponse('NSP0SIM00001', 'abc'))).toEqual({
      kind: 'challenge-response',
      hash: challengeHash('NSP0SIM00001', 'abc'),
    });
    expect(parseCommand(encodeRequestVersion())).toEqual({ kind: 'request-version' });
    expect(parseCommand(encodeRequestDeviceStatus())).toEqual({ kind: 'request-device-status' });
    expect(parseCommand(encodeControl('pause'))).toEqual({ kind: 'control', command: 'pause' });
    expect(
      parseCommand(encodeDrill(balls, { duration: { kind: 'combos', value: 2 }, random: true })),
    ).toMatchObject({ kind: 'new-drill', drill: { balls, random: true, amount: 2 } });
    expect(parseCommand(encodeReplaceBalls(balls))).toEqual({ kind: 'replace-balls', balls });
  });

  it('does not throw on messages it cannot read', () => {
    expect(parseCommand(fromHex('81 0000'))).toEqual({ kind: 'unknown', command: 0x81 });
    expect(parseCommand(fromHex('80 0100 09'))).toEqual({ kind: 'unknown', command: 0x80 });
    expect(parseCommand(new Uint8Array())).toEqual({ kind: 'unknown', command: -1 });
  });
});

describe('notification encoders', () => {
  it('build notifications that parseNotification reads back', () => {
    expect(parseNotification(encodeChallengeNotification('NSP0SIM00001', 'c0de'))).toMatchObject({
      kind: 'challenge',
      serial: 'NSP0SIM00001',
      code: 'c0de',
    });
    expect(
      parseNotification(encodeVersionNotification({ serial: 'S', hardware: 'H2', firmware: 'F3' })),
    ).toMatchObject({ kind: 'version', serial: 'S', hardware: 'H2', firmware: 'F3' });
    expect(parseNotification(encodeDeviceStatusNotification('stopping'))).toMatchObject({
      kind: 'device-status',
      state: 5,
      stateName: 'stopping',
    });
    const status = { runtime: 300, sets: 2, balls: 7, ballIndex: 3 };
    expect(parseNotification(encodeDrillStatusNotification(status))).toMatchObject({
      kind: 'drill-status',
      ...status,
    });
    expect(parseNotification(encodeDrillRejectedNotification())).toMatchObject({
      kind: 'drill-rejected',
    });
  });

  it('writes the ok byte, the type and the payload length', () => {
    expect(toHex(encodeNotification(0x80))).toBe('01800000');
    expect(toHex(encodeNotification(0x84, Uint8Array.of(9), false))).toBe('0084010009');
  });
});
