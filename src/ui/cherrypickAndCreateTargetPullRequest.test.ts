import nock from 'nock';
import ora from 'ora';
import { TargetBranchChoice } from '../options/ConfigOptions';
import { ValidConfigOptions } from '../options/options';
import * as childProcess from '../services/child-process-promisified';
import * as logger from '../services/logger';
import * as prompts from '../services/prompts';
import { ExecError } from '../test/ExecError';
import { createNockListener } from '../test/nockHelpers';
import { PromiseReturnType } from '../types/PromiseReturnType';
import { SpyHelper } from '../types/SpyHelper';
import { cherrypickAndCreateTargetPullRequest } from './cherrypickAndCreateTargetPullRequest';

const TARGET_PULL_NUMBER = 1338;

describe('cherrypickAndCreateTargetPullRequest', () => {
  let consoleLogSpy: SpyHelper<typeof logger['consoleLog']>;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(logger, 'consoleLog');
  });

  afterEach(() => {
    consoleLogSpy.mockClear();
  });

  describe('when commit has a pull request reference', () => {
    let res: PromiseReturnType<typeof cherrypickAndCreateTargetPullRequest>;
    let execSpy: SpyHelper<typeof childProcess.exec>;
    let getAddLabelsToTargetPrCalls: () => unknown[];
    let getAddLabelsToSourcePr1000Calls: () => unknown[];
    let getAddLabelsToSourcePr2000Calls: () => unknown[];
    let getCreatePullRequestCalls: () => unknown[];

    beforeEach(async () => {
      execSpy = jest
        .spyOn(childProcess, 'exec')

        // mock all exec commands to respond without errors
        .mockResolvedValue({ stdout: '', stderr: '' });

      // ensure labels are added to target PR
      getAddLabelsToTargetPrCalls = mockAddLabelCall(TARGET_PULL_NUMBER);

      // ensure labels are added to source PR
      getAddLabelsToSourcePr1000Calls = mockAddLabelCall(1000);
      getAddLabelsToSourcePr2000Calls = mockAddLabelCall(2000);

      getCreatePullRequestCalls = mockCreatePullRequestCall();

      res = await cherrypickAndCreateTargetPullRequest({
        targetBranch: '6.x',
        options: {
          assignees: [] as string[],
          githubApiBaseUrlV3: 'https://api.github.com',
          fork: true,
          targetPRLabels: ['backport'],
          prDescription: 'myPrSuffix',
          prTitle: '[{targetBranch}] {commitMessages}',
          repoName: 'kibana',
          repoOwner: 'elastic',
          username: 'sqren',
          sourceBranch: 'myDefaultSourceBranch',
          sourcePRLabels: [] as string[],
          targetBranchChoices: [
            { name: '7.0', sourcePRLabels: ['7.0.0'] },
            { name: '6.x', sourcePRLabels: ['6.5.1'] },
          ] as TargetBranchChoice[],
        } as ValidConfigOptions,
        commits: [
          {
            sourceBranch: '7.x',
            sha: 'mySha',
            formattedMessage: 'myCommitMessage (#1000)',
            originalMessage: 'My original commit message',
            pullNumber: 1000,
            sourcePRLabels: [],
            existingTargetPullRequests: [],
          },
          {
            sourceBranch: '7.x',
            sha: 'mySha2',
            formattedMessage: 'myOtherCommitMessage (#2000)',
            originalMessage: 'My original commit message',
            pullNumber: 2000,
            sourcePRLabels: [],
            existingTargetPullRequests: [],
          },
        ],
      });
    });

    afterEach(() => {
      execSpy.mockClear();
      //@ts-expect-error
      ora.mockClear();
    });

    it('returns the expected response', () => {
      expect(res).toEqual({ url: 'myHtmlUrl', number: TARGET_PULL_NUMBER });
    });

    it('creates pull request', () => {
      expect(getCreatePullRequestCalls()).toEqual([
        {
          title: '[6.x] myCommitMessage (#1000) | myOtherCommitMessage (#2000)',
          head: 'sqren:backport/6.x/pr-1000_pr-2000',
          base: '6.x',
          body:
            'Backports the following commits to 6.x:\n - myCommitMessage (#1000)\n - myOtherCommitMessage (#2000)\n\nmyPrSuffix',
        },
      ]);
    });

    it('should make correct git commands', () => {
      expect(execSpy.mock.calls).toMatchSnapshot();
    });

    it('logs correctly', () => {
      expect(consoleLogSpy.mock.calls.length).toBe(2);
      expect(consoleLogSpy.mock.calls[0][0]).toMatchInlineSnapshot(`
        "
        Backporting to 6.x:"
      `);
      expect(consoleLogSpy.mock.calls[1][0]).toMatchInlineSnapshot(
        `"View pull request: myHtmlUrl"`
      );
    });

    it('should start the spinner with the correct text', () => {
      expect((ora as any).mock.calls.map((call: any) => call[0]))
        .toMatchInlineSnapshot(`
        Array [
          "Pulling latest changes",
          "Cherry-picking: myCommitMessage (#1000)",
          "Cherry-picking: myOtherCommitMessage (#2000)",
          "Pushing branch \\"sqren:backport/6.x/pr-1000_pr-2000\\"",
          undefined,
          "Creating pull request",
          "Adding labels: \\"backport\\" to #1338",
          "Adding labels: \\"6.5.1\\" to #1000",
          "Adding labels: \\"6.5.1\\" to #2000",
        ]
      `);
    });

    it('adds labels to the target pull request', () => {
      expect(getAddLabelsToTargetPrCalls()).toEqual([{ labels: ['backport'] }]);
    });

    it('adds labels to source pull requests', () => {
      expect(getAddLabelsToSourcePr1000Calls()).toEqual([
        { labels: ['6.5.1'] },
      ]);
      expect(getAddLabelsToSourcePr2000Calls()).toEqual([
        { labels: ['6.5.1'] },
      ]);
    });
  });

  describe('when sourcePRLabels includes wildcard', () => {
    let execSpy: SpyHelper<typeof childProcess.exec>;
    let getAddLabelsToSourcePr1000Calls: () => unknown[];
    let getAddLabelsToSourcePr2000Calls: () => unknown[];

    beforeEach(async () => {
      execSpy = jest
        .spyOn(childProcess, 'exec')

        // mock all exec commands to respond without errors
        .mockResolvedValue({ stdout: '', stderr: '' });

      // ensure labels are added to source PR
      getAddLabelsToSourcePr1000Calls = mockAddLabelCall(1000);
      getAddLabelsToSourcePr2000Calls = mockAddLabelCall(2000);

      // mock create pull request
      mockCreatePullRequestCall();

      await cherrypickAndCreateTargetPullRequest({
        targetBranch: '6.x',
        options: {
          assignees: [] as string[],
          githubApiBaseUrlV3: 'https://api.github.com',
          fork: true,
          targetPRLabels: ['backport'],
          prDescription: 'myPrSuffix',
          prTitle: '[{targetBranch}] {commitMessages}',
          repoName: 'kibana',
          repoOwner: 'elastic',
          username: 'sqren',
          sourceBranch: 'myDefaultSourceBranch',
          sourcePRLabels: [] as string[],
          targetBranchChoices: [
            { name: '7.0', sourcePRLabels: ['7.0.0'] },
            { name: '6.x', sourcePRLabels: ['6.5.*'] },
          ] as TargetBranchChoice[],
        } as ValidConfigOptions,
        commits: [
          {
            sourceBranch: '7.x',
            sha: 'mySha',
            formattedMessage: 'myCommitMessage (#1000)',
            originalMessage: 'My original commit message',
            pullNumber: 1000,
            sourcePRLabels: [],
            existingTargetPullRequests: [],
          },
          {
            sourceBranch: '7.x',
            sha: 'mySha2',
            formattedMessage: 'myOtherCommitMessage (#2000)',
            originalMessage: 'My original commit message',
            pullNumber: 2000,
            sourcePRLabels: [],
            existingTargetPullRequests: [],
          },
        ],
      });
    });

    afterEach(() => {
      execSpy.mockClear();
      //@ts-expect-error
      ora.mockClear();
    });

    it('does not add labels to source pull requests', () => {
      expect(getAddLabelsToSourcePr1000Calls()).toEqual([]);
      expect(getAddLabelsToSourcePr2000Calls()).toEqual([]);
    });
  });

  describe('when commit does not have a pull request reference', () => {
    let res: PromiseReturnType<typeof cherrypickAndCreateTargetPullRequest>;
    let getCreatePullRequestCalls: () => unknown[];
    let getAddLabelsToTargetPrCalls: () => unknown[];

    beforeEach(async () => {
      // mock all exec commands to respond without errors
      jest
        .spyOn(childProcess, 'exec')
        .mockResolvedValue({ stdout: '', stderr: '' });

      getCreatePullRequestCalls = mockCreatePullRequestCall();

      // ensure labels are added to target PR
      getAddLabelsToTargetPrCalls = mockAddLabelCall(TARGET_PULL_NUMBER);

      res = await cherrypickAndCreateTargetPullRequest({
        targetBranch: '6.x',
        options: {
          assignees: [] as string[],
          githubApiBaseUrlV3: 'https://api.github.com',
          fork: true,
          targetPRLabels: ['backport'],
          prTitle: '[{targetBranch}] {commitMessages}',
          repoName: 'kibana',
          repoOwner: 'elastic',
          username: 'sqren',
          sourcePRLabels: [] as string[],
          targetBranchChoices: [
            { name: '7.0', sourcePRLabels: ['7.0.0'] },
            { name: '6.x', sourcePRLabels: ['6.5.1'] },
          ] as TargetBranchChoice[],
        } as ValidConfigOptions,
        commits: [
          {
            sourceBranch: '7.x',
            sha: 'mySha',
            formattedMessage: 'myCommitMessage (mySha)',
            originalMessage: 'My original commit message',
            sourcePRLabels: [],
            existingTargetPullRequests: [],
          },
        ],
      });
    });

    it('creates pull request', () => {
      expect(getCreatePullRequestCalls()).toEqual([
        {
          title: '[6.x] myCommitMessage (mySha)',
          head: 'sqren:backport/6.x/commit-mySha',
          base: '6.x',
          body:
            'Backports the following commits to 6.x:\n - myCommitMessage (mySha)',
        },
      ]);
    });

    it('returns the expected response', () => {
      expect(res).toEqual({ url: 'myHtmlUrl', number: TARGET_PULL_NUMBER });
    });

    it('adds labels to the target pull request', () => {
      expect(getAddLabelsToTargetPrCalls()).toEqual([{ labels: ['backport'] }]);
    });
  });

  describe('when cherry-picking fails', () => {
    let res: PromiseReturnType<typeof cherrypickAndCreateTargetPullRequest>;
    let promptSpy: SpyHelper<typeof prompts['confirmPrompt']>;
    let execSpy: ReturnType<typeof setupExecSpy>;
    let getCreatePullRequestCalls: () => unknown[];

    beforeEach(async () => {
      // spies
      promptSpy = jest.spyOn(prompts, 'confirmPrompt').mockResolvedValue(true);
      execSpy = setupExecSpy();

      getCreatePullRequestCalls = mockCreatePullRequestCall();

      res = await cherrypickAndCreateTargetPullRequest({
        targetBranch: '6.x',
        options: {
          assignees: [] as string[],
          fork: true,
          targetPRLabels: ['backport'],
          prTitle: '[{targetBranch}] {commitMessages}',
          repoName: 'kibana',
          repoOwner: 'elastic',
          username: 'sqren',
          sourceBranch: 'myDefaultSourceBranch',
          sourcePRLabels: [] as string[],
          targetBranchChoices: [] as TargetBranchChoice[],
        } as ValidConfigOptions,
        commits: [
          {
            sourceBranch: '7.x',
            sha: 'mySha',
            formattedMessage: 'myCommitMessage (mySha)',
            originalMessage: 'My original commit message',
            sourcePRLabels: [],
            existingTargetPullRequests: [],
          },
        ],
      });
    });

    afterEach(() => {
      promptSpy.mockClear();
      execSpy.mockClear();
      //@ts-expect-error
      ora.mockClear();
    });

    it('creates pull request', () => {
      expect(getCreatePullRequestCalls()).toEqual([
        {
          title: '[6.x] myCommitMessage (mySha)',
          head: 'sqren:backport/6.x/commit-mySha',
          base: '6.x',
          body:
            'Backports the following commits to 6.x:\n - myCommitMessage (mySha)',
        },
      ]);
    });

    it('returns the expected response', () => {
      expect(res).toEqual({ url: 'myHtmlUrl', number: TARGET_PULL_NUMBER });
    });

    it('shows the right prompts', () => {
      expect(promptSpy.mock.calls.length).toBe(3);

      expect(promptSpy.mock.calls[0][0]).toMatchInlineSnapshot(`
        "Please fix the issues in: /myHomeDir/.backport/repositories/elastic/kibana

        Conflicting files:
         - /myHomeDir/.backport/repositories/elastic/kibana/conflicting-file.txt


        Press ENTER when the conflicts are resolved and files are staged"
      `);

      expect(promptSpy.mock.calls[1][0]).toMatchInlineSnapshot(`
        "Please fix the issues in: /myHomeDir/.backport/repositories/elastic/kibana

        Conflicting files:
         - /myHomeDir/.backport/repositories/elastic/kibana/conflicting-file.txt


        Press ENTER when the conflicts are resolved and files are staged"
      `);

      expect(promptSpy.mock.calls[2][0]).toMatchInlineSnapshot(`
        "Please fix the issues in: /myHomeDir/.backport/repositories/elastic/kibana


        Unstaged files:
         - /myHomeDir/.backport/repositories/elastic/kibana/conflicting-file.txt

        Press ENTER when the conflicts are resolved and files are staged"
      `);
    });

    it('calls exec correctly', () => {
      expect(execSpy.mock.calls).toMatchSnapshot();
    });

    it('calls ora correctly', () => {
      expect((ora as any).mock.calls.map((call: any) => call[0]))
        .toMatchInlineSnapshot(`
        Array [
          "Pulling latest changes",
          "Cherry-picking: myCommitMessage (mySha)",
          "Finalizing cherrypick",
          "Pushing branch \\"sqren:backport/6.x/commit-mySha\\"",
          undefined,
          "Creating pull request",
          "Adding labels: \\"backport\\" to #1338",
        ]
      `);
    });

    it('logs correctly', async () => {
      expect(consoleLogSpy.mock.calls[0][0]).toMatchInlineSnapshot(`
        "
        Backporting to 6.x:"
      `);
      expect(consoleLogSpy.mock.calls[1][0]).toMatchInlineSnapshot(`
        "
        ----------------------------------------
        "
      `);
      expect(consoleLogSpy.mock.calls[2][0]).toMatchInlineSnapshot(`
        "
        ----------------------------------------
        "
      `);
      expect(consoleLogSpy.mock.calls[3][0]).toMatchInlineSnapshot(
        `"View pull request: myHtmlUrl"`
      );
    });
  });
});

