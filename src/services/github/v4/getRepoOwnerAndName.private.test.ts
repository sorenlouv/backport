import * as childProcess from '../../../services/child-process-promisified';
import { getDevAccessToken } from '../../../test/private/getDevAccessToken';
import { getSandboxPath, resetSandbox } from '../../../test/sandbox';
import { getRepoOwnerAndName } from './getRepoOwnerAndName';

const sandboxPath = getSandboxPath({ filename: __filename });

describe('fetchRemoteProjectConfig', () => {
  let devAccessToken: string;

  beforeEach(async () => {
    devAccessToken = await getDevAccessToken();
  });

  describe('when the remote is a fork', () => {
    it('retrives the original owner from github', async () => {
      await resetSandbox(sandboxPath);
      const execOpts = { cwd: sandboxPath };
      await childProcess.exec(`git init`, execOpts);
      await childProcess.exec(
        `git remote add sqren git@github.com:sqren/kibana.git`,
        execOpts
      );

      expect(
        await getRepoOwnerAndName({
          accessToken: devAccessToken,
          cwd: sandboxPath,
        })
      ).toEqual({
        repoName: 'kibana',
        repoOwner: 'elastic',
      });
    });
  });

  describe('when none of the git remotes are found', () => {
    it('swallows the error and returns empty', async () => {
      await resetSandbox(sandboxPath);
      const execOpts = { cwd: sandboxPath };
      await childProcess.exec(`git init`, execOpts);
      await childProcess.exec(
        `git remote add foo git@github.com:foo/kibana.git`,
        execOpts
      );

      await childProcess.exec(
        `git remote add bar git@github.com:bar/kibana.git`,
        execOpts
      );

      expect(
        await getRepoOwnerAndName({
          accessToken: devAccessToken,
          cwd: sandboxPath,
        })
      ).toEqual({});
    });
  });

  describe('when there are no git remotes', () => {
    it('returns empty', async () => {
      await resetSandbox(sandboxPath);
      const execOpts = { cwd: sandboxPath };
      await childProcess.exec(`git init`, execOpts);

      expect(
        await getRepoOwnerAndName({
          accessToken: devAccessToken,
          cwd: sandboxPath,
        })
      ).toEqual({});
    });
  });
});
