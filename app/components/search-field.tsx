import { Search } from 'lucide-react';

import { Input } from '~/components/ui/input';
import { cn } from '~/lib/utils';

type SearchFieldProps = {
  /** The placeholder and the field's accessible name, for example "Search drills". */
  label: string;
  value: string;
  onChange(value: string): void;
  className?: string;
};

/** A search box with a magnifier icon. */
export function SearchField({ label, value, onChange, className }: SearchFieldProps) {
  return (
    <label className={cn('relative block', className)}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        placeholder={label}
        aria-label={label}
        className="h-9 pl-[34px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
