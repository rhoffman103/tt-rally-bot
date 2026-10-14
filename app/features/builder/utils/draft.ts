// The drill being built and the selected ball, and every change the builder makes to them.
import type { BallRef, DropSpot } from '~/components/table-diagram';
import { type SpeedSpinMapping, toRpm } from '~/lib/drills/speed-spin';
import type { DrillDraft } from '~/lib/drills/storage';
import type { Ball, Drill, DrillLine } from '~/lib/drills/types';

export type BuilderState = { drill: DrillDraft; selected: BallRef };

/** Drag a ball (or a whole line, when `alt` is left out) onto another ball. */
export type DragSource = { line: number; alt?: number };

export type BuilderAction =
  | { type: 'select'; ball: BallRef }
  | { type: 'rename'; name: string }
  /** Changes the selected ball. */
  | { type: 'change'; changes: Partial<Ball> }
  /** Selects a ball and moves where it lands, from the table. */
  | { type: 'place'; ball: BallRef; spot: DropSpot }
  /** A copy of the selected ball at the end of the drill. */
  | { type: 'add' }
  /** A copy of the selected ball right after it, in the same random line if it is in one. */
  | { type: 'duplicate' }
  /** Turns the selected line into a random line, or adds to it, with a mirrored copy of the selected ball. */
  | { type: 'add-alternative' }
  /** Puts the selected line's balls into the line above, so the robot picks one of them at random. */
  | { type: 'join-above' }
  | { type: 'delete' }
  | { type: 'move'; direction: -1 | 1 }
  | { type: 'drag'; from: DragSource; to: BallRef }
  /** Replaces the drill's balls and settings, for example from an imported file. Keeps the drill's id. */
  | { type: 'load'; drill: DrillDraft };

/** The ball a new drill starts with: speed 5, spin 3, a little past the middle of the table. */
function defaultBall(mapping: SpeedSpinMapping): Ball {
  return {
    ...toRpm({ speed: 5, spin: 3 }, mapping),
    height: 20,
    dropPoint: 0,
    frequency: 50,
    repetitions: 1,
  };
}

/** What the builder starts with: a new drill, a copy of a preset (no `id`), or one of your drills. */
export function initialState(drill: Drill | null, mapping: SpeedSpinMapping): BuilderState {
  const selected = { line: 0, alt: 0 };
  if (!drill) {
    return {
      selected,
      drill: {
        name: 'New drill',
        lines: [{ alternatives: [defaultBall(mapping)] }],
        randomOrder: false,
        duration: { kind: 'minutes', value: 1 },
      },
    };
  }
  const draft = toDraft(drill);
  if (drill.source === 'preset')
    return { selected, drill: { ...draft, id: undefined, name: `${drill.name} (copy)` } };
  return { selected, drill: draft };
}

/** The parts of a drill the builder changes. */
export function toDraft(drill: Drill): DrillDraft {
  const { id, name, lines, randomOrder, duration, pauseBetweenSetsSec } = structuredClone(drill);
  return {
    id,
    name,
    lines,
    randomOrder,
    duration,
    ...(pauseBetweenSetsSec === undefined ? {} : { pauseBetweenSetsSec }),
  };
}

/** True when the two drafts would save the same drill. */
export const sameDraft = (a: DrillDraft, b: DrillDraft) =>
  JSON.stringify(comparable(a)) === JSON.stringify(comparable(b));

const comparable = (d: DrillDraft) => [
  d.id,
  d.name,
  d.lines,
  d.randomOrder,
  d.duration,
  d.pauseBetweenSetsSec,
];

export const selectedBall = ({ drill, selected }: BuilderState): Ball =>
  drill.lines[selected.line].alternatives[selected.alt];

export const canDelete = ({ drill }: BuilderState) =>
  drill.lines.length > 1 || drill.lines[0].alternatives.length > 1;

/** False when the selected ball is already first (−1) or last (1). */
export function canMove({ drill, selected }: BuilderState, direction: -1 | 1): boolean {
  const { alternatives } = drill.lines[selected.line];
  if (alternatives.length > 1) return true; // it can always leave its random line
  const to = selected.line + direction;
  return to >= 0 && to < drill.lines.length;
}

