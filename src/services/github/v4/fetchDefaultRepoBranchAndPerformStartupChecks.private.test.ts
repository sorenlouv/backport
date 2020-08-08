import { BackportOptions } from '../../../options/options';
import { getTestCredentials } from '../../../test/private/getTestCredentials';
import { fetchDefaultRepoBranchAndPerformStartupChecks } from './fetchDefaultRepoBranchAndPerformStartupChecks';

describe('fetchDefaultRepoBranchAndPerformStartupChecks', () => {
  let accessToken: string;

  beforeAll(async () => {
    const config = await getTestCredentials();
    accessToken = config.accessToken;
  });

  describe('accessToken is invalid', () => {
    it('throws an error', async () => {
      const options = {
        accessToken: 'foo',
        githubApiBaseUrlV4: 'https://api.github.com/graphql',
        repoName: 'backport-demo',
        repoOwner: 'sqren',
      } as BackportOptions;

      await expect(
        fetchDefaultRepoBranchAndPerformStartupChecks(options)
      ).rejects.toThrowError(
        'Please check your access token and make sure it is valid.\nConfig: /myHomeDir/.backport/config.json'
      );
    });
  });

  describe('accessToken is valid', () => {
    it('returns the default branch', async () => {
      const options = {
        accessToken: accessToken,
        githubApiBaseUrlV4: 'https://api.github.com/graphql',
        repoName: 'backport-demo',
        repoOwner: 'sqren',
      } as BackportOptions;

      expect(
        await fetchDefaultRepoBranchAndPerformStartupChecks(options)
      ).toEqual({ defaultBranch: 'master' });
    });
  });
});
