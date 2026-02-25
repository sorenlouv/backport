import type { Commit } from '../../entrypoint.api';
import { BackportError } from '../../entrypoint.api';
import type { ValidConfigOptions } from '../../options/options';
import * as git from '../git';
import { logger } from '../logger';
import { waitForCherrypick } from './wait-for-cherrypick';

const commitAuthor = { name: 'Test User', email: 'test@test.com' };

function makeCommit(overrides?: Partial<Commit>): Commit {
  return {
    author: commitAuthor,
    sourceCommit: {
      sha: 'abc123',
      message: 'My commit message (#1)',
      committedDate: '2021-01-01',
    },
    sourcePullRequest: {
      number: 1,
      title: 'My commit message',
      url: 'https://github.com/org/repo/pull/1',
      labels: [],
      mergeCommit: {
        sha: 'abc123',
        message: 'My commit message (#1)',
      },
    },
    sourceBranch: 'main',
    targetPullRequestStates: [],
    suggestedTargetBranches: [],
    ...overrides,
  } as Commit;
}

function makeOptions(
  overrides?: Partial<ValidConfigOptions>,
): ValidConfigOptions {
  return {
    repoOwner: 'org',
    repoName: 'repo',
    interactive: false,
    autoResolveConflictsWithTheirs: true,
    ...overrides,
  } as ValidConfigOptions;
}

const conflictingCherrypickResult = {
  conflictingFiles: [{ absolute: '/repo/la-liga.md', relative: 'la-liga.md' }],
  unstagedFiles: [],
  needsResolving: true,
};

const cleanCherrypickResult = {
  conflictingFiles: [],
  unstagedFiles: [],
  needsResolving: false,
};

describe('waitForCherrypick with autoResolveConflictsWithTheirs', () => {
  let cherrypickSpy: jest.SpyInstance;
  let cherrypickAbortSpy: jest.SpyInstance;

  beforeEach(() => {
    cherrypickSpy = jest.spyOn(git, 'cherrypick');
    cherrypickAbortSpy = jest
      .spyOn(git, 'cherrypickAbort')
      .mockResolvedValue({ stderr: '', stdout: '', code: 0, cmdArgs: [] });
    jest.spyOn(git, 'commitChanges').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should abort and retry with theirs when cherry-pick has conflicts', async () => {
    cherrypickSpy
      .mockResolvedValueOnce(conflictingCherrypickResult) // first attempt: conflicts
      .mockResolvedValueOnce(cleanCherrypickResult); // retry: clean

    const result = await waitForCherrypick(makeOptions(), makeCommit(), '7.x');

    expect(result).toEqual({
      hasCommitsWithConflicts: true,
      unresolvedFiles: [],
    });

    expect(cherrypickAbortSpy).toHaveBeenCalledTimes(1);
    expect(cherrypickSpy).toHaveBeenCalledTimes(2);
    expect(cherrypickSpy.mock.calls[1][0]).toMatchObject({
      strategyOption: 'theirs',
    });
  });

  it('should return unresolvedFiles when retry still has conflicts', async () => {
    cherrypickSpy
      .mockResolvedValueOnce(conflictingCherrypickResult) // first attempt
      .mockResolvedValueOnce(conflictingCherrypickResult); // retry: still conflicts

    const result = await waitForCherrypick(makeOptions(), makeCommit(), '7.x');

    expect(result).toEqual({
      hasCommitsWithConflicts: true,
      unresolvedFiles: ['la-liga.md'],
    });

    expect((logger as any).spy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Cherry-pick retry with --strategy-option=theirs still has unresolved files',
      ),
      undefined,
    );
  });

  it('should warn when both autoResolveConflictsWithTheirs and commitConflicts are set', async () => {
    cherrypickSpy
      .mockResolvedValueOnce(conflictingCherrypickResult)
      .mockResolvedValueOnce(cleanCherrypickResult);

    await waitForCherrypick(
      makeOptions({ commitConflicts: true }),
      makeCommit(),
      '7.x',
    );

    expect((logger as any).spy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Both "autoResolveConflictsWithTheirs" and "commitConflicts" are enabled',
      ),
      undefined,
    );
  });

  it('should propagate error when cherrypickAbort fails', async () => {
    cherrypickSpy.mockResolvedValueOnce(conflictingCherrypickResult);
    cherrypickAbortSpy.mockRejectedValueOnce(
      new BackportError('Failed to abort cherry-pick before retry'),
    );

    await expect(
      waitForCherrypick(makeOptions(), makeCommit(), '7.x'),
    ).rejects.toThrow('Failed to abort cherry-pick before retry');
  });

  it('should not abort/retry when cherry-pick succeeds cleanly', async () => {
    cherrypickSpy.mockResolvedValueOnce(cleanCherrypickResult);

    const result = await waitForCherrypick(makeOptions(), makeCommit(), '7.x');

    expect(result).toEqual({
      hasCommitsWithConflicts: false,
      unresolvedFiles: [],
    });

    expect(cherrypickAbortSpy).not.toHaveBeenCalled();
    expect(cherrypickSpy).toHaveBeenCalledTimes(1);
  });
});
