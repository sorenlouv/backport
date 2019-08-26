import { BackportOptions } from '../options/options';
import {
  getGlobalConfigPath,
  getRepoOwnerPath,
  getRepoPath,
  getReposPath
} from '../services/env';

describe('env', () => {
  test('getGlobalConfigPath', () => {
    expect(getGlobalConfigPath()).toBe('/myHomeDir/.backport/config.json');
  });

  test('getReposPath', () => {
    expect(getReposPath()).toBe('/myHomeDir/.backport/repositories');
  });

  test('getRepoOwnerPath', () => {
    expect(getRepoOwnerPath({ repoOwner: 'elastic' } as BackportOptions)).toBe(
      '/myHomeDir/.backport/repositories/elastic'
    );
  });

  test('getRepoPath', () => {
    expect(
      getRepoPath({
        repoOwner: 'elastic',
        repoName: 'kibana'
      } as BackportOptions)
    ).toBe('/myHomeDir/.backport/repositories/elastic/kibana');
  });
});
