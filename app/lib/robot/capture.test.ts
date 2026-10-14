import { describe, expect, it } from 'vitest';

import type { Ball } from '~/lib/drills/types';
import {
  capturedToDrill,
  findDrills,
  readCapture,
  type CapturedMessage,
} from '~/lib/robot/capture';
import { encodeControl, encodeDrill, encodeReplaceBalls, toHex } from '~/lib/robot/protocol';

const ball = (dropPoint: number, repetitions = 1): Ball => ({
  upperRpm: 4000,
  lowerRpm: 2500,
  height: 20,
  dropPoint,
  frequency: 50,
  repetitions,
});

const NINE_BALLS = [-8, -6, -4, -2, 0, 2, 4, 6, 8].map((d) => ball(d));
const nineBallDrill = encodeDrill(NINE_BALLS, {
  duration: { kind: 'minutes', value: 5 },
  random: true,
});

// ---------- Fake captures ----------

const u16 = (n: number) => [n & 0xff, n >> 8]; // little-endian, as in HCI and L2CAP
const be32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const le32 = (n: number) => be32(n).reverse();

const WRITE_HANDLE = 0x0012;
const writeCommand = (value: Uint8Array) => [0x52, ...u16(WRITE_HANDLE), ...value];
const notification = (value: Uint8Array) => [0x1b, ...u16(0x0014), ...value];

/** HCI ACL packets for one ATT PDU: an L2CAP frame on channel 4, split into pieces of at most `mtu` bytes. */
function acl(pdu: number[], { connection = 0x40, mtu = 251 } = {}): number[][] {
  const frame = [...u16(pdu.length), ...u16(0x0004), ...pdu];
  const packets: number[][] = [];
  for (let offset = 0; offset < frame.length; offset += mtu) {
    const piece = frame.slice(offset, offset + mtu);
    const boundary = offset === 0 ? 0b10 : 0b01;
    packets.push([...u16(connection | (boundary << 12)), ...u16(piece.length), ...piece]);
  }
  return packets;
}

type Packet = { sent: boolean; data: number[] };
const sent = (pdu: number[], options?: Parameters<typeof acl>[1]): Packet[] =>
  acl(pdu, options).map((data) => ({ sent: true, data }));
const received = (pdu: number[]): Packet[] => acl(pdu).map((data) => ({ sent: false, data }));

/** Android: datalink 1002 (H4), so each packet starts with its type. */
function btsnoop(packets: Packet[]): Uint8Array {
  const header = [...new TextEncoder().encode('btsnoop\0'), ...be32(1), ...be32(1002)];
  const time = 0x00dcddb30f2f8000n + 1_700_000_000_000_000n; // 14 Nov 2023, in µs since year 0
  const records = packets.flatMap(({ sent, data }) => {
    const h4 = [0x02, ...data];
    const ts = new Uint8Array(8);
    new DataView(ts.buffer).setBigInt64(0, time);
    return [
      ...be32(h4.length),
      ...be32(h4.length),
      ...be32(sent ? 0 : 1),
      ...be32(0),
      ...ts,
      ...h4,
    ];
  });
  // An HCI event, which is skipped.
  const event = [0x04, 0x0e, 0x01, 0x00];
  const eventRecord = [
    ...be32(4),
    ...be32(4),
    ...be32(3),
    ...be32(0),
    ...new Array(8).fill(0),
    ...event,
  ];
  return Uint8Array.from([...header, ...eventRecord, ...records]);
}

/** PacketLogger: u32 length, u32 seconds, u32 microseconds, u8 type, data. */
function pklg(packets: Packet[], littleEndian: boolean): Uint8Array {
  const u32 = littleEndian ? le32 : be32;
  const record = (type: number, data: number[]) => [
    ...u32(9 + data.length),
    ...u32(1_700_000_000),
    ...u32(500_000),
    type,
    ...data,
  ];
  return Uint8Array.from([
    ...record(0xfc, [...new TextEncoder().encode('note')]),
    ...packets.flatMap(({ sent, data }) => record(sent ? 0x02 : 0x03, data)),
  ]);
}

const sentHex = (messages: CapturedMessage[]) =>
  messages.filter((m) => m.direction === 'sent').map((m) => toHex(m.bytes));

// ---------- Tests ----------

