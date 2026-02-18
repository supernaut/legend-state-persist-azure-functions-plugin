import js from '@eslint/js';
import json from '@eslint/json';
import markdown from '@eslint/markdown';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import perfectionist from 'eslint-plugin-perfectionist';
import sonarjs from 'eslint-plugin-sonarjs';
import unusedImports from 'eslint-plugin-unused-imports';
import { defineConfig } from 'eslint/config';
import { globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  {
    extends: ['js/recommended'],
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    languageOptions: { globals: globals.browser },
    plugins: { js },
  },
  tseslint.configs.recommended,
  {
    extends: ['json/recommended'],
    files: ['**/*.json'],
    language: 'json/json',
    plugins: { json },
  },
  {
    extends: ['markdown/recommended'],
    files: ['**/*.md'],
    language: 'markdown/gfm',
    plugins: { markdown },
  },
  eslintConfigPrettier,
  {
    files: ['**/*.ts', '**/*.js', '**/*.mjs'],
    name: 'unused-imports',
    plugins: {
      'unused-imports': unusedImports,
    },
    rules: {
      'no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          vars: 'all',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.js', '**/*.mjs'],
    name: 'perfectionist',
    ...perfectionist.configs['recommended-alphabetical'],
    rules: {
      ...perfectionist.configs['recommended-alphabetical'].rules,
      'perfectionist/sort-imports': [
        'error',
        {
          customGroups: [
            {
              elementNamePattern: ['^@azure$', '^@azure/.+'],
              groupName: 'type-azure',
              modifiers: ['type'],
            },
            {
              elementNamePattern: ['^@azure$', '^@azure/.+'],
              groupName: 'azure',
            },
            {
              elementNamePattern: ['^@legendapp$', '^@legendapp/.+'],
              groupName: 'type-legendapp',
              modifiers: ['type'],
            },
            {
              elementNamePattern: ['^@legendapp$', '^@legendapp/.+'],
              groupName: 'legendapp',
            },
            {
              elementNamePattern: ['^fs$', '^fs/.+', '^path$', '^path/.+'],
              groupName: 'node',
            },
          ],
          groups: [
            'node',
            'azure',
            { newlinesBetween: 0 },
            'type-azure',
            'legendapp',
            { newlinesBetween: 0 },
            'type-legendapp',
            ['value-builtin', 'value-external'],
            'value-import',
            'type-import',
            'value-internal',
            'type-internal',
            'value-parent',
            'value-sibling',
            'value-index',
            'type-parent',
            'type-sibling',
            'type-index',
            'ts-equals-import',
            'style',
            'side-effect-style',
            'side-effect',
            'unknown',
          ],
          ignoreCase: true,
        },
      ],
      'perfectionist/sort-named-imports': [
        'error',
        {
          customGroups: [],
          fallbackSort: { type: 'unsorted' },
          groups: ['type-import', 'value-import'],
          ignoreAlias: false,
          ignoreCase: true,
          newlinesBetween: 'ignore',
          order: 'asc',
          partitionByComment: false,
          partitionByNewLine: false,
          specialCharacters: 'keep',
          type: 'alphabetical',
        },
      ],
    },
  },
  { files: ['**/*.ts', '**/*.js', '**/*.mjs'], ...sonarjs.configs.recommended },
  { ignores: ['node_modules', 'dist/**'] },
  globalIgnores(
    ['**/node_modules/', '**/dist/', '**/out-tsc/'],
    'Ignore modules, build and output',
  ),
]);
