import { defineConfig } from 'vitest/config';

// ensure timezone is always in UTC
process.env.TZ = 'UTC';
process.env.NODE_ENV = 'test';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // no exclusions — run all tests including private and mutation
    exclude: [],
    retry: 3,
    setupFiles: ['./src/test/setupFiles/automatic-mocks.ts'],
    clearMocks: true,
    snapshotSerializers: ['./src/test/setupFiles/snapshot-serializer-ansi.ts'],
    pool: 'forks',
    maxWorkers: 1,
  },
});
