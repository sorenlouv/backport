import type { Commit } from '../../../entrypoint.api';
import { getConfiguredTargetPRLabels } from './get-configured-target-pr-labels';

const commits: Commit[] = [
  {
    author: { name: 'Søren Louv-Jansen', email: 'sorenlouv@gmail.com' },
    suggestedTargetBranches: [],
    sourceCommit: {
      branchLabelMapping: {
        '^backport-to-(.+)$': '$1',
      },
      committedDate: '2021-01-13T20:01:44Z',
      message: 'Fix major bug (#88188)',
      sha: 'd1b348e6213c5ad48653dfaad6eaf4928b2c688b',
    },
    sourcePullRequest: {
      labels: ['backport-to-7.11', 'feature-abc'],
      number: 88188,
      title: 'Fix major bug',
      url: 'https://github.com/elastic/kibana/pull/88188',
      mergeCommit: {
        message: 'Fix major bug (#88188)',
        sha: 'd1b348e6213c5ad48653dfaad6eaf4928b2c688b',
      },
    },
    sourceBranch: 'master',
    targetPullRequestStates: [
      {
        url: 'https://github.com/elastic/kibana/pull/88289',
        number: 88289,
        branch: '7.11',
        label: 'backport-to-7.11',
        branchLabelMappingKey: '^backport-to-(.+)$',
        isSourceBranch: false,
        state: 'OPEN',
        mergeCommit: {
          sha: 'b8194e9ec27d69f485d8b194d1cb5e4f6d8fef6d',
          message: 'Fix major bug (#88188) (#88289)',
        },
      },
      {
        url: 'https://github.com/elastic/kibana/pull/88288',
        number: 88288,
        branch: '7.x',
        state: 'OPEN',
        mergeCommit: {
          sha: '52710be7add6811ec4783c7d383d4159c0aa76f5',
          message: '[7.x] Fix major bug (#88188) (#88288)',
        },
      },
    ],
  },
];

describe('getConfiguredTargetPRLabels', () => {
  describe('replaces template values', () => {
    it('replaces {{targetBranch}}', () => {
      const labels = getConfiguredTargetPRLabels({
        interactive: false,
        commits,
        targetPRLabels: ['backported-to-{{targetBranch}}'],
        targetBranch: '7.x',
      });
      expect(labels).toEqual(['backported-to-7.x']);
    });

    it('replaces {{sourceBranch}}', () => {
      const labels = getConfiguredTargetPRLabels({
        interactive: false,
        commits,
        targetPRLabels: ['backported-from-{{sourceBranch}}'],
        targetBranch: '7.x',
      });
      expect(labels).toEqual(['backported-from-master']);
    });
  });

  describe('static labels', () => {
    it('keeps static labels regardless of interactivity', () => {
      expect(
        getConfiguredTargetPRLabels({
          interactive: false,
          commits,
          targetPRLabels: ['some-static-label'],
          targetBranch: '7.11',
        }),
      ).toEqual(['some-static-label']);

      expect(
        getConfiguredTargetPRLabels({
          interactive: true,
          commits,
          targetPRLabels: ['some-static-label'],
          targetBranch: '7.11',
        }),
      ).toEqual(['some-static-label']);
    });
  });

  describe('dynamic labels', () => {
    it('applies dynamic label when branch mapping is available', () => {
      expect(
        getConfiguredTargetPRLabels({
          interactive: false,
          commits,
          targetPRLabels: ['backport-$1'],
          targetBranch: '7.11',
        }),
      ).toEqual(['backport-7.11']);
    });

    it('drops dynamic label when interactive and mapping is missing', () => {
      expect(
        getConfiguredTargetPRLabels({
          interactive: true,
          commits,
          targetPRLabels: ['backport-$1'],
          targetBranch: '7.x',
        }),
      ).toEqual([]);
    });
  });

  describe('multiple dynamic labels', () => {
    it('keeps resolved labels and drops unresolved ones based on interactivity', () => {
      expect(
        getConfiguredTargetPRLabels({
          interactive: false,
          commits,
          targetPRLabels: ['backport-$1', '$1', 'my-static-label'],
          targetBranch: '7.11',
        }),
      ).toEqual(['backport-7.11', '7.11', 'my-static-label']);

      expect(
        getConfiguredTargetPRLabels({
          interactive: true,
          commits,
          targetPRLabels: ['backport-$1', '$1', 'my-static-label'],
          targetBranch: '7.x',
        }),
      ).toEqual(['my-static-label']);
    });
  });
});
