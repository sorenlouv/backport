import { getDevAccessToken } from '../../../test/private/get-dev-access-token';
import { getReviewersFromPullRequests } from './get-reviewers-from-pull-requests';

const accessToken = getDevAccessToken();

describe('getReviewersFromPullRequests', () => {
  it('returns reviewers', async () => {
    const reviewers = await getReviewersFromPullRequests({
      options: {
        repoOwner: 'backport-org',
        repoName: 'repo-with-reviewed-pull-requests',
        accessToken,
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
        accessToken,
        authenticatedUsername: 'sorenlouv',
        interactive: false,
      },
      pullNumbers: [2],
    });

    expect(reviewers).toEqual(['backport-demo-user']);
  });
});
