import { ArrowLeft, Info } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useFetcher, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { BallChip } from '~/components/ball-chip';
import { DrillBadges } from '~/components/drill-badges';
import { TableDiagram } from '~/components/table-diagram';
import { Button, buttonVariants } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { ballSummary, durationText } from '~/lib/drills/describe';
import type { SpeedSpinMapping } from '~/lib/drills/speed-spin';
import type { Drill } from '~/lib/drills/types';
import { cn } from '~/lib/utils';
import type { ImportAction, ImportResult } from '~/features/sharing/types/import-action';
import { changedOn, compareCopies, sameDay } from '~/features/sharing/utils/copies';

type ImportDrillProps = {
  /** The share code, sent back to the route's `clientAction` on save. */
  code: string;
  drill: Drill;
  /** The saved drill with the same `id`, if there is one. */
  existing: Drill | null;
  /** The name "Keep both" gives the shared drill. */
  copyName: string;
  speedSpin: SpeedSpinMapping;
};

type Mode = ImportAction['mode'];

/** The import screen: the shared drill on the table and in a list, then Save. */
export function ImportDrill({ code, drill, existing, copyName, speedSpin }: ImportDrillProps) {
  const fetcher = useFetcher<ImportResult>();
  const navigate = useNavigate();
  const order = existing ? compareCopies(drill, existing) : 'newer';
  // Replacing a newer copy loses changes, so then "Keep both" is picked first.
  const [mode, setMode] = useState<Mode>(order === 'older' ? 'keep-both' : 'replace');
  const saving = fetcher.state !== 'idle';
  const result = fetcher.data;

  useEffect(() => {
    if (!result) return;
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Saved “${result.drill.name}”`);
    void navigate(`/drills/${result.drill.id}`, { replace: true });
  }, [result, navigate]);

  const save = () => {
    const action: ImportAction = { code, mode: existing ? mode : 'replace' };
    void fetcher.submit(action, { method: 'post', encType: 'application/json' });
  };

  return (
    <div className="mx-auto max-w-[780px]">
      <Link
        to="/"
        className="mb-3 inline-flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Drills
      </Link>
      <div className="mb-5">
        <h1 className="text-[26px]/[1.2] font-semibold tracking-[-0.02em] max-wide:text-[22px]">
          Import a drill
        </h1>
        <p className="mt-1 text-muted-foreground">
          Someone shared this drill with you. Check it, then save it.
        </p>
      </div>

      <Card className="[--card-spacing:--spacing(5)]">
        <CardContent>
          <div className="mb-5 grid grid-cols-[minmax(0,1fr)] gap-5 wide:grid-cols-[280px_minmax(0,1fr)]">
            <TableDiagram
              lines={drill.lines}
              orientation="landscape"
              className="w-full self-start rounded-lg"
            />
            <div>
              <h2 className="text-lg font-semibold">{drill.name}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
                <DrillBadges drill={drill} showSource={false} showDuration={false} />
                <span>
                  {drill.lines.length} {drill.lines.length === 1 ? 'ball' : 'balls'} ·{' '}
                  {durationText(drill.duration)}
                </span>
              </div>
              <ol className="mt-3.5 grid gap-2">
                {drill.lines.map((line, i) => (
                  <li key={i} className="flex items-center gap-2 text-[13.5px]">
                    <BallChip label={String(i + 1)} random={line.alternatives.length > 1} />
                    <span>
                      {line.alternatives.map((ball, j) => (
                        <span key={j}>
                          {j > 0 && <span className="text-muted-foreground"> or </span>}
                          {ballSummary(ball, speedSpin)}
                        </span>
                      ))}
                      {line.alternatives[0].repetitions > 1 && (
                        <span className="text-muted-foreground">
                          {' '}
                          ×{line.alternatives[0].repetitions}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {existing && (
            <ExistingCopy
              drill={drill}
              existing={existing}
              copyName={copyName}
              order={order}
              mode={mode}
              onModeChange={setMode}
            />
          )}

          <div className="flex justify-end gap-2 border-t pt-4">
            <Link to="/" className={buttonVariants({ variant: 'ghost', size: 'lg' })}>
              Cancel
            </Link>
            <Button size="lg" className="px-4" disabled={saving} onClick={save}>
              Save drill
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type ExistingCopyProps = {
  drill: Drill;
  existing: Drill;
  copyName: string;
  order: ReturnType<typeof compareCopies>;
  mode: Mode;
  onModeChange(mode: Mode): void;
};

/** "You already have this drill": replace it, or keep both. */
function ExistingCopy({ drill, existing, copyName, order, mode, onModeChange }: ExistingCopyProps) {
  const time = sameDay(drill.updatedAt, existing.updatedAt);
  const when =
    order === 'same'
      ? `Both copies were last changed on ${changedOn(drill.updatedAt)}.`
      : `The shared copy was changed on ${changedOn(drill.updatedAt, { time })}. Yours was changed on ${changedOn(existing.updatedAt, { time })}.`;
  const replaceNote = {
    newer: 'Use the newer, shared copy.',
    older: 'Use the shared copy, which is older than yours.',
    same: 'Use the shared copy.',
  }[order];

  const options: { value: Mode; title: string; note: string }[] = [
    { value: 'replace', title: 'Replace mine', note: replaceNote },
    {
      value: 'keep-both',
      title: 'Keep both',
      note: `Save this one as “${copyName}”.`,
    },
  ];

  return (
    <div
      role="group"
      aria-labelledby="existing-copy"
      className="mb-5 flex items-start gap-2.5 rounded-lg border border-warn/45 bg-warn-soft px-3.5 py-3 text-warn-fg"
    >
      <Info aria-hidden="true" className="mt-0.5 size-4 flex-none" />
      <div className="flex-1">
        <p id="existing-copy">
          <b className="font-semibold">You already have this drill.</b> {when}
        </p>
        <div className="mt-3 grid gap-2">
          {options.map((option) => (
            <label
              key={option.value}
              className={cn(
                'flex cursor-pointer items-start gap-2.5 rounded-md border border-warn/35 bg-background px-3 py-2.5 text-foreground',
                'has-focus-visible:ring-3 has-focus-visible:ring-ring/50',
              )}
            >
              <input
                type="radio"
                name="import-mode"
                value={option.value}
                checked={mode === option.value}
                onChange={() => onModeChange(option.value)}
                className="mt-[3px] accent-primary"
              />
              <span>
                <b className="block font-medium">{option.title}</b>
                <small className="text-[13px] text-muted-foreground">{option.note}</small>
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
