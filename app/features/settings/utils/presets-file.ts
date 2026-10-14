import type { Drill } from '~/lib/drills/types';

type NamedDrill = Pick<Drill, 'name' | 'lines' | 'randomOrder' | 'duration'>;

/** Presets don't change in the browser, so their `updatedAt` only has to be a valid time. */
const PRESET_TIME = '2026-01-01T00:00:00.000Z';

/** "Push, then loop!" → "push-then-loop". */
export function presetId(name: string): string {
  return (
    name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'preset'
  );
}

/**
 * The text of `app/lib/drills/presets.json` for these drills. Two drills with the same name get ids ending in
 * -2, -3 and so on, because preset ids must be unique.
 */
export function presetsJson(drills: NamedDrill[]): string {
  const used = new Set<string>();
  const presets = drills.map(({ name, lines, randomOrder, duration }): Drill => {
    const base = presetId(name);
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    return { id, name, lines, randomOrder, duration, source: 'preset', updatedAt: PRESET_TIME };
  });
  return JSON.stringify(presets, null, 2) + '\n';
}
