import { defineConfig } from 'vitest/config';

// ensure timezone is always in UTC
process.env.TZ = 'UTC';
process.env.NODE_ENV = 'test';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    retry: 3,
    pool: 'forks',
    maxWorkers: 1,
  },
});
