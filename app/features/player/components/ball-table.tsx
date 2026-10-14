import { Shuffle } from 'lucide-react';
import { Fragment } from 'react';

import { ballLabel } from '~/lib/drills/describe';
import { describeLanding } from '~/lib/drills/landing';
import { fromRpm, type SpeedSpinMapping } from '~/lib/drills/speed-spin';
import type { Ball, DrillLine } from '~/lib/drills/types';
import { cn } from '~/lib/utils';

type BallTableProps = {
  lines: DrillLine[];
  speedSpin: SpeedSpinMapping;
  /** The line the robot is shooting. */
  currentLine: number | null;
};

const spinText = (spin: number) =>
  spin === 0 ? 'None' : spin > 0 ? `Top ${spin}` : `Back ${-spin}`;

const cell = 'border-t px-3 py-[9px] whitespace-nowrap first:pl-5';
const number = 'font-mono text-[12.5px]';

/** Every ball in play order: where it lands, speed, spin and how many times in a row. */
export function BallTable({ lines, speedSpin, currentLine }: BallTableProps) {
  const row = (line: DrillLine, i: number, ball: Ball, j: number) => {
    const random = line.alternatives.length > 1;
    const { speed, spin } = fromRpm(ball, speedSpin);
    return (
      <tr
        key={`${i}-${j}`}
        aria-current={i === currentLine ? 'step' : undefined}
        className={cn(
          random && '[&>td]:border-t-0 [&>td]:bg-muted/50',
          i === currentLine && '[&>td]:bg-ball/14',
        )}
      >
        <td className={cell}>
          <span
            className={cn(
              'inline-grid h-[22px] min-w-[22px] place-items-center rounded-full bg-ball px-[5px] text-[11px] font-semibold text-white',
              random && 'outline-[1.5px] outline-offset-2 outline-ball outline-dashed',
            )}
          >
            {ballLabel(line, i, j)}
          </span>
        </td>
        <td className={cell}>{describeLanding(ball)}</td>
        <td className={cn(cell, number)}>{speed}</td>
        <td className={cn(cell, number)}>{spinText(spin)}</td>
        <td className={cn(cell, number)}>{ball.repetitions > 1 ? `×${ball.repetitions}` : '—'}</td>
      </tr>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13.5px]">
        <thead>
          <tr>
            {['#', 'Where', 'Speed', 'Spin', 'Repeat'].map((title) => (
              <th
                key={title}
                className="border-t px-3 py-2 text-left text-[12.5px] font-medium text-muted-foreground first:pl-5"
              >
                {title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <Fragment key={i}>
              {line.alternatives.length > 1 && (
                <tr>
                  <td
                    colSpan={5}
                    className="border-t px-5 pt-2.5 pb-1 text-xs text-muted-foreground"
                  >
                    <Shuffle aria-hidden="true" className="mr-1 inline size-3 align-[-2px]" />
                    Ball {i + 1} is one of these, picked at random
                  </td>
                </tr>
              )}
              {line.alternatives.map((ball, j) => row(line, i, ball, j))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
