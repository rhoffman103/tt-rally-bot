# Dependency licences

Check the licence and add a row here before you add a dependency (rule W13 in `docs/conventions.md`).

## Runtime

| Package                    | Licence                   | Used for                                                    |
| -------------------------- | ------------------------- | ----------------------------------------------------------- |
| @base-ui/react             | MIT                       | headless components under shadcn (base-nova)                |
| @fontsource-variable/geist | OFL-1.1                   | Geist font                                                  |
| @react-router/node         | MIT                       | React Router                                                |
| class-variance-authority   | Apache-2.0                | component variants (shadcn)                                 |
| cn                         | MIT                       | class-name merging (shadcn), re-exported from `~/lib/utils` |
| isbot                      | Unlicense                 | React Router template                                       |
| lucide-react               | ISC                       | icons                                                       |
| react, react-dom           | MIT                       | UI                                                          |
| react-router               | MIT                       | routing, data loading                                       |
| shadcn                     | MIT                       | component CLI and styles                                    |
| sonner                     | MIT                       | toast messages (shadcn)                                     |
| spark-md5                  | WTFPL OR MIT (MIT chosen) | MD5 for the robot handshake                                 |
| tw-animate-css             | MIT                       | animations (shadcn)                                         |
| uqr                        | MIT                       | QR codes for sharing drills (small, no dependencies)        |
| zustand                    | MIT                       | player session state                                        |

## Development

| Package                                          | Licence    | Used for                                        |
| ------------------------------------------------ | ---------- | ----------------------------------------------- |
| @react-router/dev                                | MIT        | build, typegen                                  |
| @tailwindcss/vite, tailwindcss                   | MIT        | styling                                         |
| @types/node, @types/react, @types/react-dom      | MIT        | types                                           |
| @types/spark-md5, @types/web-bluetooth           | MIT        | types                                           |
| typescript                                       | Apache-2.0 | W12 (strict types)                              |
| vite                                             | MIT        | bundler                                         |
| vitest                                           | MIT        | unit tests (`pnpm test`)                        |
| eslint, @eslint/js                               | MIT        | base lint rules                                 |
| typescript-eslint                                | MIT        | W12 (`no-explicit-any`, `ban-ts-comment`)       |
| eslint-plugin-import-x                           | MIT        | W2, W3 (feature boundaries)                     |
| eslint-import-resolver-typescript                | ISC        | lets import-x resolve the `~/` alias            |
| eslint-plugin-check-file                         | Apache-2.0 | W4 (no barrels), W6 (kebab-case)                |
| eslint-plugin-react-hooks                        | MIT        | W10                                             |
| globals                                          | MIT        | browser globals                                 |
| prettier, prettier-plugin-tailwindcss            | MIT        | formatting, Tailwind class order                |
| eslint-config-prettier                           | MIT        | turns off ESLint rules that clash with Prettier |
| knip                                             | ISC        | finds unused files, exports and dependencies    |
| jscpd                                            | MIT        | finds copied and pasted code                    |
| @commitlint/cli, @commitlint/config-conventional | MIT        | checks commit messages (Conventional Commits)   |
| husky                                            | MIT        | installs the `commit-msg` git hook              |
