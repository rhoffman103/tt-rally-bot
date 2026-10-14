import { Download, FileSearch, Save, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { useFetcher } from 'react-router';
import { toast } from 'sonner';

import { Alert, AlertDescription } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { durationText } from '~/lib/drills/describe';
import type { ImportResult } from '~/lib/drills/storage';
import type { Ball } from '~/lib/drills/types';
import { capturedToDrill, findDrills, readCapture, type CapturedDrill } from '~/lib/robot/capture';
import { cn } from '~/lib/utils';
import { SettingsCard } from '~/features/settings/components/settings-card';
import type { SettingsAction } from '~/features/settings/types/settings-action';
import { presetsJson } from '~/features/settings/utils/presets-file';
import { downloadFile } from '~/utils/download-file';
import { formatRpm, formatSigned } from '~/utils/format';

const PRESETS_FILE = 'presets.json';

type Found = { key: number; captured: CapturedDrill; name: string };

/**
 * Reads a Bluetooth capture of the official app and turns the drills it sent into drills here.
 */
export function CaptureCard() {
  const fetcher = useFetcher<ImportResult>();
  const fileInput = useRef<HTMLInputElement>(null);
  const [found, setFound] = useState<Found[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const result = fetcher.data;
  useEffect(() => {
    if (!result) return;
    if (!result.ok) toast.error(result.error);
    else
      toast.success(
        `Saved ${result.drills.length} ${result.drills.length === 1 ? 'drill' : 'drills'} to your drills`,
      );
  }, [result]);

  const openFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = ''; // so picking the same file again still reads it
    if (!file) return;
    const read = readCapture(new Uint8Array(await file.arrayBuffer()));
    const drills = read.ok ? findDrills(read.messages) : [];
    if (!read.ok) setError(read.error);
    else if (drills.length === 0) {
      setError(
        'This capture has no drills in it. Keep the capture running while the official app starts each drill.',
      );
    } else setError(null);
    setFound(drills.map((captured, i) => ({ key: i, captured, name: `Captured drill ${i + 1}` })));
  };

  const drills = (found ?? []).map(({ captured, name }) => ({
    name: name.trim() || 'Captured drill',
    ...capturedToDrill(captured),
  }));

  const saveAll = () => {
    const action: SettingsAction = { intent: 'save-drills', drills };
    void fetcher.submit(action, { method: 'post', encType: 'application/json' });
  };

  const downloadPresets = () => {
    downloadFile(PRESETS_FILE, presetsJson(drills), 'application/json');
    toast.success(`Downloaded ${PRESETS_FILE}`);
  };

  const rename = (key: number, name: string) =>
    setFound((list) => list?.map((item) => (item.key === key ? { ...item, name } : item)) ?? null);
  const remove = (key: number) =>
    setFound((list) => list?.filter((item) => item.key !== key) ?? null);

  return (
    <SettingsCard
      title="Drills from the official app"
      description="Record the Bluetooth traffic while the robot’s official app plays its drills, then open the recording here: a .pklg file from PacketLogger (iPhone) or btsnoop_hci.log (Android)."
    >
      <Button variant="outline" size="lg" onClick={() => fileInput.current?.click()}>
        <FileSearch aria-hidden="true" />
        Open a capture
      </Button>
      <input
        ref={fileInput}
        type="file"
        className="hidden"
        onChange={(event) => void openFile(event)}
      />

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {found && found.length > 0 && (
        <>
          <p className="mt-5 mb-3 text-muted-foreground">
            Found {found.length} {found.length === 1 ? 'drill' : 'drills'}, in the order the app
            sent them. Give each one its name from the official app.
          </p>
          <div className="grid gap-4">
            {found.map((item) => (
              <CapturedDrillItem
                key={item.key}
                item={item}
                onRename={(name) => rename(item.key, name)}
                onRemove={() => remove(item.key)}
              />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="lg" disabled={fetcher.state !== 'idle'} onClick={saveAll}>
              <Save aria-hidden="true" />
              Save to your drills
            </Button>
            <Button variant="outline" size="lg" onClick={downloadPresets}>
              <Download aria-hidden="true" />
              Download {PRESETS_FILE}
            </Button>
          </div>
        </>
      )}
    </SettingsCard>
  );
}

type CapturedDrillItemProps = {
  item: Found;
  onRename: (name: string) => void;
  onRemove: () => void;
};

function CapturedDrillItem({ item, onRename, onRemove }: CapturedDrillItemProps) {
  const nameId = useId();
  const { time, drill, replacements, timesSent } = item.captured;
  const facts = [
    time === null ? null : new Date(time).toLocaleTimeString('en-GB'),
    `${drill.balls.length} ${drill.balls.length === 1 ? 'ball' : 'balls'}`,
    drill.duration ? durationText(drill.duration) : null,
    drill.random ? 'Random order' : null,
    timesSent > 1 ? `Sent ${timesSent} times` : null,
  ].filter(Boolean);

  return (
    <section className="rounded-lg border p-4" aria-labelledby={nameId}>
      <div className="flex items-end gap-2">
        <div className="grid flex-1 gap-1.5">
          <Label htmlFor={nameId}>Name</Label>
          <Input id={nameId} value={item.name} onChange={(e) => onRename(e.currentTarget.value)} />
        </div>
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label={`Leave out “${item.name}”`}
          onClick={onRemove}
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      <p className="mt-2 text-[12.5px] text-muted-foreground">{facts.join(' · ')}</p>
      {!drill.duration && (
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          The length setting (mode {drill.mode}, amount {drill.amount}) is new to this app, so the
          drill plays until you stop it.
        </p>
      )}
      {replacements.length > 0 && (
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          The app changed the balls {replacements.length}{' '}
          {replacements.length === 1 ? 'time' : 'times'} while this drill played. Those balls are
          added as extra lines after the first {drill.balls.length}. Check the order before you use
          it.
        </p>
      )}
      <CapturedBalls balls={[drill.balls, ...replacements].flat()} />
    </section>
  );
}

const COLUMNS = ['#', 'Upper rpm', 'Lower rpm', 'Height', 'Drop', 'Freq.', 'Repeat'];
const cell =
  'border-t px-2 py-1.5 text-right font-mono text-[12.5px] whitespace-nowrap first:pl-0 first:text-left';

/** The wheel speeds and settings exactly as the app sent them. */
function CapturedBalls({ balls }: { balls: Ball[] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {COLUMNS.map((title) => (
              <th
                key={title}
                className={cn(
                  cell,
                  'border-t-0 font-sans text-xs font-medium text-muted-foreground',
                )}
              >
                {title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {balls.map((ball, i) => (
            <tr key={i}>
              <td className={cell}>{i + 1}</td>
              <td className={cell}>{formatRpm(ball.upperRpm)}</td>
              <td className={cell}>{formatRpm(ball.lowerRpm)}</td>
              <td className={cell}>{formatSigned(ball.height)}</td>
              <td className={cell}>{formatSigned(ball.dropPoint)}</td>
              <td className={cell}>{ball.frequency}</td>
              <td className={cell}>{ball.repetitions > 1 ? `×${ball.repetitions}` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
