// Rules: docs/conventions.md (adapted from bulletproof-react).
import fs from 'node:fs';

import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import checkFile from 'eslint-plugin-check-file';
import importX from 'eslint-plugin-import-x';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Shared code: anything outside features/ and routes/ (W2).
const SHARED = [
  './app/components',
  './app/config',
  './app/hooks',
  './app/lib',
  './app/stores',
  './app/testing',
  './app/types',
  './app/utils',
];

// One zone per feature folder, so a new feature needs no config change (W3).
const features = fs.existsSync('app/features')
  ? fs
      .readdirSync('app/features', { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  : [];

const featureZones = features.map((name) => ({
  target: `./app/features/${name}`,
  from: './app/features',
  except: [`./${name}`],
  message: 'W3: features must not import each other. Combine them in a route.',
}));

export default tseslint.config(
  // Generated folders. .react-router/ holds the route types from `react-router typegen`.
  { ignores: ['build/', '.react-router/', 'node_modules/'] },
  js.configs.recommended,
  tseslint.configs.recommended, // W12: no-explicit-any, ban-ts-comment
  reactHooks.configs.flat.recommended, // W10
  {
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ['app/**/*.{ts,tsx}'],
    plugins: { 'import-x': importX, 'check-file': checkFile },
    settings: {
      'import-x/resolver-next': [createTypeScriptImportResolver({ project: './tsconfig.json' })],
    },
    rules: {
      // W2, W3: imports flow one way: shared → features → routes.
      'import-x/no-restricted-paths': [
        'error',
        {
          zones: [
            ...featureZones,
            {
              target: SHARED,
              from: ['./app/features', './app/routes'],
              message:
                'W2: shared code must not import features or routes. Move the code into a feature, or pass it in as props.',
            },
            {
              target: './app/features',
              from: './app/routes',
              message: 'W2: features must not import routes.',
            },
          ],
        },
      ],
      // W5: absolute imports through ~/ instead of ../
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^\\.\\./',
              message: 'W5: import with ~/ (for example ~/features/player/...), not ../',
            },
          ],
        },
      ],
      // W4: no barrel files. Import each file directly.
      'check-file/no-index': 'error',
      // W6: kebab-case file and folder names.
      'check-file/filename-naming-convention': [
        'error',
        { 'app/**/*.{ts,tsx}': 'KEBAB_CASE' },
        { ignoreMiddleExtensions: true },
      ],
      'check-file/folder-naming-convention': ['error', { 'app/**/': 'KEBAB_CASE' }],
    },
  },
  prettier, // keep last: turns off rules that clash with Prettier
);
