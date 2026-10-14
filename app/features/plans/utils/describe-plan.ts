import type { Plan } from '~/lib/plans/types';

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "6 stages · 25 drills". */
export function planSummary(plan: Pick<Plan, 'stages'>): string {
  const drills = plan.stages.reduce((sum, stage) => sum + stage.steps.length, 0);
  return `${count(plan.stages.length, 'stage', 'stages')} · ${count(drills, 'drill', 'drills')}`;
}
