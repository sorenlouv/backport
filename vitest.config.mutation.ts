import { defineConfig } from 'vitest/config';

// ensure timezone is always in UTC
process.env.TZ = 'UTC';
process.env.NODE_ENV = 'test';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // only include "mutation" tests that cannot run in parallel because they mutate shared state
    include: ['src/**/*.mutation.test.ts'],
    exclude: [],
    retry: 3,
    setupFiles: ['./src/test/setupFiles/automatic-mocks.ts'],
    clearMocks: true,
    snapshotSerializers: ['./src/test/setupFiles/snapshot-serializer-ansi.ts'],
    pool: 'forks',
    maxWorkers: 1,
    isolate: false,
  },
});
