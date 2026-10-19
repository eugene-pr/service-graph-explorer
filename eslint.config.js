import js from '@eslint/js';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import importX from 'eslint-plugin-import-x';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Atomic Design layers, lowest first. A layer may import only layers before it.
const layers = ['atoms', 'molecules', 'organisms', 'templates', 'pages'];
const webSrc = 'apps/web/src';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/storybook-static/**', '.claude/**', '.playwright-mcp/**'] },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['eslint.config.js'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-unsafe-type-assertion': 'error',
    },
  },
  {
    files: ['apps/api/**/*.ts', 'packages/**/*.ts', '*.js'],
    languageOptions: { globals: globals.node },
  },
  { files: ['*.js'], ...tseslint.configs.disableTypeChecked },
  {
    files: [`${webSrc}/**/*.{ts,tsx}`],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'import-x': importX },
    settings: {
      'import-x/resolver-next': [createTypeScriptImportResolver({ project: 'apps/web/tsconfig.json' })],
    },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      'import-x/no-restricted-paths': [
        'error',
        {
          zones: layers.slice(0, -1).map((layer, i) => ({
            target: `${webSrc}/${layer}`,
            from: layers.slice(i + 1).map((higher) => `${webSrc}/${higher}`),
            message: `Atomic Design: ${layer} may only import lower layers.`,
          })),
        },
      ],
    },
  },
  {
    files: [`${webSrc}/atoms/**`, `${webSrc}/molecules/**`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: '@tanstack/react-query', message: 'Atoms and molecules are presentational: no data fetching.' },
            { name: 'zustand', message: 'Atoms and molecules are presentational: no store access.' },
          ],
          patterns: [
            {
              regex: '(^|/)(store|hooks|api)(/|$)',
              message: 'Atoms and molecules are presentational: no store, hook or API client imports.',
            },
          ],
        },
      ],
    },
  },
);
