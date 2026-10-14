import { describe, expect, it } from 'vitest';

import type { PlanDraft } from '~/lib/plans/storage';
import { canMoveStep, cleanDraft, planReducer, toDraft } from '~/features/plans/utils/plan-draft';

const draft = (): PlanDraft => ({
  name: 'Plan',
  description: '',
  stages: [
    {
      name: 'A',
      goal: '',
      steps: [
        { drillId: 'a1', note: '' },
        { drillId: 'a2', note: '' },
      ],
    },
    { name: 'B', goal: '', steps: [{ drillId: 'b1', note: '' }] },
  ],
});

const ids = (d: PlanDraft) => d.stages.map((s) => s.steps.map((step) => step.drillId));

describe('toDraft', () => {
  it('starts a new plan with one empty stage', () => {
    expect(toDraft(null)).toEqual({
      name: '',
      description: '',
      stages: [{ name: 'Stage 1', goal: '', steps: [] }],
    });
  });
});

describe('planReducer', () => {
  it('adds stages named after their place', () => {
    const next = planReducer(draft(), { type: 'add-stage' });
    expect(next.stages[2]).toEqual({ name: 'Stage 3', goal: '', steps: [] });
  });

  it('adds drills to the end of a stage, with empty notes', () => {
    const next = planReducer(draft(), { type: 'add-steps', stage: 1, drillIds: ['x', 'y'] });
    expect(ids(next)).toEqual([
      ['a1', 'a2'],
      ['b1', 'x', 'y'],
    ]);
  });

  it('moves a step inside its stage', () => {
    const next = planReducer(draft(), { type: 'move-step', stage: 0, step: 0, direction: 1 });
    expect(ids(next)).toEqual([['a2', 'a1'], ['b1']]);
  });

  it('moves a step past the end of its stage into the next stage, and back', () => {
    const down = planReducer(draft(), { type: 'move-step', stage: 0, step: 1, direction: 1 });
    expect(ids(down)).toEqual([['a1'], ['a2', 'b1']]);
    const up = planReducer(down, { type: 'move-step', stage: 1, step: 0, direction: -1 });
    expect(ids(up)).toEqual([['a1', 'a2'], ['b1']]);
  });

  it('can’t move the first step up or the last step down', () => {
    expect(canMoveStep(draft(), 0, 0, -1)).toBe(false);
    expect(canMoveStep(draft(), 1, 0, 1)).toBe(false);
    expect(canMoveStep(draft(), 0, 1, 1)).toBe(true);
    const same = planReducer(draft(), { type: 'move-step', stage: 0, step: 0, direction: -1 });
    expect(ids(same)).toEqual(ids(draft()));
  });

  it('moves and removes stages', () => {
    const moved = planReducer(draft(), { type: 'move-stage', stage: 1, direction: -1 });
    expect(moved.stages.map((s) => s.name)).toEqual(['B', 'A']);
    const removed = planReducer(draft(), { type: 'remove-stage', stage: 0 });
    expect(removed.stages.map((s) => s.name)).toEqual(['B']);
  });

  it('changes notes and removes steps', () => {
    const noted = planReducer(draft(), { type: 'set-note', stage: 0, step: 1, note: 'Go' });
    expect(noted.stages[0].steps[1].note).toBe('Go');
    const removed = planReducer(noted, { type: 'remove-step', stage: 0, step: 0 });
    expect(removed.stages[0].steps).toEqual([{ drillId: 'a2', note: 'Go' }]);
  });
});

describe('cleanDraft', () => {
  it('gives blank names a default', () => {
    const blank = { ...draft(), name: '  ' };
    blank.stages[1].name = '';
    const clean = cleanDraft(blank);
    expect(clean.name).toBe('Untitled plan');
    expect(clean.stages.map((s) => s.name)).toEqual(['A', 'Stage 2']);
  });
});
