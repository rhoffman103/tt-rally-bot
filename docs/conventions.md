# Conventions

These rules are adapted from [alan2207/bulletproof-react](https://github.com/alan2207/bulletproof-react) and fitted to this project: React Router framework mode with `ssr: false`, `clientLoader` for data, Tailwind with shadcn, zustand, and Web Bluetooth through `app/lib/robot/`. Where a rule clashes with `CLAUDE.md`, that file wins.

Each rule says how it is checked:

- **eslint**: `pnpm lint` (the config is `eslint.config.js`)
- **tsc**: `pnpm typecheck`
- **review**: no tool can check it. The `web-feature` skill and code review cover it.

Run `pnpm check` to check formatting, lint and types. Run `pnpm format` to format and `pnpm lint:fix` to fix what ESLint can fix.

---

## Layout: one folder per feature

```
app/
├── root.tsx         app shell, RobotProvider, ErrorBoundary, HydrateFallback
├── routes.ts        route table
├── routes/          route modules. Thin: clientLoader/clientAction, meta, and feature components
├── features/
│   └── <feature>/   connection, player, builder
│       ├── assets/
│       ├── components/
│       ├── hooks/
│       ├── stores/      zustand stores used only by this feature
│       ├── types/
│       └── utils/
├── components/      shared components. components/ui/ holds the shadcn components
├── config/          constants and environment values
├── hooks/           shared hooks
├── lib/             shared code: robot/ (robot protocol, transport, client), drills/ (types, presets, storage), utils
├── stores/          zustand stores used by more than one feature
├── testing/         test helpers. Tests sit next to the file they test (protocol.test.ts)
├── types/           shared types
└── utils/           shared helper functions
```

Create only the folders a feature needs. A feature is a part of the product, not a kind of file: `player` is a feature, `buttons` is not.

## Rules

| #   | Rule                                                                                                                                                                                                                                                                                                                                                                     | Checked by                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| W1  | Code goes in the folders above. Code used by one feature lives in that feature. Move it to a shared folder only when a second feature needs it.                                                                                                                                                                                                                          | review                                           |
| W2  | Imports flow one way: **shared folders → features → routes**. Shared code never imports from `features/` or `routes/`, and features never import from `routes/`.                                                                                                                                                                                                         | eslint `import-x/no-restricted-paths`            |
| W3  | Features don't import from each other. To use two features together, combine them in a route. If they need the same code, move it to a shared folder.                                                                                                                                                                                                                    | eslint `import-x/no-restricted-paths`            |
| W4  | No barrel files (`index.ts` that re-exports). Import each file directly. Barrel files slow down Vite and make it hard to see what depends on what.                                                                                                                                                                                                                       | eslint `check-file/no-index`                     |
| W5  | Import with the `~/` alias (`~/features/player/components/drill-list`), not `../`. Use `./` only for files in the same folder and for `./+types/<route>`.                                                                                                                                                                                                                | eslint `no-restricted-imports`                   |
| W6  | File and folder names in `app/` are kebab-case: `ball-editor.tsx`, `use-drill-progress.ts`. Components inside them stay PascalCase.                                                                                                                                                                                                                                      | eslint `check-file`                              |
| W7  | Route modules are thin. They load data in `clientLoader` and change data in `clientAction` by calling functions from `~/lib/drills/storage`. They render feature components. Business logic, Bluetooth calls and direct `localStorage` access don't go in routes.                                                                                                        | review                                           |
| W8  | Every message to the robot goes through the one `RobotClient` in `lib/robot/client.ts`. Bytes are built and parsed only in `lib/robot/protocol.ts`. Drill types come from `~/lib/drills/types.ts`. Don't redefine them. Never touch `navigator.bluetooth` or `window` at module scope: the root route is pre-rendered at build time.                                     | review                                           |
| W9  | State goes in the smallest place it fits: saved drills come from `clientLoader`, form state from `<Form>` or local state, and state for one component from `useState`. The robot connection lives in `RobotProvider`. Use a zustand store only for client state that many components share (for example the builder's selected ball), in the feature's `stores/` folder. | review                                           |
| W10 | Follow the Rules of Hooks.                                                                                                                                                                                                                                                                                                                                               | eslint `react-hooks`                             |
| W11 | Add shadcn components with the shadcn CLI (`pnpm dlx shadcn add <name>`) into `components/ui/`. Don't put feature logic there. To change how one feature uses a component, wrap it in the feature's `components/`.                                                                                                                                                       | review                                           |
| W12 | TypeScript is strict. Don't use `any` or `@ts-ignore`. If a type really is unknown, use `unknown` and narrow it.                                                                                                                                                                                                                                                         | tsc, eslint `@typescript-eslint/no-explicit-any` |
| W13 | Check the licence and add a row to `docs/licenses.md` before you add any dependency.                                                                                                                                                                                                                                                                                     | review                                           |

## Where this guide differs from bulletproof-react

- **`app/`, not `src/`.** React Router framework mode uses `app/`, and the route modules live in `app/routes/` with the route table in `app/routes.ts`.
- **No React Query.** Data loads in `clientLoader` and changes in `clientAction`. React Router reloads loaders after an action, so a separate cache is not needed. Robot status and drill progress come from `RobotClient` events through `useRobot()`, not from polling.
- **No API layer.** There is no backend. Shared robot code lives in `app/lib/robot/` and drill data in `app/lib/drills/`.
- **zustand** is the client state library.
- **Feature boundaries are set up automatically.** `eslint.config.js` reads `app/features/` and makes one zone per folder, so a new feature needs no config change.
