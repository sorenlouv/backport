module.exports = {
  snapshotSerializers: ['jest-snapshot-serializer-ansi'],
  setupFiles: ['./src/test/setupFiles/automatic-mocks.ts'],
  preset: 'ts-jest',
  testRegex: '(test|src)/.*test.ts$',

  // exclude private tests that requires credentials and can therefore not run on CI for external contributors
  modulePathIgnorePatterns: ['.*.private.test.ts$'],

  moduleFileExtensions: ['ts', 'js', 'json'],
  globals: {
    'ts-jest': {
      diagnostics: false,
    },
  },
};
