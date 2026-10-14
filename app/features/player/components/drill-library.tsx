import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { CardSection } from '~/components/card-section';
import { SearchField } from '~/components/search-field';
import { buttonVariants } from '~/components/ui/button';
import { useRobot } from '~/hooks/use-robot';
import type { Drill } from '~/lib/drills/types';
import { ConnectBanner } from '~/features/player/components/connect-banner';
import { DrillCard } from '~/features/player/components/drill-card';
import { Segmented } from '~/features/player/components/segmented';
import { useDeleteDrill } from '~/features/player/hooks/use-delete-drill';
import { useDuplicateDrill } from '~/features/player/hooks/use-duplicate-drill';

type Filter = 'all' | 'favorites' | 'mine' | 'presets';

const grid =
  'grid-cols-[repeat(auto-fill,minmax(230px,1fr))] max-wide:grid-cols-[repeat(auto-fill,minmax(160px,1fr))]';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'favorites', label: 'Favorites' },
  { value: 'mine', label: 'My drills' },
  { value: 'presets', label: 'Presets' },
];

type DrillLibraryProps = {
  drills: Drill[];
  /** The ids of the drills starred as favorites. */
  favorites: string[];
};

/** The drill library: search, a filter, and the custom and preset drills in two sections, or the favorites. */
export function DrillLibrary({ drills, favorites }: DrillLibraryProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const { status, progress } = useRobot();
  const { duplicate, pending } = useDuplicateDrill();
  const { remove, pending: deleting } = useDeleteDrill();

  const search = query.trim().toLowerCase();
  const matches = drills.filter((d) => !search || d.name.toLowerCase().includes(search));
  const mine = matches.filter((d) => d.source === 'custom');
  const presets = matches.filter((d) => d.source === 'preset');
  const starred = new Set(favorites);
  const favoriteDrills = matches.filter((d) => starred.has(d.id));
  const running = status === 'playing' || status === 'paused';
  const liveFor = (drill: Drill) => (running && progress?.drillId === drill.id ? status : null);

  const emptyMine = search
    ? 'No drills match your search.'
    : 'You have no drills of your own yet. Build one with New drill, or copy a preset.';
  const emptyFavorites = search
    ? 'No drills match your search.'
    : 'You have no favorites yet. Tap the star on a drill to add it here.';
  const cards = (list: Drill[]) =>
    list.map((drill) => (
      <DrillCard
        key={drill.id}
        drill={drill}
        live={liveFor(drill)}
        favorite={starred.has(drill.id)}
        onDuplicate={drill.source === 'preset' ? () => duplicate(drill.id) : undefined}
        duplicating={pending}
        onDelete={drill.source === 'custom' ? () => remove(drill.id) : undefined}
        deleting={deleting}
      />
    ));

  return (
    <>
      <ConnectBanner />
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px]/[1.2] font-semibold tracking-[-0.02em] max-wide:text-[22px]">
            Drills
          </h1>
          <p className="mt-1 text-muted-foreground">Pick a drill to play it, or build your own.</p>
        </div>
        <Link
          to="/builder/new"
          aria-label="New drill"
          className={buttonVariants({ size: 'lg', className: 'px-3.5 max-wide:px-2.5' })}
        >
          <Plus aria-hidden="true" />
          <span className="max-wide:hidden">New drill</span>
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <SearchField
          label="Search drills"
          value={query}
          onChange={setQuery}
          className="max-w-[360px] min-w-[200px] flex-1"
        />
        <Segmented<Filter> label="Show" options={FILTERS} value={filter} onChange={setFilter} />
      </div>

      <div className="grid gap-8">
        {filter === 'favorites' && (
          <CardSection
            title="Favorites"
            count={favoriteDrills.length}
            empty={emptyFavorites}
            gridClassName={grid}
          >
            {cards(favoriteDrills)}
          </CardSection>
        )}
        {(filter === 'all' || filter === 'mine') && (
          <CardSection title="My drills" count={mine.length} empty={emptyMine} gridClassName={grid}>
            {cards(mine)}
          </CardSection>
        )}
        {(filter === 'all' || filter === 'presets') && (
          <CardSection
            title="Presets"
            count={presets.length}
            empty="No drills match your search."
            gridClassName={grid}
          >
            {cards(presets)}
          </CardSection>
        )}
      </div>
    </>
  );
}
