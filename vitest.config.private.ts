import { defineConfig } from 'vitest/config';

// ensure timezone is always in UTC
process.env.TZ = 'UTC';
process.env.NODE_ENV = 'test';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // "private" tests require a GITHUB_TOKEN, so they only run on CI for non-fork branches
    include: ['src/**/*.private.test.ts'],
    exclude: [],
    retry: process.env.CI ? 2 : 1,
    setupFiles: ['./src/test/setupFiles/automatic-mocks.ts'],
    clearMocks: true,
    snapshotSerializers: ['./src/test/setupFiles/snapshot-serializer-ansi.ts'],
    testTimeout: 15_000,
    hookTimeout: 15_000,
    pool: 'forks',
    maxWorkers: 1,
    isolate: false,
  },
});
