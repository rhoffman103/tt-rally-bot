import { data, redirect } from 'react-router';

import type { Route } from './+types/plan-editor';
import { listDrills } from '~/lib/drills/storage';
import { getPlan, savePlan } from '~/lib/plans/storage';
import { PlanEditor } from '~/features/plans/components/plan-editor';
import type { PlanAction, SavePlanResult } from '~/features/plans/types/plan-action';

// Serves two route ids: plan-new (/plans/new) and plan-edit (/plans/:id/edit).
export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  const name = loaderData?.plan?.name;
  return [{ title: name ? `Edit ${name} · TT Rally Bot` : 'New plan · TT Rally Bot' }];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const id = 'id' in params ? params.id : undefined;
  const plan = id ? await getPlan(id) : null;
  if (id && !plan) throw data('This plan doesn’t exist.', { status: 404 });
  // Built-in plans can't be changed. Their page offers "Copy and change" instead.
  if (plan?.source === 'preset') throw redirect(`/plans/${plan.id}`);
  return { plan, drills: await listDrills() };
}

export async function clientAction({ request }: Route.ClientActionArgs): Promise<SavePlanResult> {
  const action = (await request.json()) as PlanAction;
  if (action.intent !== 'save') return { ok: false, error: 'The editor can only save plans.' };
  try {
    const plan = await savePlan(action.plan);
    return { ok: true, plan, created: !action.plan.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export default function PlanEditorRoute({ loaderData }: Route.ComponentProps) {
  const { plan, drills } = loaderData;
  return <PlanEditor key={plan?.id ?? 'new'} plan={plan} drills={drills} />;
}
