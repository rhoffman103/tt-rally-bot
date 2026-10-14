import { Download, Upload } from 'lucide-react';
import { useRef, type ChangeEvent, type ReactNode } from 'react';
import { toast } from 'sonner';

import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { drillsToJson, readDrillFile, type DrillDraft } from '~/lib/drills/storage';
import { printDrillText } from '~/lib/drills/text-format';
import { fileName } from '~/features/builder/utils/file-name';
import { downloadFile } from '~/utils/download-file';

type BuilderHeaderProps = {
  drill: DrillDraft;
  dirty: boolean;
  saving: boolean;
  onRename(name: string): void;
  /** Replaces the drill's balls with the ones from a file. Nothing is saved until Save. */
  onLoad(drill: DrillDraft): void;
  onSave(): void;
  /** The Share button, from the sharing feature. Goes before Save. */
  share?: ReactNode;
};

const action = 'px-3.5 max-wide:px-2.5';

/** The drill's name, whether it is saved, and Import, Export, Share and Save. */
export function BuilderHeader({
  drill,
  dirty,
  saving,
  onRename,
  onLoad,
  onSave,
  share,
}: BuilderHeaderProps) {
  const fileInput = useRef<HTMLInputElement>(null);

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = ''; // so picking the same file again still imports it
    if (!file) return;
    const result = readDrillFile(file.name, await file.text());
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const [first] = result.drills;
    onLoad(first);
    const more =
      result.drills.length > 1
        ? ` The file has ${result.drills.length} drills; this is the first.`
        : '';
    toast.success(`Loaded “${first.name}”. Save to keep it.${more}`);
  };

  const exportAs = (format: 'json' | 'txt') => {
    const name = fileName(drill.name, format);
    const text =
      format === 'json'
        ? drillsToJson([
            { ...drill, id: drill.id ?? '', source: 'custom', updatedAt: new Date().toISOString() },
          ])
        : printDrillText(drill);
    downloadFile(name, text, format === 'json' ? 'application/json' : 'text/plain');
    toast.success(`Downloaded ${name}`);
  };

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <input
        value={drill.name}
        onChange={(e) => onRename(e.target.value)}
        aria-label="Drill name"
        placeholder="Untitled drill"
        maxLength={80}
        className="-ml-2.5 h-11 min-w-[200px] flex-1 rounded-md border border-transparent bg-transparent px-2.5 text-2xl font-semibold tracking-[-0.02em] outline-none hover:border-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 max-wide:text-[22px]"
      />
      <span role="status" className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
        {dirty && <i aria-hidden="true" className="size-[7px] rounded-full bg-warn" />}
        {saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'Saved'}
      </span>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="ghost"
          size="lg"
          className={action}
          aria-label="Import"
          onClick={() => fileInput.current?.click()}
        >
          <Upload aria-hidden="true" />
          <span className="max-wide:hidden">Import</span>
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,.txt,application/json,text/plain"
          className="hidden"
          onChange={(event) => void importFile(event)}
        />
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Export"
            render={<Button variant="outline" size="lg" className={action} />}
          >
            <Download aria-hidden="true" />
            <span className="max-wide:hidden">Export</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto">
            <DropdownMenuItem onClick={() => exportAs('json')}>
              TT Rally Bot file (.json)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportAs('txt')}>Plain text (.txt)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {share}
        <Button size="lg" className="px-4" disabled={saving} onClick={onSave}>
          Save
        </Button>
      </div>
    </div>
  );
}
