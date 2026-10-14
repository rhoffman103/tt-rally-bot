import { useId, useState, type ComponentProps } from 'react';

import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';

type NumberFieldProps = Pick<ComponentProps<'input'>, 'min' | 'max' | 'step'> & {
  label: string;
  value: number;
  unit?: string;
  /** Shown in red under the field. */
  error?: string;
  /** Called with the new number when the field loses focus or Enter is pressed. Not called for empty text. */
  onCommit(value: number): void;
};

/** A number input with its unit inside, which saves when you leave it. */
export function NumberField({
  label,
  value,
  unit = 'rpm',
  error,
  onCommit,
  ...range
}: NumberFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const number = Number(draft);
    if (draft.trim() !== '' && Number.isFinite(number) && number !== value) onCommit(number);
    setDraft(null);
  };

  return (
    <div>
      <Label htmlFor={id} className="mb-1.5 text-[13px]">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          className="h-9 pr-10 font-mono"
          value={draft ?? String(value)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          {...range}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[12.5px] text-muted-foreground"
        >
          {unit}
        </span>
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
