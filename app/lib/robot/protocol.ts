// Bytes to and from the robot. Pure functions, no I/O. The protocol is described in docs/robot-protocol.md.
// Every guess the doc marks **(verify)** is a named constant here, so a firmware change is a one-file fix.
import SparkMD5 from 'spark-md5';

import type { Ball, BallErrors, BallField, Drill } from '~/lib/drills/types';

// ---------- GATT ----------

export const ADVERTISED_SERVICE = 0xfeff;
export const PRIMARY_SERVICE = '02f00000-0000-0000-0000-00000000fe00';
export const WRITE_CHARACTERISTIC = '02f00000-0000-0000-0000-00000000ff01';
export const NOTIFY_CHARACTERISTIC = '02f00000-0000-0000-0000-00000000ff02';

// ---------- Commands ----------

/** First byte of each message we send. */
export const COMMAND = {
  // (verify) docs/robot-protocol.md "Connection handshake": steps 3 and 4 send `01 00 00` and `02 00 00`.
  // the v3 controller names notification types 1 and 2 "version-info" and "device-status", so these are probably requests
  // for those.
  requestVersion: 0x01,
  requestDeviceStatus: 0x02,
  requestChallenge: 0x07,
  challengeResponse: 0x08,
  control: 0x80,
  newDrill: 0x81,
  replaceBalls: 0x84,
} as const;

/** Payload byte of a `0x80` control message. docs/robot-protocol.md "Control commands". */
const CONTROL = { wakeUp: 0, stop: 1, pause: 2, resume: 3 } as const;
export type ControlCommand = keyof typeof CONTROL;

/** The robot holds at most this many balls at a time (`0x81` and `0x84`). */
export const MAX_BALLS_PER_MESSAGE = 9;

// ---------- Ball ----------

export const BALL_BYTES = 24;

export const BALL_LIMITS = {
  upperRpm: { min: 400, max: 7500, step: 1 },
  lowerRpm: { min: 400, max: 7500, step: 1 },
  height: { min: -50, max: 100, step: 1 },
  dropPoint: { min: -10, max: 10, step: 0.5 },
  frequency: { min: 0, max: 100, step: 10 },
  repetitions: { min: 1, max: 200, step: 1 },
} as const satisfies Record<BallField, { min: number; max: number; step: number }>;

// The float fields are scaled before they are sent. docs/robot-protocol.md "Ball (24 bytes)".
const toWireHeight = (h: number) => ((h + 50) / 150) * 50 - 20; // −50…100 → −20…30
const fromWireHeight = (w: number) => ((w + 20) / 50) * 150 - 50;
const toWireDropPoint = (d: number) => ((d + 10) / 20) * 44 - 22; // −10…10 → −22…22
const fromWireDropPoint = (w: number) => ((w + 22) / 44) * 20 - 10;
const toWireFrequency = (f: number) => f / 100 + 0.5; // 0…100 → 0.5…1.5
const fromWireFrequency = (w: number) => (w - 0.5) * 100;

/** Removes float32 noise but keeps values that are off the editor's steps. */
const clean = (n: number) => Math.round(n * 1000) / 1000 + 0; // + 0 turns −0 into 0

function writeBall(view: DataView, offset: number, ball: Ball) {
  view.setUint32(offset, Math.round(ball.upperRpm), true);
  view.setUint32(offset + 4, Math.round(ball.lowerRpm), true);
  view.setFloat32(offset + 8, toWireHeight(ball.height), true);
  view.setFloat32(offset + 12, toWireDropPoint(ball.dropPoint), true);
  view.setFloat32(offset + 16, toWireFrequency(ball.frequency), true);
  view.setUint32(offset + 20, Math.round(ball.repetitions), true);
}

export function encodeBall(ball: Ball): Uint8Array {
  const bytes = new Uint8Array(BALL_BYTES);
  writeBall(new DataView(bytes.buffer), 0, ball);
  return bytes;
}

