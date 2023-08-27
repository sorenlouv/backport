import { getDevAccessToken } from '../../../test/private/getDevAccessToken';
import { getReviewersFromPullRequests } from './getReviewersFromPullRequests';

const accessToken = getDevAccessToken();

describe('getReviewersFromPullRequests', () => {
  it('returns reviewers', async () => {
    const reviewers = await getReviewersFromPullRequests({
      options: {
        repoOwner: 'backport-org',
        repoName: 'commit-author',
        accessToken,
        authenticatedUsername: 'foobar',
        interactive: true,
      },
      pullNumbers: [2],
    });

    expect(reviewers).toEqual(['sqren', 'backport-demo-user']);
  });

  it('excludes current user', async () => {
    const reviewers = await getReviewersFromPullRequests({
      options: {
        repoOwner: 'backport-org',
        repoName: 'commit-author',
        accessToken,
        authenticatedUsername: 'sqren',
        interactive: false,
      },
      pullNumbers: [2],
    });

    expect(reviewers).toEqual(['backport-demo-user']);
  });
});
