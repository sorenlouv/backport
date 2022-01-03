jest.unmock('./services/logger');

import { getCommits } from './entrypoint.module';
import { getDevAccessToken } from './test/private/getDevAccessToken';

describe('entrypoint.module', () => {
  it('getCommits', async () => {
    const accessToken = await getDevAccessToken();
    const commits = await getCommits({
      accessToken: accessToken,
      repoName: 'kibana',
      repoOwner: 'elastic',
      pullNumber: 121633,
    });

    expect(commits).toEqual([
      {
        committedDate: '2021-12-20T14:20:16Z',
        expectedTargetPullRequests: [
          {
            branch: '8.0',
            number: 121643,
            state: 'MERGED',
            url: 'https://github.com/elastic/kibana/pull/121643',
          },
        ],
        originalMessage:
          '[APM] Add note about synthtrace to APM docs (#121633)',
        pullNumber: 121633,
        pullUrl: 'https://github.com/elastic/kibana/pull/121633',
        sha: 'd421ddcf6157150596581c7885afa3690cec6339',
        sourceBranch: 'main',
      },
    ]);
  });
});
