import { getDevAccessToken } from '../../../../test/private/getDevAccessToken';
import type { Commit } from '../../../sourceCommit/parseSourceCommit';
import { fetchCommitBySha } from './fetchCommitBySha';

const accessToken = getDevAccessToken();

describe('fetchCommitBySha', () => {
  it('should return single commit with pull request', async () => {
    const expectedCommit: Commit = {
      author: { email: 'sorenlouv@gmail.com', name: 'Søren Louv-Jansen' },
      suggestedTargetBranches: [],
      sourceCommit: {
        branchLabelMapping: {
          '^v(\\d+).(\\d+).\\d+$': '$1.$2',
          '^v7.9.0$': '7.x',
          '^v8.0.0$': 'master',
        },
        committedDate: '2020-07-07T20:40:28Z',
        message: '[APM] Add API tests (#70740)',
        sha: 'cb6fbc0e1b406675724181a3e9f59459b5f8f892',
      },
      sourcePullRequest: {
        labels: ['Team:APM - DEPRECATED', 'release_note:skip', 'v7.9.0'],
        number: 70740,
        title: '[APM] Add API tests',
        url: 'https://github.com/elastic/kibana/pull/70740',
        mergeCommit: {
          message: '[APM] Add API tests (#70740)',
          sha: 'cb6fbc0e1b406675724181a3e9f59459b5f8f892',
        },
      },
      sourceBranch: 'master',
      targetPullRequestStates: [
        {
          branch: '7.x',
          label: 'v7.9.0',
          branchLabelMappingKey: '^v7.9.0$',
          isSourceBranch: false,
          state: 'MERGED',
          number: 71014,
          url: 'https://github.com/elastic/kibana/pull/71014',
          mergeCommit: {
            message: '[APM] Add API tests (#70740) (#71014)',
            sha: 'd15242be682582e58cd69f6b7707565434e99293',
          },
        },
      ],
    };

    const commit = await fetchCommitBySha({
      repoOwner: 'elastic',
      repoName: 'kibana',
      accessToken,
      sha: 'cb6fbc0e',
      sourceBranch: 'master',
    });

    expect(commit).toEqual(expectedCommit);
  });

  it('throws if sha does not exist', async () => {
    await expect(
      fetchCommitBySha({
        repoOwner: 'elastic',
        repoName: 'kibana',
        accessToken,
        sha: 'fc22f59',
        sourceBranch: 'main',
      }),
    ).rejects.toThrow('No commit found on branch "main" with sha "fc22f59"');
  });

  it('throws if sha is invalid', async () => {
    await expect(
      fetchCommitBySha({
        repoOwner: 'elastic',
        repoName: 'kibana',
        accessToken,
        sha: 'myCommitSha',
        sourceBranch: 'main',
      }),
    ).rejects.toThrow(
      'No commit found on branch "main" with sha "myCommitSha"',
    );
  });
});
