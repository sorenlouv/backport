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
    },
  },

  // Rules added to (or tightened in) unicorn's recommended preset between v65
  // and v77 that existing code does not yet satisfy. Disabled so the plugin
  // upgrade lands without code churn; adopt them incrementally and remove from
  // this list as the violations are fixed.
  {
    rules: {
      'unicorn/consistent-boolean-name': 'off',
      'unicorn/consistent-compound-words': 'off',
      'unicorn/consistent-conditional-object-spread': 'off',
      'unicorn/filename-case': 'off',
      'unicorn/max-nested-calls': 'off',
      'unicorn/no-asterisk-prefix-in-documentation-comments': 'off',
      'unicorn/no-declarations-before-early-exit': 'off',
      'unicorn/no-global-object-property-assignment': 'off',
      'unicorn/no-non-function-verb-prefix': 'off',
      'unicorn/no-top-level-assignment-in-function': 'off',
      'unicorn/no-top-level-side-effects': 'off',
      'unicorn/no-unnecessary-boolean-comparison': 'off',
      'unicorn/no-unnecessary-parameters': 'off',
      'unicorn/no-unreadable-for-of-expression': 'off',
      'unicorn/no-unsafe-string-replacement': 'off',
      'unicorn/no-useless-coercion': 'off',
      'unicorn/no-useless-template-literals': 'off',
      'unicorn/prefer-await': 'off',
      'unicorn/prefer-combined-guards': 'off',
      'unicorn/prefer-continue': 'off',
      'unicorn/prefer-early-return': 'off',
      'unicorn/prefer-includes-over-repeated-comparisons': 'off',
      'unicorn/prefer-literal-ascii': 'off',
      'unicorn/prefer-minimal-ternary': 'off',
      'unicorn/prefer-number-coercion': 'off',
      'unicorn/prefer-number-is-safe-integer': 'off',
      'unicorn/prefer-object-iterable-methods': 'off',
      'unicorn/prefer-short-escape-sequences': 'off',
      'unicorn/prefer-simple-condition-first': 'off',
      'unicorn/prefer-smaller-scope': 'off',
      'unicorn/prefer-split-limit': 'off',
      'unicorn/prefer-ternary': 'off',
      'unicorn/prefer-then-catch': 'off',
      'unicorn/prefer-unicode-code-point-escapes': 'off',
      'unicorn/prefer-url-href': 'off',
      'unicorn/single-line-block-comment-style': 'off',
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
      // Allow process.env strictly in tests and vitest configs
      'no-restricted-syntax': 'off',
    },
  },
];
