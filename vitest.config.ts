import { defineConfig } from 'vitest/config';

// ensure timezone is always in UTC
process.env.TZ = 'UTC';
process.env.NODE_ENV = 'test';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // exclude "private" tests that require credentials and cannot run on CI for external contributors
    // exclude "mutation" tests that cannot run in parallel because they mutate shared state
    exclude: ['**/*.private.test.ts', '**/*.mutation.test.ts'],
    setupFiles: ['./src/test/setupFiles/automatic-mocks.ts'],
    clearMocks: true,
    snapshotSerializers: ['./src/test/setupFiles/snapshot-serializer-ansi.ts'],
  },
});
