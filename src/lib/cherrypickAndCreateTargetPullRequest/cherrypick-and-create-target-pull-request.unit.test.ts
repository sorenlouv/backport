import os from 'node:os';
import type { MockInstance } from 'vitest';
import {
  defaultConfigOptions,
  type ValidConfigOptions,
} from '../../options/options.js';
import {
  cleanupFetchMock,
  mockFetchResponse,
  mockGraphqlRequest,
  setupFetchMock,
} from '../../test/helpers/mock-fetch.js';
import type { SpyHelper } from '../../types/spy-helper.js';
import * as childProcess from '../child-process-promisified.js';
import type { TargetBranchResponse } from '../github/v4/validate-target-branch.js';
import * as logger from '../logger.js';
import * as oraModule from '../ora.js';
import type { Commit } from '../sourceCommit/parse-source-commit.js';
import * as autoMergeNowOrLater from './auto-merge-now-or-later.js';
import { cherrypickAndCreateTargetPullRequest } from './cherrypick-and-create-target-pull-request.js';
import * as waitForCherrypickModule from './wait-for-cherrypick.js';

describe('cherrypickAndCreateTargetPullRequest', () => {
  let execSpy: SpyHelper<typeof childProcess.spawnPromise>;
  let addLabelsCalls: any[];
  let consoleLogSpy: SpyHelper<(typeof logger)['consoleLog']>;
  let autoMergeSpy: SpyHelper<typeof autoMergeNowOrLater.autoMergeNowOrLater>;

  beforeEach(() => {
    vi.spyOn(os, 'homedir').mockReturnValue('/myHomeDir');

    autoMergeSpy = vi.spyOn(autoMergeNowOrLater, 'autoMergeNowOrLater');

    execSpy = vi
      .spyOn(childProcess, 'spawnPromise')

      // mock all spawn commands to respond without errors
      .mockResolvedValue({ stdout: '', stderr: '', code: 0, cmdArgs: [] });

    consoleLogSpy = vi.spyOn(logger, 'consoleLog');

    setupFetchMock();

    // ensure labels are added
    addLabelsCalls = mockFetchResponse({
      url: '/repos/elastic/kibana/issues/1337/labels',
      method: 'POST',
      responseBody: {},
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    expect(addLabelsCalls).toHaveLength(1);
    cleanupFetchMock();
  });

  describe('when commit has a pull request reference', () => {
    let res: Awaited<ReturnType<typeof cherrypickAndCreateTargetPullRequest>>;
    let createPullRequestCalls: unknown[];
    let oraSpy: MockInstance;

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

      mockGraphqlRequest<TargetBranchResponse>({
        operationName: 'GetBranchId',
        body: { data: { repository: { ref: { id: 'foo' } } } },
      });

      createPullRequestCalls = mockFetchResponse({
        url: '/repos/elastic/kibana/pulls',
        method: 'POST',
        responseBody: { number: 1337, html_url: 'myHtmlUrl' },
      });

      oraSpy = vi.spyOn(oraModule, 'ora');

      res = await cherrypickAndCreateTargetPullRequest({
        options,
        commits,
        targetBranch: '6.x',
      });
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
        url: 'myHtmlUrl',
        number: 1337,
        hasConflicts: false,
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

      mockGraphqlRequest<TargetBranchResponse>({
        operationName: 'GetBranchId',
        body: { data: { repository: { ref: { id: 'foo' } } } },
      });

      createPullRequestCalls = mockFetchResponse({
        url: '/repos/elastic/kibana/pulls',
        method: 'POST',
        responseBody: { number: 1337, html_url: 'myHtmlUrl' },
      });

      res = await cherrypickAndCreateTargetPullRequest({
        options,
        commits,
        targetBranch: '6.x',
      });
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
        url: 'myHtmlUrl',
        number: 1337,
        hasConflicts: false,
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

      mockGraphqlRequest<TargetBranchResponse>({
        operationName: 'GetBranchId',
        body: { data: { repository: { ref: { id: 'foo' } } } },
      });

      createPullRequestCalls = mockFetchResponse({
        url: '/repos/elastic/kibana/pulls',
        method: 'POST',
        responseBody: { number: 1337, html_url: 'myHtmlUrl' },
      });

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
        url: 'myHtmlUrl',
        number: 1337,
        hasConflicts: false,
      });
    });
  });

  describe('when autoAssign is true', () => {
    let addAssigneesCalls: any[];

    beforeEach(async () => {
      const options = {
        assignees: [] as string[],
        autoAssign: true,
        authenticatedUsername: 'sqren_authenticated',
        author: 'sorenlouv',
        fork: true,
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

      mockGraphqlRequest<TargetBranchResponse>({
        operationName: 'GetBranchId',
        body: { data: { repository: { ref: { id: 'foo' } } } },
      });

      mockFetchResponse({
        url: '/repos/elastic/kibana/pulls',
        method: 'POST',
        responseBody: { number: 1337, html_url: 'myHtmlUrl' },
      });

      addAssigneesCalls = mockFetchResponse({
        url: '/repos/elastic/kibana/issues/1337/assignees',
        method: 'POST',
        responseBody: {},
      });

      await cherrypickAndCreateTargetPullRequest({
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
    });

    it('adds the authenticated user as assignee', () => {
      expect(addAssigneesCalls).toHaveLength(1);
      expect(addAssigneesCalls[0]).toEqual(
        expect.objectContaining({ assignees: ['sqren_authenticated'] }),
      );
    });
  });

  describe('WHEN a cherry-pick encounters conflicts', () => {
    it.each([
      {
        conflictResolution: 'commit' as const,
        conflictLabel: 'needs-resolution',
        expectedLabels: ['backport', 'needs-resolution'],
      },
      {
        conflictResolution: 'commit' as const,
        conflictLabel: 'conflicts-present',
        expectedLabels: ['backport', 'conflicts-present'],
      },
      {
        conflictResolution: 'theirs' as const,
        conflictLabel: 'needs-resolution',
        expectedLabels: ['backport'],
      },
    ])(
      'SHOULD return the conflict and apply the expected labels for $conflictResolution',
      async ({ conflictResolution, conflictLabel, expectedLabels }) => {
        vi.spyOn(
          waitForCherrypickModule,
          'waitForCherrypick',
        ).mockResolvedValue({
          hasCommitsWithConflicts: true,
          unresolvedFiles: ['conflicted-file.ts'],
        });

        mockGraphqlRequest<TargetBranchResponse>({
          operationName: 'GetBranchId',
          body: { data: { repository: { ref: { id: 'foo' } } } },
        });

        mockFetchResponse({
          url: '/repos/elastic/kibana/pulls',
          method: 'POST',
          responseBody: { number: 1337, html_url: 'myHtmlUrl' },
        });

        const response = await cherrypickAndCreateTargetPullRequest({
          options: {
            ...defaultConfigOptions,
            assignees: [],
            authenticatedUsername: 'authenticated-user',
            author: 'sorenlouv',
            autoMerge: false,
            conflictLabel,
            conflictResolution,
            copySourcePRLabels: false,
            copySourcePRReviewers: false,
            fork: true,
            githubToken: 'token',
            githubApiBaseUrlV4: 'http://localhost/graphql',
            interactive: false,
            prTitle: '[{{targetBranch}}] {{commitMessages}}',
            repoForkOwner: 'sorenlouv',
            repoName: 'kibana',
            repoOwner: 'elastic',
            reviewers: [],
            sourceBranch: '7.x',
            sourcePRLabels: [],
            targetPRLabels: ['backport'],
          },
          commits: [
            {
              author: {
                email: 'soren@example.com',
                name: 'Soren',
              },
              sourceBranch: '7.x',
              suggestedTargetBranches: [],
              sourceCommit: {
                branchLabelMapping: undefined,
                committedDate: '2026-01-01',
                sha: 'mySha',
                message: 'My commit',
              },
              targetPullRequestStates: [],
            },
          ],
          targetBranch: '6.x',
        });

        expect(response.hasConflicts).toBe(true);
        expect(addLabelsCalls[0]).toEqual({ labels: expectedLabels });
      },
    );

    it.each([
      [false, true],
      [true, false],
    ])(
      'SHOULD preserve a conflict from either commit in a batch: %j',
      async (firstHasConflicts, secondHasConflicts) => {
        vi.spyOn(waitForCherrypickModule, 'waitForCherrypick')
          .mockResolvedValueOnce({
            hasCommitsWithConflicts: firstHasConflicts,
            unresolvedFiles: firstHasConflicts ? ['first.ts'] : [],
          })
          .mockResolvedValueOnce({
            hasCommitsWithConflicts: secondHasConflicts,
            unresolvedFiles: secondHasConflicts ? ['second.ts'] : [],
          });

        mockGraphqlRequest<TargetBranchResponse>({
          operationName: 'GetBranchId',
          body: { data: { repository: { ref: { id: 'foo' } } } },
        });
        mockFetchResponse({
          url: '/repos/elastic/kibana/pulls',
          method: 'POST',
          responseBody: { number: 1337, html_url: 'myHtmlUrl' },
        });

        const makeCommit = (sha: string): Commit => ({
          author: { email: 'soren@example.com', name: 'Soren' },
          sourceBranch: '7.x',
          suggestedTargetBranches: [],
          sourceCommit: {
            branchLabelMapping: undefined,
            committedDate: '2026-01-01',
            sha,
            message: `Commit ${sha}`,
          },
          targetPullRequestStates: [],
        });

        const response = await cherrypickAndCreateTargetPullRequest({
          options: {
            ...defaultConfigOptions,
            assignees: [],
            authenticatedUsername: 'authenticated-user',
            author: 'sorenlouv',
            autoMerge: true,
            conflictLabel: 'conflicts-present',
            conflictResolution: 'commit',
            copySourcePRLabels: false,
            copySourcePRReviewers: false,
            fork: true,
            githubToken: 'token',
            githubApiBaseUrlV4: 'http://localhost/graphql',
            interactive: false,
            prTitle: '[{{targetBranch}}] {{commitMessages}}',
            repoForkOwner: 'sorenlouv',
            repoName: 'kibana',
            repoOwner: 'elastic',
            reviewers: [],
            sourceBranch: '7.x',
            sourcePRLabels: [],
            targetPRLabels: ['backport'],
          },
          commits: [makeCommit('first'), makeCommit('second')],
          targetBranch: '6.x',
        });

        expect(response.hasConflicts).toBe(true);
        expect(addLabelsCalls[0]).toEqual({
          labels: ['backport', 'conflicts-present'],
        });
        expect(autoMergeSpy).not.toHaveBeenCalled();
      },
    );
  });
});
