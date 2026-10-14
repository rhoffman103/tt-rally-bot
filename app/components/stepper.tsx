import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '~/components/ui/button';

type StepperProps = {
  /** What the number is, for screen readers: "Minutes". */
  label: string;
  value: number;
  /** Shown after the field: "minutes", "sets", "s". */
  unit: string;
  min: number;
  max: number;
  /** How much − and + change the number. Defaults to 1. */
  step?: number;
  disabled?: boolean;
  onChange(value: number): void;
};

/** A number with − and + buttons. Typed numbers count when the field loses focus or Enter is pressed. */
export function Stepper({
  label,
  value,
  unit,
  min,
  max,
  step = 1,
  disabled,
  onChange,
}: StepperProps) {
  const [typed, setTyped] = useState<string | null>(null);

  const commitTyped = () => {
    if (typed === null) return;
    const number = Number(typed);
    if (typed.trim() !== '' && Number.isFinite(number)) onChange(number);
    setTyped(null);
  };

  return (
    <div className="inline-flex items-center gap-1.5">
      <Button
        variant="outline"
        size="icon"
        aria-label={`${label}: less`}
        disabled={disabled || value <= min}
        onClick={() => onChange(value - step)}
      >
        <Minus aria-hidden="true" />
      </Button>
      <input
        type="number"
        inputMode={Number.isInteger(step) ? 'numeric' : 'decimal'}
        aria-label={label}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={typed ?? String(value)}
        onChange={(e) => setTyped(e.target.value)}
        onBlur={commitTyped}
        onKeyDown={(e) => e.key === 'Enter' && commitTyped()}
        className="h-8 w-[58px] [appearance:textfield] rounded-lg border border-input bg-transparent text-center font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 [&::-webkit-inner-spin-button]:appearance-none"
      />
      <Button
        variant="outline"
        size="icon"
        aria-label={`${label}: more`}
        disabled={disabled || value >= max}
        onClick={() => onChange(value + step)}
      >
        <Plus aria-hidden="true" />
      </Button>
      <span className="text-[13px] text-muted-foreground">{unit}</span>
    </div>
  );
}
