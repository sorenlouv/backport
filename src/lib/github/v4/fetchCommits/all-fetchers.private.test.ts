import { getDevGithubToken } from '../../../../test/helpers/get-dev-github-token.js';
import type { Commit } from '../../../sourceCommit/parse-source-commit.js';
import { fetchCommitsByPullNumber } from './fetch-commit-by-pull-number.js';
import { fetchCommitBySha } from './fetch-commit-by-sha.js';
import { fetchCommitsByAuthor } from './fetch-commits-by-author.js';
import { fetchPullRequestsBySearchQuery } from './fetch-pull-requests-by-search-query.js';

const githubToken = getDevGithubToken();
vi.setConfig({ testTimeout: 15_000 });

describe('allFetchers', () => {
  let commitByAuthor: Commit;

  beforeEach(async () => {
    const commitsByAuthor = await fetchCommitsByAuthor({
      githubToken,
      author: 'sorenlouv',
      maxCount: 1,
      repoName: 'backport-e2e',
      repoOwner: 'backport-org',
      sourceBranch: 'master',
      since: '2020-08-16T00:00:00Z',
      until: '2020-08-17T00:00:00Z',
      commitPaths: [] as Array<string>,
    });

    commitByAuthor = commitsByAuthor[0];
  });

  it('matches commitByAuthor with commitByPullNumber', async () => {
    if (!commitByAuthor.sourcePullRequest) {
      throw new Error('Missing pull number!');
    }

    const commitByPullNumber = await fetchCommitsByPullNumber({
      repoOwner: 'backport-org',
      repoName: 'backport-e2e',
      githubToken,
      pullNumber: commitByAuthor.sourcePullRequest.number,
      sourceBranch: 'master',
    });

    expect(commitByAuthor).toEqual(commitByPullNumber[0]);
  });

  it('matches commitByAuthor with commitBySha', async () => {
    const commitBySha = await fetchCommitBySha({
      repoOwner: 'backport-org',
      repoName: 'backport-e2e',
      githubToken,
      sha: commitByAuthor.sourceCommit.sha,
      sourceBranch: 'master',
    });

    expect(commitByAuthor).toEqual(commitBySha);
  });

  it('matches commitByAuthor with commitBySearchQuery', async () => {
    const commitsBySearchQuery = await fetchPullRequestsBySearchQuery({
      githubToken,
      author: 'sorenlouv',
      since: null,
      until: null,
      maxCount: 1,
      prQuery: `created:2020-08-16..2020-08-16`,
      repoName: 'backport-e2e',
      repoOwner: 'backport-org',
      sourceBranch: 'master',
    });

    const commitBySearchQuery = commitsBySearchQuery[0];

    expect(commitByAuthor).toEqual(commitBySearchQuery);
  });

  it('returns correct response for commitByAuthor', () => {
    const expectedCommit: Commit = {
      author: { email: 'sorenlouv@gmail.com', name: 'Søren Louv-Jansen' },
      suggestedTargetBranches: [],
      sourceCommit: {
        branchLabelMapping: {
          '^v8.0.0$': 'master',
          '^v7.9.0$': '7.x',
          '^v(\\d+).(\\d+).\\d+$': '$1.$2',
        },
        committedDate: '2020-08-16T21:44:28Z',
        message: 'Add sheep emoji (#9)',
        sha: 'eebf165c82a4b718d95c11b3877e365b1949ff28',
      },
      sourcePullRequest: {
        labels: ['v7.8.0'],
        number: 9,
        title: 'Add sheep emoji',
        url: 'https://github.com/backport-org/backport-e2e/pull/9',
        mergeCommit: {
          message: 'Add sheep emoji (#9)',
          sha: 'eebf165c82a4b718d95c11b3877e365b1949ff28',
        },
      },
      sourceBranch: 'master',
      targetPullRequestStates: [
        {
          branch: '7.8',
          label: 'v7.8.0',
          branchLabelMappingKey: String.raw`^v(\d+).(\d+).\d+$`,
          isSourceBranch: false,
          state: 'OPEN',
          number: 10,
          url: 'https://github.com/backport-org/backport-e2e/pull/10',
        },
      ],
    };
    expect(commitByAuthor).toEqual(expectedCommit);
  });
});
