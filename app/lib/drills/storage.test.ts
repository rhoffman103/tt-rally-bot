import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import presetFile from '~/lib/drills/presets.json';
import zeroToHero from '~/lib/drills/zero-to-hero.json';
import {
  copyName,
  deleteDrill,
  drillsToJson,
  duplicateDrill,
  exportDrills,
  getDrill,
  importDrillCopy,
  importDrillFile,
  importDrills,
  importDrillsJson,
  isPreset,
  listDrills,
  listFavorites,
  readDrillFile,
  saveDrill,
  setFavorite,
} from '~/lib/drills/storage';
import type { Drill } from '~/lib/drills/types';
import { validateBall } from '~/lib/robot/protocol';
import { testBall, testDrill } from '~/testing/drills';
import { stubLocalStorage } from '~/testing/memory-storage';

let storage: Storage;
beforeEach(() => {
  storage = stubLocalStorage();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-09T12:00:00.000Z'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const presets = [...presetFile, ...zeroToHero];
const PRESET_ID = presets[0].id;

describe('presets', () => {
  it('are listed after the custom drills: the preset file, then the Zero to hero drills', async () => {
    await saveDrill(testDrill([testBall()], { id: 'mine' }));
    const ids = (await listDrills()).map((d) => d.id);
    expect(ids).toEqual(['mine', ...presets.map((p) => p.id)]);
  });

  it('are valid drills with balls the robot accepts', async () => {
    for (const preset of await listDrills()) {
      expect(preset.source).toBe('preset');
      expect(preset.lines.length).toBeGreaterThan(0);
      for (const ball of preset.lines.flatMap((line) => line.alternatives)) {
        expect(validateBall(ball)).toEqual({});
      }
    }
  });

  it('end before the robot runs out of its about 130 balls', async () => {
    // Balls a minute as docs/zero-to-hero.md assumes: 30 at frequency 0, 90 at 100.
    const ballsAMinute = (frequency: number) => 30 + 0.6 * frequency;
    for (const preset of await listDrills()) {
      const balls = preset.lines.flatMap((line) => line.alternatives);
      const { duration } = preset;
      expect(duration.kind, preset.id).not.toBe('endless');
      const fired =
        duration.kind === 'minutes'
          ? duration.value * ballsAMinute(Math.max(...balls.map((ball) => ball.frequency)))
          : duration.kind === 'combos'
            ? duration.value *
              preset.lines.reduce((sum, l) => sum + l.alternatives[0].repetitions, 0)
            : Infinity;
      expect(fired, preset.id).toBeLessThanOrEqual(130);
    }
  });

  it('can’t be deleted', async () => {
    await expect(deleteDrill(PRESET_ID)).rejects.toThrow('can’t be deleted');
    expect(await getDrill(PRESET_ID)).not.toBeNull();
  });

  it('can’t be changed', async () => {
    const preset = (await getDrill(PRESET_ID))!;
    await expect(saveDrill({ ...preset, name: 'Changed' })).rejects.toThrow('can’t be changed');
    expect((await getDrill(PRESET_ID))!.name).toBe(preset.name);
  });

  it('come back as copies, so changing one changes nothing stored', async () => {
    const preset = (await getDrill(PRESET_ID))!;
    preset.lines[0].alternatives[0].height = 99;
    expect((await getDrill(PRESET_ID))!.lines[0].alternatives[0].height).not.toBe(99);
  });
});

describe('saveDrill', () => {
  it('sets updatedAt to now and source to custom', async () => {
    const saved = await saveDrill(
      testDrill([testBall()], { updatedAt: '2020-01-01T00:00:00.000Z' }),
    );
    expect(saved.updatedAt).toBe('2026-10-09T12:00:00.000Z');
    expect(saved.source).toBe('custom');
    expect(await getDrill(saved.id)).toEqual(saved);
  });

  it('makes an id for a new drill', async () => {
    const saved = await saveDrill({ ...testDrill([testBall()]), id: undefined });
    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('updates a drill with the same id in place', async () => {
    await saveDrill(testDrill([testBall()], { id: 'a', name: 'A' }));
    await saveDrill(testDrill([testBall()], { id: 'b', name: 'B' }));
    vi.setSystemTime(new Date('2026-10-10T08:00:00.000Z'));
    await saveDrill(testDrill([testBall()], { id: 'a', name: 'A2' }));
    const custom = (await listDrills()).filter((d) => d.source === 'custom');
    expect(custom.map((d) => [d.id, d.name])).toEqual([
      ['a', 'A2'], // newest first
      ['b', 'B'],
    ]);
  });
});

describe('deleteDrill', () => {
  it('deletes a custom drill', async () => {
    const saved = await saveDrill(testDrill([testBall()]));
    await deleteDrill(saved.id);
    expect(await getDrill(saved.id)).toBeNull();
  });

  it('does nothing for an unknown id', async () => {
    await expect(deleteDrill('nope')).resolves.toBeUndefined();
  });
});

describe('favorites', () => {
  it('are empty at first', async () => {
    expect(await listFavorites()).toEqual([]);
  });

  it('can be presets or custom drills, in the order they were starred', async () => {
    const saved = await saveDrill(testDrill([testBall()]));
    await setFavorite(saved.id, true);
    await setFavorite(PRESET_ID, true);
    expect(await listFavorites()).toEqual([saved.id, PRESET_ID]);
  });

  it('keep one star when a drill is starred twice', async () => {
    await setFavorite(PRESET_ID, true);
    await setFavorite(PRESET_ID, true);
    expect(await listFavorites()).toEqual([PRESET_ID]);
  });

  it('can be removed', async () => {
    await setFavorite(PRESET_ID, true);
    await setFavorite(PRESET_ID, false);
    expect(await listFavorites()).toEqual([]);
  });

  it('lose a drill when it is deleted', async () => {
    const saved = await saveDrill(testDrill([testBall()]));
    await setFavorite(saved.id, true);
    await deleteDrill(saved.id);
    expect(await listFavorites()).toEqual([]);
  });

  it('read as empty when the stored value is broken', async () => {
    storage.setItem('tt-rally-bot.favorites', '{not json');
    expect(await listFavorites()).toEqual([]);
  });
});

describe('duplicateDrill', () => {
  it('turns a preset into a custom drill with a new id', async () => {
    const preset = (await getDrill(PRESET_ID))!;
    const copy = await duplicateDrill(PRESET_ID);
    expect(copy.id).not.toBe(PRESET_ID);
    expect(isPreset(copy.id)).toBe(false);
    expect(copy).toMatchObject({
      name: `${preset.name} (copy)`,
      source: 'custom',
      lines: preset.lines,
      duration: preset.duration,
      updatedAt: '2026-10-09T12:00:00.000Z',
    });
    expect(await getDrill(copy.id)).toEqual(copy);
  });

  it('fails for an unknown id', async () => {
    await expect(duplicateDrill('nope')).rejects.toThrow('no longer exists');
  });
});

describe('importDrills', () => {
  const shared = testDrill([testBall()], {
    id: 'shared-1',
    name: 'Shared',
    updatedAt: '2026-10-08T09:00:00.000Z',
  });

  it('keeps the id and updatedAt', async () => {
    const [imported] = await importDrills([shared]);
    expect(imported).toEqual(shared);
    expect(await getDrill('shared-1')).toEqual(shared);
  });

  it('updates the drill when it is imported again', async () => {
    await importDrills([shared]);
    await importDrills([{ ...shared, name: 'Shared, changed' }]);
    const custom = (await listDrills()).filter((d) => d.source === 'custom');
    expect(custom).toHaveLength(1);
    expect(custom[0].name).toBe('Shared, changed');
  });

  it('gives a drill with a preset’s id a new id', async () => {
    const preset = (await getDrill(PRESET_ID))!;
    const [imported] = await importDrills([preset]);
    expect(imported.id).not.toBe(PRESET_ID);
    expect(imported.source).toBe('custom');
    expect((await getDrill(PRESET_ID))!.source).toBe('preset');
  });
});

describe('importDrillCopy', () => {
  it('saves a copy with a new id next to the drill with the same id', async () => {
    const shared = testDrill([testBall()], { id: 'shared', name: 'Serve' });
    await importDrills([shared]);
    const copy = await importDrillCopy(shared);
    expect(copy).toMatchObject({ name: 'Serve (2)', lines: shared.lines, source: 'custom' });
    expect(copy.id).not.toBe('shared');
    expect(copy.updatedAt).toBe('2026-10-09T12:00:00.000Z');
    expect((await getDrill('shared'))?.name).toBe('Serve');
  });

  it('picks the first free number', async () => {
    const shared = testDrill([testBall()], { id: 'shared', name: 'Serve' });
    await importDrillCopy(shared);
    await saveDrill(testDrill([testBall()], { id: 'other', name: 'Serve (3)' }));
    expect(await copyName('Serve')).toBe('Serve (4)');
    expect((await importDrillCopy(shared)).name).toBe('Serve (4)');
  });
});

describe('JSON export and import', () => {
  it('round trips every custom drill', async () => {
    const a = await saveDrill(testDrill([testBall(), [testBall(), testBall({ dropPoint: 5 })]]));
    const b = await saveDrill(
      testDrill([testBall({ height: 13.333 })], {
        id: 'b',
        duration: { kind: 'combos', value: 20 },
        pauseBetweenSetsSec: 3,
        randomOrder: true,
      }),
    );
    const json = await exportDrills();
    storage.clear();
    const result = await importDrillsJson(json);
    expect(result).toEqual({ ok: true, drills: [a, b] });
  });

  it('exports the chosen drills, presets too', async () => {
    const json = JSON.parse(await exportDrills([PRESET_ID, 'missing']));
    expect(json.format).toBe('tt-rally-bot-drills');
    expect(json.drills.map((d: Drill) => d.id)).toEqual([PRESET_ID]);
  });

  it('imports one drill or a list of drills', async () => {
    const drill = testDrill([testBall()], { id: 'one' });
    expect(await importDrillsJson(JSON.stringify(drill))).toMatchObject({ ok: true });
    expect(await importDrillsJson(JSON.stringify([{ ...drill, id: 'two' }]))).toMatchObject({
      ok: true,
    });
    expect((await listDrills()).filter((d) => d.source === 'custom')).toHaveLength(2);
  });

  it('imports minutes in steps of 30 seconds', async () => {
    const drill = testDrill([testBall()], { duration: { kind: 'minutes', value: 1.5 } });
    expect(await importDrillsJson(JSON.stringify(drill))).toMatchObject({ ok: true });
    expect((await getDrill(drill.id))!.duration).toEqual({ kind: 'minutes', value: 1.5 });
  });

  it('explains what is wrong with a bad file and saves nothing', async () => {
    const bad = (value: unknown) => importDrillsJson(JSON.stringify(value));
    expect(await importDrillsJson('{oops')).toEqual({
      ok: false,
      error: 'This file isn’t a TT Rally Bot drill file. It isn’t valid JSON.',
    });
    expect(await bad([])).toEqual({ ok: false, error: 'This file has no drills in it.' });
    expect(await bad({ ...testDrill([]), name: 'Empty' })).toEqual({
      ok: false,
      error: '“Empty” has no balls.',
    });
    expect(
      await bad([testDrill([testBall()]), testDrill([testBall(), testBall({ upperRpm: 9000 })])]),
    ).toEqual({
      ok: false,
      error:
        'Drill 2: “Test drill”, ball 2: The upper wheel speed must be a number from 400 to 7500.',
    });
    expect(await bad({ ...testDrill([testBall()]), duration: { kind: 'forever' } })).toMatchObject({
      ok: false,
    });
    for (const duration of [
      { kind: 'minutes', value: 1.25 },
      { kind: 'minutes', value: 0 },
      { kind: 'minutes', value: '1.5' },
      { kind: 'combos', value: 1.5 },
    ]) {
      expect(await bad({ ...testDrill([testBall()]), duration })).toMatchObject({ ok: false });
    }
    expect(storage.getItem('tt-rally-bot.drills')).toBeNull();
  });

  it('skips stored drills that no longer read', async () => {
    storage.setItem(
      'tt-rally-bot.drills',
      JSON.stringify([testDrill([testBall()], { id: 'good' }), { id: 'broken' }]),
    );
    const custom = (await listDrills()).filter((d) => d.source === 'custom');
    expect(custom.map((d) => d.id)).toEqual(['good']);
  });
});

describe('importDrillFile', () => {
  it('reads JSON files', async () => {
    const json = JSON.stringify({ drills: [testDrill([testBall()], { id: 'a' })] });
    const result = await importDrillFile('backup.txt', json);
    expect(result.ok && result.drills.map((d) => d.id)).toEqual(['a']);
    expect((await importDrillFile('backup.json', 'oops')).ok).toBe(false);
  });

  it('reads a drill in the plain text format, named by its comment or the file', async () => {
    const named = await importDrillFile('x.txt', '; Serve practice\n3000 2000 20 0 50 1\n');
    expect(named.ok && named.drills[0]).toMatchObject({
      name: 'Serve practice',
      source: 'custom',
      randomOrder: false,
      duration: { kind: 'endless' },
      lines: [{ alternatives: [testBall()] }],
    });
    const unnamed = await importDrillFile('Long rally.txt', '3000 2000 20 0 50 1');
    expect(unnamed.ok && unnamed.drills[0].name).toBe('Long rally');
    expect(await listDrills()).toHaveLength(2 + presets.length);
  });

  it('explains what is wrong with a bad text file', async () => {
    const result = await importDrillFile('x.txt', 'hello\nworld');
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(
        /^This file isn’t a TT Rally Bot drill file\. Line 1: .+ \(and 1 more\)$/,
      ),
    });
  });
});

describe('readDrillFile', () => {
  it('reads JSON and text files without saving them', () => {
    const drill = testDrill([testBall()], { id: 'a' });
    expect(readDrillFile('a.json', drillsToJson([drill]))).toEqual({ ok: true, drills: [drill] });
    expect(readDrillFile('Serve.txt', '3000 2000 20 0 50 1')).toEqual({
      ok: true,
      drills: [
        {
          name: 'Serve',
          lines: [{ alternatives: [testBall()] }],
          randomOrder: false,
          duration: { kind: 'endless' },
        },
      ],
    });
    expect(readDrillFile('x.txt', 'hello').ok).toBe(false);
    expect(storage.getItem('tt-rally-bot.drills')).toBeNull();
  });
});