function setupExecSpy() {
  let conflictingFilesCheck = 0;
  let unstagedFilesCheck = 0;
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
        throw new ExecError({ cmd });
      }

      // getConflictingFiles
      if (cmd === 'git --no-pager diff --check') {
        conflictingFilesCheck++;
        if (conflictingFilesCheck >= 4) {
          return { stderr: '', stdout: '' };
        }

        throw new ExecError({
          code: 2,
          cmd,
          stdout: `conflicting-file.txt:1: leftover conflict marker\nconflicting-file.txt:3: leftover conflict marker\nconflicting-file.txt:5: leftover conflict marker\n`,
        });
      }

      // getUnstagedFiles
      if (cmd === 'git --no-pager diff --name-only') {
        unstagedFilesCheck++;
        if (unstagedFilesCheck >= 5) {
          return { stderr: '', stdout: '' };
        }
        return { stdout: `conflicting-file.txt\n`, stderr: '' };
      }

      // addUnstagedFiles
      if (cmd === 'git add --update') {
        return { stdout: ``, stderr: '' };
      }

      // finalizeCherrypick
      if (cmd.includes('git commit --no-edit')) {
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

function mockCreatePullRequestCall() {
  return createNockListener(
    nock('https://api.github.com')
      .post('/repos/elastic/kibana/pulls')
      .reply(200, { html_url: 'myHtmlUrl', number: TARGET_PULL_NUMBER })
  );
}

function mockAddLabelCall(pullNumber: number) {
  return createNockListener(
    nock('https://api.github.com')
      .post(`/repos/elastic/kibana/issues/${pullNumber}/labels`)
      .reply(200)
  );
}
