import { describe, expect, it } from 'vitest';

import type { Drill } from '~/lib/drills/types';
import { presetId, presetsJson } from '~/features/settings/utils/presets-file';

describe('presetId', () => {
  it('makes a kebab-case id from the name', () => {
    expect(presetId('Push, then loop!')).toBe('push-then-loop');
    expect(presetId('Défense 2')).toBe('defense-2');
    expect(presetId('???')).toBe('preset');
  });
});

describe('presetsJson', () => {
  const drill = (name: string) => ({
    name,
    lines: [
      {
        alternatives: [
          {
            upperRpm: 4000,
            lowerRpm: 2500,
            height: 20,
            dropPoint: 0,
            frequency: 50,
            repetitions: 1,
          },
        ],
      },
    ],
    randomOrder: false,
    duration: { kind: 'endless' } as const,
  });

  it('writes presets with unique ids', () => {
    const presets = JSON.parse(presetsJson([drill('Falkenberg'), drill('Falkenberg')])) as Drill[];
    expect(presets.map((p) => p.id)).toEqual(['falkenberg', 'falkenberg-2']);
    expect(presets[0]).toMatchObject({ source: 'preset', name: 'Falkenberg', randomOrder: false });
    expect(Number.isNaN(Date.parse(presets[0].updatedAt))).toBe(false);
  });
});
