import { useId, type ReactNode } from 'react';

import { cn } from '~/lib/utils';

type CardSectionProps = {
  title: string;
  count: number;
  /** Shown instead of the cards when there are none. */
  empty: string;
  /** The grid's columns. */
  gridClassName: string;
  children: ReactNode;
};

/** A titled group of cards with how many there are, like "My drills 3". */
export function CardSection({ title, count, empty, gridClassName, children }: CardSectionProps) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <div className="mb-3 flex items-center gap-2">
        <h2 id={id} className="text-[15px] font-semibold">
          {title}
        </h2>
        <span className="text-[13px] text-muted-foreground">{count}</span>
      </div>
      {count > 0 ? (
        <div className={cn('grid gap-4 max-wide:gap-3', gridClassName)}>{children}</div>
      ) : (
        <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
          {empty}
        </p>
      )}
    </section>
  );
}