/** Reads one 24-byte ball at `offset`. */
export function parseBall(bytes: Uint8Array, offset = 0): Ball {
  if (offset < 0 || bytes.length < offset + BALL_BYTES) {
    throw new RangeError(`A ball needs ${BALL_BYTES} bytes from offset ${offset}.`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    upperRpm: view.getUint32(offset, true),
    lowerRpm: view.getUint32(offset + 4, true),
    height: clean(fromWireHeight(view.getFloat32(offset + 8, true))),
    dropPoint: clean(fromWireDropPoint(view.getFloat32(offset + 12, true))),
    frequency: clean(fromWireFrequency(view.getFloat32(offset + 16, true))),
    repetitions: view.getUint32(offset + 20, true),
  };
}

const isOnStep = (value: number, step: number) =>
  Math.abs(value / step - Math.round(value / step)) < 1e-9;

function rangeMessage(field: BallField) {
  const { min, max, step } = BALL_LIMITS[field];
  if (step === 1) return `Use a whole number from ${min} to ${max}.`;
  return `Use a number from ${min} to ${max}, in steps of ${step}.`;
}

/** One short message for each field that is out of range. An empty object means the ball is valid. */
export function validateBall(ball: Ball): BallErrors {
  const errors: BallErrors = {};
  for (const field of Object.keys(BALL_LIMITS) as BallField[]) {
    const value = ball[field];
    const { min, max, step } = BALL_LIMITS[field];
    if (!Number.isFinite(value) || value < min || value > max || !isOnStep(value, step)) {
      errors[field] = rangeMessage(field);
    }
  }
  return errors;
}

// ---------- Drills ----------

export type DrillDuration = Drill['duration'];

/**
 * Mode byte of a `0x81` message. (verify) docs/robot-protocol.md "New drill — 0x81". the v3 controller sends 3 for
 * endless, 0 for "play N minutes" and 1 for "play N combos", with N in the amount field.
 */
const DRILL_MODE = { minutes: 0, combos: 1, endless: 3 } as const;

const NEW_DRILL_HEADER_BYTES = 7; // 81 | u16 len | u8 mode | u16 amount | u8 random
const REPLACE_BALLS_HEADER_BYTES = 3; // 84 | u16 len

function checkBallCount(count: number) {
  if (count < 1 || count > MAX_BALLS_PER_MESSAGE) {
    throw new RangeError(`Send 1 to ${MAX_BALLS_PER_MESSAGE} balls at a time, not ${count}.`);
  }
}

function checkAmount(amount: number) {
  if (!Number.isInteger(amount) || amount < 0 || amount > 0xffff) {
    throw new RangeError(`The drill length must be a whole number from 0 to 65535, not ${amount}.`);
  }
}

/**
 * New drill (`0x81`) with 1 to 9 balls. `random` lets the robot pick the balls in any order. The robot counts
 * whole minutes, so 1.5 minutes is sent as 2 and the app stops the drill on time (client.ts).
 */
export function encodeDrill(
  balls: Ball[],
  { duration, random }: { duration: DrillDuration; random: boolean },
): Uint8Array {
  checkBallCount(balls.length);
  const amount =
    duration.kind === 'endless'
      ? 0
      : duration.kind === 'minutes'
        ? Math.ceil(duration.value)
        : duration.value;
  checkAmount(amount);
  const bytes = new Uint8Array(NEW_DRILL_HEADER_BYTES + balls.length * BALL_BYTES);
  const view = new DataView(bytes.buffer);
  view.setUint8(0, COMMAND.newDrill);
  view.setUint16(1, 4 + balls.length * BALL_BYTES, true);
  view.setUint8(3, DRILL_MODE[duration.kind]);
  view.setUint16(4, amount, true);
  view.setUint8(6, random ? 1 : 0);
  balls.forEach((ball, i) => writeBall(view, NEW_DRILL_HEADER_BYTES + i * BALL_BYTES, ball));
  return bytes;
}

/**
 * Replaces the balls of the drill that is playing (`0x84`), without stopping it. (verify) docs/robot-protocol.md
 * "Replace balls mid-drill": the length field is 1 + 24·n, although the message is 3 + 24·n bytes long.
 */
export function encodeReplaceBalls(balls: Ball[]): Uint8Array {
  checkBallCount(balls.length);
  const bytes = new Uint8Array(REPLACE_BALLS_HEADER_BYTES + balls.length * BALL_BYTES);
  const view = new DataView(bytes.buffer);
  view.setUint8(0, COMMAND.replaceBalls);
  view.setUint16(1, 1 + balls.length * BALL_BYTES, true);
  balls.forEach((ball, i) => writeBall(view, REPLACE_BALLS_HEADER_BYTES + i * BALL_BYTES, ball));
  return bytes;
}

function parseBalls(bytes: Uint8Array, offset: number): Ball[] {
  const count = (bytes.length - offset) / BALL_BYTES;
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError(`Expected whole balls of ${BALL_BYTES} bytes after byte ${offset}.`);
  }
  return Array.from({ length: count }, (_, i) => parseBall(bytes, offset + i * BALL_BYTES));
}

export type ParsedDrill = {
  balls: Ball[];
  random: boolean;
  mode: number;
  amount: number;
  /** `null` when the mode byte is not one of `DRILL_MODE`. */
  duration: DrillDuration | null;
};

