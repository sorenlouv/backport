import MockAdapter from 'axios-mock-adapter';
import axios from 'axios';
import { fetchCommitBySha } from '../../../src/services/github/fetchCommitBySha';
import { getDefaultOptions } from './getDefaultOptions';

describe('fetchCommitBySha', () => {
  it('should return single commit with pull request', async () => {
    const mock = new MockAdapter(axios);
    const commitSha = 'myCommitSha';
    const options = getDefaultOptions();
    const { repoOwner, repoName, accessToken } = options;

    mock
      .onGet(
        `https://api.github.com/search/commits?q=hash:${commitSha}%20repo:${repoOwner}/${repoName}&per_page=1&access_token=${accessToken}`
      )
      .reply(200, {
        items: [{ commit: { message: 'myMessage' }, sha: commitSha }]
      });

    mock
      .onGet(
        `https://api.github.com/search/issues?q=repo:${repoOwner}/${repoName}+${commitSha}+base:master&access_token=${accessToken}`
      )
      .reply(200, { items: [{ number: 'myPullRequestNumber' }] });

    expect(await fetchCommitBySha({ ...options, sha: commitSha })).toEqual({
      message: 'myMessage (#myPullRequestNumber)',
      pullNumber: 'myPullRequestNumber',
      sha: 'myCommitSha'
    });
  });
});
