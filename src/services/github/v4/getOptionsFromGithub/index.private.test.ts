import { OptionsFromCliArgs } from '../../../../options/cliArgs';
import { OptionsFromConfigFiles } from '../../../../options/config/config';
import { getDevAccessToken } from '../../../../test/private/getDevAccessToken';
import { getOptionsFromGithub } from '.';

describe('getOptionsFromGithub', () => {
  let devAccessToken: string;

  beforeAll(async () => {
    devAccessToken = await getDevAccessToken();
  });

  describe('accessToken is invalid', () => {
    it('throws an error', async () => {
      const optionsFromConfigFiles = {
        accessToken: 'foo',
        githubApiBaseUrlV4: 'https://api.github.com/graphql',
        upstream: 'backport-org/backport-e2e',
      } as OptionsFromConfigFiles;
      const optionsFromCliArgs = {} as OptionsFromCliArgs;

      await expect(
        getOptionsFromGithub(optionsFromConfigFiles, optionsFromCliArgs)
      ).rejects.toThrowError(
        'Please check your access token and make sure it is valid.\nConfig: /myHomeDir/.backport/config.json'
      );
    });
  });

  describe('accessToken is valid', () => {
    it('returns the default branch', async () => {
      const optionsFromConfigFiles = {
        accessToken: devAccessToken,
        githubApiBaseUrlV4: 'https://api.github.com/graphql',
        upstream: 'backport-org/backport-e2e',
      } as OptionsFromConfigFiles;
      const optionsFromCliArgs = {} as OptionsFromCliArgs;

      expect(
        await getOptionsFromGithub(optionsFromConfigFiles, optionsFromCliArgs)
      ).toEqual({
        defaultBranch: 'master',
      });
    });
  });
});
