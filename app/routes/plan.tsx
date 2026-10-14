import { data, redirect } from 'react-router';

import type { Route } from './+types/plan';
import { listDrills } from '~/lib/drills/storage';
import { deletePlan, duplicatePlan, getPlan } from '~/lib/plans/storage';
import { PlanView } from '~/features/plans/components/plan-view';
import type { PlanAction, PlanCommandResult } from '~/features/plans/types/plan-action';

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  return [{ title: `${loaderData?.plan.name ?? 'Plan'} · TT Rally Bot` }];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const plan = await getPlan(params.id);
  if (!plan) throw data('This plan doesn’t exist.', { status: 404 });
  return { plan, drills: await listDrills() };
}

/** "Copy and change" opens the copy in the editor. Delete goes back to the plan list. */
export async function clientAction({ request }: Route.ClientActionArgs) {
  const action = (await request.json()) as PlanAction;
  try {
    if (action.intent === 'duplicate') {
      const copy = await duplicatePlan(action.planId);
      return redirect(`/plans/${copy.id}/edit`);
    }
    if (action.intent === 'delete') {
      await deletePlan(action.planId);
      return redirect('/plans');
    }
    return null;
  } catch (error) {
    const result: PlanCommandResult = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    return result;
  }
}

export default function PlanRoute({ loaderData }: Route.ComponentProps) {
  return <PlanView plan={loaderData.plan} drills={loaderData.drills} />;
}
