import { useId } from 'react';

import { Label } from '~/components/ui/label';
import { Slider } from '~/components/ui/slider';
import { formatSigned } from '~/utils/format';

type SliderFieldProps = {
  label: string;
  value: number;
  limits: { min: number; max: number; step: number };
  /** Words under the slider, spread from end to end: ['Slow', 'Fast']. */
  scale: string[];
  /** Shown in red under the slider. */
  error?: string;
  onChange(value: number): void;
};

/** A labelled slider with its value at the right and a scale underneath. */
export function SliderField({ label, value, limits, scale, error, onChange }: SliderFieldProps) {
  const id = useId();
  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-baseline justify-between">
        <Label id={id}>{label}</Label>
        <output className="font-mono text-[13px]">{formatSigned(value)}</output>
      </div>
      <Slider
        aria-labelledby={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        value={[value]}
        {...limits}
        onValueChange={(next) => onChange(Array.isArray(next) ? next[0] : next)}
      />
      <div className="mt-0.5 flex justify-between text-[11.5px] text-muted-foreground">
        {scale.map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
