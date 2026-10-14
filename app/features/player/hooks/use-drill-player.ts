import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

import { useRobot } from '~/hooks/use-robot';
import type { Drill } from '~/lib/drills/types';
import type { DrillProgress } from '~/lib/robot/client';
import { useSessionStore } from '~/features/player/stores/session-store';
import { clock, drillForSession, type Session, sessionOf } from '~/features/player/utils/session';

// The id is the message: when `play()` fails, the header's robot-error toast has the same one.
const showError = (error: unknown) => {
  const text = error instanceof Error ? error.message : String(error);
  toast.error(text, { id: text });
};

/** Everything the player screen needs for one drill: its session, the robot's state and the play commands. */
export function useDrillPlayer(drill: Drill) {
  const robot = useRobot();
  const stored = useSessionStore((state) => state.sessions[drill.id]);
  const played = useSessionStore((state) => state.played);
  const setSession = useSessionStore((state) => state.setSession);
  const setPlayed = useSessionStore((state) => state.setPlayed);

  const session = stored ?? sessionOf(drill);
  const running = robot.status === 'playing' || robot.status === 'paused';
  const isThisDrill = robot.progress?.drillId === drill.id;
  /** This drill is playing or paused. */
  const run: DrillProgress | null = running && isThisDrill ? robot.progress : null;
  /** How the last run of this drill ended, until another drill plays or the robot disconnects. */
  const lastRun: DrillProgress | null = !running && isThisDrill ? robot.progress : null;
  /** The drill as the robot plays it: with the session it started with, not later changes. */
  const playing = played?.id === drill.id ? played : drillForSession(drill, session);

  // A toast when the drill comes to its end by itself, not when you stop it.
  const stoppedByYou = useRef(false);
  const wasRunning = useRef(false);
  const isRunning = run !== null;
  useEffect(() => {
    if (isRunning) {
      wasRunning.current = true;
      return;
    }
    if (wasRunning.current && lastRun && !stoppedByYou.current) {
      toast.success(
        `Done: ${lastRun.set} ${lastRun.set === 1 ? 'set' : 'sets'}, ${lastRun.ballsShot} balls in ${clock(lastRun.elapsedSec)}`,
      );
    }
    wasRunning.current = false;
    stoppedByYou.current = false;
  }, [isRunning, lastRun]);

  return {
    status: robot.status,
    connected: robot.status === 'standby' || running,
    session,
    setSession: (next: Session) => setSession(drill.id, next),
    run,
    lastRun,
    playing,
    /** Another drill is playing. Play stops it first. */
    otherIsRunning: running && !isThisDrill,
    /** The name of the other drill that is playing, when this browser started it. */
    otherName:
      running && !isThisDrill && played && played.id === robot.progress?.drillId
        ? played.name
        : null,
    connect: () => robot.connect().catch(showError),
    play: () => {
      const toPlay = drillForSession(drill, session);
      setPlayed(toPlay);
      stoppedByYou.current = false;
      robot.play(toPlay).catch(showError);
    },
    togglePause: () => {
      if (robot.status === 'playing') robot.pause().catch(showError);
      else if (robot.status === 'paused') robot.resume().catch(showError);
    },
    stop: () => {
      stoppedByYou.current = true;
      robot.stop().catch(showError);
    },
  };
}
