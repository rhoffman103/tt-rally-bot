import { Pause, Play, Square } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import type { Drill } from '~/lib/drills/types';
import type { DrillProgress, RobotStatus } from '~/lib/robot/client';
import { cn } from '~/lib/utils';
import { clock, remaining } from '~/features/player/utils/session';

type PlayControlsProps = {
  status: RobotStatus;
  connected: boolean;
  /** This drill's run while it plays or is paused. */
  run: DrillProgress | null;
  /** How this drill's last run ended. */
  lastRun: DrillProgress | null;
  /** The drill as the robot plays it, with the session's duration. */
  playing: Drill;
  otherIsRunning: boolean;
  otherName: string | null;
  onConnect(): void;
  onPlay(): void;
  onTogglePause(): void;
  onStop(): void;
};

// Big enough to hit from a few metres away.
const big = "h-14 w-full rounded-lg text-base [&_svg:not([class*='size-'])]:size-5";

/** Play, pause, resume and stop, with the run's progress. */
export function PlayControls(props: PlayControlsProps) {
  return (
    <Card className="[--card-spacing:--spacing(5)]">
      <CardContent className="grid gap-3.5">
        {props.run ? <Running {...props} run={props.run} /> : <Ready {...props} />}
      </CardContent>
    </Card>
  );
}

function Ready({
  status,
  connected,
  lastRun,
  otherIsRunning,
  otherName,
  onConnect,
  onPlay,
}: PlayControlsProps) {
  let hint: ReactNode = null;
  if (status === 'disconnected') {
    hint = (
      <>
        Connect the robot to play.{' '}
        <button
          type="button"
          className="font-medium text-foreground underline underline-offset-3"
          onClick={onConnect}
        >
          Connect
        </button>
      </>
    );
  } else if (status === 'connecting') hint = 'Connecting to the robot…';
  else if (status === 'unsupported') hint = 'Bluetooth isn’t available in this browser.';
  else if (otherIsRunning) {
    hint = `${otherName ? `“${otherName}”` : 'Another drill'} is playing. Play stops it and starts this drill.`;
  } else if (lastRun) {
    const sets = `${lastRun.set} ${lastRun.set === 1 ? 'set' : 'sets'}`;
    hint = `Last run: ${sets}, ${lastRun.ballsShot} balls in ${clock(lastRun.elapsedSec)}.`;
  }

  return (
    <>
      <Button className={big} disabled={!connected} onClick={onPlay}>
        <Play aria-hidden="true" className="fill-current" />
        Play
      </Button>
      {hint && <p className="text-[13px] text-muted-foreground">{hint}</p>}
      <KeyHint>
        <Kbd>Space</Kbd> pause or resume · <Kbd>Esc</Kbd> stop
      </KeyHint>
    </>
  );
}

function Running({
  status,
  run,
  playing,
  onTogglePause,
  onStop,
}: PlayControlsProps & { run: DrillProgress }) {
  const paused = status === 'paused';
  const { duration } = playing;
  const left = remaining(duration, run);
  const sets = duration.kind === 'combos' ? `${run.set}/${duration.value}` : String(run.set);

  return (
    <>
      <div className="flex items-center gap-2 font-medium">
        <span
          aria-hidden="true"
          className={cn(
            'size-2 flex-none rounded-full',
            paused ? 'bg-warn' : 'animate-blink bg-ball',
          )}
        />
        {paused ? 'Paused' : `Ball ${run.currentLine + 1} · set ${run.set + 1}`}
      </div>
      <dl className="grid grid-cols-3 gap-2">
        <Stat label="Time" value={clock(run.elapsedSec)} />
        <Stat label="Balls" value={String(run.ballsShot)} />
        <Stat label="Sets done" value={sets} />
      </dl>
      <div>
        {left.share !== null && (
          <div
            role="progressbar"
            aria-label="Session"
            aria-valuenow={Math.round(left.share * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            className="mb-1.5 h-2 overflow-hidden rounded-full bg-muted"
          >
            <span
              className="block h-full rounded-full bg-ball transition-[width] duration-400"
              style={{ width: `${left.share * 100}%` }}
            />
          </div>
        )}
        <p className="text-[12.5px] text-muted-foreground">{left.label}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button className={big} onClick={onTogglePause}>
          {paused ? (
            <Play aria-hidden="true" className="fill-current" />
          ) : (
            <Pause aria-hidden="true" className="fill-current" />
          )}
          {paused ? 'Resume' : 'Pause'}
        </Button>
        <Button variant="destructive" className={big} onClick={onStop}>
          <Square aria-hidden="true" className="fill-current" />
          Stop
        </Button>
      </div>
      <KeyHint>
        <Kbd>Space</Kbd> {paused ? 'resume' : 'pause'} · <Kbd>Esc</Kbd> stop
      </KeyHint>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col-reverse rounded-lg bg-muted p-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-mono text-[22px]/[1.2] font-semibold tracking-[-0.02em]">{value}</dd>
    </div>
  );
}

function KeyHint({ children }: { children: ReactNode }) {
  return <p className="text-center text-[12.5px] text-muted-foreground">{children}</p>;
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-block rounded-[4px] border border-b-2 bg-muted px-[5px] font-mono text-[11.5px] text-foreground">
      {children}
    </kbd>
  );
}