export function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  const { drill, selected } = state;
  const lines = drill.lines.map((line) => ({ alternatives: [...line.alternatives] }));
  const at = selected.line;
  const line = lines[at];
  const next = (selectedBall: BallRef, changed = lines): BuilderState => ({
    drill: { ...drill, lines: changed },
    selected: selectedBall,
  });

  switch (action.type) {
    case 'select':
      return exists(lines, action.ball) ? { ...state, selected: action.ball } : state;

    case 'rename':
      return { ...state, drill: { ...drill, name: action.name } };

    case 'change':
      line.alternatives[selected.alt] = { ...line.alternatives[selected.alt], ...action.changes };
      return next(selected);

    case 'place': {
      if (!exists(lines, action.ball)) return state;
      const target = lines[action.ball.line];
      target.alternatives[action.ball.alt] = {
        ...target.alternatives[action.ball.alt],
        ...action.spot,
      };
      return next(action.ball);
    }

    case 'add':
      lines.push({ alternatives: [{ ...selectedBall(state) }] });
      return next({ line: lines.length - 1, alt: 0 });

    case 'duplicate':
      if (line.alternatives.length > 1) {
        line.alternatives.splice(selected.alt + 1, 0, { ...selectedBall(state) });
        return next({ line: at, alt: selected.alt + 1 });
      }
      lines.splice(at + 1, 0, { alternatives: [{ ...selectedBall(state) }] });
      return next({ line: at + 1, alt: 0 });

    case 'add-alternative': {
      const ball = selectedBall(state);
      // On the other side of the table, so the two choices are easy to tell apart.
      line.alternatives.push({ ...ball, dropPoint: ball.dropPoint === 0 ? 5 : -ball.dropPoint });
      return next({ line: at, alt: line.alternatives.length - 1 });
    }

    case 'join-above': {
      if (at === 0) return state;
      const above = lines[at - 1];
      const alt = above.alternatives.length + selected.alt;
      above.alternatives.push(...line.alternatives);
      lines.splice(at, 1);
      return next({ line: at - 1, alt });
    }

    case 'delete':
      if (!canDelete(state)) return state;
      if (line.alternatives.length > 1) {
        line.alternatives.splice(selected.alt, 1);
        return next({ line: at, alt: Math.max(0, selected.alt - 1) });
      }
      lines.splice(at, 1);
      return next({ line: Math.min(at, lines.length - 1), alt: 0 });

    case 'move':
      return move(state, lines, action.direction);

    case 'drag':
      return drag(state, lines, action.from, action.to);

    case 'load':
      return {
        drill: { ...structuredClone(action.drill), id: drill.id },
        selected: { line: 0, alt: 0 },
      };
  }
}

const exists = (lines: DrillLine[], { line, alt }: BallRef) =>
  lines[line]?.alternatives[alt] !== undefined;

function arrayMove<T>(items: T[], from: number, to: number) {
  const [item] = items.splice(from, 1);
  items.splice(to, 0, item);
}

/** One step up or down. A ball at the edge of a random line leaves it and becomes a line of its own. */
function move(state: BuilderState, lines: DrillLine[], direction: -1 | 1): BuilderState {
  if (!canMove(state, direction)) return state;
  const { line: at, alt } = state.selected;
  const { alternatives } = lines[at];
  const done = (selected: BallRef): BuilderState => ({
    drill: { ...state.drill, lines },
    selected,
  });

  if (alternatives.length === 1) {
    arrayMove(lines, at, at + direction);
    return done({ line: at + direction, alt: 0 });
  }
  const to = alt + direction;
  if (to >= 0 && to < alternatives.length) {
    arrayMove(alternatives, alt, to);
    return done({ line: at, alt: to });
  }
  const [ball] = alternatives.splice(alt, 1);
  const lineAt = direction === -1 ? at : at + 1;
  lines.splice(lineAt, 0, { alternatives: [ball] });
  return done({ line: lineAt, alt: 0 });
}

/**
 * Drops a ball or a line onto another ball. A line takes the place of the line it is dropped on. A ball from a
 * random line moves within that line, or leaves it and becomes a line of its own next to the line it is dropped on.
 */
function drag(
  state: BuilderState,
  lines: DrillLine[],
  from: DragSource,
  to: BallRef,
): BuilderState {
  if (!lines[from.line] || !exists(lines, to)) return state;
  const done = (selected: BallRef): BuilderState => ({
    drill: { ...state.drill, lines },
    selected,
  });
  const source = lines[from.line].alternatives;

  if (from.alt === undefined || source.length === 1) {
    if (from.line === to.line) return state;
    arrayMove(lines, from.line, to.line);
    return done({ line: to.line, alt: from.alt ?? 0 });
  }
  if (!source[from.alt]) return state;
  if (from.line === to.line) {
    arrayMove(source, from.alt, to.alt);
    return done({ line: to.line, alt: to.alt });
  }
  const [ball] = source.splice(from.alt, 1);
  const lineAt = to.line > from.line ? to.line + 1 : to.line;
  lines.splice(lineAt, 0, { alternatives: [ball] });
  return done({ line: lineAt, alt: 0 });
}
