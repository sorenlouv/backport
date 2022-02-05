import { resolve } from 'path';
import del from 'del';
import makeDir from 'make-dir';
import { ValidConfigOptions } from '../options/options';
import { mockGqlRequest } from '../test/nockHelpers';
import { SpyHelper } from '../types/SpyHelper';
import * as childProcess from './child-process-promisified';
import {
  cherrypick,
  cloneRepo,
  getIsCommitInBranch,
  getSourceRepoPath,
} from './git';
import { getShortSha } from './github/commitFormatters';
import { RepoOwnerAndNameResponse } from './github/v4/getRepoOwnerAndName';

jest.unmock('make-dir');
jest.unmock('del');

const GIT_SANDBOX_DIR_PATH = resolve(
  `${__dirname}/_tmp_sandbox_/git.integration.test`
);

async function resetGitSandbox(specName: string) {
  await del(GIT_SANDBOX_DIR_PATH);
  await makeDir(`${GIT_SANDBOX_DIR_PATH}/${specName}`);
}

async function createAndCommitFile({
  filename,
  content,
  execOpts,
}: {
  filename: string;
  content: string;
  execOpts: { cwd: string };
}) {
  await childProcess.exec(`echo "${content}" > "${filename}"`, execOpts);
  await childProcess.exec(
    `git add -A && git commit -m 'Update ${filename}'`,
    execOpts
  );

  return getCurrentSha(execOpts);
}

async function getCurrentSha(execOpts: { cwd: string }) {
  const { stdout } = await childProcess.exec('git rev-parse HEAD', execOpts);
  return stdout.trim();
}

async function getCurrentMessage(execOpts: { cwd: string }) {
  const { stdout } = await childProcess.exec(
    'git --no-pager log -1 --pretty=%B',
    execOpts
  );
  return stdout.trim();
}

