import { cn } from '~/lib/utils';

type SegmentedProps<T extends string> = {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange(value: T): void;
  disabled?: boolean;
  /** Fill the width, with equal parts. */
  full?: boolean;
};

/** A row of buttons where one is on, like the mockup's `.seg`. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
  full,
}: SegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('gap-0.5 rounded-lg bg-muted p-[3px]', full ? 'flex' : 'inline-flex')}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className="h-[30px] flex-1 rounded-md px-3 text-[13px] font-medium whitespace-nowrap text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-xs"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
