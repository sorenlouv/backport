import type { Commit } from '../../sourceCommit/parse-source-commit.js';
import { getTargetPRLabels } from './get-target-prlabels.js';

const commits = [
  {
    author: { email: 'soren@example.com', name: 'Soren' },
    sourceBranch: 'main',
    sourceCommit: {
      branchLabelMapping: undefined,
      sha: 'abc123',
      message: 'Fix a bug',
      committedDate: '2026-01-01',
    },
    suggestedTargetBranches: [],
    targetPullRequestStates: [],
  },
] satisfies Commit[];

function getLabels({
  hasConflicts,
  targetPRLabels = [],
}: {
  hasConflicts: boolean;
  targetPRLabels?: string[];
}) {
  return getTargetPRLabels({
    interactive: false,
    targetPRLabels,
    commits,
    targetBranch: '7.x',
    copySourcePRLabels: false,
    conflictLabel: 'merge-conflict',
    hasConflicts,
  });
}

describe('WHEN target pull request labels are resolved', () => {
  it('SHOULD add the conflict label for committed conflicts', () => {
    expect(getLabels({ hasConflicts: true })).toEqual(['merge-conflict']);
  });

  it('SHOULD omit the conflict label without committed conflicts', () => {
    expect(getLabels({ hasConflicts: false })).toEqual([]);
  });

  it('SHOULD avoid duplicate conflict labels', () => {
    expect(
      getLabels({
        hasConflicts: true,
        targetPRLabels: ['merge-conflict'],
      }),
    ).toEqual(['merge-conflict']);
  });
});
