import { resolve } from 'path';
import del from 'del';
import makeDir from 'make-dir';
import * as childProcess from '../../../services/child-process-promisified';
import { getDevAccessToken } from '../../../test/private/getDevAccessToken';
import { getRepoOwnerAndName } from './getRepoOwnerAndName';

jest.unmock('make-dir');
jest.unmock('del');

describe('fetchRemoteProjectConfig', () => {
  let devAccessToken: string;

  async function resetSandbox() {
    const GIT_SANDBOX_DIR_PATH = resolve(
      `${__dirname}/_tmp_sandbox_/getRepoOwnerAndName.private.test`
    );

    console.log(__dirname, GIT_SANDBOX_DIR_PATH);

    await del(GIT_SANDBOX_DIR_PATH);
    await makeDir(GIT_SANDBOX_DIR_PATH);

    return GIT_SANDBOX_DIR_PATH;
  }

  beforeEach(async () => {
    devAccessToken = await getDevAccessToken();
  });

  describe('when the remote is a fork', () => {
    it('retrives the original owner from github', async () => {
      const sandboxPath = await resetSandbox();
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
      const sandboxPath = await resetSandbox();
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
      const sandboxPath = await resetSandbox();
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
