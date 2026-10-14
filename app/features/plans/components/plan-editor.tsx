import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useId, useReducer, type Dispatch } from 'react';
import { Link } from 'react-router';

import { LeaveDialog } from '~/components/leave-dialog';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import type { Drill } from '~/lib/drills/types';
import type { PlanDraft } from '~/lib/plans/storage';
import type { Plan } from '~/lib/plans/types';
import { useUnsavedWarning } from '~/hooks/use-unsaved-warning';
import { DrillPicker } from '~/features/plans/components/drill-picker';
import { useSavePlan } from '~/features/plans/hooks/use-save-plan';
import {
  canMoveStep,
  cleanDraft,
  planReducer,
  sameDraft,
  toDraft,
  type PlanEdit,
} from '~/features/plans/utils/plan-draft';

type PlanEditorProps = {
  /** The plan to edit. Null for a new plan. */
  plan: Plan | null;
  /** Every drill, to add to stages and to name the drills already in them. */
  drills: Drill[];
};

/** The plan editor: the plan's name and description, then its stages and their drills, in order. */
export function PlanEditor({ plan, drills }: PlanEditorProps) {
  const [draft, dispatch] = useReducer(planReducer, plan, toDraft);
  const dirty = !plan || !sameDraft(draft, toDraft(plan));
  const blocker = useUnsavedWarning(dirty);
  const { save, saving } = useSavePlan();
  const descriptionId = useId();
  const byId = new Map(drills.map((drill) => [drill.id, drill]));

  const onSave = () => {
    const clean = cleanDraft(draft);
    if (clean.name !== draft.name) dispatch({ type: 'set', field: 'name', value: clean.name });
    save(clean);
  };

  return (
    <>
      <Link
        to={plan ? `/plans/${plan.id}` : '/plans'}
        className="mb-3 inline-flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {plan ? plan.name : 'Plans'}
      </Link>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          value={draft.name}
          onChange={(e) => dispatch({ type: 'set', field: 'name', value: e.target.value })}
          aria-label="Plan name"
          placeholder="Untitled plan"
          maxLength={80}
          className="-ml-2.5 h-11 min-w-[200px] flex-1 rounded-md border border-transparent bg-transparent px-2.5 text-2xl font-semibold tracking-[-0.02em] outline-none hover:border-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 max-wide:text-[22px]"
        />
        <span role="status" className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          {dirty && <i aria-hidden="true" className="size-[7px] rounded-full bg-warn" />}
          {saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'Saved'}
        </span>
        <Button size="lg" className="px-4" disabled={saving} onClick={onSave}>
          Save
        </Button>
      </div>

      <div className="grid max-w-[820px] gap-4">
        <div>
          <Label htmlFor={descriptionId} className="mb-1.5">
            Description
          </Label>
          <Textarea
            id={descriptionId}
            value={draft.description}
            onChange={(e) => dispatch({ type: 'set', field: 'description', value: e.target.value })}
            placeholder="Who the plan is for, and how to use it."
            maxLength={1000}
          />
        </div>

        <ol className="grid gap-4">
          {draft.stages.map((stage, i) => (
            <StageEditor
              key={i}
              draft={draft}
              index={i}
              dispatch={dispatch}
              drills={drills}
              byId={byId}
            />
          ))}
        </ol>
        <div>
          <Button variant="outline" size="lg" onClick={() => dispatch({ type: 'add-stage' })}>
            <Plus aria-hidden="true" />
            Add stage
          </Button>
        </div>
      </div>
      <LeaveDialog blocker={blocker} what="plan" />
    </>
  );
}

type StageEditorProps = {
  draft: PlanDraft;
  index: number;
  dispatch: Dispatch<PlanEdit>;
  drills: Drill[];
  byId: Map<string, Drill>;
};

function StageEditor({ draft, index, dispatch, drills, byId }: StageEditorProps) {
  const stage = draft.stages[index];
  const number = index + 1;
  const id = useId();
  const label = stage.name.trim() || `Stage ${number}`;

  return (
    <li>
      <Card>
        <CardContent className="grid gap-3">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor={`${id}-name`} className="mb-1.5">
                Stage {number}
              </Label>
              <Input
                id={`${id}-name`}
                value={stage.name}
                placeholder={`Stage ${number}`}
                maxLength={80}
                onChange={(e) =>
                  dispatch({
                    type: 'set-stage',
                    stage: index,
                    field: 'name',
                    value: e.target.value,
                  })
                }
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Move stage ${number} up`}
              disabled={index === 0}
              onClick={() => dispatch({ type: 'move-stage', stage: index, direction: -1 })}
            >
              <ArrowUp aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Move stage ${number} down`}
              disabled={index === draft.stages.length - 1}
              onClick={() => dispatch({ type: 'move-stage', stage: index, direction: 1 })}
            >
              <ArrowDown aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Remove stage ${number}`}
              title="Remove the stage. Its drills stay in your library."
              onClick={() => dispatch({ type: 'remove-stage', stage: index })}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
          <div>
            <Label htmlFor={`${id}-goal`} className="mb-1.5">
              Goal
            </Label>
            <Input
              id={`${id}-goal`}
              value={stage.goal}
              placeholder="What the player can do after this stage"
              maxLength={200}
              onChange={(e) =>
                dispatch({ type: 'set-stage', stage: index, field: 'goal', value: e.target.value })
              }
            />
          </div>

          {stage.steps.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-center text-muted-foreground">
              No drills yet. Add drills from your library.
            </p>
          ) : (
            <ol className="grid gap-2">
              {stage.steps.map((step, j) => {
                const name = byId.get(step.drillId)?.name;
                const stepLabel = `${j + 1} of stage ${number}`;
                const move = (direction: -1 | 1) =>
                  dispatch({ type: 'move-step', stage: index, step: j, direction });
                return (
                  <li key={j} className="grid gap-2 rounded-lg border bg-muted/40 p-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          name
                            ? 'min-w-0 flex-1 truncate font-medium'
                            : 'flex-1 text-muted-foreground'
                        }
                      >
                        {name ?? 'This drill no longer exists'}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Move drill ${stepLabel} up`}
                        disabled={!canMoveStep(draft, index, j, -1)}
                        onClick={() => move(-1)}
                      >
                        <ArrowUp aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Move drill ${stepLabel} down`}
                        disabled={!canMoveStep(draft, index, j, 1)}
                        onClick={() => move(1)}
                      >
                        <ArrowDown aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove drill ${stepLabel} from the plan`}
                        onClick={() => dispatch({ type: 'remove-step', stage: index, step: j })}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                    <Input
                      value={step.note}
                      aria-label={`What to work on in drill ${stepLabel}`}
                      placeholder="What to work on, and when it’s done. For example: 8 of 10 land on the table."
                      maxLength={300}
                      className="bg-background"
                      onChange={(e) =>
                        dispatch({ type: 'set-note', stage: index, step: j, note: e.target.value })
                      }
                    />
                  </li>
                );
              })}
            </ol>
          )}
          <div>
            <DrillPicker
              drills={drills}
              stageName={label}
              onAdd={(drillIds) => dispatch({ type: 'add-steps', stage: index, drillIds })}
            />
          </div>
        </CardContent>
      </Card>
    </li>
  );
}
