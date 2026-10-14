// The plan editor's state: the plan being edited, and the changes the editor can make to it.
import type { PlanDraft } from '~/lib/plans/storage';
import type { Plan, PlanStage } from '~/lib/plans/types';

type Direction = -1 | 1;

export type PlanEdit =
  | { type: 'set'; field: 'name' | 'description'; value: string }
  | { type: 'add-stage' }
  | { type: 'set-stage'; stage: number; field: 'name' | 'goal'; value: string }
  | { type: 'move-stage'; stage: number; direction: Direction }
  | { type: 'remove-stage'; stage: number }
  | { type: 'add-steps'; stage: number; drillIds: string[] }
  | { type: 'set-note'; stage: number; step: number; note: string }
  | { type: 'move-step'; stage: number; step: number; direction: Direction }
  | { type: 'remove-step'; stage: number; step: number };

const newStage = (index: number): PlanStage => ({
  name: `Stage ${index + 1}`,
  goal: '',
  steps: [],
});

/** The draft to start the editor with: the plan's fields, or an empty plan with one stage. */
export function toDraft(plan: Plan | null): PlanDraft {
  if (!plan) return { name: '', description: '', stages: [newStage(0)] };
  const { id, name, description, stages } = plan;
  return structuredClone({ id, name, description, stages });
}

export const sameDraft = (a: PlanDraft, b: PlanDraft) => JSON.stringify(a) === JSON.stringify(b);

/** The draft as it is saved: blank names get a default. */
export function cleanDraft(draft: PlanDraft): PlanDraft {
  return {
    ...draft,
    name: draft.name.trim() || 'Untitled plan',
    stages: draft.stages.map((stage, i) => ({
      ...stage,
      name: stage.name.trim() || `Stage ${i + 1}`,
    })),
  };
}

function swap<T>(list: T[], index: number, direction: Direction): T[] {
  const to = index + direction;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

const replaceAt = <T>(list: T[], index: number, item: T) =>
  list.map((old, i) => (i === index ? item : old));

/** Whether a step can move: past the start or end of its stage, it moves into the stage next to it. */
export function canMoveStep(draft: PlanDraft, stage: number, step: number, direction: Direction) {
  const steps = draft.stages[stage].steps;
  const inStage = step + direction >= 0 && step + direction < steps.length;
  return inStage || (stage + direction >= 0 && stage + direction < draft.stages.length);
}

export function planReducer(draft: PlanDraft, edit: PlanEdit): PlanDraft {
  const stages = draft.stages;
  switch (edit.type) {
    case 'set':
      return { ...draft, [edit.field]: edit.value };
    case 'add-stage':
      return { ...draft, stages: [...stages, newStage(stages.length)] };
    case 'set-stage':
      return {
        ...draft,
        stages: replaceAt(stages, edit.stage, { ...stages[edit.stage], [edit.field]: edit.value }),
      };
    case 'move-stage':
      return { ...draft, stages: swap(stages, edit.stage, edit.direction) };
    case 'remove-stage':
      return { ...draft, stages: stages.filter((_, i) => i !== edit.stage) };
    case 'add-steps': {
      const stage = stages[edit.stage];
      const added = edit.drillIds.map((drillId) => ({ drillId, note: '' }));
      return {
        ...draft,
        stages: replaceAt(stages, edit.stage, { ...stage, steps: [...stage.steps, ...added] }),
      };
    }
    case 'set-note': {
      const stage = stages[edit.stage];
      const step = { ...stage.steps[edit.step], note: edit.note };
      return {
        ...draft,
        stages: replaceAt(stages, edit.stage, {
          ...stage,
          steps: replaceAt(stage.steps, edit.step, step),
        }),
      };
    }
    case 'move-step':
      return { ...draft, stages: moveStep(stages, edit.stage, edit.step, edit.direction) };
    case 'remove-step': {
      const stage = stages[edit.stage];
      const steps = stage.steps.filter((_, i) => i !== edit.step);
      return { ...draft, stages: replaceAt(stages, edit.stage, { ...stage, steps }) };
    }
  }
}

function moveStep(stages: PlanStage[], stage: number, step: number, direction: Direction) {
  const steps = stages[stage].steps;
  const to = step + direction;
  if (to >= 0 && to < steps.length) {
    return replaceAt(stages, stage, { ...stages[stage], steps: swap(steps, step, direction) });
  }
  const other = stage + direction;
  if (other < 0 || other >= stages.length) return stages;
  // Into the next stage as its first step, or into the previous stage as its last step.
  const moved = steps[step];
  const target = stages[other];
  const targetSteps = direction === 1 ? [moved, ...target.steps] : [...target.steps, moved];
  return stages.map((s, i) => {
    if (i === stage) return { ...s, steps: steps.filter((_, j) => j !== step) };
    if (i === other) return { ...s, steps: targetSteps };
    return s;
  });
}
