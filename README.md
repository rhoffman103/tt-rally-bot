# TT-Rally-Bot

A web app that controls the **Nova S Pro** table tennis robot over Bluetooth. It replaces the official Pongbot mobile
app.

With it you can:

- connect to the robot from Chrome
- play preset drills, with big play, pause and stop buttons
- build your own drills, ball by ball, on a table diagram
- share a drill with a QR code or a link
- follow training plans, such as the built-in **Zero to hero** plan

The app runs in Chrome on a computer. A phone app (iOS and Android) is planned.

## What you need

- **Chrome** or another Chromium browser, such as Edge. The app uses Web Bluetooth, which Safari and Firefox do not
  support.
- **Node.js** and **pnpm**, to run the app on your computer.
- The robot, switched on. You can also try the app without it: see [Try it without the robot](#try-it-without-the-robot).

## Run the app

1. Install the dependencies:

   ```bash
   pnpm install
   ```

2. Start the app:

   ```bash
   pnpm dev
   ```

3. Open http://localhost:5173 in Chrome.
4. Select **Connect** and choose the robot in Chrome's Bluetooth window.

Web Bluetooth works only on `localhost` or on an `https://` address.

## Try it without the robot

The app has a simulated robot. To turn it on, do one of these:

- open the app with `?robot=sim` at the end of the address, for example http://localhost:5173/?robot=sim
- go to **Settings** and turn on **Simulated robot**

## Build and deploy

The app is a single-page app (React Router in SPA mode). To build it:

```bash
pnpm build
```

This writes static files to `build/client/`. Put that folder on any static web host.

The host must send every path to `index.html`, or links to pages inside the app will show "404 Not Found". For
example, with a `_redirects` file:

```
/*    /index.html   200
```

## Commands

| Command         | What it does                                            |
| --------------- | ------------------------------------------------------- |
| `pnpm dev`      | Starts the app and reloads it when you change code      |
| `pnpm build`    | Builds the app into `build/client/`                     |
| `pnpm test`     | Runs the tests (Vitest)                                 |
| `pnpm check`    | Checks format, lint, types, unused code and copied code |
| `pnpm format`   | Formats the code with Prettier                          |
| `pnpm lint:fix` | Fixes the lint problems that ESLint can fix             |

Run `pnpm check` and `pnpm test` before you commit.

## How the code is organised

- `app/lib/robot/` talks to the robot: the Bluetooth protocol, the connection and the simulated robot.
- `app/lib/drills/` and `app/lib/plans/` hold the drill and plan types, the presets and storage. Drills are saved in
  the browser.
- `app/features/` has one folder for each part of the app: connection, player, builder, sharing, plans and settings.
- `app/routes/` has one small file for each page.

Shared code goes into features, and features go into routes. Features never import each other.

The stack is React Router 8, React 19, TypeScript, Tailwind CSS 4, shadcn and zustand.

## Contributing

- Follow [docs/conventions.md](docs/conventions.md). `pnpm lint` checks most of the rules.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/). A Git hook checks each
  message.
- Before you add a dependency, check its licence and add a row to [docs/licenses.md](docs/licenses.md).

## Documents

| Document                                         | What it covers                 |
| ------------------------------------------------ | ------------------------------ |
| [docs/robot-protocol.md](docs/robot-protocol.md) | The robot's Bluetooth protocol |
| [docs/conventions.md](docs/conventions.md)       | Rules for the code             |
| [docs/licenses.md](docs/licenses.md)             | Licences of the dependencies   |

## Licence

MIT. See [LICENSE](LICENSE).
