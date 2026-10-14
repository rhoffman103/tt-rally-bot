import { describe, expect, it } from 'vitest';

import { decodeShareCode, encodeShareCode } from '~/lib/drills/share-code';
import type { Ball, Drill } from '~/lib/drills/types';
import { BALL_LIMITS } from '~/lib/robot/protocol';
import { testBall, testDrill } from '~/testing/drills';

async function roundTrip(drills: Drill | Drill[]) {
  const result = await decodeShareCode(await encodeShareCode(drills));
  if (!result.ok) throw new Error(result.error);
  return result.drills;
}

/** A repeatable stream of random numbers (mulberry32). */
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomBall(next: () => number): Ball {
  const ball: Partial<Ball> = {};
  for (const [field, { min, max, step }] of Object.entries(BALL_LIMITS)) {
    ball[field as keyof Ball] = min + Math.floor(next() * ((max - min) / step + 1)) * step;
  }
  return ball as Ball;
}

const toBytes = (code: string) =>
  Uint8Array.from(atob(code.replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0));
const toCode = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');

describe('share code round trip', () => {
  it('keeps every value of a drill', async () => {
    const drill = testDrill([testBall(), testBall({ dropPoint: -3.5, repetitions: 4 })], {
      id: 'third-ball',
      name: 'Third-ball attack',
      duration: { kind: 'combos', value: 20 },
      pauseBetweenSetsSec: 3,
      updatedAt: '2026-10-08T09:15:42.123Z',
    });
    expect(await roundTrip(drill)).toEqual([drill]);
  });

  it('keeps the lowest and highest value of every field', async () => {
    const lowest = testBall({
      upperRpm: 400,
      lowerRpm: 400,
      height: -50,
      dropPoint: -10,
      frequency: 0,
      repetitions: 1,
    });
    const highest = testBall({
      upperRpm: 7500,
      lowerRpm: 7500,
      height: 100,
      dropPoint: 10,
      frequency: 100,
      repetitions: 200,
    });
    const drill = testDrill([lowest, highest, testBall({ height: 0, dropPoint: 0 })]);
    expect(await roundTrip(drill)).toEqual([drill]);
  });

  it('keeps every duration, random order and a long name', async () => {
    const drills = [
      testDrill([testBall()], { id: 'a', duration: { kind: 'endless' }, randomOrder: true }),
      testDrill([testBall()], { id: 'b', duration: { kind: 'minutes', value: 65535 } }),
      testDrill([testBall()], { id: 'c', duration: { kind: 'combos', value: 1 } }),
      testDrill([testBall()], { id: 'h', duration: { kind: 'minutes', value: 0.5 } }),
      testDrill([testBall()], { id: 'i', duration: { kind: 'minutes', value: 2.5 } }),
      testDrill([testBall()], { id: 'd', name: 'Ünïcödé 🏓 '.repeat(40), pauseBetweenSetsSec: 0 }),
    ];
    expect(await roundTrip(drills)).toEqual(drills);
  });

  it('keeps random lines', async () => {
    const drill = testDrill([
      testBall(),
      [testBall({ dropPoint: -7 }), testBall({ dropPoint: 7 })],
      [testBall({ height: 1 }), testBall({ height: 2 }), testBall({ height: 3 })],
    ]);
    expect(await roundTrip(drill)).toEqual([drill]);
  });

  it('keeps random drills with random values', async () => {
    const next = random(42);
    for (let i = 0; i < 50; i++) {
      const lines = Array.from({ length: 1 + Math.floor(next() * 12) }, () =>
        next() < 0.3
          ? Array.from({ length: 2 + Math.floor(next() * 3) }, () => randomBall(next))
          : randomBall(next),
      );
      const drill = testDrill(lines, { id: crypto.randomUUID(), randomOrder: next() < 0.5 });
      expect(await roundTrip(drill)).toEqual([drill]);
    }
  });

  it('keeps a long drill', async () => {
    const next = random(7);
    const drill = testDrill(Array.from({ length: 500 }, () => randomBall(next)));
    expect(await roundTrip(drill)).toEqual([drill]);
  });

  it('turns a preset into a custom drill and keeps its id', async () => {
    const drill = testDrill([testBall()], { id: 'falkenberg', source: 'preset' });
    expect(await roundTrip(drill)).toEqual([{ ...drill, source: 'custom' }]);
  });

  it('rounds values that are between the editor’s steps', async () => {
    const drill = testDrill([testBall({ height: 13.333, dropPoint: 2.3, frequency: 47 })]);
    const [decoded] = await roundTrip(drill);
    expect(decoded.lines[0].alternatives[0]).toMatchObject({
      height: 13,
      dropPoint: 2.5,
      frequency: 50,
    });
  });
});

