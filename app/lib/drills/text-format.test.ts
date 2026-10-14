import { describe, expect, it } from 'vitest';

import { parseDrillText, printDrillText } from '~/lib/drills/text-format';
import { testBall, testDrill } from '~/testing/drills';

// A known example drill.
const EXAMPLE = `500   4000  -50   6   0  1
1000, 4000,  20, 10, 30, 1 | 5000,  700,  40, -10, 20, 1 ; either fh or bh drive
4000   700  100   2  20  1`;

const ball = (...[upperRpm, lowerRpm, height, dropPoint, frequency, repetitions]: number[]) => ({
  upperRpm,
  lowerRpm,
  height,
  dropPoint,
  frequency,
  repetitions,
});

describe('parseDrillText', () => {
  it('reads the example', () => {
    expect(parseDrillText(EXAMPLE)).toEqual({
      ok: true,
      lines: [
        { alternatives: [ball(500, 4000, -50, 6, 0, 1)] },
        { alternatives: [ball(1000, 4000, 20, 10, 30, 1), ball(5000, 700, 40, -10, 20, 1)] },
        { alternatives: [ball(4000, 700, 100, 2, 20, 1)] },
      ],
    });
  });

  it('skips blank and comment lines, and reads a name from the first comment', () => {
    const result = parseDrillText('; Falkenberg\n\r\n  ; warm up first\n400 400 0 -0.5 50 2\r\n');
    expect(result).toEqual({
      ok: true,
      name: 'Falkenberg',
      lines: [{ alternatives: [ball(400, 400, 0, -0.5, 50, 2)] }],
    });
  });

  it('reports every bad ball with its line', () => {
    const result = parseDrillText(
      [
        '400 400 0 0 50', // five numbers
        '400 400 0 0 50 1 | 400 abc 0 0 50 1',
        '7501 400 0 0 50 1',
        '400 400 0 0.3 50 1',
        '400 400 0 0 50 1 |',
      ].join('\n'),
    );
    expect(result).toEqual({
      ok: false,
      errors: [
        'Line 1: A ball needs 6 numbers, not 5.',
        'Line 2, ball 2: “abc” isn’t a number.',
        'Line 3: The upper wheel is 7501. Use a whole number from 400 to 7500.',
        'Line 4: The drop point is 0.3. Use a number from -10 to 10, in steps of 0.5.',
        'Line 5, ball 2: A ball has no numbers. Check for an extra “|”.',
      ],
    });
  });

  it('needs at least one ball', () => {
    expect(parseDrillText('; just a comment\n')).toEqual({
      ok: false,
      errors: ['There are no balls in this text.'],
    });
  });
});

describe('printDrillText', () => {
  it('prints one line per drill line with the name first', () => {
    const drill = testDrill(
      [
        testBall({ upperRpm: 5220, lowerRpm: 3860, dropPoint: -6.5 }),
        [testBall(), testBall({ repetitions: 3 })],
      ],
      { name: 'Two lines' },
    );
    expect(printDrillText(drill)).toBe(
      '; Two lines\n5220 3860 20 -6.5 50 1\n3000 2000 20 0 50 1 | 3000 2000 20 0 50 3\n',
    );
  });

  it('round trips through parseDrillText', () => {
    const drill = testDrill(
      [
        testBall({ upperRpm: 400, lowerRpm: 7500, height: -50, dropPoint: -10, frequency: 0 }),
        [testBall({ height: 100, dropPoint: 10, frequency: 100, repetitions: 200 }), testBall()],
      ],
      { name: 'Edges; and a semicolon' },
    );
    expect(parseDrillText(printDrillText(drill))).toEqual({
      ok: true,
      name: drill.name,
      lines: drill.lines,
    });
  });

  it('round trips the example, apart from its comment', () => {
    const parsed = parseDrillText(EXAMPLE);
    if (!parsed.ok) throw new Error('parse failed');
    expect(parseDrillText(printDrillText(parsed))).toEqual(parsed);
  });
});
