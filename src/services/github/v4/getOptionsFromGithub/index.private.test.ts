import { OptionsFromCliArgs } from '../../../../options/cliArgs';
import { OptionsFromConfigFiles } from '../../../../options/config/config';
import { getDevAccessToken } from '../../../../test/private/getDevAccessToken';
import { getOptionsFromGithub } from '.';

describe('getOptionsFromGithub', () => {
  let devAccessToken: string;

  beforeAll(async () => {
    devAccessToken = await getDevAccessToken();
  });

  describe('access token', () => {
    describe('is invalid', () => {
      it('throws an error', async () => {
        const optionsFromConfigFiles = {
          username: 'sqren',
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

    describe('is valid', () => {
      // skip test until the following file has been updated:
      // https://github.com/backport-org/backport-e2e/blob/master/.backportrc.json
      //
      // eslint-disable-next-line jest/no-disabled-tests
      it.skip('returns the options', async () => {
        const optionsFromConfigFiles = {
          username: 'sqren',
          accessToken: devAccessToken,
          githubApiBaseUrlV4: 'https://api.github.com/graphql',
          upstream: 'backport-org/backport-e2e',
        } as OptionsFromConfigFiles;
        const optionsFromCliArgs = {} as OptionsFromCliArgs;

        expect(
          await getOptionsFromGithub(optionsFromConfigFiles, optionsFromCliArgs)
        ).toEqual({
          sourceBranch: 'master',
          targetBranchChoices: [
            { name: 'master', sourcePRLabels: ['8.0.0'] },
            { name: '7.x', sourcePRLabels: ['7.9.*'] },
            { name: '7.8', sourcePRLabels: ['7.8.*'] },
          ],
          targetPRLabels: ['backport'],
          upstream: 'backport-org/backport-e2e',
        });
      });
    });
  });

  describe('when using fork as upstream', () => {
    it('uses upstream of parent', async () => {
      const optionsFromConfigFiles = {
        username: 'sqren',
        accessToken: devAccessToken,
        githubApiBaseUrlV4: 'https://api.github.com/graphql',
        upstream: 'sqren/backport-e2e',
      } as OptionsFromConfigFiles;
      const optionsFromCliArgs = {} as OptionsFromCliArgs;

      const options = await getOptionsFromGithub(
        optionsFromConfigFiles,
        optionsFromCliArgs
      );

      await expect(options.upstream).toEqual('backport-org/backport-e2e');
    });
  });

  describe('sourceBranch', () => {
    describe('when no sourceBranch is specified', () => {
      it('uses the default branch of the repo', async () => {
        const optionsFromConfigFiles = {
          username: 'sqren',
          accessToken: devAccessToken,
          githubApiBaseUrlV4: 'https://api.github.com/graphql',
          upstream: 'backport-org/repo-with-non-standard-main-branch',
        } as OptionsFromConfigFiles;
        const optionsFromCliArgs = {} as OptionsFromCliArgs;

        const options = await getOptionsFromGithub(
          optionsFromConfigFiles,
          optionsFromCliArgs
        );

        await expect(options.sourceBranch).toEqual('my-custom-default-branch');
      });
    });

    describe('when sourceBranch is specified', () => {
      it('uses that as sourceBranch if nothing else is specified', async () => {
        const optionsFromConfigFiles = {
          sourceBranch: 'my-specific-source-branch',
          username: 'sqren',
          accessToken: devAccessToken,
          githubApiBaseUrlV4: 'https://api.github.com/graphql',
          upstream: 'backport-org/repo-with-non-standard-main-branch',
        } as OptionsFromConfigFiles;
        const optionsFromCliArgs = {} as OptionsFromCliArgs;

        const options = await getOptionsFromGithub(
          optionsFromConfigFiles,
          optionsFromCliArgs
        );

        await expect(options.sourceBranch).toEqual('my-specific-source-branch');
      });
    });
  });

  describe('when a branch named "backport"', () => {
    describe('exists', () => {
      it('shows a warning', async () => {
        const optionsFromConfigFiles = {
          username: 'sqren',
          accessToken: devAccessToken,
          githubApiBaseUrlV4: 'https://api.github.com/graphql',
          upstream: 'backport-org/repo-with-branch-named-backport',
        } as OptionsFromConfigFiles;
        const optionsFromCliArgs = {} as OptionsFromCliArgs;

        await expect(async () => {
          await getOptionsFromGithub(
            optionsFromConfigFiles,
            optionsFromCliArgs
          );
        }).rejects.toThrowError(
          'You must delete the branch "backport" to continue. See https://github.com/sqren/backport/issues/155 for details'
        );
      });
    });
  });

  describe('when a backportrc.json config was deleted from repo', () => {
    it('does not throw', async () => {
      const optionsFromConfigFiles = {
        username: 'sqren',
        accessToken: devAccessToken,
        githubApiBaseUrlV4: 'https://api.github.com/graphql',
        upstream: 'backport-org/repo-with-backportrc-removed',
      } as OptionsFromConfigFiles;
      const optionsFromCliArgs = {} as OptionsFromCliArgs;

      const options = await getOptionsFromGithub(
        optionsFromConfigFiles,
        optionsFromCliArgs
      );

      expect(options).toEqual({ sourceBranch: 'main' });
    });
  });
});
