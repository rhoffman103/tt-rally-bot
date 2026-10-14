import type { Drill } from '~/lib/drills/types';

/**
 * What the import screen sends to its route's `clientAction`, as JSON. The route reads the drill from the code
 * again. `keep-both` saves the shared drill as a copy next to the drill with the same `id`.
 */
export type ImportAction = { code: string; mode: 'replace' | 'keep-both' };

export type ImportResult = { ok: true; drill: Drill } | { ok: false; error: string };
