import { Copy, Plus } from 'lucide-react';
import { Link } from 'react-router';

import { CardSection } from '~/components/card-section';
import { Button, buttonVariants } from '~/components/ui/button';
import type { Plan } from '~/lib/plans/types';
import { usePlanCommand } from '~/features/plans/hooks/use-plan-command';
import { planSummary } from '~/features/plans/utils/describe-plan';

const grid = 'grid-cols-[repeat(auto-fill,minmax(280px,1fr))] max-wide:grid-cols-[minmax(0,1fr)]';

/** The training plans: the person's own, then the built-in ones. */
export function PlanList({ plans }: { plans: Plan[] }) {
  const { duplicate, pending } = usePlanCommand();
  const mine = plans.filter((plan) => plan.source === 'custom');
  const builtIn = plans.filter((plan) => plan.source === 'preset');

  const cards = (list: Plan[]) =>
    list.map((plan) => (
      <PlanCard
        key={plan.id}
        plan={plan}
        onDuplicate={plan.source === 'preset' ? () => duplicate(plan.id) : undefined}
        duplicating={pending}
      />
    ));

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px]/[1.2] font-semibold tracking-[-0.02em] max-wide:text-[22px]">
            Training plans
          </h1>
          <p className="mt-1 text-muted-foreground">
            Work through drills in stages. Follow a built-in plan, or make your own from any drills.
          </p>
        </div>
        <Link
          to="/plans/new"
          aria-label="New plan"
          className={buttonVariants({ size: 'lg', className: 'px-3.5 max-wide:px-2.5' })}
        >
          <Plus aria-hidden="true" />
          <span className="max-wide:hidden">New plan</span>
        </Link>
      </div>

      <div className="grid gap-8">
        <CardSection
          title="My plans"
          gridClassName={grid}
          count={mine.length}
          empty="You have no plans of your own yet. Make one with New plan, or copy a built-in plan."
        >
          {cards(mine)}
        </CardSection>
        <CardSection
          title="Built-in plans"
          gridClassName={grid}
          count={builtIn.length}
          empty="There are no built-in plans."
        >
          {cards(builtIn)}
        </CardSection>
      </div>
    </>
  );
}

type PlanCardProps = {
  plan: Plan;
  /** Shown on built-in plans: saves a copy in My plans and opens it in the editor. */
  onDuplicate?: () => void;
  duplicating?: boolean;
};

function PlanCard({ plan, onDuplicate, duplicating }: PlanCardProps) {
  return (
    <div className="relative flex flex-col gap-1 rounded-xl border bg-card px-4 pt-3.5 pb-4 transition-[border-color,box-shadow] hover:border-ring hover:shadow-md has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/50">
      {/* The link covers the whole card. */}
      <Link
        to={`/plans/${plan.id}`}
        className="pr-9 text-[15px] font-semibold outline-none after:absolute after:inset-0"
      >
        {plan.name}
      </Link>
      <div className="text-[13px] text-muted-foreground">{planSummary(plan)}</div>
      {plan.description && <p className="mt-1.5 line-clamp-3 text-[13.5px]">{plan.description}</p>}
      {onDuplicate && (
        <Button
          variant="outline"
          size="icon-sm"
          className="absolute top-2.5 right-2.5"
          aria-label={`Make a copy of ${plan.name} to change`}
          title="Make a copy to change"
          disabled={duplicating}
          onClick={onDuplicate}
        >
          <Copy aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
