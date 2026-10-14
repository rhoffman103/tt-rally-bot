// The small labels about a drill: preset or mine, how long it runs, random order or balls, and playing.
import { Shuffle } from 'lucide-react';

import { Badge } from '~/components/ui/badge';
import { durationText, hasRandomLine } from '~/lib/drills/describe';
import type { Drill } from '~/lib/drills/types';
import { cn } from '~/lib/utils';

type DrillBadgesProps = {
  drill: Pick<Drill, 'source' | 'duration' | 'randomOrder' | 'lines'>;
  /** The "Preset" or "My drill" badge. */
  showSource?: boolean;
  showDuration?: boolean;
  /** Set when the robot is playing this drill. */
  live?: 'playing' | 'paused' | null;
  className?: string;
};

export function DrillBadges({
  drill,
  showSource = true,
  showDuration = true,
  live = null,
  className,
}: DrillBadgesProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {showSource && (
        <Badge variant="outline">{drill.source === 'preset' ? 'Preset' : 'My drill'}</Badge>
      )}
      {live && (
        <Badge className="bg-ball/16 text-[color-mix(in_oklch,var(--ball)_70%,var(--foreground))]">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-ball" />
          {live === 'paused' ? 'Paused' : 'Playing'}
        </Badge>
      )}
      {showDuration && <Badge variant="outline">{durationText(drill.duration)}</Badge>}
      {drill.randomOrder && (
        <Badge variant="outline">
          <Shuffle aria-hidden="true" />
          Random order
        </Badge>
      )}
      {hasRandomLine(drill) && (
        <Badge variant="outline">
          <Shuffle aria-hidden="true" />
          Random ball
        </Badge>
      )}
    </div>
  );
}