describe('share code format', () => {
  it('starts with format version 1 and uses only base64url characters', async () => {
    const code = await encodeShareCode(testDrill([testBall()]));
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(toBytes(code)[0]).toBe(1);
  });

  it('fits a 9-ball drill with a generated id in about 150 characters', async () => {
    const next = random(1);
    const drill = testDrill(
      Array.from({ length: 9 }, () => randomBall(next)),
      { id: crypto.randomUUID(), name: 'Serve return mix' },
    );
    const code = await encodeShareCode(drill);
    expect(code.length).toBeLessThan(200);
  });

  it('refuses a drill with no balls', async () => {
    await expect(encodeShareCode(testDrill([]))).rejects.toThrow('at least one ball');
  });
});

describe('decoding bad codes', () => {
  const failure = (reason: string) => expect.objectContaining({ ok: false, reason });

  it('says when there is no code', async () => {
    expect(await decodeShareCode('  ')).toEqual(
      expect.objectContaining({ ok: false, reason: 'empty', error: expect.any(String) }),
    );
  });

  it('says when the text isn’t a code', async () => {
    expect(await decodeShareCode('not a code!')).toEqual(failure('not-a-code'));
    expect(await decodeShareCode('A')).toEqual(failure('not-a-code'));
    expect(await decodeShareCode('AA')).toEqual(failure('not-a-code')); // one byte: no body
    expect(await decodeShareCode(toCode(Uint8Array.of(0, 1, 2)))).toEqual(failure('not-a-code'));
  });

  it('says when the code comes from a newer version', async () => {
    const bytes = toBytes(await encodeShareCode(testDrill([testBall()])));
    bytes[0] = 2;
    expect(await decodeShareCode(toCode(bytes))).toEqual(failure('newer-version'));
  });

  it('says when the code is cut off', async () => {
    const code = await encodeShareCode(testDrill([testBall(), testBall()]));
    for (const length of [code.length - 1, code.length - 4, Math.floor(code.length / 2), 4]) {
      expect(await decodeShareCode(code.slice(0, length))).toEqual(failure('damaged'));
    }
  });

  it('says when the code is damaged', async () => {
    const bytes = toBytes(await encodeShareCode(testDrill([testBall()])));
    bytes[5] ^= 0xff;
    const result = await decodeShareCode(toCode(bytes));
    // A changed byte can still inflate to a valid drill by chance, but it must never throw.
    expect(result.ok ? result.drills : result.reason).toBeTruthy();
    expect(await decodeShareCode(toCode(Uint8Array.of(1, 0xff, 0xff, 0xff)))).toEqual(
      failure('damaged'),
    );
  });

  it('never throws on random input', async () => {
    const next = random(99);
    for (let i = 0; i < 200; i++) {
      const bytes = Uint8Array.from({ length: 1 + Math.floor(next() * 60) }, () =>
        Math.floor(next() * 256),
      );
      bytes[0] = 1;
      const result = await decodeShareCode(toCode(bytes));
      expect(typeof result.ok).toBe('boolean');
    }
  });

  it('refuses a code that unpacks to too much data', async () => {
    const huge = new Uint8Array(2 << 20);
    const stream = new CompressionStream('deflate-raw');
    const writer = stream.writable.getWriter();
    void writer.write(huge);
    void writer.close();
    const compressed = new Uint8Array(await new Response(stream.readable).arrayBuffer());
    const code = toCode(Uint8Array.of(1, ...compressed));
    expect(await decodeShareCode(code)).toEqual(failure('damaged'));
  });
});
