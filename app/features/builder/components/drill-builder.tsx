import { ArrowLeft, Combine, Plus, Shuffle } from 'lucide-react';
import { useReducer, type ReactNode } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';

import { LeaveDialog } from '~/components/leave-dialog';
import { TableDiagram } from '~/components/table-diagram';
import { Button } from '~/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { hasRandomLine } from '~/lib/drills/describe';
import type { SpeedSpinMapping } from '~/lib/drills/speed-spin';
import type { DrillDraft } from '~/lib/drills/storage';
import type { Drill } from '~/lib/drills/types';
import { useUnsavedWarning } from '~/hooks/use-unsaved-warning';
import { MAX_BALLS_PER_MESSAGE } from '~/lib/robot/protocol';
import type { Settings } from '~/lib/settings';
import { BallEditor } from '~/features/builder/components/ball-editor';
import { BuilderHeader } from '~/features/builder/components/builder-header';
import { SequenceList } from '~/features/builder/components/sequence-list';
import { useSaveDrill } from '~/features/builder/hooks/use-save-drill';
import { firstBadBall, hasErrors } from '~/features/builder/utils/ball-errors';
import { builderReducer, initialState, sameDraft, toDraft } from '~/features/builder/utils/draft';

type DrillBuilderProps = {
  /** The drill to edit. Null for a new drill. A preset is edited as a new copy. */
  drill: Drill | null;
  speedSpin: SpeedSpinMapping;
  rpmLimits: Settings['rpmLimits'];
  /**
   * The Share button, from the sharing feature, for the drill as it is in the editor. `updatedAt` is left out while
   * there are unsaved changes.
   */
  share?: (drill: DrillDraft & { updatedAt?: string }) => ReactNode;
};

const cardTitle = 'text-[15px] font-semibold';
const cardNote = 'text-[13px] text-muted-foreground';

/** The drill builder: the balls in order, where they land, and the selected ball's settings. */
export function DrillBuilder({ drill, speedSpin, rpmLimits, share }: DrillBuilderProps) {
  const [state, dispatch] = useReducer(builderReducer, null, () => initialState(drill, speedSpin));
  const saved = drill?.source === 'custom' ? toDraft(drill) : null;
  const dirty = !saved || !sameDraft(state.drill, saved);
  const blocker = useUnsavedWarning(dirty);
  const { save, saving } = useSaveDrill();
  const { lines } = state.drill;
  const { line, alt } = state.selected;

  const onSave = () => {
    const bad = firstBadBall(lines, rpmLimits);
    if (bad) {
      dispatch({ type: 'select', ball: bad });
      toast.error('Fix the ball marked in red before saving.');
      return;
    }
    const name = state.drill.name.trim() || 'Untitled drill';
    if (name !== state.drill.name) dispatch({ type: 'rename', name });
    save({ ...state.drill, name });
  };

  return (
    <>
      <Link
        to="/"
        className="mb-3 inline-flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Drills
      </Link>
      <BuilderHeader
        drill={state.drill}
        dirty={dirty}
        saving={saving}
        onRename={(name) => dispatch({ type: 'rename', name })}
        onLoad={(loaded) => dispatch({ type: 'load', drill: loaded })}
        onSave={onSave}
        share={share?.(
          dirty || !drill ? state.drill : { ...state.drill, updatedAt: drill.updatedAt },
        )}
      />

      {/* Three columns on wide screens; table and editor side by side on medium; one column on phones. */}
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 [grid-template-areas:'table'_'edit'_'seq'] wide:grid-cols-[minmax(0,1fr)_300px] wide:[grid-template-areas:'table_edit'_'seq_edit'] min-[70rem]:grid-cols-[280px_minmax(0,1fr)_310px] min-[70rem]:[grid-template-areas:'seq_table_edit']">
        <Card className="[grid-area:seq]">
          <CardHeader>
            <CardTitle className={cardTitle}>Sequence</CardTitle>
            <CardAction className={cardNote}>
              {lines.length} {lines.length === 1 ? 'ball' : 'balls'}
            </CardAction>
          </CardHeader>
          <CardContent>
            <SequenceList
              state={state}
              dispatch={dispatch}
              speedSpin={speedSpin}
              rpmLimits={rpmLimits}
            />
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Button variant="outline" size="sm" onClick={() => dispatch({ type: 'add' })}>
                <Plus aria-hidden="true" />
                Add ball
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dispatch({ type: 'add-alternative' })}
              >
                <Shuffle aria-hidden="true" />
                Add random choice
              </Button>
              {line > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  title={`The robot picks this ball or ball ${line} at random`}
                  onClick={() => dispatch({ type: 'join-above' })}
                >
                  <Combine aria-hidden="true" />
                  Random with ball {line}
                </Button>
              )}
            </div>
            {(lines.length > MAX_BALLS_PER_MESSAGE || hasRandomLine(state.drill)) && (
              <p className="mt-2.5 text-[13px] text-muted-foreground">
                The robot holds {MAX_BALLS_PER_MESSAGE} balls at a time, so the app sends the next
                ones while the drill plays.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="[grid-area:table]">
          <CardHeader>
            <CardTitle className={cardTitle}>Where it lands</CardTitle>
            <CardAction className={cardNote}>Click or drag on the table</CardAction>
          </CardHeader>
          <CardContent>
            <TableDiagram
              lines={lines}
              selected={{ line, alt }}
              isInvalid={(ball) => hasErrors(ball, rpmLimits)}
              onSelect={(ball) => dispatch({ type: 'select', ball })}
              onPlace={(ball, spot) => dispatch({ type: 'place', ball, spot })}
              className="mx-auto h-125 w-auto max-w-full max-wide:h-100"
            />
          </CardContent>
        </Card>

        <Card className="[grid-area:edit]">
          <BallEditor
            state={state}
            dispatch={dispatch}
            speedSpin={speedSpin}
            rpmLimits={rpmLimits}
          />
        </Card>
      </div>
      <LeaveDialog blocker={blocker} what="drill" />
    </>
  );
}
