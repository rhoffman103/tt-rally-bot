---
name: web-feature
description: Project rules for the tt-rally-bot app (app/), adapted from bulletproof-react. Use when adding or changing routes, features (connection, player, builder), components, hooks, zustand stores, robot code, drill storage, or shared code in app/. Use it together with the `react-router` and `shadcn` skills; where they differ, this one wins.
---

# tt-rally-bot app rules

The full rules, with numbers, are in `docs/conventions.md`. Read it before your first change in `app/` in a session. This skill tells you how to apply them. README.md describes the code layout.

Many rules are checked by machine. A hook runs Prettier and ESLint on every file you edit and sends the problems back to you. Run this before you say you are done:

```bash
pnpm check
```

If ESLint reports a boundary error (W2, W3), move the code. Don't silence the rule or change `eslint.config.js` unless the user agrees to change the rule.

## Where code goes

```
app/routes/<route>.tsx                     clientLoader/clientAction + meta + feature components. Thin.
app/features/<feature>/components/<x>.tsx  UI for this feature (connection, player, builder)
app/features/<feature>/hooks/use-<x>.ts
app/features/<feature>/stores/<x>-store.ts zustand, only for client state many components share
app/features/<feature>/types/ utils/ assets/
app/lib/robot/                              robot protocol, transport and RobotClient. The only code that talks to the robot
app/lib/drills/                            drill types, presets and storage
app/components/ hooks/ lib/ stores/ types/ utils/ config/   shared: used by 2+ features
app/components/ui/                         shadcn components (add with the shadcn CLI)
```

Imports flow one way: **shared → features → routes**. A feature never imports another feature. Combine features in a route.

## Adding a feature: steps

1. **Pick the feature.** Name it after a part of the product, in kebab-case (`player`, not `Player` or `buttons`). If it already exists, add to it.
2. **Data and robot calls.** Drill data goes through `~/lib/drills/storage`. Robot messages go through `RobotClient` (via `useRobot()`). Don't build bytes outside `~/lib/robot/protocol.ts`.
3. **Components and hooks.** Build the UI in `features/<feature>/components/`. Use shadcn components from `~/components/ui/`. Keep state local. Add a store only when many components need the same client state.
4. **Route.** Add or update the route module in `app/routes/` and register it in `app/routes.ts`. Load data in `clientLoader` and change it in `clientAction`. Pass the data to feature components as props.
5. **Share only when needed.** If a second feature needs the same code, move it to a shared folder and update both features' imports. Don't import across features.
6. **Check.** Run `pnpm check`, then `pnpm build` for route changes.

## Templates

```tsx
// app/routes/drills.tsx
import type { Route } from './+types/drills';
import { listDrills } from '~/lib/drills/storage';
import { DrillList } from '~/features/player/components/drill-list';

export async function clientLoader() {
  return { drills: await listDrills() };
}

export default function Drills({ loaderData }: Route.ComponentProps) {
  return <DrillList drills={loaderData.drills} />;
}
```

## Rules people often miss

- **No barrel files.** Don't create `index.ts`. Import each file by its full path.
- **No `../` imports.** Use `~/...`. `./` is fine within a folder and for `./+types/<route>`.
- **SPA mode.** Use `clientLoader` and `clientAction`, never `loader` or `action`.
- **No browser APIs at module scope.** The root route is pre-rendered at build time. Touch `navigator.bluetooth`, `window` and `localStorage` only in effects, event handlers or `clientLoader`.
- **No `localStorage` in components or routes.** It goes through `~/lib/drills/storage`.
- **Don't redefine drill types.** Use `~/lib/drills/types`.
- **New dependency?** Check its licence, then add a row to `docs/licenses.md`.
