import { ArrowLeft, Copy, Pencil, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { DrillBadges } from '~/components/drill-badges';
import { TableDiagram } from '~/components/table-diagram';
import { Button, buttonVariants } from '~/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import type { SpeedSpinMapping } from '~/lib/drills/speed-spin';
import type { Drill } from '~/lib/drills/types';
import { cn } from '~/lib/utils';
import { BallTable } from '~/features/player/components/ball-table';
import { DeleteDrillButton } from '~/features/player/components/delete-drill-button';
import { PlayControls } from '~/features/player/components/play-controls';
import { SessionCard } from '~/features/player/components/session-card';
import { useDrillPlayer } from '~/features/player/hooks/use-drill-player';
import { useDeleteDrill } from '~/features/player/hooks/use-delete-drill';
import { useDuplicateDrill } from '~/features/player/hooks/use-duplicate-drill';
import { usePlayerShortcuts } from '~/features/player/hooks/use-player-shortcuts';

type DrillPlayerProps = {
  drill: Drill;
  speedSpin: SpeedSpinMapping;
  /** The Share button, from the sharing feature. Goes first in the actions at the top. */
  share?: ReactNode;
};

const action = 'px-3.5 max-wide:px-2.5';

/** The drill detail screen: the table, the balls, and the controls to play the drill on the robot. */
export function DrillPlayer({ drill, speedSpin, share }: DrillPlayerProps) {
  const player = useDrillPlayer(drill);
  const { duplicate, pending } = useDuplicateDrill();
  const { remove, pending: deleting } = useDeleteDrill();
  const { run, status } = player;
  usePlayerShortcuts(run !== null, player);

  const live = run ? (status === 'paused' ? 'paused' : 'playing') : null;
  // Balls fade around the one being shot only while it is really shooting.
  const currentLine = run && status === 'playing' ? run.currentLine : null;

  return (
    <>
      <Link
        to="/"
        className="mb-3 inline-flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Drills
      </Link>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px]/[1.2] font-semibold tracking-[-0.02em] max-wide:text-[22px]">
            {drill.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
            <DrillBadges drill={drill} showDuration={false} live={live} />
            <span>{drill.lines.length} balls in each set</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {share}
          {drill.source === 'preset' ? (
            <Button
              variant="outline"
              size="lg"
              className={action}
              aria-label="Copy and edit"
              disabled={pending}
              onClick={() => duplicate(drill.id)}
            >
              <Copy aria-hidden="true" />
              <span className="max-wide:hidden">Copy and edit</span>
            </Button>
          ) : (
            <>
              <DeleteDrillButton
                name={drill.name}
                trigger={
                  <Button
                    variant="outline"
                    size="lg"
                    className={action}
                    aria-label="Delete"
                    disabled={deleting || run !== null}
                  />
                }
                onDelete={() => remove(drill.id)}
              >
                <Trash2 aria-hidden="true" />
                <span className="max-wide:hidden">Delete</span>
              </DeleteDrillButton>
              <Link
                to={`/builder/${drill.id}`}
                aria-label="Edit"
                className={buttonVariants({ variant: 'outline', size: 'lg', className: action })}
              >
                <Pencil aria-hidden="true" />
                <span className="max-wide:hidden">Edit</span>
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="grid items-start gap-5 min-[54rem]:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-5">
          <Card className="[--card-spacing:--spacing(4)]">
            <CardContent>
              <TableDiagram
                lines={drill.lines}
                orientation="landscape"
                current={currentLine === null ? null : { line: currentLine }}
                className="max-h-[380px]"
              />
              <Legend />
            </CardContent>
          </Card>
          <Card className="pb-0 [--card-spacing:--spacing(5)]">
            <CardHeader>
              <CardTitle className="text-[15px] font-semibold">Balls</CardTitle>
              <CardAction className="text-[13px] text-muted-foreground">
                Played in this order
              </CardAction>
            </CardHeader>
            <BallTable lines={drill.lines} speedSpin={speedSpin} currentLine={currentLine} />
          </Card>
        </div>
        {/* First on narrow screens, so the controls are in reach. */}
        <aside className="-order-1 grid gap-5 min-[54rem]:sticky min-[54rem]:top-[76px] min-[54rem]:order-none">
          <PlayControls
            status={status}
            connected={player.connected}
            run={run}
            lastRun={player.lastRun}
            playing={player.playing}
            otherIsRunning={player.otherIsRunning}
            otherName={player.otherName}
            onConnect={player.connect}
            onPlay={player.play}
            onTogglePause={player.togglePause}
            onStop={player.stop}
          />
          <SessionCard
            session={player.session}
            onChange={player.setSession}
            locked={run !== null}
          />
        </aside>
      </div>
    </>
  );
}

function Legend() {
  const dot = 'size-3 rounded-full bg-ball';
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <i aria-hidden="true" className="size-3 rounded-[3px] bg-muted-foreground" />
        Robot
      </span>
      <span className="flex items-center gap-1.5">
        <i aria-hidden="true" className={dot} />
        Where each ball lands
      </span>
      <span className="flex items-center gap-1.5">
        <i
          aria-hidden="true"
          className={cn(dot, 'outline-[1.5px] outline-offset-1 outline-ball outline-dashed')}
        />
        One of these, at random
      </span>
    </div>
  );
}
