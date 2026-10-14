import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getDrill } from '~/lib/drills/storage';
import presets from '~/lib/plans/presets.json';
import {
  deletePlan,
  duplicatePlan,
  getPlan,
  isPresetPlan,
  listPlans,
  savePlan,
  type PlanDraft,
} from '~/lib/plans/storage';
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

const PRESET_ID = presets[0].id;

const draft = (overrides: Partial<PlanDraft> = {}): PlanDraft => ({
  name: 'My plan',
  description: '',
  stages: [{ name: 'Stage 1', goal: '', steps: [{ drillId: 'zero-to-hero-1-1', note: 'Go' }] }],
  ...overrides,
});

describe('built-in plans', () => {
  it('only use drills that exist', async () => {
    for (const plan of await listPlans()) {
      for (const step of plan.stages.flatMap((stage) => stage.steps)) {
        expect(await getDrill(step.drillId), step.drillId).not.toBeNull();
      }
    }
  });

  it('are listed after the custom plans', async () => {
    const mine = await savePlan(draft());
    expect((await listPlans()).map((p) => p.id)).toEqual([mine.id, ...presets.map((p) => p.id)]);
  });

  it('can’t be changed or deleted', async () => {
    expect(isPresetPlan(PRESET_ID)).toBe(true);
    await expect(savePlan(draft({ id: PRESET_ID }))).rejects.toThrow('can’t be changed');
    await expect(deletePlan(PRESET_ID)).rejects.toThrow('can’t be deleted');
    expect(await getPlan(PRESET_ID)).not.toBeNull();
  });
});

describe('custom plans', () => {
  it('are saved with a new id, and updated in place when saved again', async () => {
    const saved = await savePlan(draft());
    expect(saved).toMatchObject({ name: 'My plan', source: 'custom' });
    expect(saved.updatedAt).toBe('2026-10-09T12:00:00.000Z');

    await savePlan({ ...saved, name: 'Renamed' });
    const plans = await listPlans();
    expect(plans.filter((p) => p.source === 'custom').map((p) => p.name)).toEqual(['Renamed']);
  });

  it('are listed newest first', async () => {
    const older = await savePlan(draft({ name: 'Older' }));
    vi.setSystemTime(new Date('2026-10-10T12:00:00.000Z'));
    const newer = await savePlan(draft({ name: 'Newer' }));
    const ids = (await listPlans()).filter((p) => p.source === 'custom').map((p) => p.id);
    expect(ids).toEqual([newer.id, older.id]);
  });

  it('can be deleted', async () => {
    const saved = await savePlan(draft());
    await deletePlan(saved.id);
    expect(await getPlan(saved.id)).toBeNull();
  });

  it('are copied with a new id and name, built-in plans too', async () => {
    const copy = await duplicatePlan(PRESET_ID);
    expect(copy.id).not.toBe(PRESET_ID);
    expect(copy).toMatchObject({ name: 'Zero to hero (copy)', source: 'custom' });
    expect(copy.stages).toEqual((await getPlan(PRESET_ID))?.stages);
  });

  it('skip a broken entry and keep the rest', async () => {
    const saved = await savePlan(draft());
    const stored: unknown[] = JSON.parse(storage.getItem('tt-rally-bot.plans') ?? '[]');
    storage.setItem('tt-rally-bot.plans', JSON.stringify([{ id: 'broken' }, ...stored]));
    expect((await listPlans()).filter((p) => p.source === 'custom').map((p) => p.id)).toEqual([
      saved.id,
    ]);
  });
});
