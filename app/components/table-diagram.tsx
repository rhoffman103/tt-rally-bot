// The table seen from above, with a marker where each ball lands. Used by the player, the builder and import.
import { useRef, type PointerEvent } from 'react';

import { ballLabel } from '~/lib/drills/describe';
import { describeLanding, heightForDepth, landingDepth } from '~/lib/drills/landing';
import type { Ball, DrillLine } from '~/lib/drills/types';
import { BALL_LIMITS } from '~/lib/robot/protocol';
import { cn } from '~/lib/utils';

/** One ball in a drill: its line, and which of the line's random balls. */
export type BallRef = { line: number; alt: number };
/** The ball the robot is shooting. Without `alt`, every ball of the line: the robot reports only the line. */
export type CurrentBall = { line: number; alt?: number };
export type DropSpot = Pick<Ball, 'dropPoint' | 'height'>;

type TableDiagramProps = {
  lines: DrillLine[];
  /** Portrait puts the robot at the top. Landscape turns the table so the robot is on the left. */
  orientation?: 'portrait' | 'landscape';
  /** Numbers on the markers. Turn them off for small pictures. */
  numbers?: boolean;
  /** The ball the robot is shooting. It pulses and the other balls fade. */
  current?: CurrentBall | null;
  /** The ball being edited. It gets a ring. */
  selected?: BallRef | null;
  /** Balls to draw in red, for example ones outside the wheel speed limits. */
  isInvalid?: (ball: Ball) => boolean;
  /** Edit mode. Called when a marker is pressed. */
  onSelect?: (ball: BallRef) => void;
  /** Edit mode. Called while a click or drag moves a ball: the pressed marker, or else the selected ball. */
  onPlace?: (ball: BallRef, spot: DropSpot) => void;
  className?: string;
};

// Drawn in portrait in a 180 × 300 box. Landscape swaps the axes.
const WIDTH = 180;
const HEIGHT = 300;
const CENTRE_X = 90;
const NET_Y = 150;
const LANDING_TOP = 152; // the player's half, from just past the net…
const LANDING_DEPTH = 126; // …to just before the end line
const DROP_SCALE = 66; // x distance from the centre line to drop point ±10
const ROBOT = { x: 90, y: 20 }; // where the ball paths start

const r1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const sameBall = (a: BallRef | null | undefined, b: BallRef) =>
  a?.line === b.line && a.alt === b.alt;
const isShooting = (current: CurrentBall | null, b: BallRef) =>
  current?.line === b.line && (current.alt === undefined || current.alt === b.alt);

type Marker = BallRef & { ball: Ball; label: string; random: boolean; x: number; y: number };

