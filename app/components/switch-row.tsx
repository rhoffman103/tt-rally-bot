import { useId } from 'react';

import { Switch } from '~/components/ui/switch';
import { cn } from '~/lib/utils';

type SwitchRowProps = {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange(checked: boolean): void;
  disabled?: boolean;
  className?: string;
};

/** A setting that is on or off: its name and what it does, with a switch at the end. */
export function SwitchRow({
  title,
  description,
  checked,
  onCheckedChange,
  disabled,
  className,
}: SwitchRowProps) {
  const id = useId();
  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      <div>
        <b id={`${id}-title`} className="block font-medium">
          {title}
        </b>
        <small id={`${id}-description`} className="block text-[13px] text-muted-foreground">
          {description}
        </small>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
      />
    </div>
  );
}
