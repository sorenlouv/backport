import { getDevGithubToken } from '../../../../test/helpers/get-dev-github-token.js';
import type { Commit } from '../../../sourceCommit/parse-source-commit.js';
import { fetchCommitBySha } from './fetch-commit-by-sha.js';

const githubToken = getDevGithubToken();

describe('fetchCommitBySha', () => {
  it('should return single commit with pull request', async () => {
    const expectedCommit: Commit = {
      author: { email: 'sorenlouv@gmail.com', name: 'Søren Louv-Jansen' },
      suggestedTargetBranches: [],
      sourceCommit: {
        branchLabelMapping: {
          '^v8.0.0$': 'master',
          '^v7.9.0$': '7.x',
          '^v(\\d+).(\\d+).\\d+$': '$1.$2',
        },
        committedDate: '2020-08-15T12:40:19Z',
        message: 'Add 🍏 emoji (#5)',
        sha: 'ee8c492334cef1ca077a56addb79a26f79821d2f',
      },
      sourcePullRequest: {
        labels: ['v7.8.0', 'v7.9.0', 'v8.0.0'],
        number: 5,
        title: 'Add 🍏 emoji',
        url: 'https://github.com/backport-org/backport-e2e/pull/5',
        mergeCommit: {
          message: 'Add 🍏 emoji (#5)',
          sha: 'ee8c492334cef1ca077a56addb79a26f79821d2f',
        },
      },
      sourceBranch: 'master',
      targetPullRequestStates: [
        {
          branch: '7.8',
          label: 'v7.8.0',
          branchLabelMappingKey: String.raw`^v(\d+).(\d+).\d+$`,
          isSourceBranch: false,
          state: 'MERGED',
          number: 7,
          url: 'https://github.com/backport-org/backport-e2e/pull/7',
          mergeCommit: {
            message: 'Add 🍏 emoji (#5) (#7)',
            sha: '46cd6f9999effdf894a36dbc7db90e890f4be840',
          },
        },
        {
          branch: '7.x',
          label: 'v7.9.0',
          branchLabelMappingKey: '^v7.9.0$',
          isSourceBranch: false,
          state: 'MERGED',
          number: 6,
          url: 'https://github.com/backport-org/backport-e2e/pull/6',
          mergeCommit: {
            message: 'Add 🍏 emoji (#5) (#6)',
            sha: '4bcd876d4ceaa73cf437bfc89b74d1a4e704c0a6',
          },
        },
        {
          branch: 'master',
          label: 'v8.0.0',
          branchLabelMappingKey: '^v8.0.0$',
          isSourceBranch: true,
          state: 'MERGED',
          number: 5,
          url: 'https://github.com/backport-org/backport-e2e/pull/5',
          mergeCommit: {
            message: 'Add 🍏 emoji (#5)',
            sha: 'ee8c492334cef1ca077a56addb79a26f79821d2f',
          },
        },
      ],
    };

    const commit = await fetchCommitBySha({
      repoOwner: 'backport-org',
      repoName: 'backport-e2e',
      githubToken,
      sha: 'ee8c4923',
      sourceBranch: 'master',
    });

    expect(commit).toEqual(expectedCommit);
  });

  it('throws if sha does not exist', async () => {
    await expect(
      fetchCommitBySha({
        repoOwner: 'backport-org',
        repoName: 'backport-e2e',
        githubToken,
        sha: 'fc22f59',
        sourceBranch: 'master',
      }),
    ).rejects.toThrow('No commit found on branch "master" with sha "fc22f59"');
  });

  it('throws if sha is invalid', async () => {
    await expect(
      fetchCommitBySha({
        repoOwner: 'backport-org',
        repoName: 'backport-e2e',
        githubToken,
        sha: 'myCommitSha',
        sourceBranch: 'master',
      }),
    ).rejects.toThrow(
      'No commit found on branch "master" with sha "myCommitSha"',
    );
  });
});
