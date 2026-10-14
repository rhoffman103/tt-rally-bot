import { Check, Plus } from 'lucide-react';
import { useState } from 'react';

import { SearchField } from '~/components/search-field';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';
import { durationText } from '~/lib/drills/describe';
import type { Drill } from '~/lib/drills/types';
import { cn } from '~/lib/utils';

type DrillPickerProps = {
  drills: Drill[];
  /** The stage the drills go into, for the dialog's title. */
  stageName: string;
  /** The picked drills' ids, in the order they were picked. */
  onAdd(drillIds: string[]): void;
};

// On phones the dialog sits at the bottom of the screen, like the share dialog.
const sheet =
  'max-[35rem]:top-auto max-[35rem]:bottom-0 max-[35rem]:max-w-none max-[35rem]:translate-y-0 max-[35rem]:rounded-b-none';

/** "Add drills" and its dialog: search the drills, pick some, and add them to the end of a stage. */
export function DrillPicker({ drills, stageName, onAdd }: DrillPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string[]>([]);

  const search = query.trim().toLowerCase();
  const matches = drills.filter((d) => !search || d.name.toLowerCase().includes(search));
  const groups = [
    { title: 'My drills', list: matches.filter((d) => d.source === 'custom') },
    { title: 'Presets', list: matches.filter((d) => d.source === 'preset') },
  ].filter((group) => group.list.length > 0);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setQuery('');
      setPicked([]);
    }
  };
  const toggle = (id: string) =>
    setPicked((now) => (now.includes(id) ? now.filter((p) => p !== id) : [...now, id]));
  const add = () => {
    onAdd(picked);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Plus aria-hidden="true" />
        Add drills
      </DialogTrigger>
      <DialogContent className={`gap-0 bg-background p-6 sm:max-w-[480px] ${sheet}`}>
        <DialogHeader className="gap-1.5 pr-6">
          <DialogTitle className="text-lg/snug font-semibold">
            Add drills to “{stageName}”
          </DialogTitle>
          <DialogDescription className="text-sm">
            Pick one or more drills. They go at the end of the stage, in the order you pick them.
          </DialogDescription>
        </DialogHeader>

        <SearchField
          label="Search drills"
          value={query}
          onChange={setQuery}
          className="mt-4 mb-3"
        />

        <div className="-mx-2 max-h-[min(400px,50svh)] overflow-y-auto px-2">
          {groups.length === 0 && (
            <p className="py-6 text-center text-muted-foreground">No drills match your search.</p>
          )}
          {groups.map((group) => (
            <div key={group.title} className="mb-3">
              <h3 className="mb-1 text-[13px] font-medium text-muted-foreground">{group.title}</h3>
              <ul className="grid gap-0.5">
                {group.list.map((drill) => {
                  const order = picked.indexOf(drill.id);
                  const on = order !== -1;
                  return (
                    <li key={drill.id}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggle(drill.id)}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-md border border-transparent px-2 py-2 text-left outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50',
                          on && 'border-ring bg-accent',
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            'grid size-5 flex-none place-items-center rounded-full border text-[11px] font-semibold',
                            on && 'border-primary bg-primary text-primary-foreground',
                          )}
                        >
                          {on ? order + 1 : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{drill.name}</span>
                          <span className="block text-[13px] text-muted-foreground">
                            {drill.lines.length} {drill.lines.length === 1 ? 'ball' : 'balls'} ·{' '}
                            {durationText(drill.duration)}
                          </span>
                        </span>
                        {on && <Check aria-hidden="true" className="size-4 flex-none" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <DialogFooter className="-mx-6 mt-4 -mb-6 px-6">
          <Button size="lg" disabled={picked.length === 0} onClick={add}>
            {picked.length === 0
              ? 'Add drills'
              : `Add ${picked.length} ${picked.length === 1 ? 'drill' : 'drills'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
