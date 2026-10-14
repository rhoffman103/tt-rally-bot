import { Copy, Star, Trash2 } from 'lucide-react';
import { Link } from 'react-router';

import { DrillBadges } from '~/components/drill-badges';
import { TableDiagram } from '~/components/table-diagram';
import { Button } from '~/components/ui/button';
import { durationText } from '~/lib/drills/describe';
import type { Drill } from '~/lib/drills/types';
import { DeleteDrillButton } from '~/features/player/components/delete-drill-button';
import { useFavorite } from '~/features/player/hooks/use-favorite';
import { editedText } from '~/features/player/utils/edited-text';

type DrillCardProps = {
  drill: Drill;
  live: 'playing' | 'paused' | null;
  /** Starred as a favorite. The card's star button changes it. */
  favorite: boolean;
  /** Shown on presets: saves a copy in My drills. */
  onDuplicate?: () => void;
  duplicating?: boolean;
  /** Shown on custom drills: deletes the drill after asking. Off while the drill plays. */
  onDelete?: () => void;
  deleting?: boolean;
};

export function DrillCard({
  drill,
  live,
  favorite,
  onDuplicate,
  duplicating,
  onDelete,
  deleting,
}: DrillCardProps) {
  const star = useFavorite(drill.id, favorite);
  const count = drill.lines.length;
  const meta = [`${count} ${count === 1 ? 'ball' : 'balls'}`, durationText(drill.duration)];
  if (drill.source === 'custom') meta.push(editedText(drill.updatedAt));

  return (
    <div className="relative flex flex-col overflow-hidden rounded-xl border bg-card transition-[border-color,box-shadow] hover:border-ring hover:shadow-md has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/50">
      <div className="bg-muted p-3">
        <TableDiagram lines={drill.lines} orientation="landscape" numbers={false} />
      </div>
      <div className="flex flex-1 flex-col gap-1 px-3.5 pt-3 pb-3.5">
        {/* The link covers the whole card. */}
        <Link
          to={`/drills/${drill.id}`}
          className="text-[15px] font-semibold outline-none after:absolute after:inset-0"
        >
          {drill.name}
        </Link>
        <div className="text-[13px] text-muted-foreground">{meta.join(' · ')}</div>
        <DrillBadges
          drill={drill}
          showSource={false}
          showDuration={false}
          live={live}
          className="mt-1.5 max-wide:[&>*:nth-child(n+2)]:hidden"
        />
      </div>
      <div className="absolute top-2 right-2 flex gap-1.5">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={`Favorite ${drill.name}`}
          aria-pressed={star.favorite}
          title={star.favorite ? 'Remove from Favorites' : 'Add to Favorites'}
          onClick={star.toggle}
        >
          <Star aria-hidden="true" className={star.favorite ? 'fill-warn text-warn' : undefined} />
        </Button>
        {onDuplicate && (
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={`Make a copy of ${drill.name} in My drills`}
            title="Make a copy in My drills"
            disabled={duplicating}
            onClick={onDuplicate}
          >
            <Copy aria-hidden="true" />
          </Button>
        )}
        {onDelete && (
          <DeleteDrillButton
            name={drill.name}
            trigger={
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={`Delete ${drill.name}`}
                title="Delete"
                disabled={deleting || live !== null}
              />
            }
            onDelete={onDelete}
          >
            <Trash2 aria-hidden="true" />
          </DeleteDrillButton>
        )}
      </div>
    </div>
  );
}
