import { backportRun } from '../../backport-run.js';
import * as getCommitsModule from '../../lib/get-commits.js';
import * as getTargetBranchesModule from '../../lib/get-target-branches.js';
import * as createStatusCommentModule from '../../lib/github/v3/create-status-comment.js';
import * as runSequentiallyModule from '../../lib/run-sequentially.js';
import * as setupRepoModule from '../../lib/setup-repo.js';
import * as optionsModule from '../../options/options.js';
import {
  defaultConfigOptions,
  type ValidConfigOptions,
} from '../../options/options.js';

function makeOptions(
  overrides: Partial<ValidConfigOptions> = {},
): ValidConfigOptions {
  return {
    ...defaultConfigOptions,
    authenticatedUsername: 'authenticated-user',
    author: 'sorenlouv',
    conflictResolution: 'commit',
    failOnConflicts: true,
    githubToken: 'token',
    interactive: false,
    repoForkOwner: 'sorenlouv',
    repoName: 'repo',
    repoOwner: 'org',
    sourceBranch: 'main',
    ...overrides,
  };
}

describe('WHEN a pull request is created after committing conflicts', () => {
  beforeEach(() => {
    process.exitCode = undefined;
    vi.spyOn(optionsModule, 'getOptions').mockResolvedValue(makeOptions());
    vi.spyOn(getCommitsModule, 'getCommits').mockResolvedValue([]);
    vi.spyOn(getTargetBranchesModule, 'getTargetBranches').mockResolvedValue([
      '7.x',
    ]);
    vi.spyOn(setupRepoModule, 'setupRepo').mockResolvedValue();
    vi.spyOn(runSequentiallyModule, 'runSequentially').mockResolvedValue([
      {
        status: 'success',
        targetBranch: '7.x',
        pullRequestUrl: 'https://github.com/org/repo/pull/1',
        pullRequestNumber: 1,
        hasConflicts: true,
      },
    ]);
    vi.spyOn(
      createStatusCommentModule,
      'createStatusComment',
    ).mockResolvedValue();
  });

  afterEach(() => {
    process.exitCode = undefined;
    vi.restoreAllMocks();
  });

  it.each([
    {
      name: 'committed conflict with failure enabled',
      conflictResolution: 'commit' as const,
      failOnConflicts: true,
      hasConflicts: true,
      exitCodeOnFailure: true,
      expectedExitCode: 1,
    },
    {
      name: 'failure disabled',
      conflictResolution: 'commit' as const,
      failOnConflicts: false,
      hasConflicts: true,
      exitCodeOnFailure: true,
      expectedExitCode: undefined,
    },
    {
      name: 'no conflicts',
      conflictResolution: 'commit' as const,
      failOnConflicts: true,
      hasConflicts: false,
      exitCodeOnFailure: true,
      expectedExitCode: undefined,
    },
    {
      name: 'automatically resolved conflict',
      conflictResolution: 'theirs' as const,
      failOnConflicts: true,
      hasConflicts: true,
      exitCodeOnFailure: true,
      expectedExitCode: undefined,
    },
    {
      name: 'module caller opted out of exit mutation',
      conflictResolution: 'commit' as const,
      failOnConflicts: true,
      hasConflicts: true,
      exitCodeOnFailure: false,
      expectedExitCode: undefined,
    },
  ])(
    'SHOULD set exit status $expectedExitCode for $name',
    async ({
      conflictResolution,
      failOnConflicts,
      hasConflicts,
      exitCodeOnFailure,
      expectedExitCode,
    }) => {
      vi.mocked(optionsModule.getOptions).mockResolvedValue(
        makeOptions({ conflictResolution, failOnConflicts }),
      );
      vi.mocked(runSequentiallyModule.runSequentially).mockResolvedValue([
        {
          status: 'success',
          targetBranch: '7.x',
          pullRequestUrl: 'https://github.com/org/repo/pull/1',
          pullRequestNumber: 1,
          hasConflicts,
        },
      ]);

      const response = await backportRun({
        processArgs: ['--non-interactive'],
        exitCodeOnFailure,
      });

      expect(response.results[0]).toMatchObject({ hasConflicts });
      expect(process.exitCode).toBe(expectedExitCode);
    },
  );

  it.each([
    [false, true],
    [true, false],
  ])(
    'SHOULD fail when either target branch has committed conflicts: %j',
    async (firstHasConflicts, secondHasConflicts) => {
      vi.mocked(runSequentiallyModule.runSequentially).mockResolvedValue([
        {
          status: 'success',
          targetBranch: '7.x',
          pullRequestUrl: 'https://github.com/org/repo/pull/1',
          pullRequestNumber: 1,
          hasConflicts: firstHasConflicts,
        },
        {
          status: 'success',
          targetBranch: '8.x',
          pullRequestUrl: 'https://github.com/org/repo/pull/2',
          pullRequestNumber: 2,
          hasConflicts: secondHasConflicts,
        },
      ]);

      await backportRun({
        processArgs: ['--non-interactive'],
        exitCodeOnFailure: true,
      });

      expect(process.exitCode).toBe(1);
    },
  );
});