export function TableDiagram({
  lines,
  orientation = 'portrait',
  numbers = true,
  current = null,
  selected = null,
  isInvalid,
  onSelect,
  onPlace,
  className,
}: TableDiagramProps) {
  const landscape = orientation === 'landscape';
  // Portrait (x, y) → screen point in the viewBox.
  const place = (x: number, y: number): [number, number] =>
    landscape ? [r1(y), r1(WIDTH - x)] : [r1(x), r1(y)];
  const rect = (x1: number, y1: number, x2: number, y2: number) => {
    const [ax, ay] = place(x1, y1);
    const [bx, by] = place(x2, y2);
    return {
      x: Math.min(ax, bx),
      y: Math.min(ay, by),
      width: Math.abs(bx - ax),
      height: Math.abs(by - ay),
    };
  };
  const line = (x1: number, y1: number, x2: number, y2: number) => {
    const [ax, ay] = place(x1, y1);
    const [bx, by] = place(x2, y2);
    return { x1: ax, y1: ay, x2: bx, y2: by };
  };

  const markers: Marker[] = lines.flatMap((drillLine, i) =>
    drillLine.alternatives.map((ball, j) => {
      const [x, y] = place(
        CENTRE_X + (ball.dropPoint / 10) * DROP_SCALE,
        LANDING_TOP + landingDepth(ball) * LANDING_DEPTH,
      );
      const random = drillLine.alternatives.length > 1;
      return { line: i, alt: j, ball, label: ballLabel(drillLine, i, j), random, x, y };
    }),
  );
  const [robotX, robotY] = place(ROBOT.x, ROBOT.y);

  // ---------- Edit mode ----------
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<BallRef | null>(null);

  function spotAt(event: PointerEvent, ball: Ball): DropSpot | null {
    const matrix = svgRef.current?.getScreenCTM()?.inverse();
    if (!matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix);
    const [x, y] = landscape ? [WIDTH - point.y, point.x] : [point.x, point.y];
    const { min, max, step } = BALL_LIMITS.dropPoint;
    const dropPoint = clamp(
      Math.round((((x - CENTRE_X) / DROP_SCALE) * 10) / step) * step,
      min,
      max,
    );
    // On the robot's half only the side changes.
    const height =
      y > NET_Y
        ? heightForDepth(clamp((y - LANDING_TOP) / LANDING_DEPTH, 0, 1), ball)
        : ball.height;
    return { dropPoint: dropPoint + 0, height };
  }

  function placeAt(event: PointerEvent, ref: BallRef) {
    const ball = lines[ref.line]?.alternatives[ref.alt];
    const spot = ball && spotAt(event, ball);
    if (spot) onPlace?.(ref, spot);
  }

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    if (!onPlace || event.button !== 0) return;
    const marker = (event.target as Element).closest<SVGGElement>('[data-line]');
    let ref = selected;
    if (marker) {
      ref = { line: Number(marker.dataset.line), alt: Number(marker.dataset.alt) };
      onSelect?.(ref);
    }
    if (!ref) return;
    dragging.current = ref;
    event.currentTarget.setPointerCapture(event.pointerId);
    placeAt(event, ref);
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (dragging.current) placeAt(event, dragging.current);
  }

  function handlePointerUp() {
    dragging.current = null;
  }

  return (
    <svg
      ref={svgRef}
      viewBox={landscape ? `0 0 ${HEIGHT} ${WIDTH}` : `0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={tableLabel(markers, current)}
      className={cn(
        'block h-auto w-full',
        onPlace && 'cursor-crosshair touch-none select-none',
        className,
      )}
      onPointerDown={onPlace && handlePointerDown}
      onPointerMove={onPlace && handlePointerMove}
      onPointerUp={onPlace && handlePointerUp}
      onPointerCancel={onPlace && handlePointerUp}
    >
      <rect {...rect(15, 15, 165, 285)} rx={3} className="fill-table" />
      <rect {...rect(15, 15, 165, 150)} className="fill-table-far" />
      <rect {...rect(15, 15, 165, 285)} rx={3} className="fill-none stroke-table-line stroke-2" />
      <line {...line(90, 15, 90, 285)} className="stroke-table-line stroke-[0.8] opacity-60" />
      <line
        {...line(8, NET_Y, 172, NET_Y)}
        strokeLinecap="round"
        className="stroke-net stroke-[3.5]"
      />
      <rect {...rect(76, 2, 104, 20)} rx={5} className="fill-muted-foreground" />
      {markers.map((m) => (
        <line
          key={`path-${m.line}-${m.alt}`}
          x1={robotX}
          y1={robotY}
          x2={m.x}
          y2={m.y}
          strokeDasharray="3 3"
          className="stroke-table-line stroke-1 opacity-40"
        />
      ))}
      {markers.map((m) => {
        const isCurrent = isShooting(current, m);
        return (
          <g
            key={`ball-${m.line}-${m.alt}`}
            data-line={m.line}
            data-alt={m.alt}
            className={cn(onPlace && 'cursor-grab', current && !isCurrent && 'opacity-40')}
          >
            {isCurrent && (
              <circle
                cx={m.x}
                cy={m.y}
                r={10}
                className="origin-center animate-ball-pulse fill-ball [transform-box:fill-box] motion-reduce:hidden"
              />
            )}
            {sameBall(selected, m) && (
              <circle
                cx={m.x}
                cy={m.y}
                r={15}
                className="fill-none stroke-table-line stroke-[2.5]"
              />
            )}
            <circle
              cx={m.x}
              cy={m.y}
              r={numbers ? 10 : 8.5}
              // A random line's balls have a dashed edge.
              strokeDasharray={m.random ? '2.6 2' : undefined}
              className={cn(
                isInvalid?.(m.ball) ? 'fill-destructive' : 'fill-ball',
                m.random ? 'stroke-table-line stroke-[1.5]' : 'stroke-table stroke-2',
              )}
            />
            {numbers && (
              <text
                x={m.x}
                y={m.y}
                dy="0.35em"
                textAnchor="middle"
                className="pointer-events-none fill-white text-[8.5px] font-semibold"
              >
                {m.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** For screen readers: every ball's landing spot, which balls are random, and the ball being shot. */
function tableLabel(markers: Marker[], current: CurrentBall | null): string {
  if (markers.length === 0) return 'Table seen from above, with no balls yet.';
  const count = `${markers.length} ${markers.length === 1 ? 'ball' : 'balls'}`;
  const spots = markers.map((m) => `${m.label}: ${describeLanding(m.ball).toLowerCase()}`);
  let label = `Table seen from above, with ${count}. ${spots.join('; ')}.`;
  if (markers.some((m) => m.random))
    label += ' Balls with a letter share a line: the robot picks one of them at random.';
  const shooting = markers.filter((m) => isShooting(current, m));
  if (shooting.length === 1) label += ` Now shooting ball ${shooting[0].label}.`;
  else if (shooting.length > 1)
    label += ` Now shooting one of balls ${shooting.map((m) => m.label).join(', ')}.`;
  return label;
}
