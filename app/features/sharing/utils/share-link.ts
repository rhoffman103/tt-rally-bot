// The link a shared drill travels in. The planned phone app will open `tt-rally-bot://` links.
import type { DrillDraft } from '~/lib/drills/storage';
import { encodeShareCode } from '~/lib/drills/share-code';
import type { Drill } from '~/lib/drills/types';

/** A drill to share. A drill from the builder may not be saved yet, so it can lack an `id` and `updatedAt`. */
export type ShareableDrill = DrillDraft & { updatedAt?: string };

export type ShareLinkResult = { ok: true; link: string } | { ok: false; error: string };

const shareLink = (code: string) => `tt-rally-bot://import?d=${code}`;

/**
 * The share link for a drill. A drill without an `id` gets one when it is imported. A drill without `updatedAt`
 * has unsaved changes, so it counts as changed now.
 */
export async function makeShareLink(drill: ShareableDrill): Promise<ShareLinkResult> {
  const shared: Drill = {
    ...drill,
    id: drill.id ?? '',
    source: 'custom',
    updatedAt: drill.updatedAt ?? new Date().toISOString(),
  };
  try {
    return { ok: true, link: shareLink(await encodeShareCode(shared)) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
