// A plain text format for drills, so they can move between this app and other Nova S controllers:
//
//   500   4000  -50   6   0  1
//   1000, 4000,  20, 10, 30, 1 | 5000,  700,  40, -10, 20, 1 ; either fh or bh drive
//
// One drill line per text line. A ball is six numbers: upper rpm, lower rpm, height, drop point, frequency and
// repetitions, separated by spaces or commas. `|` separates balls the robot picks from at random. `;` starts a
// comment that runs to the end of the line. Lines with no balls are skipped. The format has no name, duration or
// order: print puts the name in a comment on the first line, and parse reads it back from there.
import type { Ball, DrillLine } from '~/lib/drills/types';
import { validateBall } from '~/lib/robot/protocol';

export type TextParseResult =
  { ok: true; name?: string; lines: DrillLine[] } | { ok: false; errors: string[] };

const FIELDS = ['upperRpm', 'lowerRpm', 'height', 'dropPoint', 'frequency', 'repetitions'] as const;
const FIELD_NAMES: Record<keyof Ball, string> = {
  upperRpm: 'upper wheel',
  lowerRpm: 'lower wheel',
  height: 'height',
  dropPoint: 'drop point',
  frequency: 'frequency',
  repetitions: 'repetitions',
};

export function parseDrillText(text: string): TextParseResult {
  const lines: DrillLine[] = [];
  const errors: string[] = [];
  let name: string | undefined;
  for (const [i, rawLine] of text.split(/\r?\n/).entries()) {
    const [code, ...comment] = rawLine.split(';');
    if (code.trim() === '') {
      // The first comment before any ball is the drill's name, as printDrillText writes it.
      if (lines.length === 0 && errors.length === 0 && name === undefined && comment.length > 0) {
        name = comment.join(';').trim() || undefined;
      }
      continue;
    }
    const alternatives: Ball[] = [];
    const parts = code.split('|');
    for (const [j, part] of parts.entries()) {
      const where = parts.length > 1 ? `Line ${i + 1}, ball ${j + 1}` : `Line ${i + 1}`;
      const ball = parseBall(part);
      if (typeof ball === 'string') errors.push(`${where}: ${ball}`);
      else alternatives.push(ball);
    }
    lines.push({ alternatives });
  }
  if (errors.length > 0) return { ok: false, errors };
  if (lines.length === 0) return { ok: false, errors: ['There are no balls in this text.'] };
  return { ok: true, ...(name === undefined ? {} : { name }), lines };
}

/** The drill in the plain text format, with the name in a comment on the first line. */
export function printDrillText({ name, lines }: { name?: string; lines: DrillLine[] }): string {
  const header = name ? [`; ${name.replace(/\r?\n/g, ' ')}`] : [];
  const body = lines.map((line) =>
    line.alternatives.map((ball) => FIELDS.map((field) => ball[field]).join(' ')).join(' | '),
  );
  return [...header, ...body].join('\n') + '\n';
}

function parseBall(text: string): Ball | string {
  const tokens = text.split(/[\s,]+/).filter((token) => token !== '');
  if (tokens.length === 0) return 'A ball has no numbers. Check for an extra “|”.';
  const notNumber = tokens.find((token) => !Number.isFinite(Number(token)));
  if (notNumber !== undefined) return `“${notNumber}” isn’t a number.`;
  if (tokens.length !== FIELDS.length) {
    return `A ball needs ${FIELDS.length} numbers, not ${tokens.length}.`;
  }
  const ball = Object.fromEntries(FIELDS.map((field, i) => [field, Number(tokens[i])])) as Ball;
  const errors = validateBall(ball);
  const bad = FIELDS.find((field) => errors[field]);
  return bad ? `The ${FIELD_NAMES[bad]} is ${ball[bad]}. ${errors[bad]}` : ball;
}
