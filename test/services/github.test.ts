import {
  fetchCommitsByAuthor,
  setAccessToken
} from '../../src/services/github';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { BackportOptions } from '../../src/options/options';

describe('getCommits', () => {
  it('should return commits with pull request', async () => {
    const mock = new MockAdapter(axios);
    const repoOwner = 'elastic';
    const repoName = 'kibana';
    const accessToken = 'myAccessToken';
    const username = 'sqren';
    const commitSha = 'myCommitSha';
    const apiHostname = 'api.github.com';
    setAccessToken(accessToken);

    mock
      .onGet(
        `https://api.github.com/repos/${repoOwner}/${repoName}/commits?access_token=${accessToken}&per_page=5&author=${username}`
      )
      .reply(200, [
        {
          commit: {
            message: 'myMessage'
          },
          sha: commitSha
        }
      ]);

    mock
      .onGet(
        `https://api.github.com/search/issues?q=repo:${repoOwner}/${repoName}+${commitSha}+base:master&access_token=${accessToken}`
      )
      .reply(200, {
        items: [
          {
            number: 'myPullRequestNumber'
          }
        ]
      });

    expect(
      await fetchCommitsByAuthor({
        repoOwner,
        repoName,
        username,
        apiHostname
      } as BackportOptions)
    ).toEqual([
      {
        message: 'myMessage',
        pullNumber: 'myPullRequestNumber',
        sha: 'myCommitSha'
      }
    ]);
  });

  it('should return commits without pull request', async () => {
    const mock = new MockAdapter(axios);
    const repoOwner = 'elastic';
    const repoName = 'kibana';
    const accessToken = 'myAccessToken';
    const username = 'sqren';
    const commitSha = 'myCommitSha';
    const apiHostname = 'api.github.com';
    setAccessToken(accessToken);

    mock
      .onGet(
        `https://api.github.com/repos/${repoOwner}/${repoName}/commits?access_token=${accessToken}&per_page=5&author=${username}`
      )
      .reply(200, [
        {
          commit: {
            message: 'myMessage'
          },
          sha: commitSha
        }
      ]);

    mock
      .onGet(
        `https://api.github.com/search/issues?q=repo:${repoOwner}/${repoName}+${commitSha}+base:master&access_token=${accessToken}`
      )
      .reply(200, { items: [] });

    expect(
      await fetchCommitsByAuthor({
        repoOwner,
        repoName,
        username,
        apiHostname
      } as BackportOptions)
    ).toEqual([
      {
        message: 'myMessage',
        pullNumber: undefined,
        sha: 'myCommitSha'
      }
    ]);
  });

  it('allows a custom github api hostname', async () => {
    const mock = new MockAdapter(axios);
    const repoOwner = 'elastic';
    const repoName = 'kibana';
    const accessToken = 'myAccessToken';
    const username = 'sqren';
    const commitSha = 'myCommitSha';
    const apiHostname = 'api.github.my-company.com';
    setAccessToken(accessToken);

    mock
      .onGet(
        `https://${apiHostname}/repos/${repoOwner}/${repoName}/commits?access_token=${accessToken}&per_page=5&author=${username}`
      )
      .reply(200, [
        {
          commit: {
            message: 'myMessage'
          },
          sha: commitSha
        }
      ]);

    mock
      .onGet(
        `https://${apiHostname}/search/issues?q=repo:${repoOwner}/${repoName}+${commitSha}+base:master&access_token=${accessToken}`
      )
      .reply(200, {
        items: [
          {
            number: 'myPullRequestNumber'
          }
        ]
      });

    expect(
      await fetchCommitsByAuthor({
        repoOwner,
        repoName,
        apiHostname,
        username
      } as BackportOptions)
    ).toEqual([
      {
        message: 'myMessage',
        pullNumber: 'myPullRequestNumber',
        sha: 'myCommitSha'
      }
    ]);
  });
});
