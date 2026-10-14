// Reads a Bluetooth capture of the official app and finds the drills it sent to the robot.
// This file reads only the Bluetooth layers (HCI, L2CAP, ATT). protocol.ts reads the robot's own bytes.
import type { Ball, Drill } from '~/lib/drills/types';
import {
  BALL_BYTES,
  drillMessageLength,
  MAX_BALLS_PER_MESSAGE,
  parseCommand,
  toHex,
  type ParsedDrill,
} from '~/lib/robot/protocol';

/** One value written to the robot or notified by it. */
export type CapturedMessage = {
  /** Milliseconds since 1970, or `null` in a hex text file. */
  time: number | null;
  /** `sent` is phone → robot. */
  direction: 'sent' | 'received';
  /** The Bluetooth connection, so messages to other devices in the same capture stay apart. */
  connection: number;
  bytes: Uint8Array;
};

export type CaptureResult =
  { ok: true; messages: CapturedMessage[] } | { ok: false; error: string };

/** A drill the app started with `0x81`, with the balls it changed with `0x84` while the drill played. */
export type CapturedDrill = {
  time: number | null;
  drill: ParsedDrill;
  replacements: Ball[][];
  /** The `0x81` message, then each `0x84`, in hex. */
  messages: string[];
  /** How many times the app sent exactly these messages. */
  timesSent: number;
};

const NOT_A_CAPTURE =
  'This file isn’t a Bluetooth capture this app can read. Open a .pklg file from PacketLogger, a ' +
  'btsnoop_hci.log file from Android, or a text file with one message in hex on each line.';

/** Reads a PacketLogger (.pklg), btsnoop or hex text file. Never throws. */
export function readCapture(file: Uint8Array): CaptureResult {
  try {
    const packets = isBtsnoop(file) ? readBtsnoop(file) : readPacketLogger(file);
    if (packets) return { ok: true, messages: joinSplitWrites(readAtt(packets)) };
    const messages = readHexLines(new TextDecoder().decode(file));
    return messages.length > 0 ? { ok: true, messages } : { ok: false, error: NOT_A_CAPTURE };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : NOT_A_CAPTURE };
  }
}

/**
 * The drills in a capture, in the order the app first sent them. A drill sent again with the same bytes is listed
 * once, with `timesSent` counting the sends.
 */
export function findDrills(messages: CapturedMessage[]): CapturedDrill[] {
  const drills = new Map<string, CapturedDrill>();
  let current: CapturedDrill | null = null;
  const finish = () => {
    if (!current) return;
    const key = current.messages.join(' ');
    const seen = drills.get(key);
    if (seen) seen.timesSent++;
    else drills.set(key, current);
    current = null;
  };

  for (const message of messages) {
    if (message.direction !== 'sent') continue;
    const command = parseCommand(message.bytes);
    if (command.kind === 'new-drill') {
      finish();
      current = {
        time: message.time,
        drill: command.drill,
        replacements: [],
        messages: [toHex(message.bytes)],
        timesSent: 1,
      };
    } else if (command.kind === 'replace-balls' && current) {
      current.replacements.push(command.balls);
      current.messages.push(toHex(message.bytes));
    } else if (command.kind === 'control' && command.command === 'stop') {
      finish();
    }
  }
  finish();
  return [...drills.values()];
}

/**
 * The captured drill as this app's drill: one line per ball, in the order the app sent them. Balls sent with
 * `0x84` come after the `0x81` balls. A mode byte this app doesn't know becomes "endless".
 */
export function capturedToDrill({
  drill,
  replacements,
}: CapturedDrill): Pick<Drill, 'lines' | 'randomOrder' | 'duration'> {
  return {
    lines: [drill.balls, ...replacements].flat().map((ball) => ({ alternatives: [{ ...ball }] })),
    randomOrder: drill.random,
    duration: drill.duration ?? { kind: 'endless' },
  };
}

// ---------- HCI packets ----------

/** An HCI ACL data packet: u16 handle and flags, u16 length, then L2CAP. */
type AclPacket = { time: number; sent: boolean; data: Uint8Array };

const view = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

const BTSNOOP_MAGIC = 'btsnoop\0';
const BTSNOOP_HEADER_BYTES = 16;
const BTSNOOP_RECORD_BYTES = 24;
const BTSNOOP_HCI = 1001; // no packet type byte; flags bit 1 marks commands and events
const BTSNOOP_UART = 1002; // H4: a packet type byte comes first
const H4_ACL = 0x02;
/** btsnoop times count microseconds from 1 January year 0. This is 1970 on that scale. */
const BTSNOOP_EPOCH = 0x00dcddb30f2f8000n;

