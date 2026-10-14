import { ArrowDown, ArrowUp, GripVertical, Shuffle } from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';

import { BallChip } from '~/components/ball-chip';
import type { BallRef } from '~/components/table-diagram';
import { Button } from '~/components/ui/button';
import { ballLabel, ballSummary } from '~/lib/drills/describe';
import type { SpeedSpinMapping } from '~/lib/drills/speed-spin';
import type { Settings } from '~/lib/settings';
import { cn } from '~/lib/utils';
import { hasErrors } from '~/features/builder/utils/ball-errors';
import {
  type BuilderAction,
  type BuilderState,
  canMove,
  type DragSource,
} from '~/features/builder/utils/draft';

type SequenceListProps = {
  state: BuilderState;
  dispatch(action: BuilderAction): void;
  speedSpin: SpeedSpinMapping;
  rpmLimits: Settings['rpmLimits'];
};

const sameRef = (a: BallRef | null, b: BallRef) => a?.line === b.line && a.alt === b.alt;

/**
 * Every ball in play order. Click a ball to edit it. Reorder by dragging the grip, or with the arrow buttons on the
 * selected ball (Alt+↑ and Alt+↓ also work). A random line's balls sit in a dashed box, whose header has its own
 * arrow buttons to move the whole line.
 */
export function SequenceList({ state, dispatch, speedSpin, rpmLimits }: SequenceListProps) {
  const { drill, selected } = state;
  const [dragFrom, setDragFrom] = useState<DragSource | null>(null);
  const [dropOn, setDropOn] = useState<BallRef | null>(null);
  // After a move by keyboard, focus follows the ball to its new place in the list.
  const listRef = useRef<HTMLDivElement>(null);
  const movedBy = useRef<{ direction: -1 | 1; group: boolean } | null>(null);

  useEffect(() => {
    const moved = movedBy.current;
    if (moved === null) return;
    movedBy.current = null;
    const item = listRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    // After a group moves, focus stays on the group's own buttons, never on a ball's.
    const box = moved.group ? item?.closest('[data-group]') : item?.parentElement;
    const attribute = moved.group ? 'data-group-move' : 'data-move';
    const button =
      box?.querySelector<HTMLButtonElement>(`[${attribute}="${moved.direction}"]:not(:disabled)`) ??
      (moved.group ? box?.querySelector<HTMLButtonElement>(`[${attribute}]:not(:disabled)`) : null);
    (button ?? item)?.focus();
  }, [selected]);

  const move = (direction: -1 | 1) => {
    movedBy.current = { direction, group: false };
    dispatch({ type: 'move', direction });
  };
  // A random line moves as a whole, like dragging its header. The line's first ball is selected after.
  const moveGroup = (line: number, direction: -1 | 1) => {
    movedBy.current = { direction, group: true };
    dispatch({ type: 'drag', from: { line }, to: { line: line + direction, alt: 0 } });
  };

  const startDrag = (event: DragEvent, from: DragSource) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', ''); // Firefox only starts a drag with data
    setDragFrom(from);
  };
  const endDrag = () => {
    setDragFrom(null);
    setDropOn(null);
  };
  const dropHandlers = (to: BallRef) => ({
    onDragOver: (event: DragEvent) => {
      if (!dragFrom) return;
      event.preventDefault();
      if (!sameRef(dropOn, to)) setDropOn(to);
    },
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      if (dragFrom) dispatch({ type: 'drag', from: dragFrom, to });
      endDrag();
    },
  });

  const item = (lineIndex: number, alt: number) => {
    const line = drill.lines[lineIndex];
    const ball = line.alternatives[alt];
    const ref = { line: lineIndex, alt };
    const isSelected = sameRef(selected, ref);
    const label = ballLabel(line, lineIndex, alt);
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
      event.preventDefault();
      const direction = event.key === 'ArrowUp' ? -1 : 1;
      if (canMove(state, direction)) move(direction);
    };
    return (
      <div
        key={`${lineIndex}-${alt}`}
        draggable
        onDragStart={(event) => startDrag(event, ref)}
        onDragEnd={endDrag}
        {...dropHandlers(ref)}
        className={cn(
          'flex min-w-0 items-center gap-1 rounded-md border border-transparent pr-1 hover:bg-accent',
          isSelected && 'border-ring bg-accent',
          dropOn && sameRef(dropOn, ref) && 'border-dashed border-ring',
        )}
      >
        <span className="flex cursor-grab items-center self-stretch pl-2 text-muted-foreground">
          <GripVertical aria-hidden="true" className="size-4" />
        </span>
        <button
          type="button"
          aria-pressed={isSelected}
          aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
          onClick={() => dispatch({ type: 'select', ball: ref })}
          onKeyDown={isSelected ? onKeyDown : undefined}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-sm py-[7px] pl-1 text-left text-[13.5px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <BallChip
            label={label}
            random={line.alternatives.length > 1}
            invalid={hasErrors(ball, rpmLimits)}
          />
          <span className="min-w-0 flex-1 truncate">
            <span className="sr-only">Ball {label}: </span>
            {ballSummary(ball, speedSpin)}
          </span>
          {ball.repetitions > 1 && (
            <span className="font-mono text-xs text-muted-foreground">×{ball.repetitions}</span>
          )}
        </button>
        {isSelected && (
          <>
            <Button
              variant="ghost"
              size="icon-xs"
              data-move={-1}
              aria-label={`Move ball ${label} up`}
              disabled={!canMove(state, -1)}
              onClick={() => move(-1)}
            >
              <ArrowUp aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              data-move={1}
              aria-label={`Move ball ${label} down`}
              disabled={!canMove(state, 1)}
              onClick={() => move(1)}
            >
              <ArrowDown aria-hidden="true" />
            </Button>
          </>
        )}
      </div>
    );
  };

  return (
    <div ref={listRef} className="grid grid-cols-[minmax(0,1fr)] gap-1">
      {drill.lines.map((line, i) =>
        line.alternatives.length === 1 ? (
          item(i, 0)
        ) : (
          <div
            key={i}
            data-group
            className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-0.5 rounded-lg border border-dashed border-ring p-1"
          >
            <div
              draggable
              onDragStart={(event) => startDrag(event, { line: i })}
              onDragEnd={endDrag}
              {...dropHandlers({ line: i, alt: 0 })}
              className="flex cursor-grab items-center gap-1.5 pr-1 pl-1.5 text-xs text-muted-foreground"
            >
              <Shuffle aria-hidden="true" className="size-3" />
              <span className="flex-1">One of these, at random</span>
              <Button
                variant="ghost"
                size="icon-xs"
                data-group-move={-1}
                aria-label={`Move ball ${i + 1} up`}
                disabled={i === 0}
                onClick={() => moveGroup(i, -1)}
              >
                <ArrowUp aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                data-group-move={1}
                aria-label={`Move ball ${i + 1} down`}
                disabled={i === drill.lines.length - 1}
                onClick={() => moveGroup(i, 1)}
              >
                <ArrowDown aria-hidden="true" />
              </Button>
            </div>
            {line.alternatives.map((_, j) => item(i, j))}
          </div>
        ),
      )}
    </div>
  );
}
