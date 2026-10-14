import { describe, expect, it } from 'vitest';

import { DEFAULT_SPEED_SPIN } from '~/lib/drills/speed-spin';
import type { Ball } from '~/lib/drills/types';
import { validateBall } from '~/lib/robot/protocol';
import { testBall, testDrill } from '~/testing/drills';
import {
  builderReducer,
  type BuilderAction,
  type BuilderState,
  canDelete,
  canMove,
  initialState,
  sameDraft,
  toDraft,
} from '~/features/builder/utils/draft';

// Balls told apart by height: b(1) has height 1.
const b = (height: number): Ball => testBall({ height });

function stateOf(lines: (Ball | Ball[])[], line = 0, alt = 0): BuilderState {
  return { drill: toDraft(testDrill(lines)), selected: { line, alt } };
}

/** The drill as heights, with random lines as arrays, and the selected ball. */
function shape(state: BuilderState) {
  return {
    lines: state.drill.lines.map(({ alternatives }) =>
      alternatives.length === 1 ? alternatives[0].height : alternatives.map((x) => x.height),
    ),
    selected: [state.selected.line, state.selected.alt],
  };
}

const run = (state: BuilderState, ...actions: BuilderAction[]) =>
  actions.reduce(builderReducer, state);

describe('initialState', () => {
  it('starts a new drill with one valid ball', () => {
    const { drill } = initialState(null, DEFAULT_SPEED_SPIN);
    expect(drill.id).toBeUndefined();
    expect(drill.lines).toHaveLength(1);
    expect(validateBall(drill.lines[0].alternatives[0])).toEqual({});
  });

  it('edits a preset as a new copy, and your own drill as itself', () => {
    const preset = testDrill([b(1)], { id: 'p', name: 'Serve', source: 'preset' });
    expect(initialState(preset, DEFAULT_SPEED_SPIN).drill).toMatchObject({
      id: undefined,
      name: 'Serve (copy)',
    });
    const mine = testDrill([b(1)], { id: 'm' });
    expect(initialState(mine, DEFAULT_SPEED_SPIN).drill.id).toBe('m');
  });
});

describe('sameDraft', () => {
  it('ignores source and updatedAt but sees every change', () => {
    const drill = testDrill([b(1)]);
    const draft = toDraft(drill);
    expect(sameDraft(draft, toDraft({ ...drill, updatedAt: 'later' }))).toBe(true);
    expect(sameDraft(draft, { ...draft, name: 'Other' })).toBe(false);
    const changed = run(stateOf([b(1)]), { type: 'change', changes: { height: 2 } });
    expect(sameDraft(draft, changed.drill)).toBe(false);
  });
});