/** Reads a `0x81` message, for example one captured from the official app. */
export function parseDrill(bytes: Uint8Array): ParsedDrill {
  if (bytes[0] !== COMMAND.newDrill) {
    throw new Error(`Not a new-drill message: it starts with ${toHex(bytes.subarray(0, 1))}.`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const balls = parseBalls(bytes, NEW_DRILL_HEADER_BYTES);
  const mode = view.getUint8(3);
  const amount = view.getUint16(4, true);
  return {
    balls,
    random: view.getUint8(6) !== 0,
    mode,
    amount,
    duration: toDuration(mode, amount),
  };
}

function toDuration(mode: number, amount: number): DrillDuration | null {
  if (mode === DRILL_MODE.endless) return { kind: 'endless' };
  if (mode === DRILL_MODE.minutes) return { kind: 'minutes', value: amount };
  if (mode === DRILL_MODE.combos) return { kind: 'combos', value: amount };
  return null;
}

/**
 * How many bytes a `0x81` or `0x84` message should have, from its length field, or `null` for other messages and
 * headers too short to read. A capture can show one message split over several Bluetooth writes; this tells
 * when it is whole.
 */
export function drillMessageLength(bytes: Uint8Array): number | null {
  if (bytes.length < 3) return null;
  const length = bytes[1] | (bytes[2] << 8);
  if (bytes[0] === COMMAND.newDrill) return 3 + length;
  if (bytes[0] === COMMAND.replaceBalls) return 2 + length; // the length field is 1 + 24·n
  return null;
}

/** Reads a `0x84` message. */
export function parseReplaceBalls(bytes: Uint8Array): Ball[] {
  if (bytes[0] !== COMMAND.replaceBalls) {
    throw new Error(`Not a replace-balls message: it starts with ${toHex(bytes.subarray(0, 1))}.`);
  }
  return parseBalls(bytes, REPLACE_BALLS_HEADER_BYTES);
}

// ---------- Control and handshake ----------

export function encodeControl(command: ControlCommand): Uint8Array {
  return Uint8Array.of(COMMAND.control, 0x01, 0x00, CONTROL[command]);
}

/** Handshake step 1. docs/robot-protocol.md "Connection handshake". */
export function encodeRequestChallenge(): Uint8Array {
  return Uint8Array.of(COMMAND.requestChallenge, 0x00, 0x00, 0x00);
}

/** Handshake step 3. */
export function encodeRequestVersion(): Uint8Array {
  return Uint8Array.of(COMMAND.requestVersion, 0x00, 0x00);
}

/** Handshake step 4. */
export function encodeRequestDeviceStatus(): Uint8Array {
  return Uint8Array.of(COMMAND.requestDeviceStatus, 0x00, 0x00);
}

/** Salt key for the challenge hash. docs/robot-protocol.md "Challenge response". */
const CHALLENGE_KEY = 'Mjgx1jAwXDBaMFcxCz3JBgNVBAYT4kJF7Rkw';

/** md5(serial + salt + code) as 32 lowercase hex characters. */
export function challengeHash(serial: string, code: string): string {
  const salt = [...serial]
    .map((ch) => CHALLENGE_KEY[ch.charCodeAt(0) % CHALLENGE_KEY.length])
    .join('');
  return SparkMD5.hash(serial + salt + code);
}

/** Handshake step 2: `08 20 00` and the hash as 32 ASCII bytes. */
export function challengeResponse(serial: string, code: string): Uint8Array {
  const hash = new TextEncoder().encode(challengeHash(serial, code));
  const bytes = new Uint8Array(3 + hash.length);
  const view = new DataView(bytes.buffer);
  view.setUint8(0, COMMAND.challengeResponse);
  view.setUint16(1, hash.length, true);
  bytes.set(hash, 3);
  return bytes;
}

// ---------- Notifications ----------

/** Type byte (byte 1) of a notification. Types 2 and 5 are in the doc; the others are guesses. */
const NOTIFICATION_TYPE = {
  // (verify) docs/robot-protocol.md "Notifications": the v3 controller names type 1 "version-info".
  version: 1,
  deviceStatus: 2,
  drillStatus: 5,
  // docs/robot-protocol.md "Notifications": the challenge comes back as the reply to "request challenge" (type 7),
  // as the v3 controller parses it. Type 8 is the reply to our challenge response.
  challenge: 7,
} as const;

/**
 * Device state at byte 4 of a device-status notification, indexed by value. (verify) docs/robot-protocol.md
 * "Notifications": the names come from the v3 controller. The doc saw 5 when a drill ends and 3 after stop.
 */
const DEVICE_STATES = [
  'uninitialized',
  'unknown',
  'initializing',
  'free',
  'running',
  'stopping',
] as const;
export type DeviceState = (typeof DEVICE_STATES)[number];

/**
 * (verify) docs/robot-protocol.md "Notifications": state 5 was seen when a drill ends, before the robot is back in
 * standby. The app treats it as "the drill is over".
 */
export const DRILL_ENDED_STATE: DeviceState = 'stopping';

/**
 * (verify) docs/robot-protocol.md "New drill — 0x81": the v1 controller treats exactly these bytes as "drill rejected",
 * although byte 0 is 1, which elsewhere means ok.
 */
const DRILL_REJECTED_HEX = '01810000';

// (verify) docs/robot-protocol.md "Connection handshake": serial at bytes 6–17, code from byte 18.
const CHALLENGE_SERIAL_START = 6;
const CHALLENGE_CODE_START = 18;

type NotificationBase = { ok: boolean; type: number; payload: Uint8Array };

export type Notification = NotificationBase &
  (
    | { kind: 'challenge'; serial: string; code: string }
    | { kind: 'device-status'; state: number; stateName: DeviceState | null }
    | {
        kind: 'drill-status';
        // (verify) docs/robot-protocol.md "Notifications": field names from the v3 controller; the units are unknown.
        runtime: number; // u16 at 4
        sets: number; // u16 at 6 ("drills" in the v3 controller)
        balls: number; // u16 at 8: balls shot in the current set
        ballIndex: number; // u8 at 10
      }
    | { kind: 'version'; serial: string; hardware: string; firmware: string }
    | { kind: 'drill-rejected' }
    | { kind: 'other' }
  );

const ascii = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

/**
 * Reads a notification: `byte 0: 1 = ok | byte 1: type | bytes 2–3: u16 payload length | bytes 4+: payload`.
 * Never throws: a message too short for its type comes back as `kind: 'other'`.
 */
export function parseNotification(bytes: Uint8Array): Notification {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const base: NotificationBase = {
    ok: bytes[0] === 1,
    type: bytes[1] ?? -1,
    payload: bytes.subarray(4),
  };
  const other = { ...base, kind: 'other' } as const;

  if (toHex(bytes) === DRILL_REJECTED_HEX) return { ...base, kind: 'drill-rejected' };

  switch (base.type) {
    case NOTIFICATION_TYPE.challenge:
      if (bytes.length < CHALLENGE_CODE_START) return other;
      return {
        ...base,
        kind: 'challenge',
        serial: ascii(bytes.subarray(CHALLENGE_SERIAL_START, CHALLENGE_CODE_START)),
        code: ascii(bytes.subarray(CHALLENGE_CODE_START)),
      };
    case NOTIFICATION_TYPE.deviceStatus: {
      if (bytes.length < 5) return other;
      const state = view.getUint8(4);
      return { ...base, kind: 'device-status', state, stateName: DEVICE_STATES[state] ?? null };
    }
    case NOTIFICATION_TYPE.drillStatus:
      if (bytes.length < 11) return other;
      return {
        ...base,
        kind: 'drill-status',
        runtime: view.getUint16(4, true),
        sets: view.getUint16(6, true),
        balls: view.getUint16(8, true),
        ballIndex: view.getUint8(10),
      };
    case NOTIFICATION_TYPE.version: {
      // (verify) three strings, their lengths in bytes 4, 5 and 6 (the v3 controller).
      if (bytes.length < 7) return other;
      const serialEnd = 7 + view.getUint8(4);
      const hardwareEnd = serialEnd + view.getUint8(5);
      const firmwareEnd = hardwareEnd + view.getUint8(6);
      if (bytes.length < firmwareEnd) return other;
      return {
        ...base,
        kind: 'version',
        serial: ascii(bytes.subarray(7, serialEnd)),
        hardware: ascii(bytes.subarray(serialEnd, hardwareEnd)),
        firmware: ascii(bytes.subarray(hardwareEnd, firmwareEnd)),
      };
    }
    default:
      return other;
  }
}

// ---------- Simulated robot ----------
// The simulated robot (simulated-transport.ts) reads what the app sends and answers with the notifications
// above. Its bytes follow the same guesses, so it can't confirm them.

export type Command =
  | { kind: 'request-challenge' }
  | { kind: 'challenge-response'; hash: string }
  | { kind: 'request-version' }
  | { kind: 'request-device-status' }
  | { kind: 'control'; command: ControlCommand }
  | { kind: 'new-drill'; drill: ParsedDrill }
  | { kind: 'replace-balls'; balls: Ball[] }
  | { kind: 'unknown'; command: number };

const CONTROL_NAMES = Object.fromEntries(
  Object.entries(CONTROL).map(([name, value]) => [value, name as ControlCommand]),
) as Record<number, ControlCommand | undefined>;

/** Reads a message the app sends to the robot. Never throws: a message it can't read is `kind: 'unknown'`. */
export function parseCommand(bytes: Uint8Array): Command {
  const command = bytes[0] ?? -1;
  const unknown = { kind: 'unknown', command } as const;
  try {
    switch (command) {
      case COMMAND.requestChallenge:
        return { kind: 'request-challenge' };
      case COMMAND.challengeResponse:
        return { kind: 'challenge-response', hash: ascii(bytes.subarray(3)) };
      case COMMAND.requestVersion:
        return { kind: 'request-version' };
      case COMMAND.requestDeviceStatus:
        return { kind: 'request-device-status' };
      case COMMAND.control: {
        const name = CONTROL_NAMES[bytes[3] ?? -1];
        return name && bytes.length === 4 ? { kind: 'control', command: name } : unknown;
      }
      case COMMAND.newDrill:
        return { kind: 'new-drill', drill: parseDrill(bytes) };
      case COMMAND.replaceBalls:
        return { kind: 'replace-balls', balls: parseReplaceBalls(bytes) };
      default:
        return unknown;
    }
  } catch {
    return unknown;
  }
}

/** `01 | type | u16 payload length | payload`, or `00 …` when `ok` is false. */
export function encodeNotification(
  type: number,
  payload = new Uint8Array(),
  ok = true,
): Uint8Array {
  const bytes = new Uint8Array(4 + payload.length);
  const view = new DataView(bytes.buffer);
  view.setUint8(0, ok ? 1 : 0);
  view.setUint8(1, type);
  view.setUint16(2, payload.length, true);
  bytes.set(payload, 4);
  return bytes;
}

/** The challenge: two unknown bytes (zero here), the 12-character serial, then the code. */
export function encodeChallengeNotification(serial: string, code: string): Uint8Array {
  const text = new TextEncoder().encode(serial.padEnd(12).slice(0, 12) + code);
  const payload = new Uint8Array(CHALLENGE_SERIAL_START - 4 + text.length);
  payload.set(text, CHALLENGE_SERIAL_START - 4);
  return encodeNotification(NOTIFICATION_TYPE.challenge, payload);
}

export function encodeVersionNotification(info: {
  serial: string;
  hardware: string;
  firmware: string;
}): Uint8Array {
  const parts = [info.serial, info.hardware, info.firmware].map((s) => new TextEncoder().encode(s));
  const payload = new Uint8Array(3 + parts.reduce((sum, p) => sum + p.length, 0));
  let offset = 3;
  parts.forEach((part, i) => {
    payload[i] = part.length;
    payload.set(part, offset);
    offset += part.length;
  });
  return encodeNotification(NOTIFICATION_TYPE.version, payload);
}

export function encodeDeviceStatusNotification(state: DeviceState): Uint8Array {
  return encodeNotification(
    NOTIFICATION_TYPE.deviceStatus,
    Uint8Array.of(DEVICE_STATES.indexOf(state)),
  );
}

export function encodeDrillStatusNotification(status: {
  runtime: number;
  sets: number;
  balls: number;
  ballIndex: number;
}): Uint8Array {
  const payload = new Uint8Array(7);
  const view = new DataView(payload.buffer);
  view.setUint16(0, status.runtime, true);
  view.setUint16(2, status.sets, true);
  view.setUint16(4, status.balls, true);
  view.setUint8(6, status.ballIndex);
  return encodeNotification(NOTIFICATION_TYPE.drillStatus, payload);
}

export function encodeDrillRejectedNotification(): Uint8Array {
  return fromHex(DRILL_REJECTED_HEX);
}

// ---------- Hex ----------

/** Lowercase hex, for the debug log. No spaces unless you pass a `separator`. */
export function toHex(bytes: Uint8Array, separator = ''): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(separator);
}

/** Reads hex like `80010002` or `80 01 00 02`. */
export function fromHex(hex: string): Uint8Array {
  const digits = hex.replace(/\s+/g, '');
  if (digits.length % 2 !== 0 || /[^0-9a-f]/i.test(digits)) {
    throw new Error(`Not a hex string: ${hex}`);
  }
  return Uint8Array.from({ length: digits.length / 2 }, (_, i) =>
    parseInt(digits.slice(i * 2, i * 2 + 2), 16),
  );
}
