import { Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '~/components/ui/button';
import { useRobot } from '~/hooks/use-robot';
import type { LogEntry } from '~/lib/robot/client';
import type { Settings } from '~/lib/settings';
import { SettingsCard } from '~/features/settings/components/settings-card';
import { SwitchRow } from '~/components/switch-row';
import { useSaveSettings } from '~/features/settings/hooks/use-save-settings';

const ARROWS: Record<LogEntry['dir'], string> = { out: '→', in: '←', info: '·' };
const COLOURS: Record<LogEntry['dir'], string> = {
  out: 'text-sent',
  in: 'text-ok',
  info: 'text-muted-foreground',
};

const time = (at: number) => new Date(at).toLocaleTimeString('en-GB');
const asText = (entry: LogEntry) =>
  [time(entry.at), ARROWS[entry.dir], entry.hex, entry.text].filter(Boolean).join('  ');

/** Every message to and from the robot, in hex, with a switch to show or hide it. */
export function DebugLogCard({ saved }: { saved: Settings }) {
  const { settings, save } = useSaveSettings(saved);
  const { log } = useRobot();
  // Clear only hides what is there now: the log itself belongs to the robot connection.
  const [clearedAfter, setClearedAfter] = useState<LogEntry | null>(null);
  const entries = log.slice(clearedAfter ? log.lastIndexOf(clearedAfter) + 1 : 0);
  const last = entries.at(-1);

  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [last, settings.debugLog]);

  const copy = () =>
    navigator.clipboard
      .writeText(entries.map(asText).join('\n'))
      .then(() => toast.success('Log copied'))
      .catch(() => toast.error('Couldn’t copy the log.'));

  return (
    <SettingsCard>
      <SwitchRow
        title="Debug log"
        description="Shows every message to and from the robot, in hex."
        checked={settings.debugLog}
        onCheckedChange={(debugLog) => save({ debugLog })}
      />
      {settings.debugLog && (
        <>
          <div
            ref={box}
            role="log"
            aria-label="Debug log"
            aria-live="off"
            tabIndex={0}
            className="mt-4 mb-3 max-h-[260px] overflow-auto rounded-lg bg-muted px-3 py-2.5 font-mono text-xs/[1.7] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {entries.length === 0 ? (
              <span className="text-muted-foreground">Nothing yet. Connect the robot.</span>
            ) : (
              entries.map((entry, i) => (
                <div key={`${entry.at}-${i}`} className="flex gap-2.5 whitespace-nowrap">
                  <span className="text-muted-foreground">{time(entry.at)}</span>
                  <span className={COLOURS[entry.dir]}>{ARROWS[entry.dir]}</span>
                  {entry.hex && <code className={COLOURS[entry.dir]}>{entry.hex}</code>}
                  <span className="font-sans text-muted-foreground">{entry.text}</span>
                </div>
              ))
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={entries.length === 0} onClick={copy}>
              <Copy aria-hidden="true" />
              Copy
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={entries.length === 0}
              onClick={() => setClearedAfter(last ?? null)}
            >
              Clear
            </Button>
          </div>
        </>
      )}
    </SettingsCard>
  );
}
