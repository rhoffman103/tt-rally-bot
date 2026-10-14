import { CircleAlert } from 'lucide-react';
import { Link } from 'react-router';

import { buttonVariants } from '~/components/ui/button';
import { Card } from '~/components/ui/card';

/** Shown instead of the import screen when the link or QR code can't be read. */
export function BadShareCode({ error }: { error: string }) {
  return (
    <div className="mx-auto max-w-[780px]">
      <Card className="grid justify-items-center gap-3 px-6 py-12 text-center">
        <div className="grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
          <CircleAlert aria-hidden="true" className="size-[22px]" />
        </div>
        <h1 className="text-[22px] font-semibold">We can’t read this drill</h1>
        <p className="max-w-[46ch] text-muted-foreground">{error}</p>
        <Link to="/" className={buttonVariants({ size: 'lg', className: 'px-4' })}>
          Go to drills
        </Link>
      </Card>
    </div>
  );
}