function isBtsnoop(file: Uint8Array) {
  return new TextDecoder().decode(file.subarray(0, BTSNOOP_MAGIC.length)) === BTSNOOP_MAGIC;
}

/** Android's `btsnoop_hci.log`, and Wireshark's btsnoop export. Numbers are big-endian. */
function readBtsnoop(file: Uint8Array): AclPacket[] {
  const v = view(file);
  const datalink = file.length >= BTSNOOP_HEADER_BYTES ? v.getUint32(12) : -1;
  if (datalink !== BTSNOOP_HCI && datalink !== BTSNOOP_UART) {
    throw new Error(
      `This btsnoop file uses data link type ${datalink}, which this app can’t read.`,
    );
  }
  const packets: AclPacket[] = [];
  let offset = BTSNOOP_HEADER_BYTES;
  while (offset + BTSNOOP_RECORD_BYTES <= file.length) {
    const included = v.getUint32(offset + 4);
    const flags = v.getUint32(offset + 8);
    const time = Number(v.getBigInt64(offset + 16) - BTSNOOP_EPOCH) / 1000;
    const start = offset + BTSNOOP_RECORD_BYTES;
    offset = start + included;
    if (offset > file.length) break; // cut off mid-record
    let data = file.subarray(start, offset);
    if (datalink === BTSNOOP_UART) {
      if (data[0] !== H4_ACL) continue;
      data = data.subarray(1);
    } else if (flags & 0b10) {
      continue;
    }
    packets.push({ time, sent: (flags & 0b01) === 0, data });
  }
  return packets;
}

const PKLG_HEADER_BYTES = 13; // u32 length, u32 seconds, u32 microseconds, u8 type
const PKLG_ACL_SENT = 0x02;
const PKLG_ACL_RECEIVED = 0x03;
const PKLG_TYPES = new Set([
  0x00, 0x01, 0x02, 0x03, 0x08, 0x09, 0x0a, 0x0b, 0xf7, 0xf8, 0xf9, 0xfa, 0xfb, 0xfc, 0xfd, 0xfe,
]);

/**
 * Apple's PacketLogger (`.pklg`). Older files are big-endian, newer ones little-endian, so try both, as Wireshark
 * does. `null` when the file is neither.
 */
function readPacketLogger(file: Uint8Array): AclPacket[] | null {
  const littleEndian = [false, true].find((le) => looksLikePacketLogger(file, le));
  if (littleEndian === undefined) return null;
  const v = view(file);
  const packets: AclPacket[] = [];
  let offset = 0;
  while (offset + PKLG_HEADER_BYTES <= file.length) {
    const length = v.getUint32(offset, littleEndian); // counts the bytes after itself
    const end = offset + 4 + length;
    if (length < PKLG_HEADER_BYTES - 4 || end > file.length) break;
    const type = file[offset + 12];
    if (type === PKLG_ACL_SENT || type === PKLG_ACL_RECEIVED) {
      const time =
        v.getUint32(offset + 4, littleEndian) * 1000 + v.getUint32(offset + 8, littleEndian) / 1000;
      packets.push({ time, sent: type === PKLG_ACL_SENT, data: file.subarray(offset + 13, end) });
    }
    offset = end;
  }
  return packets;
}

/** The first two records have sensible lengths and known types. */
function looksLikePacketLogger(file: Uint8Array, littleEndian: boolean) {
  const v = view(file);
  let offset = 0;
  for (let record = 0; record < 2 && offset < file.length; record++) {
    if (offset + PKLG_HEADER_BYTES > file.length) return false;
    const length = v.getUint32(offset, littleEndian);
    if (length < PKLG_HEADER_BYTES - 4 || offset + 4 + length > file.length) return false;
    if (!PKLG_TYPES.has(file[offset + 12])) return false;
    offset += 4 + length;
  }
  return offset > 0;
}

// ---------- L2CAP and ATT ----------

const ACL_CONTINUATION = 0b01;
const ATT_CHANNEL = 0x0004;
const ATT = {
  writeRequest: 0x12,
  writeCommand: 0x52,
  prepareWrite: 0x16,
  executeWrite: 0x18,
  notification: 0x1b,
} as const;

type Frame = { time: number; sent: boolean; connection: number; size: number; parts: Uint8Array[] };

function concat(parts: Uint8Array[]): Uint8Array {
  const bytes = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}

