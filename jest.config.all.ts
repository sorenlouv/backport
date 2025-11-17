/**
 * @jest-config-loader-options {"compilerOptions":{"allowImportingTsExtensions":true}}
 */
import type { Config } from 'jest';
import baseConfig from './jest.config.ts';

const config: Config = {
  ...baseConfig,
  modulePathIgnorePatterns: [],
};

export default config;
