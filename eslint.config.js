import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';

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
      import: importPlugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,

      // Import organization
      'import/order': [
        'error',
        {
          alphabetize: { order: 'asc' },
          'newlines-between': 'never',
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        },
      ],
      'import/no-duplicates': 'error',

      // Essential TypeScript rules
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',

      // Turn off base rule in favor of TypeScript version
      'no-unused-vars': 'off',
    },
  },

  // Test files - relaxed rules and Vitest globals
  {
    files: ['**/*.{test,spec}.{js,ts}', '**/test/**/*.{js,ts}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: './tsconfig.eslint.json',
      },
      globals: {
        ...nodeGlobals,
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
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'error',
    },
  },
];