/** Puts L2CAP frames split over several ACL packets back together and reads the ATT writes and notifications. */
function readAtt(packets: AclPacket[]): CapturedMessage[] {
  const open = new Map<string, Frame & { channel: number }>();
  const prepared = new Map<number, Uint8Array[]>();
  const messages: CapturedMessage[] = [];

  const readPdu = ({ time, sent, connection }: Frame, pdu: Uint8Array) => {
    const opcode = pdu[0];
    const message = (bytes: Uint8Array): CapturedMessage => ({
      time,
      direction: sent ? 'sent' : 'received',
      connection,
      bytes,
    });
    if (sent && (opcode === ATT.writeRequest || opcode === ATT.writeCommand)) {
      messages.push(message(pdu.subarray(3))); // opcode, u16 handle, value
    } else if (sent && opcode === ATT.prepareWrite) {
      // A long write: the value comes in parts (opcode, u16 handle, u16 offset, part), sent when executed.
      prepared.set(connection, [...(prepared.get(connection) ?? []), pdu.subarray(5)]);
    } else if (sent && opcode === ATT.executeWrite) {
      const parts = prepared.get(connection);
      prepared.delete(connection);
      if (parts && pdu[1] === 1) messages.push(message(concat(parts)));
    } else if (!sent && opcode === ATT.notification) {
      messages.push(message(pdu.subarray(3)));
    }
  };

  for (const { time, sent, data } of packets) {
    if (data.length < 4) continue;
    const v = view(data);
    const header = v.getUint16(0, true);
    const connection = header & 0x0fff;
    const payload = data.subarray(4, 4 + v.getUint16(2, true));
    const key = `${connection}:${sent}`;

    let frame = open.get(key);
    if (((header >> 12) & 0b11) === ACL_CONTINUATION) {
      if (!frame) continue; // the start of this frame is not in the capture
      frame.parts.push(payload);
    } else {
      if (payload.length < 4) continue;
      const pv = view(payload);
      frame = {
        time,
        sent,
        connection,
        size: pv.getUint16(0, true),
        channel: pv.getUint16(2, true),
        parts: [payload.subarray(4)],
      };
      open.set(key, frame);
    }

    const bytes = concat(frame.parts);
    if (bytes.length < frame.size) continue;
    open.delete(key);
    if (frame.channel === ATT_CHANNEL && frame.size > 0)
      readPdu(frame, bytes.subarray(0, frame.size));
  }
  return messages;
}

/** A `0x81` with 9 balls. A longer length field is a broken message: don't wait for more parts. */
const LONGEST_MESSAGE = 7 + MAX_BALLS_PER_MESSAGE * BALL_BYTES;

/** The app may write one drill message in several parts. Join them until the length field is reached. */
function joinSplitWrites(messages: CapturedMessage[]): CapturedMessage[] {
  const joined: CapturedMessage[] = [];
  const open = new Map<number, CapturedMessage>(); // by connection
  for (const message of messages) {
    if (message.direction !== 'sent') {
      joined.push(message);
      continue;
    }
    const start = open.get(message.connection);
    const current = start ? { ...start, bytes: concat([start.bytes, message.bytes]) } : message;
    const expected = drillMessageLength(current.bytes);
    if (expected !== null && current.bytes.length < expected && expected <= LONGEST_MESSAGE) {
      open.set(message.connection, current);
      continue;
    }
    open.delete(message.connection);
    joined.push(current);
  }
  return joined;
}

// ---------- Hex text ----------

/** At least 4 bytes, so a time like 14:32:05 is not read as a message. */
const HEX_RUN = /(?:[0-9a-f]{2}[\s:]?){4,}/gi;

/**
 * One message per line, in hex. The longest hex run on each line is the message, so lines copied from a log with
 * times and notes still read. A line with ← is a notification; anything else was sent.
 */
function readHexLines(text: string): CapturedMessage[] {
  if (text.includes('\0')) return []; // binary, not text
  return text.split(/\r?\n/).flatMap((line): CapturedMessage[] => {
    const runs = (line.match(HEX_RUN) ?? []).map((run) => run.replace(/[\s:]/g, ''));
    const longest = runs.sort((a, b) => b.length - a.length)[0];
    if (!longest) return [];
    const bytes = Uint8Array.from(longest.match(/../g) ?? [], (pair) => parseInt(pair, 16));
    return [
      { time: null, direction: line.includes('←') ? 'received' : 'sent', connection: 0, bytes },
    ];
  });
}
