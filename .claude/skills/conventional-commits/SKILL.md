---
name: conventional-commits
description: How to write commit messages for tt-rally-bot (Conventional Commits 1.0.0). Use whenever you write a commit message, make a commit, write a pull request title, or squash commits.
---

# Commit messages

Commit messages follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/). A `commit-msg` git hook (`.husky/commit-msg`) runs commitlint with `@commitlint/config-conventional` and blocks any message that breaks the rules. Don't skip it with `--no-verify`.

## Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

- **type**: required. One from the table below.
- **scope**: optional. The part of the app you changed, in lower case.
- **subject**: required. Imperative mood ("add", not "added"), lower case start, no full stop.
- Keep the header to 100 characters or fewer (aim for about 72).
- **body**: optional. Say what changed and why. Leave a blank line after the header.
- **footer**: optional. For example `Refs: #12` or `BREAKING CHANGE: ...`. Leave a blank line before it.

## Types

| Type       | Use for                                                   |
| ---------- | --------------------------------------------------------- |
| `feat`     | a new feature for the user                                |
| `fix`      | a bug fix                                                 |
| `docs`     | documentation only                                        |
| `style`    | formatting only, no change in behaviour                   |
| `refactor` | a code change that neither fixes a bug nor adds a feature |
| `perf`     | a faster or lighter version of existing behaviour         |
| `test`     | adding or fixing tests                                    |
| `build`    | dependencies, build tools, `package.json`                 |
| `ci`       | CI configuration                                          |
| `chore`    | other upkeep that doesn't touch app code                  |
| `revert`   | reverting an earlier commit                               |

## Scopes

Use the feature folder name when the change stays inside one feature: `connection`, `player`, `builder`. Other useful scopes: `robot` (robot protocol code), `ui` (shared components), `deps`, `claude` (`.claude/` files). Leave the scope out when a change spans several areas.

## Breaking changes

Add `!` before the colon and explain in a `BREAKING CHANGE:` footer:

```
feat(builder)!: store drills in a new format

BREAKING CHANGE: drills saved by older versions must be imported again.
```

## Examples

```
feat(player): add a pause button to the drill player
fix(connection): reconnect after the robot goes to sleep
docs: explain the spin byte in robot-protocol.md
build(deps): add commitlint and husky
```

## Checking a message

Test a message without committing:

```bash
echo "feat(player): add a pause button" | pnpm exec commitlint
```

If the hook rejects a commit, fix the message and commit again. Don't change `commitlint.config.js` unless the user agrees to change the rules.
