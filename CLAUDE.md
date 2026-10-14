# TT-Rally-Bot

Web app that replaces the Pongbot mobile app for the Nova S Pro table tennis robot. The robot protocol is in `docs/robot-protocol.md`.

- Code follows **`docs/conventions.md`** (adapted from bulletproof-react): one folder per feature, imports flow shared → features → routes, features never import each other. Use the `web-feature` skill for code in `app/`. `pnpm lint` checks most of the rules.
- Before you say you are done, run `pnpm check` (format, lint and type check).
- New dependency? Check its licence and add a row to `docs/licenses.md`.
- Commit messages follow Conventional Commits. A `commit-msg` hook runs commitlint. Use the `conventional-commits` skill when you write one.
- Only make an artifact document when explicitly asked.
- Private notes (build plan, tracker, prompts, research) live in `notes/`, which Git ignores. The build plan is `notes/PLAN.md`. Committed files must not link to anything in `notes/`. Put a document in `docs/` only if it should be public.
