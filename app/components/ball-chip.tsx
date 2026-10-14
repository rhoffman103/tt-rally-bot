import { cn } from '~/lib/utils';

type BallChipProps = {
  label: string;
  /** In a random line: a dashed ring. */
  random: boolean;
  invalid?: boolean;
};

/** The ball's number in an orange dot, as on the table. Red when the ball has an error. */
export function BallChip({ label, random, invalid }: BallChipProps) {
  return (
    <span
      className={cn(
        'inline-grid h-[22px] min-w-[22px] flex-none place-items-center rounded-full px-[5px] text-[11px] font-semibold text-white',
        invalid ? 'bg-destructive' : 'bg-ball',
        random && 'outline-[1.5px] outline-offset-2 outline-ball outline-dashed',
      )}
    >
      {label}
      {invalid && <span className="sr-only"> (has an error)</span>}
    </span>
  );
}
