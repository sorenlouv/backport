import { defineConfig } from 'vitest/config';

// ensure timezone is always in UTC
process.env.TZ = 'UTC';
process.env.NODE_ENV = 'test';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.unit.test.ts'],
    setupFiles: ['./src/test/setupFiles/automatic-mocks.ts'],
    clearMocks: true,
    snapshotSerializers: ['./src/test/setupFiles/snapshot-serializer-ansi.ts'],
  },
});
