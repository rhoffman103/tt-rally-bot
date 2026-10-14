// Packs drills into a short text code for QR codes and links (`tt-rally-bot://import?d=<code>`), and back.
//
// The code is base64url. Its first byte is the format version; the rest is the body, compressed with
// deflate-raw. Body, version 1 (numbers are unsigned; "varint" is LEB128):
//
//   varint drill count, then for each drill:
//     u8      flags: bit 0 random order, bits 1–2 duration (0 endless, 1 minutes, 2 combos),
//             bit 3 has a pause between sets, bit 4 the id is a UUID, bit 5 the minutes are counted in halves
//     id      16 bytes if it is a UUID, else a string
//     string  name
//     varint  duration value (not for endless). Minutes with a half (1.5) set bit 5 and are sent doubled (3)
//     varint  pause between sets in seconds (only with bit 3)
//     varint  updatedAt in milliseconds since 1970
//     varint  line count, then for each line: varint ball count, then the balls
//   ball (8 bytes): u16 upper rpm − 400, u16 lower rpm − 400, u8 height + 50, u8 (drop point + 10) · 2,
//                   u8 frequency / 10, u8 repetitions − 1
//   string: varint byte length, then UTF-8
//
// Ball values are rounded to the editor's steps (whole rpm and height, 0.5 drop point, 10 frequency), so a value
// captured from the robot between two steps comes back on the nearest step. A newer format gets a new version byte;
// keep the decoder for every older version so old codes still import.
import type { Ball, Drill, DrillLine } from '~/lib/drills/types';
import { BALL_LIMITS } from '~/lib/robot/protocol';

const VERSION = 1;
const MAX_BODY_BYTES = 1 << 20; // stops a tiny code from inflating into a huge one

