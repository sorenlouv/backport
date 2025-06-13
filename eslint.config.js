const { FlatCompat } = require('@eslint/eslintrc');
const js = require('@eslint/js');
const path = require('path');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

module.exports = [
  // Global ignores - these are applied to all files
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'src/graphql/generated/**',
      'coverage/**',
      '*.config.js',
      'jest.*.js',
      'bin/**',
    ],
  },

  // Base recommended config
  js.configs.recommended,
  
  // Legacy configs via FlatCompat
  ...compat.extends(
    'plugin:@typescript-eslint/recommended',
    'plugin:jest/recommended',
    'plugin:prettier/recommended'
  ),
  
  // Configuration for JavaScript files
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        NodeJS: true,
        process: true,
        console: true,
        Buffer: true,
        __dirname: true,
        __filename: true,
        module: true,
        require: true,
        exports: true,
        global: true,
      },
    },
    plugins: {
      'jest': require('eslint-plugin-jest'),
      'import': require('eslint-plugin-import'),
      'prettier': require('eslint-plugin-prettier'),
    },
    rules: {
      // Import ordering rules
      'import/order': [
        'error',
        {
          alphabetize: { order: 'asc' },
          'newlines-between': 'never',
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
          ],
        },
      ],
      'no-console': 'error',
      'prettier/prettier': 'error',
    },
  },
  
  // Configuration for TypeScript files
  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: require('@typescript-eslint/parser'),
      parserOptions: {
        project: ['./tsconfig.eslint.json'],
      },
      globals: {
        NodeJS: true,
        process: true,
        console: true,
        Buffer: true,
        __dirname: true,
        __filename: true,
        module: true,
        require: true,
        exports: true,
        global: true,
      },
    },
    plugins: {
      '@typescript-eslint': require('@typescript-eslint/eslint-plugin'),
      'jest': require('eslint-plugin-jest'),
      'import': require('eslint-plugin-import'),
      'prettier': require('eslint-plugin-prettier'),
    },
    rules: {
      // Import ordering rules
      'import/order': [
        'error',
        {
          alphabetize: { order: 'asc' },
          'newlines-between': 'never',
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
          ],
        },
      ],
      'no-console': 'error',

      // Prefer typescript specific `no-unused-vars` rule
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error'],

      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/prefer-ts-expect-error': 'error',

      // Disabled rules
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-use-before-define': 'off',

      // Prettier integration
      'prettier/prettier': 'error',
    },
  },
];