describe('builderReducer', () => {
  it('changes only the selected ball, without touching the old state', () => {
    const before = stateOf([b(1), b(2)], 1);
    const after = run(before, { type: 'change', changes: { height: 9 } });
    expect(shape(after).lines).toEqual([1, 9]);
    expect(shape(before).lines).toEqual([1, 2]);
  });

  it('places a ball from the table and selects it', () => {
    const after = run(stateOf([b(1), b(2)]), {
      type: 'place',
      ball: { line: 1, alt: 0 },
      spot: { dropPoint: 5, height: 30 },
    });
    expect(after.drill.lines[1].alternatives[0]).toMatchObject({ dropPoint: 5, height: 30 });
    expect(after.selected).toEqual({ line: 1, alt: 0 });
  });

  it('adds a copy of the selected ball at the end', () => {
    expect(shape(run(stateOf([b(1), b(2)]), { type: 'add' }))).toEqual({
      lines: [1, 2, 1],
      selected: [2, 0],
    });
  });

  it('duplicates a ball next to itself, inside its random line if it is in one', () => {
    expect(shape(run(stateOf([b(1), b(2)]), { type: 'duplicate' }))).toEqual({
      lines: [1, 1, 2],
      selected: [1, 0],
    });
    expect(shape(run(stateOf([[b(1), b(2)]], 0, 0), { type: 'duplicate' }))).toEqual({
      lines: [[1, 1, 2]],
      selected: [0, 1],
    });
  });

  it('adds a random choice on the other side of the table', () => {
    const after = run(stateOf([testBall({ dropPoint: -6 })]), { type: 'add-alternative' });
    expect(after.drill.lines[0].alternatives.map((x) => x.dropPoint)).toEqual([-6, 6]);
    expect(after.selected).toEqual({ line: 0, alt: 1 });
  });

  it('joins a line to the one above as a random line', () => {
    expect(shape(run(stateOf([b(1), b(2), b(3)], 1), { type: 'join-above' }))).toEqual({
      lines: [[1, 2], 3],
      selected: [0, 1],
    });
    expect(
      shape(
        run(
          stateOf(
            [
              [b(1), b(2)],
              [b(3), b(4)],
            ],
            1,
            1,
          ),
          { type: 'join-above' },
        ),
      ),
    ).toEqual({
      lines: [[1, 2, 3, 4]],
      selected: [0, 3],
    });
    const first = stateOf([b(1), b(2)]);
    expect(run(first, { type: 'join-above' })).toBe(first);
  });

  it('deletes a ball, but never the last one', () => {
    expect(shape(run(stateOf([b(1), b(2)], 1), { type: 'delete' }))).toEqual({
      lines: [1],
      selected: [0, 0],
    });
    expect(shape(run(stateOf([[b(1), b(2)], b(3)], 0, 1), { type: 'delete' }))).toEqual({
      lines: [1, 3],
      selected: [0, 0],
    });
    const last = stateOf([b(1)]);
    expect(canDelete(last)).toBe(false);
    expect(run(last, { type: 'delete' })).toBe(last);
  });

  it('moves a line up and down, and stops at the ends', () => {
    const state = stateOf([b(1), b(2), b(3)], 1);
    expect(shape(run(state, { type: 'move', direction: -1 }))).toEqual({
      lines: [2, 1, 3],
      selected: [0, 0],
    });
    expect(shape(run(state, { type: 'move', direction: 1 }))).toEqual({
      lines: [1, 3, 2],
      selected: [2, 0],
    });
    const top = stateOf([b(1), b(2)]);
    expect(canMove(top, -1)).toBe(false);
    expect(run(top, { type: 'move', direction: -1 })).toBe(top);
  });

  it('moves a ball inside its random line, then out of it at the edge', () => {
    const state = stateOf([b(0), [b(1), b(2), b(3)], b(4)], 1, 1);
    expect(shape(run(state, { type: 'move', direction: -1 }))).toEqual({
      lines: [0, [2, 1, 3], 4],
      selected: [1, 0],
    });
    expect(
      shape(run(state, { type: 'move', direction: -1 }, { type: 'move', direction: -1 })),
    ).toEqual({ lines: [0, 2, [1, 3], 4], selected: [1, 0] });
    expect(
      shape(run(state, { type: 'move', direction: 1 }, { type: 'move', direction: 1 })),
    ).toEqual({ lines: [0, [1, 3], 2, 4], selected: [2, 0] });
  });

  it('drags a line onto another line', () => {
    const state = stateOf([b(1), b(2), b(3)]);
    expect(
      shape(run(state, { type: 'drag', from: { line: 0, alt: 0 }, to: { line: 2, alt: 0 } })),
    ).toEqual({
      lines: [2, 3, 1],
      selected: [2, 0],
    });
    const grouped = stateOf([b(1), [b(2), b(3)]]);
    expect(
      shape(run(grouped, { type: 'drag', from: { line: 1 }, to: { line: 0, alt: 0 } })),
    ).toEqual({
      lines: [[2, 3], 1],
      selected: [0, 0],
    });
  });

  it('drags a ball inside its random line, or out of it next to another line', () => {
    const state = stateOf([b(0), [b(1), b(2), b(3)], b(4)]);
    const drag = (from: { line: number; alt: number }, to: { line: number; alt: number }) =>
      shape(run(state, { type: 'drag', from, to }));
    expect(drag({ line: 1, alt: 0 }, { line: 1, alt: 2 })).toEqual({
      lines: [0, [2, 3, 1], 4],
      selected: [1, 2],
    });
    expect(drag({ line: 1, alt: 1 }, { line: 0, alt: 0 })).toEqual({
      lines: [2, 0, [1, 3], 4],
      selected: [0, 0],
    });
    expect(drag({ line: 1, alt: 1 }, { line: 2, alt: 0 })).toEqual({
      lines: [0, [1, 3], 4, 2],
      selected: [3, 0],
    });
  });

  it('ignores a drag or selection that points nowhere', () => {
    const state = stateOf([b(1), b(2)]);
    expect(run(state, { type: 'drag', from: { line: 5 }, to: { line: 0, alt: 0 } })).toBe(state);
    expect(run(state, { type: 'select', ball: { line: 0, alt: 3 } })).toBe(state);
  });

  it('loads a drill from a file but keeps the id', () => {
    const state = { ...stateOf([b(1), b(2)], 1), drill: { ...stateOf([b(1)]).drill, id: 'mine' } };
    const loaded = toDraft(testDrill([b(7)], { id: 'theirs', name: 'From file' }));
    const after = run(state, { type: 'load', drill: loaded });
    expect(after.drill).toMatchObject({ id: 'mine', name: 'From file' });
    expect(shape(after)).toEqual({ lines: [7], selected: [0, 0] });
  });
});
