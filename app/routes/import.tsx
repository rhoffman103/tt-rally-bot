import type { Route } from './+types/import';
import { decodeShareCode } from '~/lib/drills/share-code';
import { copyName, getDrill, importDrillCopy, importDrills, isPreset } from '~/lib/drills/storage';
import { loadSettings } from '~/lib/settings';
import { BadShareCode } from '~/features/sharing/components/bad-share-code';
import { ImportDrill } from '~/features/sharing/components/import-drill';
import type { ImportAction, ImportResult } from '~/features/sharing/types/import-action';

export function meta(): Route.MetaDescriptors {
  return [{ title: 'Import a drill · TT Rally Bot' }];
}

/** Reads the drill from `?d=<share code>`. A code can hold several drills; this screen shows the first. */
export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const code = new URL(request.url).searchParams.get('d') ?? '';
  const decoded = await decodeShareCode(code);
  if (!decoded.ok) return { ok: false as const, error: decoded.error };
  const [drill] = decoded.drills;
  // A drill with a preset's id is saved with a new id, so it never clashes.
  const existing = drill.id && !isPreset(drill.id) ? await getDrill(drill.id) : null;
  return {
    ok: true as const,
    code,
    drill,
    existing,
    copyName: await copyName(drill.name),
    speedSpin: loadSettings().speedSpin,
  };
}

export async function clientAction({ request }: Route.ClientActionArgs): Promise<ImportResult> {
  const action = (await request.json()) as ImportAction;
  const decoded = await decodeShareCode(action.code);
  if (!decoded.ok) return decoded;
  const [shared] = decoded.drills;
  try {
    const drill =
      action.mode === 'keep-both'
        ? await importDrillCopy(shared)
        : (await importDrills([shared]))[0];
    return { ok: true, drill };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export default function Import({ loaderData }: Route.ComponentProps) {
  if (!loaderData.ok) return <BadShareCode error={loaderData.error} />;
  const { code, drill, existing, copyName, speedSpin } = loaderData;
  // A new code starts the screen again, with the right choice picked.
  return (
    <ImportDrill
      key={code}
      code={code}
      drill={drill}
      existing={existing}
      copyName={copyName}
      speedSpin={speedSpin}
    />
  );
}
