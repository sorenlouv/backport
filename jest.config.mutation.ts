import type { Config } from 'jest';
import baseConfig from './jest.config.ts';

const config: Config = {
  ...baseConfig,

  // only include "mutation" tests that cannot run on in parallel (like they are on CI) because they mutate shared state
  testRegex: ['.*.mutation.test.ts$'],
  modulePathIgnorePatterns: [],
};

export default config;
