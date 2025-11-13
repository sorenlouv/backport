/**
 * @jest-config-loader-options {"compilerOptions":{"allowImportingTsExtensions":true}}
 */
import type { Config } from 'jest';
import baseConfig from './jest.config.ts';

const config: Config = {
  ...baseConfig,

  // only include (private) tests that cannot run on CI because they require credentials and thus exclude external contributors
  testRegex: ['.*.private.test.ts$'],
  modulePathIgnorePatterns: [],
};

export default config;
