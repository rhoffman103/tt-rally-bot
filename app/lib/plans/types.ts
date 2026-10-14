/** One drill in a stage, with what to work on and how to know it's done. */
export type PlanStep = { drillId: string; note: string };
export type PlanStage = { name: string; goal: string; steps: PlanStep[] };
/** A training plan: stages of existing drills, played in order. */
export type Plan = {
  id: string;
  name: string;
  description: string;
  stages: PlanStage[];
  source: 'preset' | 'custom';
  updatedAt: string; // ISO time, set by storage.savePlan()
};
