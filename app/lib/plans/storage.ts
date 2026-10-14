// Training plan repository: the built-in plans plus the custom plans saved in this browser.
// Async like ~/lib/drills/storage, so storage can move later without changing callers.
import type { Plan, PlanStage, PlanStep } from '~/lib/plans/types';

import presetData from './presets.json';

const PRESETS = presetData as Plan[];
const PRESET_IDS = new Set(PRESETS.map((plan) => plan.id));

const KEY = 'tt-rally-bot.plans';

/** A plan to save. Storage sets `source` and `updatedAt`, and makes an `id` when there is none. */
export type PlanDraft = Omit<Plan, 'id' | 'source' | 'updatedAt'> & { id?: string };

export const isPresetPlan = (id: string) => PRESET_IDS.has(id);

/** Custom plans, newest first, then the built-in plans in their file order. */
export async function listPlans(): Promise<Plan[]> {
  const custom = readCustom().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return [...custom, ...PRESETS.map(copy)];
}

export async function getPlan(id: string): Promise<Plan | null> {
  const plan = PRESETS.find((p) => p.id === id) ?? readCustom().find((p) => p.id === id);
  return plan ? copy(plan) : null;
}

/** Saves a custom plan and sets `updatedAt` to now. Built-in plans can't be changed: copy them first. */
export async function savePlan(draft: PlanDraft): Promise<Plan> {
  if (draft.id && isPresetPlan(draft.id)) {
    throw new Error('Built-in plans can’t be changed. Make a copy, then change the copy.');
  }
  const plan: Plan = {
    ...copy(draft),
    id: draft.id || crypto.randomUUID(),
    source: 'custom',
    updatedAt: new Date().toISOString(),
  };
  const stored = readCustom();
  const index = stored.findIndex((p) => p.id === plan.id);
  if (index === -1) stored.push(plan);
  else stored[index] = plan;
  writeCustom(stored);
  return copy(plan);
}

/** Deletes a custom plan. Does nothing if there is no plan with this id. Its drills stay. */
export async function deletePlan(id: string): Promise<void> {
  if (isPresetPlan(id)) throw new Error('Built-in plans can’t be deleted.');
  writeCustom(readCustom().filter((plan) => plan.id !== id));
}

/** Saves a copy of any plan, built-in or custom, as a new custom plan with a new `id`. */
export async function duplicatePlan(id: string): Promise<Plan> {
  const source = await getPlan(id);
  if (!source) throw new Error('This plan no longer exists.');
  return savePlan({ ...source, id: undefined, name: `${source.name} (copy)` });
}

// ---------- localStorage ----------

function readCustom(): Plan[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(stored)) return [];
    // Skip plans that no longer read, so one broken entry doesn't hide the rest.
    return stored.map(readPlan).filter((p): p is Plan => p !== null);
  } catch {
    return [];
  }
}

function writeCustom(plans: Plan[]) {
  localStorage.setItem(KEY, JSON.stringify(plans));
}

const copy = <T>(value: T): T => structuredClone(value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';

function readPlan(value: unknown): Plan | null {
  if (!isRecord(value)) return null;
  const { id, name, description, stages, updatedAt } = value;
  if (!isString(id) || !isString(name) || !Array.isArray(stages) || !isString(updatedAt)) {
    return null;
  }
  const readStages = stages.map(readStage);
  if (readStages.some((stage) => stage === null)) return null;
  return {
    id,
    name,
    description: isString(description) ? description : '',
    stages: readStages as PlanStage[],
    source: 'custom',
    updatedAt,
  };
}

function readStage(value: unknown): PlanStage | null {
  if (!isRecord(value) || !isString(value.name) || !Array.isArray(value.steps)) return null;
  const steps = value.steps.filter(
    (step): step is PlanStep => isRecord(step) && isString(step.drillId) && isString(step.note),
  );
  if (steps.length !== value.steps.length) return null;
  return {
    name: value.name,
    goal: isString(value.goal) ? value.goal : '',
    steps: steps.map(({ drillId, note }) => ({ drillId, note })),
  };
}
