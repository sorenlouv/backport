import { getDevAccessToken } from '../../../test/helpers/get-dev-access-token.js';
import { getReviewersFromPullRequests } from './get-reviewers-from-pull-requests.js';

const githubToken = getDevAccessToken();

describe('getReviewersFromPullRequests', () => {
  it('returns reviewers', async () => {
    const reviewers = await getReviewersFromPullRequests({
      options: {
        repoOwner: 'backport-org',
        repoName: 'repo-with-reviewed-pull-requests',
        githubToken,
        authenticatedUsername: 'foobar',
        interactive: true,
      },
      pullNumbers: [2],
    });

    expect(reviewers).toEqual(['sorenlouv', 'backport-demo-user']);
  });

  it('excludes current user', async () => {
    const reviewers = await getReviewersFromPullRequests({
      options: {
        repoOwner: 'backport-org',
        repoName: 'repo-with-reviewed-pull-requests',
        githubToken,
        authenticatedUsername: 'sorenlouv',
        interactive: false,
      },
      pullNumbers: [2],
    });

    expect(reviewers).toEqual(['backport-demo-user']);
  });
});
