import { Download, Upload } from 'lucide-react';
import { useEffect, useRef, type ChangeEvent } from 'react';
import { useFetcher } from 'react-router';
import { toast } from 'sonner';

import { Button } from '~/components/ui/button';
import { exportDrills, type ImportResult } from '~/lib/drills/storage';
import { SettingsCard } from '~/features/settings/components/settings-card';
import type { SettingsAction } from '~/features/settings/types/settings-action';
import { downloadFile } from '~/utils/download-file';

const EXPORT_FILE = 'tt-rally-bot-drills.json';

/** Export every custom drill to a file, or import drills from a file. */
export function DrillsCard({ myDrillCount }: { myDrillCount: number }) {
  const fetcher = useFetcher<ImportResult>();
  const fileInput = useRef<HTMLInputElement>(null);

  const result = fetcher.data;
  useEffect(() => {
    if (!result) return;
    if (!result.ok) toast.error(result.error);
    else if (result.drills.length === 1) toast.success(`Imported “${result.drills[0].name}”`);
    else toast.success(`Imported ${result.drills.length} drills`);
  }, [result]);

  const exportAll = async () => {
    if (myDrillCount === 0) {
      toast.info('You have no drills of your own to export yet.');
      return;
    }
    downloadFile(EXPORT_FILE, await exportDrills(), 'application/json');
    toast.success(`Downloaded ${EXPORT_FILE}`);
  };

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = ''; // so picking the same file again still imports it
    if (!file) return;
    const action: SettingsAction = {
      intent: 'import-drills',
      fileName: file.name,
      text: await file.text(),
    };
    void fetcher.submit(action, { method: 'post', encType: 'application/json' });
  };

  return (
    <SettingsCard
      title="Your drills"
      description="Your drills are saved in this browser. Back them up, or move them to another browser."
    >
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="lg" onClick={() => void exportAll()}>
          <Download aria-hidden="true" />
          Export all
        </Button>
        <Button
          variant="outline"
          size="lg"
          disabled={fetcher.state !== 'idle'}
          onClick={() => fileInput.current?.click()}
        >
          <Upload aria-hidden="true" />
          Import from file
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,.txt,application/json,text/plain"
          className="hidden"
          onChange={(event) => void importFile(event)}
        />
      </div>
    </SettingsCard>
  );
}
