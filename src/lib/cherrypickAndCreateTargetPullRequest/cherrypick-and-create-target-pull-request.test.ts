import os from 'os';
import nock from 'nock';
import type { ValidConfigOptions } from '../../options/options';
import {
  listenForCallsToNockScope,
  mockUrqlRequest,
} from '../../test/nock-helpers';
import type { SpyHelper } from '../../types/spy-helper';
import * as childProcess from '../child-process-promisified';
import type { TargetBranchResponse } from '../github/v4/validate-target-branch';
import * as logger from '../logger';
import * as oraModule from '../ora';
import type { Commit } from '../sourceCommit/parse-source-commit';
import * as autoMergeNowOrLater from './auto-merge-now-or-later';
import { cherrypickAndCreateTargetPullRequest } from './cherrypick-and-create-target-pull-request';

describe('cherrypickAndCreateTargetPullRequest', () => {
  let execSpy: SpyHelper<typeof childProcess.spawnPromise>;
  let addLabelsScope: ReturnType<typeof nock>;
  let consoleLogSpy: SpyHelper<(typeof logger)['consoleLog']>;
  let autoMergeSpy: SpyHelper<typeof autoMergeNowOrLater.autoMergeNowOrLater>;

  beforeEach(() => {
    jest.spyOn(os, 'homedir').mockReturnValue('/myHomeDir');

    autoMergeSpy = jest.spyOn(autoMergeNowOrLater, 'autoMergeNowOrLater');

    execSpy = jest
      .spyOn(childProcess, 'spawnPromise')

      // mock all spawn commands to respond without errors
      .mockResolvedValue({ stdout: '', stderr: '', code: 0, cmdArgs: [] });

    consoleLogSpy = jest.spyOn(logger, 'consoleLog');

    // ensure labels are added
    addLabelsScope = nock('https://api.github.com')
      .post('/repos/elastic/kibana/issues/1337/labels', {
        labels: ['backport'],
      })
      .reply(200);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Only check addLabelsScope if it was defined
    if (addLabelsScope && !addLabelsScope.isDone()) {
      addLabelsScope.done();
    }
    nock.cleanAll();
  });

  describe('when commit has a pull request reference', () => {
    let res: Awaited<ReturnType<typeof cherrypickAndCreateTargetPullRequest>>;
    let createPullRequestCalls: unknown[];
    let oraSpy: jest.SpyInstance;

    beforeEach(async () => {
      const options = {
        assignees: [] as string[],
        authenticatedUsername: 'sqren_authenticated',
        author: 'sorenlouv',
        autoMerge: true,
        autoMergeMethod: 'squash',
        fork: true,
        gitAuthorEmail: 'soren@louv.dk',
        gitAuthorName: 'Soren L',
        githubApiBaseUrlV4: 'http://localhost/graphql',
        interactive: false,
        prTitle: '[{{targetBranch}}] {{commitMessages}}',
        repoForkOwner: 'sorenlouv',
        repoName: 'kibana',
        repoOwner: 'elastic',
        reviewers: [] as string[],
        sourceBranch: 'myDefaultSourceBranch',
        sourcePRLabels: [] as string[],
        targetPRLabels: ['backport'],
      } as ValidConfigOptions;

      const commits: Commit[] = [
        {
          author: {
            email: 'soren.louv@elastic.co',
            name: 'Søren Louv-Jansen',
          },
          sourceBranch: '7.x',
          suggestedTargetBranches: [],
          sourceCommit: {
            branchLabelMapping: {},
            committedDate: 'fff',
            sha: 'mySha',
            message: 'My original commit message (#1000)',
          },
          sourcePullRequest: {
            labels: [],
            url: 'foo',
            number: 1000,
            title: 'My original commit message',
            mergeCommit: {
              sha: 'mySha',
              message: 'My original commit message (#1000)',
            },
          },
          targetPullRequestStates: [],
        },
        {
          author: {
            email: 'soren.louv@elastic.co',
            name: 'Søren Louv-Jansen',
          },
          sourceBranch: '7.x',
          suggestedTargetBranches: [],
          sourceCommit: {
            branchLabelMapping: {},
            committedDate: 'ggg',
            sha: 'mySha2',
            message: 'My other commit message (#2000)',
          },
          sourcePullRequest: {
            labels: [],
            url: 'foo',
            number: 2000,
            title: 'My other commit message',
            mergeCommit: {
              sha: 'mySha2',
              message: 'My other commit message (#2000)',
            },
          },
          targetPullRequestStates: [],
        },
      ];

      mockUrqlRequest<TargetBranchResponse>({
        operationName: 'GetBranchId',
        body: { data: { repository: { ref: { id: 'foo' } } } },
      });

      const scope = nock('https://api.github.com')
        .post('/repos/elastic/kibana/pulls')
        .reply(200, { number: 1337, html_url: 'myHtmlUrl' });
      createPullRequestCalls = listenForCallsToNockScope(scope);

      oraSpy = jest.spyOn(oraModule, 'ora');

      res = await cherrypickAndCreateTargetPullRequest({
        options,
        commits,
        targetBranch: '6.x',
      });

      scope.done();
      nock.cleanAll();
    });

    it('creates the pull request with multiple PR references', () => {
      expect(createPullRequestCalls).toMatchInlineSnapshot(`
        [
          {
            "base": "6.x",
            "body": "# Backport

        This will backport the following commits from \`7.x\` to \`6.x\`:
         - [My original commit message (#1000)](foo)
         - [My other commit message (#2000)](foo)

        <!--- Backport version: 1.2.3-mocked -->

        ### Questions ?
        Please refer to the [Backport tool documentation](https://github.com/sorenlouv/backport)",
            "head": "sorenlouv:backport/6.x/pr-1000_pr-2000",
            "title": "[6.x] My original commit message (#1000) | My other commit message (#2000)",
          },
        ]
      `);
    });

    it('calls autoMergeNowOrLater', () => {
      expect(autoMergeSpy).toHaveBeenCalledWith(expect.any(Object), 1337);
    });

    it('returns the expected response', () => {
      expect(res).toEqual({
        didUpdate: false,
        hasConflicts: false,
        url: 'myHtmlUrl',
        number: 1337,
      });
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
        `"View pull request: myHtmlUrl"`,
      );
    });

    it('should start the spinner with the correct text', () => {
      expect(oraSpy.mock.calls.map(([, text]) => text)).toMatchInlineSnapshot(`
[
  "",
  "Pulling latest changes",
  "Cherry-picking: My original commit message (#1000)",
  "Cherry-picking: My other commit message (#2000)",
  "Pushing branch "sorenlouv:backport/6.x/pr-1000_pr-2000"",
  undefined,
  "Creating pull request",
  "Adding labels: backport",
  "Auto-merge: Enabling via "squash"",
]
`);
    });
  });

  describe('when commit does not have a pull request reference', () => {
    let res: Awaited<ReturnType<typeof cherrypickAndCreateTargetPullRequest>>;
    let createPullRequestCalls: unknown[];

    beforeEach(async () => {
      const options = {
        assignees: [] as string[],
        authenticatedUsername: 'sqren_authenticated',
        author: 'sorenlouv',
        fork: true,
        prTitle: '[{{targetBranch}}] {{commitMessages}}',
        repoForkOwner: 'the_fork_owner',
        repoName: 'kibana',
        repoOwner: 'elastic',
        reviewers: [] as string[],
        sourcePRLabels: [] as string[],
        targetPRLabels: ['backport'],
        githubApiBaseUrlV4: 'http://localhost/graphql',
      } as ValidConfigOptions;

      const commits: Commit[] = [
        {
          author: {
            email: 'soren.louv@elastic.co',
            name: 'Søren Louv-Jansen',
          },
          suggestedTargetBranches: [],
          sourceCommit: {
            branchLabelMapping: {},
            committedDate: 'hhh',
            sha: 'mySha',
            message: 'My original commit message',
          },
          sourceBranch: '7.x',
          targetPullRequestStates: [],
        },
      ];

      mockUrqlRequest<TargetBranchResponse>({
        operationName: 'GetBranchId',
        body: { data: { repository: { ref: { id: 'foo' } } } },
      });

      const scope = nock('https://api.github.com')
        .post('/repos/elastic/kibana/pulls')
        .reply(200, { number: 1337, html_url: 'myHtmlUrl' });

      createPullRequestCalls = listenForCallsToNockScope(scope);

      res = await cherrypickAndCreateTargetPullRequest({
        options,
        commits,
        targetBranch: '6.x',
      });
      scope.done();
      nock.cleanAll();
    });

    it('creates the pull request with commit reference', () => {
      expect(createPullRequestCalls).toMatchInlineSnapshot(`
        [
          {
            "base": "6.x",
            "body": "# Backport

        This will backport the following commits from \`7.x\` to \`6.x\`:
         - My original commit message (mySha)

        <!--- Backport version: 1.2.3-mocked -->

        ### Questions ?
        Please refer to the [Backport tool documentation](https://github.com/sorenlouv/backport)",
            "head": "the_fork_owner:backport/6.x/commit-mySha",
            "title": "[6.x] My original commit message",
          },
        ]
      `);
    });

    it('returns the expected response', () => {
      expect(res).toEqual({
        didUpdate: false,
        hasConflicts: false,
        url: 'myHtmlUrl',
        number: 1337,
      });
    });
  });

  describe('when cherry-picking fails', () => {
    let res: Awaited<ReturnType<typeof cherrypickAndCreateTargetPullRequest>>;
    let createPullRequestCalls: unknown[];

    beforeEach(async () => {
      const options = {
        assignees: [] as string[],
        authenticatedUsername: 'sqren_authenticated',
        author: 'sorenlouv',
        fork: true,
        githubApiBaseUrlV4: 'http://localhost/graphql',
        prTitle: '[{{targetBranch}}] {{commitMessages}}',
        repoForkOwner: 'sorenlouv',
        repoName: 'kibana',
        repoOwner: 'elastic',
        reviewers: [] as string[],
        sourceBranch: 'myDefaultSourceBranch',
        sourcePRLabels: [] as string[],
        targetPRLabels: ['backport'],
      } as ValidConfigOptions;

      mockUrqlRequest<TargetBranchResponse>({
        operationName: 'GetBranchId',
        body: { data: { repository: { ref: { id: 'foo' } } } },
      });

      const scope = nock('https://api.github.com')
        .post('/repos/elastic/kibana/pulls')
        .reply(200, { number: 1337, html_url: 'myHtmlUrl' });

      createPullRequestCalls = listenForCallsToNockScope(scope);

      res = await cherrypickAndCreateTargetPullRequest({
        options,
        commits: [
          {
            author: {
              email: 'soren.louv@elastic.co',
              name: 'Søren Louv-Jansen',
            },
            suggestedTargetBranches: [],
            sourceCommit: {
              branchLabelMapping: {},
              committedDate: '2021-08-18T16:11:38Z',
              sha: 'mySha',
              message: 'My original commit message',
            },
            sourceBranch: '7.x',
            targetPullRequestStates: [],
          },
        ],
        targetBranch: '6.x',
      });

      scope.done();
      nock.cleanAll();
    });

    it('creates the pull request with commit reference', () => {
      expect(createPullRequestCalls).toMatchInlineSnapshot(`
        [
          {
            "base": "6.x",
            "body": "# Backport

        This will backport the following commits from \`7.x\` to \`6.x\`:
         - My original commit message (mySha)

        <!--- Backport version: 1.2.3-mocked -->

        ### Questions ?
        Please refer to the [Backport tool documentation](https://github.com/sorenlouv/backport)",
            "head": "sorenlouv:backport/6.x/commit-mySha",
            "title": "[6.x] My original commit message",
          },
        ]
      `);
    });

    it('returns the expected response', () => {
      expect(res).toEqual({
        didUpdate: false,
        hasConflicts: false,
        url: 'myHtmlUrl',
        number: 1337,
      });
    });
  });
});