describe('readCapture', () => {
  const packets = [
    ...sent(writeCommand(encodeControl('wakeUp'))),
    ...sent(writeCommand(nineBallDrill), { mtu: 27 }), // split over many ACL packets
    ...received(notification(Uint8Array.of(0x01, 0x81, 0x00, 0x00))),
  ];
  const expected = [toHex(encodeControl('wakeUp')), toHex(nineBallDrill)];

  it('reads an Android btsnoop log', () => {
    const result = readCapture(btsnoop(packets));
    if (!result.ok) throw new Error(result.error);
    expect(sentHex(result.messages)).toEqual(expected);
    expect(result.messages[0].time).toBe(1_700_000_000_000);
    expect(result.messages.at(-1)).toMatchObject({ direction: 'received', connection: 0x40 });
  });

  it.each([
    ['big-endian', false],
    ['little-endian', true],
  ])('reads a %s PacketLogger file', (_, littleEndian) => {
    const result = readCapture(pklg(packets, littleEndian));
    if (!result.ok) throw new Error(result.error);
    expect(sentHex(result.messages)).toEqual(expected);
    expect(result.messages[0].time).toBe(1_700_000_000_500);
  });

  it('joins a drill message the app wrote in several parts', () => {
    const parts = [
      nineBallDrill.subarray(0, 20),
      nineBallDrill.subarray(20, 200),
      nineBallDrill.subarray(200),
    ];
    const result = readCapture(
      pklg(
        parts.flatMap((part) => sent(writeCommand(part))),
        true,
      ),
    );
    if (!result.ok) throw new Error(result.error);
    expect(sentHex(result.messages)).toEqual([toHex(nineBallDrill)]);
  });

  it('does not wait for more parts when the length field is too long', () => {
    const broken = Uint8Array.of(0x81, 0xff, 0xff, 0x03);
    const result = readCapture(
      pklg([...sent(writeCommand(broken)), ...sent(writeCommand(encodeControl('stop')))], true),
    );
    if (!result.ok) throw new Error(result.error);
    expect(sentHex(result.messages)).toEqual(['81ffff03', '80010001']);
  });

  it('reads a long write (prepare, then execute)', () => {
    const prepare = (offset: number, part: Uint8Array) => [
      0x16,
      ...u16(WRITE_HANDLE),
      ...u16(offset),
      ...part,
    ];
    const result = readCapture(
      btsnoop([
        ...sent(prepare(0, nineBallDrill.subarray(0, 100))),
        ...sent(prepare(100, nineBallDrill.subarray(100))),
        ...sent([0x18, 0x01]),
      ]),
    );
    if (!result.ok) throw new Error(result.error);
    expect(sentHex(result.messages)).toEqual([toHex(nineBallDrill)]);
  });

  it('reads hex lines, including lines copied from a log', () => {
    const text = [
      `14:32:05  →  ${toHex(encodeControl('wakeUp'), ' ')}  wake up`,
      `14:32:06  ←  01810000`,
      toHex(nineBallDrill),
      'no hex here',
    ].join('\n');
    const result = readCapture(new TextEncoder().encode(text));
    if (!result.ok) throw new Error(result.error);
    expect(result.messages.map((m) => [m.direction, toHex(m.bytes)])).toEqual([
      ['sent', '80010000'],
      ['received', '01810000'],
      ['sent', toHex(nineBallDrill)],
    ]);
  });

  it('says so when the file is not a capture', () => {
    expect(readCapture(Uint8Array.of(0, 1, 2, 3, 4, 5))).toMatchObject({ ok: false });
    expect(readCapture(new TextEncoder().encode('hello'))).toMatchObject({ ok: false });
    const otherDatalink = Uint8Array.from([
      ...new TextEncoder().encode('btsnoop\0'),
      ...be32(1),
      ...be32(1004),
    ]);
    expect(readCapture(otherDatalink)).toMatchObject({
      ok: false,
      error: expect.stringContaining('1004'),
    });
  });
});

describe('findDrills', () => {
  const message = (bytes: Uint8Array, time = 0): CapturedMessage => ({
    time,
    direction: 'sent',
    connection: 1,
    bytes,
  });
  const twoBalls = encodeDrill([ball(-5), ball(5, 2)], {
    duration: { kind: 'endless' },
    random: false,
  });

  it('lists each drill once, with the balls changed while it played', () => {
    const drills = findDrills([
      message(encodeControl('wakeUp'), 1),
      message(twoBalls, 2),
      message(encodeReplaceBalls([ball(0)]), 3),
      message(encodeControl('stop'), 4),
      message(encodeReplaceBalls([ball(9)]), 5), // after stop: belongs to no drill
      message(nineBallDrill, 6),
      message(encodeControl('stop'), 7),
      message(twoBalls, 8),
      message(encodeReplaceBalls([ball(0)]), 9),
    ]);
    expect(drills).toHaveLength(2);
    expect(drills[0]).toMatchObject({ time: 2, timesSent: 2, replacements: [[ball(0)]] });
    expect(drills[0].messages).toHaveLength(2);
    expect(drills[1]).toMatchObject({ time: 6, timesSent: 1, replacements: [] });
    expect(drills[1].drill).toMatchObject({
      random: true,
      duration: { kind: 'minutes', value: 5 },
    });
  });

  it('ignores notifications and messages it cannot read', () => {
    expect(
      findDrills([
        { ...message(twoBalls), direction: 'received' },
        message(Uint8Array.of(0x81, 0x05, 0x00, 0x03)),
      ]),
    ).toEqual([]);
  });
});

describe('capturedToDrill', () => {
  it('makes one line per ball, 0x81 balls first', () => {
    const [captured] = findDrills([
      { time: 0, direction: 'sent', connection: 1, bytes: nineBallDrill },
      { time: 1, direction: 'sent', connection: 1, bytes: encodeReplaceBalls([ball(9, 3)]) },
    ]);
    const drill = capturedToDrill(captured);
    expect(drill.lines).toHaveLength(10);
    expect(drill.lines[0]).toEqual({ alternatives: [ball(-8)] });
    expect(drill.lines[9]).toEqual({ alternatives: [ball(9, 3)] });
    expect(drill).toMatchObject({ randomOrder: true, duration: { kind: 'minutes', value: 5 } });
  });

  it('plays a drill with an unknown mode byte endlessly', () => {
    const bytes = encodeDrill([ball(0)], { duration: { kind: 'endless' }, random: false });
    bytes[3] = 7;
    const [captured] = findDrills([{ time: 0, direction: 'sent', connection: 1, bytes }]);
    expect(captured.drill.duration).toBeNull();
    expect(capturedToDrill(captured).duration).toEqual({ kind: 'endless' });
  });
});