describe('git.integration', () => {
  describe('getIsCommitInBranch', () => {
    let firstSha: string;
    let secondSha: string;

    beforeEach(async () => {
      await resetGitSandbox('getIsCommitInBranch');
      const execOpts = { cwd: GIT_SANDBOX_DIR_PATH };

      // create and commit first file
      await childProcess.exec('git init', execOpts);
      firstSha = await createAndCommitFile({
        filename: 'foo.md',
        content: 'My first file',
        execOpts,
      });

      // create 7.x branch (but stay on `main` branch)
      await childProcess.exec('git branch 7.x', execOpts);

      // create and commit second file
      secondSha = await createAndCommitFile({
        filename: 'bar.md',
        content: 'My second file',
        execOpts,
      });

      // checkout 7.x
      await childProcess.exec('git checkout 7.x', execOpts);
    });

    it('should contain the first commit', async () => {
      const isFirstCommitInBranch = await getIsCommitInBranch(
        { dir: GIT_SANDBOX_DIR_PATH } as ValidConfigOptions,
        firstSha
      );

      expect(isFirstCommitInBranch).toEqual(true);
    });

    it('should not contain the second commit', async () => {
      const isSecondCommitInBranch = await getIsCommitInBranch(
        { dir: GIT_SANDBOX_DIR_PATH } as ValidConfigOptions,
        secondSha
      );

      expect(isSecondCommitInBranch).toEqual(false);
    });

    it('should not contain a random commit', async () => {
      const isSecondCommitInBranch = await getIsCommitInBranch(
        { dir: GIT_SANDBOX_DIR_PATH } as ValidConfigOptions,
        'abcdefg'
      );

      expect(isSecondCommitInBranch).toEqual(false);
    });
  });

  describe('cherrypick', () => {
    let firstSha: string;
    let secondSha: string;
    let fourthSha: string;
    let execOpts: { cwd: string };

    beforeEach(async () => {
      await resetGitSandbox('cherrypick');
      execOpts = { cwd: GIT_SANDBOX_DIR_PATH };

      // create and commit first file
      await childProcess.exec('git init', execOpts);
      firstSha = await createAndCommitFile({
        filename: 'foo.md',
        content: 'Creating first file',
        execOpts,
      });

      // create 7.x branch (but stay on `main` branch)
      await childProcess.exec('git branch 7.x', execOpts);

      // create and commit second file
      secondSha = await createAndCommitFile({
        filename: 'bar.md',
        content: 'Creating second file\nHello',
        execOpts,
      });

      // edit first file
      await createAndCommitFile({
        filename: 'foo.md',
        content: 'Changing first file',
        execOpts,
      });

      // edit first file
      fourthSha = await createAndCommitFile({
        filename: 'foo.md',
        content: 'Some more changes to the first file',
        execOpts,
      });

      // checkout 7.x
      await childProcess.exec('git checkout 7.x', execOpts);
    });

    it('should not cherrypick commit that already exists', async () => {
      const shortSha = getShortSha(firstSha);
      return expect(() =>
        cherrypick(
          { dir: GIT_SANDBOX_DIR_PATH } as ValidConfigOptions,
          firstSha
        )
      ).rejects.toThrowError(
        `Cherrypick failed because the selected commit (${shortSha}) is empty. Did you already backport this commit?`
      );
    });

    it('should cherrypick commit cleanly', async () => {
      const res = await cherrypick(
        {
          cherrypickRef: false,
          dir: GIT_SANDBOX_DIR_PATH,
        } as ValidConfigOptions,
        secondSha
      );
      expect(res).toEqual({
        conflictingFiles: [],
        needsResolving: false,
        unstagedFiles: [],
      });

      const message = await getCurrentMessage(execOpts);

      expect(message).toEqual(`Update bar.md`);
    });

    it('should cherrypick commit cleanly and append "(cherry picked from commit...)"', async () => {
      const res = await cherrypick(
        {
          cherrypickRef: true,
          dir: GIT_SANDBOX_DIR_PATH,
        } as ValidConfigOptions,
        secondSha
      );
      expect(res).toEqual({
        conflictingFiles: [],
        needsResolving: false,
        unstagedFiles: [],
      });

      const message = await getCurrentMessage(execOpts);

      expect(message).toEqual(
        `Update bar.md\n\n(cherry picked from commit ${secondSha})`
      );
    });

    it('should cherrypick commit with conflicts', async () => {
      const res = await cherrypick(
        { dir: GIT_SANDBOX_DIR_PATH } as ValidConfigOptions,
        fourthSha
      );
      expect(res).toEqual({
        needsResolving: true,
        conflictingFiles: [
          {
            absolute: `${GIT_SANDBOX_DIR_PATH}/foo.md`,
            relative: 'foo.md',
          },
        ],
        unstagedFiles: [`${GIT_SANDBOX_DIR_PATH}/foo.md`],
      });
    });
  });

  describe('cloneRepo', () => {
    const sourceRepo = `${GIT_SANDBOX_DIR_PATH}/clone/source-repo`;
    const backportRepo = `${GIT_SANDBOX_DIR_PATH}/clone/backport-repo`;
    let execSpy: SpyHelper<typeof childProcess.execAsCallback>;

    beforeEach(async () => {
      await del(GIT_SANDBOX_DIR_PATH);
      await makeDir(sourceRepo);

      const execOpts = { cwd: sourceRepo };
      await childProcess.exec(`git init`, execOpts);
      await childProcess.exec(
        `git remote add origin git@github.com:elastic/kibana.git`,
        execOpts
      );

      await createAndCommitFile({
        filename: 'my-file.txt',
        content: 'Hello!',
        execOpts,
      });

      execSpy = jest.spyOn(childProcess, 'execAsCallback');
    });

    it('clones the repo', async () => {
      await cloneRepo(
        { sourcePath: sourceRepo, targetPath: backportRepo },
        () => null
      );

      expect(execSpy).toHaveBeenCalledTimes(1);
      expect(execSpy.mock.calls[0][0].startsWith('git clone ')).toBe(true);
    });
  });

  describe('getSourceRepoPath', () => {
    const sourceRepo = `${GIT_SANDBOX_DIR_PATH}/clone/source-repo`;

    beforeEach(async () => {
      await del(GIT_SANDBOX_DIR_PATH);
      await makeDir(sourceRepo);

      const execOpts = { cwd: sourceRepo };
      await childProcess.exec(`git init`, execOpts);
      await childProcess.exec(
        `git remote add origin git@github.com:elastic/kibana.git`,
        execOpts
      );

      mockRepoOwnerAndName({
        childRepoOwner: 'sqren',
        parentRepoOwner: 'elastic',
        repoName: 'kibana',
      });
    });

    it('returns local source repo, when one remote matches', async () => {
      const options = {
        accessToken: 'verysecret',
        repoName: 'kibana',
        repoOwner: 'elastic',
        cwd: sourceRepo,
        githubApiBaseUrlV4: 'http://localhost/graphql', // required to mock the response
      } as ValidConfigOptions;
      const sourcePath = await getSourceRepoPath(options);
      expect(sourcePath).toBe(sourceRepo);
    });

    it("returns remote source repo when remotes don't match", async () => {
      const options = {
        accessToken: 'verysecret',
        repoName: 'kibana',
        repoOwner: 'no-a-match',
        cwd: sourceRepo,
        githubApiBaseUrlV4: 'http://localhost/graphql', // required to mock the response
      } as ValidConfigOptions;
      const sourcePath = await getSourceRepoPath(options);
      expect(sourcePath).toBe(
        'https://x-access-token:verysecret@github.com/no-a-match/kibana.git'
      );
    });
  });
});

function mockRepoOwnerAndName({
  repoName,
  parentRepoOwner,
  childRepoOwner,
}: {
  repoName: string;
  childRepoOwner: string;
  parentRepoOwner?: string;
}) {
  return mockGqlRequest<RepoOwnerAndNameResponse>({
    name: 'RepoOwnerAndName',
    statusCode: 200,
    body: {
      data: {
        // @ts-expect-error
        repository: {
          isFork: !!parentRepoOwner,
          name: repoName,
          owner: {
            login: childRepoOwner,
          },
          parent: parentRepoOwner
            ? {
                owner: {
                  login: parentRepoOwner,
                },
              }
            : null,
        },
      },
    },
  });
}
