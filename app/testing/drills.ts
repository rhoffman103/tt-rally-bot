// Test drills. Placeholder values, not real presets.
import type { Ball, Drill, DrillLine } from '~/lib/drills/types';

export function testBall(overrides: Partial<Ball> = {}): Ball {
  return {
    upperRpm: 3000,
    lowerRpm: 2000,
    height: 20,
    dropPoint: 0,
    frequency: 50,
    repetitions: 1,
    ...overrides,
  };
}

/** One line per ball. Pass an array for a "one of these at random" line. */
export function testDrill(lines: (Ball | Ball[])[], overrides: Partial<Drill> = {}): Drill {
  return {
    id: 'test-drill',
    name: 'Test drill',
    lines: lines.map((line): DrillLine => ({ alternatives: Array.isArray(line) ? line : [line] })),
    randomOrder: false,
    duration: { kind: 'endless' },
    source: 'custom',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}
