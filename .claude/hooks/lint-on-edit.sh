#!/bin/sh
# PostToolUse hook: format and lint each app file Claude edits (docs/conventions.md).
# Exit 2 sends ESLint's findings back to Claude so it fixes them straight away.
f=$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))')
case "$f" in
  "$CLAUDE_PROJECT_DIR"/node_modules/*|"$CLAUDE_PROJECT_DIR"/build/*|"$CLAUDE_PROJECT_DIR"/.react-router/*) exit 0 ;;
  "$CLAUDE_PROJECT_DIR"/*.ts|"$CLAUDE_PROJECT_DIR"/*.tsx|"$CLAUDE_PROJECT_DIR"/*.js) ;;
  *) exit 0 ;;
esac
[ -f "$f" ] || exit 0
cd "$CLAUDE_PROJECT_DIR" || exit 0
[ -x node_modules/.bin/eslint ] || exit 0

node_modules/.bin/prettier --write --log-level silent "$f" >/dev/null 2>&1
if ! out=$(node_modules/.bin/eslint --fix --format stylish "$f" 2>&1); then
  printf 'ESLint found problems (rules: docs/conventions.md):\n%s\n' "$out" >&2
  exit 2
fi
exit 0
