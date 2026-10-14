import { ArrowLeft, ChevronRight, Copy, Pencil, Trash2 } from 'lucide-react';
import { useId } from 'react';
import { Link } from 'react-router';

import { DeleteButton } from '~/components/delete-button';
import { Badge } from '~/components/ui/badge';
import { Button, buttonVariants } from '~/components/ui/button';
import { durationText } from '~/lib/drills/describe';
import type { Drill } from '~/lib/drills/types';
import type { Plan, PlanStage, PlanStep } from '~/lib/plans/types';
import { usePlanCommand } from '~/features/plans/hooks/use-plan-command';
import { planSummary } from '~/features/plans/utils/describe-plan';

type PlanViewProps = {
  plan: Plan;
  /** Every drill, to show each step's drill. A step whose drill was deleted says so. */
  drills: Drill[];
};

/** One plan: its stages in order, each with its drills and what to work on. */
export function PlanView({ plan, drills }: PlanViewProps) {
  const { duplicate, remove, pending } = usePlanCommand();
  const byId = new Map(drills.map((drill) => [drill.id, drill]));
  const builtIn = plan.source === 'preset';

  return (
    <>
      <Link
        to="/plans"
        className="mb-3 inline-flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Plans
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-[720px]">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[26px]/[1.2] font-semibold tracking-[-0.02em] max-wide:text-[22px]">
              {plan.name}
            </h1>
            <Badge variant="outline">{builtIn ? 'Built-in' : 'My plan'}</Badge>
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">{planSummary(plan)}</p>
          {plan.description && <p className="mt-3 whitespace-pre-line">{plan.description}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {builtIn ? (
            <Button
              size="lg"
              className="px-3.5"
              disabled={pending}
              onClick={() => duplicate(plan.id)}
            >
              <Copy aria-hidden="true" />
              Copy and change
            </Button>
          ) : (
            <>
              <DeleteButton
                trigger={
                  <Button variant="outline" size="lg" className="px-3.5" disabled={pending} />
                }
                title={`Delete “${plan.name}”?`}
                description="This deletes the plan, not its drills. You can’t undo this."
                keepLabel="Keep plan"
                onDelete={() => remove(plan.id)}
              >
                <Trash2 aria-hidden="true" />
                Delete
              </DeleteButton>
              <Link
                to={`/plans/${plan.id}/edit`}
                className={buttonVariants({ size: 'lg', className: 'px-3.5' })}
              >
                <Pencil aria-hidden="true" />
                Edit
              </Link>
            </>
          )}
        </div>
      </div>

      {plan.stages.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
          This plan has no stages yet.
        </p>
      ) : (
        <ol className="grid gap-8">
          {plan.stages.map((stage, i) => (
            <StageSection key={i} stage={stage} number={i + 1} byId={byId} />
          ))}
        </ol>
      )}
    </>
  );
}

type StageSectionProps = { stage: PlanStage; number: number; byId: Map<string, Drill> };

function StageSection({ stage, number, byId }: StageSectionProps) {
  const id = useId();
  return (
    <li aria-labelledby={id}>
      <div className="mb-3">
        <div className="text-[13px] font-medium text-muted-foreground">Stage {number}</div>
        <h2 id={id} className="text-lg font-semibold">
          {stage.name}
        </h2>
        {stage.goal && <p className="text-muted-foreground">{stage.goal}</p>}
      </div>
      {stage.steps.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-muted-foreground">
          No drills in this stage yet.
        </p>
      ) : (
        <ol className="grid gap-2">
          {stage.steps.map((step, i) => (
            <StepRow key={i} step={step} drill={byId.get(step.drillId)} />
          ))}
        </ol>
      )}
    </li>
  );
}

type StepRowProps = { step: PlanStep; drill: Drill | undefined };

function StepRow({ step, drill }: StepRowProps) {
  if (!drill) {
    return (
      <li className="flex items-start gap-3 rounded-lg border border-dashed px-3.5 py-3 text-muted-foreground">
        <div>
          <div className="font-medium">This drill no longer exists</div>
          {step.note && <p className="text-[13.5px]">{step.note}</p>}
        </div>
      </li>
    );
  }
  const balls = drill.lines.length;
  return (
    <li className="relative flex items-start gap-3 rounded-lg border bg-card px-3.5 py-3 transition-[border-color] hover:border-ring has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/50">
      <div className="min-w-0 flex-1">
        {/* The link covers the whole row. */}
        <Link
          to={`/drills/${drill.id}`}
          className="font-semibold outline-none after:absolute after:inset-0"
        >
          {drill.name}
        </Link>
        {step.note && <p className="text-[13.5px]">{step.note}</p>}
        <div className="mt-0.5 text-[13px] text-muted-foreground">
          {balls} {balls === 1 ? 'ball' : 'balls'} · {durationText(drill.duration)}
        </div>
      </div>
      <ChevronRight
        aria-hidden="true"
        className="size-4 flex-none self-center text-muted-foreground"
      />
    </li>
  );
}
