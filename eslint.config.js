import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import importPlugin, { createNodeResolver } from 'eslint-plugin-import-x';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';

const nodeGlobals = {
  process: 'readonly',
  Buffer: 'readonly',
  global: 'readonly',
  console: 'readonly',
  fetch: 'readonly',
  Headers: 'readonly',
  Request: 'readonly',
  Response: 'readonly',
  NodeJS: 'readonly',
};

export default [
  // Global ignores
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'src/graphql/generated/**',
      'bin/**',
      'coverage/**',
      '.claude/**',
    ],
  },

  // Unicorn recommended rules
  eslintPluginUnicorn.configs.recommended,
  {
    rules: {
      'unicorn/name-replacements': 'off',
      'unicorn/no-null': 'off',
      'unicorn/no-process-exit': 'off',
      'unicorn/no-array-callback-reference': 'off',
      'unicorn/consistent-function-scoping': 'off',
      'unicorn/import-style': 'off',
      'unicorn/no-nested-ternary': 'off',
      'unicorn/prefer-top-level-await': 'off',
      'unicorn/prefer-module': 'off',

      // Naming and comment conventions this codebase deliberately doesn't follow
      'unicorn/consistent-boolean-name': 'off', // e.g. `noConflicts`, `needsResolving`
      'unicorn/no-non-function-verb-prefix': 'off', // e.g. `createPullRequestCalls`
      'unicorn/no-asterisk-prefix-in-documentation-comments': 'off', // keep the standard ` * ` JSDoc prefix
      'unicorn/single-line-block-comment-style': 'off', // allow one-line `/** … */` file headers
      'unicorn/max-nested-calls': 'off', // zod schemas nest calls by design
      'unicorn/prefer-ternary': 'off', // since v77 it also rewrites `if (x) return a; return b;` guard clauses
      'unicorn/prefer-simple-condition-first': 'off', // conditions are ordered for readability
      // Files are kebab-case; directories (e.g. `sourceCommit/`) are camelCase
      'unicorn/filename-case': [
        'error',
        { case: 'kebabCase', checkDirectories: false },
      ],
    },
  },

  // Config files and test helpers configure the environment at import time
  {
    files: ['eslint.config.js', 'vitest.config*.ts', 'src/test/**/*.ts'],
    rules: {
      'unicorn/no-top-level-side-effects': 'off',
    },
  },

  // CJS config files (.graphqlrc.js uses require/module.exports)
  {
    files: ['.graphqlrc.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...nodeGlobals,
        require: 'readonly',
        module: 'writable',
        __dirname: 'readonly',
        __filename: 'readonly',
        exports: 'writable',
      },
    },
    ...js.configs.recommended,
  },

  // ESM config files
  {
    files: ['*.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: nodeGlobals,
    },
    ...js.configs.recommended,
  },

  // Config files (CJS - dotfiles like .graphqlrc.js)
  {
    files: ['.*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...nodeGlobals,
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
    ...js.configs.recommended,
  },

  // JavaScript files
  {
    files: ['**/*.js'],
    ignores: ['*.config.js', '.*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: nodeGlobals,
    },
    ...js.configs.recommended,
  },

  // TypeScript files
  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: tsparser,
      parserOptions: {
        project: './tsconfig.eslint.json',
      },
      globals: nodeGlobals,
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'import-x': importPlugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,

      // Import organization
      'import-x/order': [
        'error',
        {
          alphabetize: { order: 'asc' },
          'newlines-between': 'never',
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        },
      ],
      'import-x/no-duplicates': 'error',

      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',

      // Turn off base rule in favor of TypeScript version
      'no-unused-vars': 'off',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'MemberExpression[object.name="process"][property.name="env"]',
          message: 'Use strictly typed env fetchers (like getDevAccessToken) or dedicate specific env files instead of directly accessing process.env.',
        },
      ],
    },
  },

  // Detect circular imports across the source tree
  {
    files: ['src/**/*.ts'],
    settings: {
      // Imports use ESM-style `.js` specifiers that point to `.ts` sources.
      // Teach import-x to resolve (and traverse) them so `no-cycle` can build the module graph.
      'import-x/extensions': ['.ts', '.js'],
      'import-x/resolver-next': [
        createNodeResolver({
          extensions: ['.ts', '.js'],
          extensionAlias: { '.js': ['.ts', '.js'] },
        }),
      ],
    },
    rules: {
      'import-x/no-cycle': 'error',
    },
  },

  // Internal modules must not depend on the public entrypoint (prevents circular imports)
  {
    files: ['src/lib/**/*.ts', 'src/options/**/*.ts', 'src/utils/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/entrypoint.api.js', '**/backport-run.js'],
              message:
                'Internal modules must not import the public entrypoint — import from the canonical module (e.g. lib/backport-error.js, lib/sourceCommit/parse-source-commit.js) instead.',
            },
          ],
        },
      ],
    },
  },

  // Test files - additional globals and relaxed rules
  {
    files: [
      '**/*.{test,spec}.{js,ts}',
      '**/test/**/*.{js,ts}',
      'vitest.config*.ts',
    ],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
      // Test helpers are parameterized for readability, even when every call passes the same value
      'unicorn/no-unnecessary-parameters': 'off',
      // Allow process.env strictly in tests and vitest configs
      'no-restricted-syntax': 'off',
    },
  },
];
