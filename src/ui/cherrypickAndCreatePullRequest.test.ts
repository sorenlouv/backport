import axios from 'axios';
import dedent from 'dedent';
import ora from 'ora';
import * as childProcess from '../services/child-process-promisified';
import * as logger from '../services/logger';
import * as prompts from '../services/prompts';
import { BackportOptions } from '../options/options';
import { CommitSelected } from '../types/Commit';
import { ExecError } from '../test/ExecError';
import { SpyHelper } from '../types/SpyHelper';
import { cherrypickAndCreatePullRequest } from './cherrypickAndCreatePullRequest';

describe('cherrypickAndCreatePullRequest', () => {
  let axiosRequestSpy: SpyHelper<typeof axios.request>;

  beforeEach(() => {
    axiosRequestSpy = jest
      .spyOn(axios, 'request')

      // mock: createPullRequest
      .mockResolvedValueOnce({
        data: {
          number: 1337,
          html_url: 'myHtmlUrl',
        },
      })

      // mock: addLabelsToPullRequest
      .mockResolvedValueOnce({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('when commit has a pull request reference', () => {
    let execSpy: SpyHelper<typeof childProcess.exec>;
    beforeEach(async () => {
      execSpy = jest
        .spyOn(childProcess, 'exec')

        // mock all exec commands to respond without errors
        .mockResolvedValue({ stdout: '', stderr: '' });

      const options = {
        githubApiBaseUrlV3: 'https://api.github.com',
        fork: true,
        labels: ['backport'],
        prDescription: 'myPrSuffix',
        prTitle: '[{baseBranch}] {commitMessages}',
        repoName: 'kibana',
        repoOwner: 'elastic',
        username: 'sqren',
        sourceBranch: 'myDefaultRepoBaseBranch',
      } as BackportOptions;

      const commits: CommitSelected[] = [
        {
          branch: '7.x',
          sha: 'mySha',
          formattedMessage: 'myCommitMessage (#1000)',
          pullNumber: 1000,
        },
        {
          branch: '7.x',
          sha: 'mySha2',
          formattedMessage: 'myOtherCommitMessage (#2000)',
          pullNumber: 2000,
        },
      ];

      await cherrypickAndCreatePullRequest({
        options,
        commits,
        baseBranch: '6.x',
      });
    });

    it('should make correct git commands', () => {
      expect(execSpy.mock.calls).toMatchSnapshot();
    });

    it('should start the spinner with the correct text', () => {
      expect((ora as any).mock.calls).toMatchInlineSnapshot(`
        Array [
          Array [
            "Pulling latest changes",
          ],
          Array [
            "Cherry-picking commit mySha",
          ],
          Array [
            "Cherry-picking commit mySha2",
          ],
          Array [
            "Pushing branch \\"sqren:backport/6.x/pr-1000_pr-2000\\"",
          ],
          Array [
            "Creating pull request",
          ],
        ]
      `);
    });

    it('should create pull request', () => {
      expect(axiosRequestSpy).toHaveBeenCalledTimes(2);
      const config = axiosRequestSpy.mock.calls[0][0];
      expect(config.url).toBe(
        'https://api.github.com/repos/elastic/kibana/pulls'
      );
      expect(config.data.title).toBe(
        '[6.x] myCommitMessage (#1000) | myOtherCommitMessage (#2000)'
      );
      expect(config.data.body).toBe(
        dedent(`Backports the following commits to 6.x:
   - myCommitMessage (#1000)
   - myOtherCommitMessage (#2000)

  myPrSuffix`)
      );
      expect(config.data.head).toBe('sqren:backport/6.x/pr-1000_pr-2000');
      expect(config.data.base).toBe('6.x');
    });

    it('it should add labels', () => {
      const config = axiosRequestSpy.mock.calls[1][0];

      expect(config.url).toBe(
        'https://api.github.com/repos/elastic/kibana/issues/1337/labels'
      );
      expect(config.data).toEqual(['backport']);
    });
  });

  describe('when commit does not have a pull request reference', () => {
    beforeEach(async () => {
      const options = {
        githubApiBaseUrlV3: 'https://api.github.com',
        fork: true,
        labels: ['backport'],
        prTitle: '[{baseBranch}] {commitMessages}',
        repoName: 'kibana',
        repoOwner: 'elastic',
        username: 'sqren',
      } as BackportOptions;

      await cherrypickAndCreatePullRequest({
        options,
        commits: [
          {
            branch: '7.x',
            sha: 'mySha',
            formattedMessage: 'myCommitMessage (mySha)',
          },
        ],
        baseBranch: '6.x',
      });
    });

    it('should create pull request', () => {
      expect(axiosRequestSpy).toHaveBeenCalledTimes(2);
      const config = axiosRequestSpy.mock.calls[0][0];

      expect(config.url).toBe(
        'https://api.github.com/repos/elastic/kibana/pulls'
      );
      expect(config.data.title).toBe('[6.x] myCommitMessage (mySha)');
      expect(config.data.body).toBe(
        `Backports the following commits to 6.x:
 - myCommitMessage (mySha)`
      );
      expect(config.data.head).toBe('sqren:backport/6.x/commit-mySha');
      expect(config.data.base).toBe('6.x');
    });

    it('it should add labels', () => {
      const config = axiosRequestSpy.mock.calls[1][0];

      expect(config.url).toBe(
        'https://api.github.com/repos/elastic/kibana/issues/1337/labels'
      );
      expect(config.data).toEqual(['backport']);
    });
  });

  describe('when cherry-picking fails', () => {
    it('should start conflict resolution mode', async () => {
      // spies
      const promptSpy = jest
        .spyOn(prompts, 'confirmPrompt')
        .mockResolvedValue(true);
      const logSpy = jest.spyOn(logger, 'consoleLog');
      const execSpy = setupExecSpy();

      const options = {
        fork: true,
        labels: ['backport'],
        prTitle: '[{baseBranch}] {commitMessages}',
        repoName: 'kibana',
        repoOwner: 'elastic',
        username: 'sqren',
        sourceBranch: 'myDefaultRepoBaseBranch',
      } as BackportOptions;

      const res = await runTimersUntilResolved(() =>
        cherrypickAndCreatePullRequest({
          options,
          commits: [
            {
              branch: '7.x',
              sha: 'mySha',
              formattedMessage: 'myCommitMessage',
            },
          ],
          baseBranch: '6.x',
        })
      );

      expect(res).toEqual({
        html_url: 'myHtmlUrl',
        number: 1337,
      });

      expect(promptSpy.mock.calls).toMatchInlineSnapshot(`
        Array [
          Array [
            "[0mThe following files have conflicts:[0m
        [0m - /myHomeDir/.backport/repositories/elastic/kibana/conflicting-file.txt[0m

        [0m[3mYou do not need to \`git add\` or \`git commit\` the files - simply fix the conflicts.[23m[0m

        Press ENTER to continue",
          ],
          Array [
            "[0mThe following files have conflicts:[0m
        [0m - /myHomeDir/.backport/repositories/elastic/kibana/conflicting-file.txt[0m

        [0m[3mYou do not need to \`git add\` or \`git commit\` the files - simply fix the conflicts.[23m[0m

        Press ENTER to continue",
          ],
          Array [
            "[0mThe following files have conflicts:[0m
        [0m - /myHomeDir/.backport/repositories/elastic/kibana/conflicting-file.txt[0m

        [0m[3mYou do not need to \`git add\` or \`git commit\` the files - simply fix the conflicts.[23m[0m

        Press ENTER to continue",
          ],
          Array [
            "[0mThe following files are unstaged:[0m
        [0m - /myHomeDir/.backport/repositories/elastic/kibana/conflicting-file.txt[0m

        Press ENTER to stage them",
          ],
        ]
      `);

      expect(logSpy.mock.calls).toMatchInlineSnapshot(`
        Array [
          Array [
            "
        [1mBackporting the following commits to 6.x:[22m
         - myCommitMessage
        ",
          ],
          Array [
            "",
          ],
          Array [
            "",
          ],
          Array [
            "",
          ],
          Array [
            "",
          ],
          Array [
            "",
          ],
        ]
      `);
      expect((ora as any).mock.calls).toMatchInlineSnapshot(`
        Array [
          Array [
            "Pulling latest changes",
          ],
          Array [
            "Cherry-picking commit mySha",
          ],
          Array [
            "Staging and committing files",
          ],
          Array [
            "Pushing branch \\"sqren:backport/6.x/commit-mySha\\"",
          ],
          Array [
            "Creating pull request",
          ],
        ]
      `);
      expect(execSpy.mock.calls).toMatchSnapshot();
      expect(axiosRequestSpy).toHaveBeenCalledTimes(2);
    });
  });
});

function setupExecSpy() {
  let conflictCheckCounts = 0;
  return jest
    .spyOn(childProcess, 'exec')

    .mockImplementation(async (cmd) => {
      // createFeatureBranch
      if (cmd.includes('git checkout -B')) {
        return { stdout: 'create feature branch succeeded', stderr: '' };
      }

      // git fetch
      if (cmd.startsWith('git fetch')) {
        return { stderr: '', stdout: '' };
      }

      // cherrypick
      if (cmd === 'git cherry-pick mySha') {
        throw new ExecError('cherrypick failed', { cmd });
      }

      // filesWithConflicts
      if (cmd === 'git --no-pager diff --check') {
        conflictCheckCounts++;
        if (conflictCheckCounts >= 4) {
          return { stderr: '', stdout: '' };
        }

        throw new ExecError('Not all conflicts resolved', {
          code: 2,
          cmd,
          stdout: `conflicting-file.txt:1: leftover conflict marker\nconflicting-file.txt:3: leftover conflict marker\nconflicting-file.txt:5: leftover conflict marker\n`,
        });
      }

      // getUnmergedFiles
      if (cmd === 'git --no-pager diff --name-only --diff-filter=U') {
        return { stdout: `conflicting-file.txt\n`, stderr: '' };
      }

      // addUnstagedFiles
      if (cmd === 'git add --update') {
        return { stdout: ``, stderr: '' };
      }

      // cherrypickContinue
      if (cmd.includes('cherry-pick --continue')) {
        return { stdout: ``, stderr: '' };
      }

      // pushFeatureBranch
      if (cmd.startsWith('git push ')) {
        return { stdout: ``, stderr: '' };
      }

      // deleteFeatureBranch
      if (cmd.includes('git branch -D ')) {
        return { stdout: ``, stderr: '' };
      }

      throw new Error(`Missing mock for "${cmd}"`);
    });
}

/*
 * Run timers (setInterval/setTimeout) every tick continuously until the promise has been resolved
 */
async function runTimersUntilResolved(fn: () => Promise<any>) {
  jest.useFakeTimers();

  let isResolved = false;
  const p = fn();
  p.finally(() => (isResolved = true));

  while (isResolved === false) {
    // tick
    await new Promise((resolve) => setImmediate(resolve));

    // run timers
    jest.runAllTimers();
  }

  return p;
}
