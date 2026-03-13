import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config.ts';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      // only include (private) tests that cannot run on CI because they require credentials
      include: ['src/**/*.private.test.ts'],
      exclude: [],
      retry: 2,
      pool: 'forks',
      poolOptions: {
        forks: {
          singleFork: true,
        },
      },
    },
  }),
);
