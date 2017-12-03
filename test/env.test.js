const os = require('os');
const {
  getGlobalConfigPath,
  getReposPath,
  getRepoOwnerPath,
  getRepoPath
} = require('../src/lib/env');

describe('getGlobalConfigPath', () => {
  it('should return path to config.json ', () => {
    os.homedir = jest.fn(() => '/myHomeDir');
    expect(getGlobalConfigPath()).toBe('/myHomeDir/.backport/config.json');
  });
});

describe('getReposPath', () => {
  it('should return path to config.json ', () => {
    os.homedir = jest.fn(() => '/myHomeDir');
    expect(getReposPath()).toBe('/myHomeDir/.backport/repositories');
  });
});

describe('getRepoOwnerPath', () => {
  it('should return path to config.json ', () => {
    os.homedir = jest.fn(() => '/myHomeDir');
    expect(getRepoOwnerPath('elastic')).toBe(
      '/myHomeDir/.backport/repositories/elastic'
    );
  });
});

describe('getRepoPath', () => {
  it('should return path to config.json ', () => {
    os.homedir = jest.fn(() => '/myHomeDir');
    expect(getRepoPath('elastic', 'kibana')).toBe(
      '/myHomeDir/.backport/repositories/elastic/kibana'
    );
  });
});