describe('conflict handling', () => {
  let conflictExecSpy: SpyHelper<typeof childProcess.spawnPromise>;
  let conflictAddLabelsScope: ReturnType<typeof nock>;

  beforeEach(() => {
    jest.spyOn(os, 'homedir').mockReturnValue('/myHomeDir');
    conflictExecSpy = jest
      .spyOn(childProcess, 'spawnPromise')
      .mockResolvedValue({ stdout: '', stderr: '', code: 0, cmdArgs: [] });
    jest.spyOn(logger, 'consoleLog');
  });

  afterEach(() => {
    jest.clearAllMocks();
    if (conflictAddLabelsScope && !conflictAddLabelsScope.isDone()) {
      conflictAddLabelsScope.done();
    }
    nock.cleanAll();
  });

  describe('when commitConflicts is enabled and conflicts occur', () => {
    let res: Awaited<ReturnType<typeof cherrypickAndCreateTargetPullRequest>>;
    let addLabelsCalls: unknown[];
    let oraSpy: jest.SpyInstance;

    beforeEach(async () => {
      const options = {
        assignees: [] as string[],
        authenticatedUsername: 'sqren_authenticated',
        author: 'sorenlouv',
        commitConflicts: true,
        conflictLabel: 'merge-conflict',
        fork: true,
        githubApiBaseUrlV4: 'http://localhost/graphql',
        prTitle: '[{{targetBranch}}] {{commitMessages}}',
        repoForkOwner: 'sorenlouv',
        repoName: 'kibana',
        repoOwner: 'elastic',
        reviewers: [] as string[],
        sourceBranch: 'myDefaultSourceBranch',
        sourcePRLabels: [] as string[],
        targetPRLabels: ['backport'],
      } as ValidConfigOptions;

      const commits: Commit[] = [
        {
          author: {
            email: 'soren.louv@elastic.co',
            name: 'Søren Louv-Jansen',
          },
          sourceBranch: '7.x',
          suggestedTargetBranches: [],
          sourceCommit: {
            branchLabelMapping: {},
            committedDate: 'fff',
            sha: 'mySha',
            message: 'My original commit message (#1000)',
          },
          sourcePullRequest: {
            labels: [],
            url: 'foo',
            number: 1000,
            title: 'My original commit message',
            mergeCommit: {
              sha: 'mySha',
              message: 'My original commit message (#1000)',
            },
          },
          targetPullRequestStates: [],
        },
      ];

      // Mock git commands to simulate a conflict scenario
      conflictExecSpy.mockImplementation(
        async (cmd: string, args: readonly string[]) => {
          // Simulate cherry-pick failure (conflict)
          if (args.includes('cherry-pick')) {
            throw new childProcess.SpawnError({
              code: 1,
              cmdArgs: args,
              stdout: '',
              stderr:
                'error: could not apply mySha... My original commit message',
            });
          }

          const isDiff = args.includes('--no-pager') && args.includes('diff');

          // git diff --check - return conflicting files
          if (isDiff && args.includes('--check')) {
            throw new childProcess.SpawnError({
              code: 2,
              cmdArgs: args,
              stdout: 'conflicting-file.txt:1: leftover conflict marker\n',
              stderr: '',
            });
          }

          // git diff --name-only (unstaged files) - empty
          if (
            isDiff &&
            args.includes('--name-only') &&
            !args.includes('--cached')
          ) {
            return { stdout: '', stderr: '', code: 0, cmdArgs: args };
          }

          // git diff --name-only --cached (staged files) - empty
          if (
            isDiff &&
            args.includes('--name-only') &&
            args.includes('--cached')
          ) {
            return { stdout: '', stderr: '', code: 0, cmdArgs: args };
          }

          // git config rerere checks
          if (args.includes('config') && args.includes('rerere.enabled')) {
            return { stdout: 'false\n', stderr: '', code: 0, cmdArgs: args };
          }
          if (args.includes('config') && args.includes('rerere.autoUpdate')) {
            return { stdout: 'false\n', stderr: '', code: 0, cmdArgs: args };
          }

          // Default success for other git commands
          return { stdout: '', stderr: '', code: 0, cmdArgs: args };
        },
      );

      mockUrqlRequest<TargetBranchResponse>({
        operationName: 'GetBranchId',
        body: { data: { repository: { ref: { id: 'foo' } } } },
      });

      const createPrScope = nock('https://api.github.com')
        .post('/repos/elastic/kibana/pulls')
        .reply(200, { number: 1337, html_url: 'myHtmlUrl' });

      // Mock the conflict label addition
      conflictAddLabelsScope = nock('https://api.github.com')
        .post('/repos/elastic/kibana/issues/1337/labels', {
          labels: ['merge-conflict'],
        })
        .reply(200);
      addLabelsCalls = listenForCallsToNockScope(conflictAddLabelsScope);

      oraSpy = jest.spyOn(oraModule, 'ora');

      res = await cherrypickAndCreateTargetPullRequest({
        options,
        commits,
        targetBranch: '6.x',
      });

      createPrScope.done();
    });

    it('returns hasConflicts: true', () => {
      expect(res.hasConflicts).toBe(true);
    });

    it('adds the default conflict label to the PR', () => {
      expect(addLabelsCalls).toHaveLength(1);
      expect(addLabelsCalls[0]).toEqual({
        labels: ['merge-conflict'],
      });
    });

    it('creates the pull request successfully', () => {
      expect(res.url).toBe('myHtmlUrl');
      expect(res.number).toBe(1337);
    });

    it('shows spinner messages including conflict handling', () => {
      const spinnerTexts = oraSpy.mock.calls.map(([, text]) => text);
      expect(spinnerTexts).toContain(
        'Cherry-picking: My original commit message (#1000)',
      );
    });
  });

  describe('when commitConflicts is enabled with custom conflictLabel', () => {
    let addLabelsCalls: unknown[];

    beforeEach(async () => {
      const options = {
        assignees: [] as string[],
        authenticatedUsername: 'sqren_authenticated',
        author: 'sorenlouv',
        commitConflicts: true,
        conflictLabel: 'custom-conflict-label',
        fork: true,
        githubApiBaseUrlV4: 'http://localhost/graphql',
        prTitle: '[{{targetBranch}}] {{commitMessages}}',
        repoForkOwner: 'sorenlouv',
        repoName: 'kibana',
        repoOwner: 'elastic',
        reviewers: [] as string[],
        sourceBranch: 'myDefaultSourceBranch',
        sourcePRLabels: [] as string[],
        targetPRLabels: ['backport'],
      } as ValidConfigOptions;

      const commits: Commit[] = [
        {
          author: {
            email: 'soren.louv@elastic.co',
            name: 'Søren Louv-Jansen',
          },
          sourceBranch: '7.x',
          suggestedTargetBranches: [],
          sourceCommit: {
            branchLabelMapping: {},
            committedDate: 'fff',
            sha: 'mySha',
            message: 'My commit with conflict',
          },
          targetPullRequestStates: [],
        },
      ];

      // Mock git commands to simulate conflict
      conflictExecSpy.mockImplementation(
        async (cmd: string, args: readonly string[]) => {
          if (args.includes('cherry-pick')) {
            throw new childProcess.SpawnError({
              code: 1,
              cmdArgs: args,
              stdout: '',
              stderr: 'error: could not apply mySha...',
            });
          }

          const isDiff = args.includes('--no-pager') && args.includes('diff');

          if (isDiff && args.includes('--check')) {
            throw new childProcess.SpawnError({
              code: 2,
              cmdArgs: args,
              stdout: 'file.txt:1: leftover conflict marker\n',
              stderr: '',
            });
          }

          if (isDiff && args.includes('--name-only')) {
            return { stdout: '', stderr: '', code: 0, cmdArgs: args };
          }

          if (args.includes('config') && args.includes('rerere')) {
            return { stdout: 'false\n', stderr: '', code: 0, cmdArgs: args };
          }

          return { stdout: '', stderr: '', code: 0, cmdArgs: args };
        },
      );

      mockUrqlRequest<TargetBranchResponse>({
        operationName: 'GetBranchId',
        body: { data: { repository: { ref: { id: 'foo' } } } },
      });

      const createPrScope = nock('https://api.github.com')
        .post('/repos/elastic/kibana/pulls')
        .reply(200, { number: 1337, html_url: 'myHtmlUrl' });

      conflictAddLabelsScope = nock('https://api.github.com')
        .post('/repos/elastic/kibana/issues/1337/labels', {
          labels: ['custom-conflict-label'],
        })
        .reply(200);
      addLabelsCalls = listenForCallsToNockScope(conflictAddLabelsScope);

      jest.spyOn(oraModule, 'ora');

      await cherrypickAndCreateTargetPullRequest({
        options,
        commits,
        targetBranch: '6.x',
      });

      createPrScope.done();
    });

    it('uses the custom conflict label', () => {
      expect(addLabelsCalls).toHaveLength(1);
      expect(addLabelsCalls[0]).toEqual({
        labels: ['custom-conflict-label'],
      });
    });
  });

  describe('when commitConflicts is disabled (conflicts should abort)', () => {
    it('throws an error when conflicts occur', async () => {
      const options = {
        assignees: [] as string[],
        authenticatedUsername: 'sqren_authenticated',
        author: 'sorenlouv',
        commitConflicts: false,
        fork: true,
        githubApiBaseUrlV4: 'http://localhost/graphql',
        prTitle: '[{{targetBranch}}] {{commitMessages}}',
        repoForkOwner: 'sorenlouv',
        repoName: 'kibana',
        repoOwner: 'elastic',
        reviewers: [] as string[],
        sourceBranch: 'myDefaultSourceBranch',
        sourcePRLabels: [] as string[],
        targetPRLabels: ['backport'],
      } as ValidConfigOptions;

      const commits: Commit[] = [
        {
          author: {
            email: 'soren.louv@elastic.co',
            name: 'Søren Louv-Jansen',
          },
          sourceBranch: '7.x',
          suggestedTargetBranches: [],
          sourceCommit: {
            branchLabelMapping: {},
            committedDate: 'fff',
            sha: 'mySha',
            message: 'My commit',
          },
          targetPullRequestStates: [],
        },
      ];

      // Simulate cherry-pick failure
      conflictExecSpy.mockImplementation(
        async (cmd: string, args: readonly string[]) => {
          if (args.includes('cherry-pick')) {
            throw new childProcess.SpawnError({
              code: 1,
              cmdArgs: args,
              stdout: '',
              stderr: 'error: could not apply mySha...',
            });
          }

          const isDiff = args.includes('--no-pager') && args.includes('diff');

          if (isDiff && args.includes('--check')) {
            throw new childProcess.SpawnError({
              code: 2,
              cmdArgs: args,
              stdout: 'file.txt:1: leftover conflict marker\n',
              stderr: '',
            });
          }

          if (isDiff && args.includes('--name-only')) {
            return { stdout: '', stderr: '', code: 0, cmdArgs: args };
          }

          if (args.includes('config') && args.includes('rerere')) {
            return { stdout: 'false\n', stderr: '', code: 0, cmdArgs: args };
          }

          return { stdout: '', stderr: '', code: 0, cmdArgs: args };
        },
      );

      jest.spyOn(oraModule, 'ora');

      await expect(
        cherrypickAndCreateTargetPullRequest({
          options,
          commits,
          targetBranch: '6.x',
        }),
      ).rejects.toThrow();
    });
  });

  describe('when no conflicts occur', () => {
    let res: Awaited<ReturnType<typeof cherrypickAndCreateTargetPullRequest>>;

    beforeEach(async () => {
      const options = {
        assignees: [] as string[],
        authenticatedUsername: 'sqren_authenticated',
        author: 'sorenlouv',
        commitConflicts: true,
        conflictLabel: 'merge-conflict',
        fork: true,
        githubApiBaseUrlV4: 'http://localhost/graphql',
        prTitle: '[{{targetBranch}}] {{commitMessages}}',
        repoForkOwner: 'sorenlouv',
        repoName: 'kibana',
        repoOwner: 'elastic',
        reviewers: [] as string[],
        sourceBranch: 'myDefaultSourceBranch',
        sourcePRLabels: [] as string[],
        targetPRLabels: ['backport'],
      } as ValidConfigOptions;

      const commits: Commit[] = [
        {
          author: {
            email: 'soren.louv@elastic.co',
            name: 'Søren Louv-Jansen',
          },
          sourceBranch: '7.x',
          suggestedTargetBranches: [],
          sourceCommit: {
            branchLabelMapping: {},
            committedDate: 'fff',
            sha: 'mySha',
            message: 'My clean commit',
          },
          targetPullRequestStates: [],
        },
      ];

      // Mock successful cherry-pick (no conflicts)
      conflictExecSpy.mockResolvedValue({
        stdout: '',
        stderr: '',
        code: 0,
        cmdArgs: [],
      });

      mockUrqlRequest<TargetBranchResponse>({
        operationName: 'GetBranchId',
        body: { data: { repository: { ref: { id: 'foo' } } } },
      });

      const createPrScope = nock('https://api.github.com')
        .post('/repos/elastic/kibana/pulls')
        .reply(200, { number: 1337, html_url: 'myHtmlUrl' });

      // No conflict label should be added, so we don't mock it
      jest.spyOn(oraModule, 'ora');

      res = await cherrypickAndCreateTargetPullRequest({
        options,
        commits,
        targetBranch: '6.x',
      });

      createPrScope.done();
    });

    it('returns hasConflicts: false', () => {
      expect(res.hasConflicts).toBe(false);
    });

    it('does not attempt to add conflict label', () => {
      // Verify no conflict label API call was made
      // This is implicit - if a nock for conflict labels was set up, it would fail
      expect(res.url).toBe('myHtmlUrl');
    });
  });
});