const DURATION_KINDS = ['endless', 'minutes', 'combos'] as const;
const FLAG = {
  random: 1,
  durationShift: 1,
  durationMask: 0b110,
  pause: 1 << 3,
  uuid: 1 << 4,
  halfMinutes: 1 << 5,
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type ShareCodeError = 'empty' | 'not-a-code' | 'newer-version' | 'damaged';
export type ShareCodeResult =
  { ok: true; drills: Drill[] } | { ok: false; reason: ShareCodeError; error: string };

const MESSAGES: Record<ShareCodeError, string> = {
  empty: 'There is no drill in this link.',
  'not-a-code': 'This isn’t a TT Rally Bot drill code. Check that you copied the whole link.',
  'newer-version':
    'This drill was shared from a newer version of TT Rally Bot. Update TT Rally Bot, then try again.',
  damaged: 'This drill code is damaged or cut off. Ask for a new one.',
};

/** Packs one drill, or a list of drills, into a share code. */
export async function encodeShareCode(drills: Drill | Drill[]): Promise<string> {
  const list = Array.isArray(drills) ? drills : [drills];
  const body = new ByteWriter();
  body.varint(list.length);
  for (const drill of list) writeDrill(body, drill);
  const compressed = await transform(body.bytes(), new CompressionStream('deflate-raw'));
  const code = new Uint8Array(1 + compressed.length);
  code[0] = VERSION;
  code.set(compressed, 1);
  return toBase64Url(code);
}

/**
 * Reads a share code. Never throws: a bad code gives `ok: false` with a message to show. The drills come back as
 * custom drills with their `id`, so importing a drill again updates it.
 */
export async function decodeShareCode(code: string): Promise<ShareCodeResult> {
  const text = code.trim();
  if (text === '') return failure('empty');
  const bytes = fromBase64Url(text);
  if (!bytes || bytes.length < 2) return failure('not-a-code');
  if (bytes[0] > VERSION) return failure('newer-version');
  if (bytes[0] !== VERSION) return failure('not-a-code');
  try {
    const body = await transform(
      bytes.subarray(1),
      new DecompressionStream('deflate-raw'),
      MAX_BODY_BYTES,
    );
    const reader = new ByteReader(body);
    const count = reader.varint();
    const drills = Array.from({ length: count }, () => readDrill(reader));
    if (count === 0 || !reader.done()) return failure('damaged');
    return { ok: true, drills };
  } catch {
    // Unreadable compressed data, a body that ends too soon, or values out of range.
    return failure('damaged');
  }
}

const failure = (reason: ShareCodeError): ShareCodeResult => ({
  ok: false,
  reason,
  error: MESSAGES[reason],
});

// ---------- Drills ----------

function writeDrill(out: ByteWriter, drill: Drill) {
  if (drill.lines.length === 0 || drill.lines.some((line) => line.alternatives.length === 0)) {
    throw new RangeError(`“${drill.name}” needs at least one ball on every line.`);
  }
  const uuid = UUID.test(drill.id);
  const pause = drill.pauseBetweenSetsSec;
  const { duration } = drill;
  const halves = duration.kind === 'minutes' && !Number.isInteger(duration.value);
  out.u8(
    (drill.randomOrder ? FLAG.random : 0) |
      (DURATION_KINDS.indexOf(drill.duration.kind) << FLAG.durationShift) |
      (pause !== undefined ? FLAG.pause : 0) |
      (uuid ? FLAG.uuid : 0) |
      (halves ? FLAG.halfMinutes : 0),
  );
  if (uuid) out.raw(uuidToBytes(drill.id));
  else out.string(drill.id);
  out.string(drill.name);
  if (duration.kind !== 'endless')
    out.varint(Math.round(halves ? duration.value * 2 : duration.value));
  if (pause !== undefined) out.varint(Math.round(pause));
  out.varint(Math.max(0, Date.parse(drill.updatedAt) || 0));
  out.varint(drill.lines.length);
  for (const line of drill.lines) {
    out.varint(line.alternatives.length);
    for (const ball of line.alternatives) writeBall(out, ball);
  }
}

function readDrill(input: ByteReader): Drill {
  const flags = input.u8();
  const kind = DURATION_KINDS[(flags & FLAG.durationMask) >> FLAG.durationShift];
  const halves = (flags & FLAG.halfMinutes) !== 0;
  if (!kind || flags >> 6 || (halves && kind !== 'minutes')) {
    throw new RangeError('Unknown drill flags.');
  }
  const id = flags & FLAG.uuid ? bytesToUuid(input.raw(16)) : input.string();
  const name = input.string();
  const duration: Drill['duration'] =
    kind === 'endless' ? { kind } : { kind, value: halves ? input.varint() / 2 : input.varint() };
  const pause = flags & FLAG.pause ? input.varint() : undefined;
  const updatedAt = new Date(input.varint()).toISOString();
  const lineCount = input.varint();
  if (lineCount === 0) throw new RangeError('A drill has no balls.');
  const lines = Array.from({ length: lineCount }, (): DrillLine => {
    const ballCount = input.varint();
    if (ballCount === 0) throw new RangeError('A line has no balls.');
    return { alternatives: Array.from({ length: ballCount }, () => readBall(input)) };
  });
  return {
    id,
    name,
    lines,
    randomOrder: (flags & FLAG.random) !== 0,
    duration,
    ...(pause === undefined ? {} : { pauseBetweenSetsSec: pause }),
    source: 'custom',
    updatedAt,
  };
}

// ---------- Balls ----------

// Each field is stored as the number of steps above its minimum, in 2 bytes for rpm and 1 byte for the rest.
const BALL_FIELDS = [
  ['upperRpm', 2],
  ['lowerRpm', 2],
  ['height', 1],
  ['dropPoint', 1],
  ['frequency', 1],
  ['repetitions', 1],
] as const satisfies readonly (readonly [keyof Ball, 1 | 2])[];

function writeBall(out: ByteWriter, ball: Ball) {
  for (const [field, size] of BALL_FIELDS) {
    const { min, max, step } = BALL_LIMITS[field];
    const steps = Math.round((Math.min(max, Math.max(min, ball[field])) - min) / step);
    if (size === 2) out.u16(steps);
    else out.u8(steps);
  }
}

function readBall(input: ByteReader): Ball {
  const ball: Partial<Ball> = {};
  for (const [field, size] of BALL_FIELDS) {
    const { min, max, step } = BALL_LIMITS[field];
    const value = (size === 2 ? input.u16() : input.u8()) * step + min;
    if (value > max) throw new RangeError(`${field} is out of range.`);
    ball[field] = value;
  }
  return ball as Ball;
}

// ---------- Bytes ----------

class ByteWriter {
  private data: number[] = [];

  u8(value: number) {
    this.data.push(value & 0xff);
  }
  u16(value: number) {
    this.data.push(value & 0xff, (value >> 8) & 0xff);
  }
  /** Unsigned LEB128. Uses arithmetic, not bit operators, so it works past 32 bits (times in ms). */
  varint(value: number) {
    let rest = value;
    while (rest >= 0x80) {
      this.data.push((rest % 0x80) + 0x80);
      rest = Math.floor(rest / 0x80);
    }
    this.data.push(rest);
  }
  raw(bytes: Uint8Array) {
    this.data.push(...bytes);
  }
  string(value: string) {
    const bytes = new TextEncoder().encode(value);
    this.varint(bytes.length);
    this.raw(bytes);
  }
  bytes(): Uint8Array<ArrayBuffer> {
    return Uint8Array.from(this.data);
  }
}

class ByteReader {
  private offset = 0;
  constructor(private readonly data: Uint8Array) {}

  private take(count: number): Uint8Array {
    if (this.offset + count > this.data.length) throw new RangeError('The code ends too soon.');
    const bytes = this.data.subarray(this.offset, this.offset + count);
    this.offset += count;
    return bytes;
  }
  u8() {
    return this.take(1)[0];
  }
  u16() {
    const [low, high] = this.take(2);
    return low | (high << 8);
  }
  varint() {
    let value = 0;
    for (let factor = 1; factor <= 2 ** 49; factor *= 0x80) {
      const byte = this.u8();
      value += (byte & 0x7f) * factor;
      if (byte < 0x80) return value;
    }
    throw new RangeError('A number in the code is too long.');
  }
  raw(count: number) {
    return this.take(count);
  }
  string() {
    return new TextDecoder('utf-8', { fatal: true }).decode(this.take(this.varint()));
  }
  done() {
    return this.offset === this.data.length;
  }
}

function uuidToBytes(id: string): Uint8Array {
  const hex = id.replaceAll('-', '');
  return Uint8Array.from({ length: 16 }, (_, i) => parseInt(hex.slice(i * 2, i * 2 + 2), 16));
}

function bytesToUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Runs bytes through a compression or decompression stream. Throws if the output grows past `maxBytes`. */
async function transform(
  bytes: Uint8Array,
  stream: CompressionStream | DecompressionStream,
  maxBytes = Infinity,
): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  // Errors show up when reading below; catch them here so they aren't reported as unhandled.
  writer.write(Uint8Array.from(bytes)).catch(() => {});
  writer.close().catch(() => {});
  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > maxBytes) {
      await reader.cancel();
      throw new RangeError('The code unpacks to too much data.');
    }
    chunks.push(value);
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

/** The bytes in a base64url string, or null if it isn't one. Also accepts standard base64 and padding. */
function fromBase64Url(text: string): Uint8Array | null {
  const base64 = text.replaceAll('-', '+').replaceAll('_', '/').replace(/=+$/, '');
  if (!/^[A-Za-z0-9+/]*$/.test(base64) || base64.length % 4 === 1) return null;
  try {
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}
