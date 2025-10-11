import type { Config } from 'jest';
import baseConfig from './jest.config.ts';

const config: Config = {
  ...baseConfig,
  modulePathIgnorePatterns: [],
};

export default config;
