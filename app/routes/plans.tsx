import { redirect } from 'react-router';

import type { Route } from './+types/plans';
import { duplicatePlan, listPlans } from '~/lib/plans/storage';
import { PlanList } from '~/features/plans/components/plan-list';
import type { PlanAction, PlanCommandResult } from '~/features/plans/types/plan-action';

export function meta(): Route.MetaDescriptors {
  return [{ title: 'Training plans · TT Rally Bot' }];
}

export async function clientLoader() {
  return { plans: await listPlans() };
}

/** "Make a copy" on a built-in plan: saves a copy, then opens it in the editor. */
export async function clientAction({ request }: Route.ClientActionArgs) {
  const action = (await request.json()) as PlanAction;
  if (action.intent !== 'duplicate') return null;
  try {
    const copy = await duplicatePlan(action.planId);
    return redirect(`/plans/${copy.id}/edit`);
  } catch (error) {
    const result: PlanCommandResult = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    return result;
  }
}

export default function Plans({ loaderData }: Route.ComponentProps) {
  return <PlanList plans={loaderData.plans} />;
}
