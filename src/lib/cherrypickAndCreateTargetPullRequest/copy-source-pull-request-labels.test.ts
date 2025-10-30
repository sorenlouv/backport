import type { Commit } from '../sourceCommit/parse-source-commit';
import { getLabelsToCopy } from './copy-source-pull-request-labels';

const commits: Commit[] = [
  {
    author: { name: 'Søren Louv-Jansen', email: 'sorenlouv@gmail.com' },
    sourceBranch: 'main',
    suggestedTargetBranches: [],
    sourceCommit: {
      branchLabelMapping: {},
      committedDate: '2024-01-01T00:00:00Z',
      message: 'Some fix (#123)',
      sha: 'abc123',
    },
    sourcePullRequest: {
      labels: ['development', 'version-33', 'release_note:fix'],
      number: 123,
      title: 'Some fix',
      url: 'https://github.com/example/repo/pull/123',
      mergeCommit: {
        message: 'Some fix (#123)',
        sha: 'abc123',
      },
    },
    targetPullRequestStates: [
      {
        branch: '7.x',
        label: 'backport-to-7.x',
        number: 456,
        state: 'OPEN',
        url: 'https://github.com/example/repo/pull/456',
      },
    ],
  },
];

describe('getLabelsToCopy', () => {
  it('copies no labels when option is false', () => {
    const labels = getLabelsToCopy({
      commits,
      copySourcePRLabels: false,
    });
    expect(labels).toEqual([]);
  });

  it('copies all non-backport labels when option is true', () => {
    const labels = getLabelsToCopy({
      commits,
      copySourcePRLabels: true,
    });
    expect(labels).toEqual(['development', 'version-33', 'release_note:fix']);
  });

  it('copies labels matching provided regex patterns', () => {
    const labels = getLabelsToCopy({
      commits,
      copySourcePRLabels: ['^version-\\d+$', '^release_note:\\w+$'],
    });
    expect(labels).toEqual(['version-33', 'release_note:fix']);
  });

  it('does not copy labels when no labels match the regex patterns', () => {
    const labels = getLabelsToCopy({
      commits,
      copySourcePRLabels: ['^release-only$'],
    });
    expect(labels).toEqual([]);
  });

  it('supports single regex string configuration', () => {
    const labels = getLabelsToCopy({
      commits,
      copySourcePRLabels: '^release_note:\\w+$',
    });
    expect(labels).toEqual(['release_note:fix']);
  });
});
