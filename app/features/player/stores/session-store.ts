// Each drill's session settings for this visit, and the drill as last sent to the robot. A store, not component
// state, so both survive moving between screens while a drill plays.
import { create } from 'zustand';

import type { Drill } from '~/lib/drills/types';
import type { Session } from '~/features/player/utils/session';

type SessionState = {
  /** By drill id. A drill without one plays with its own settings. */
  sessions: Record<string, Session>;
  /** The drill as last sent to the robot, with its session's settings. */
  played: Drill | null;
  setSession(drillId: string, session: Session): void;
  setPlayed(drill: Drill): void;
};

export const useSessionStore = create<SessionState>()((set) => ({
  sessions: {},
  played: null,
  setSession: (drillId, session) =>
    set((state) => ({ sessions: { ...state.sessions, [drillId]: session } })),
  setPlayed: (drill) => set({ played: drill }),
}));
