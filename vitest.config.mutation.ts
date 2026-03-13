import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config.ts';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      // only include "mutation" tests that cannot run in parallel because they mutate shared state
      include: ['src/**/*.mutation.test.ts'],
      exclude: [],
      pool: 'forks',
      poolOptions: {
        forks: {
          singleFork: true,
        },
      },
    },
  }),
);
