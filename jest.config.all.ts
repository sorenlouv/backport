import baseConfig from './jest.config.ts';

const config = {
  ...baseConfig,
  modulePathIgnorePatterns: [],
};

export default config;
