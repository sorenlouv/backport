import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import-x';
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
      'unicorn/prevent-abbreviations': 'off',
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
