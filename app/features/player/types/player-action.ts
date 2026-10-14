/** What the library and drill screens send to their route's `clientAction`, as JSON. */
export type PlayerAction =
  | { intent: 'duplicate'; drillId: string }
  | { intent: 'delete'; drillId: string }
  | { intent: 'favorite'; drillId: string; favorite: boolean };

/**
 * The library stays and names the drill it copied or deleted. The drill screen goes to the builder or to the library
 * instead, so it returns only errors.
 */
export type PlayerResult = { ok: true; name: string } | { ok: false; error: string };
