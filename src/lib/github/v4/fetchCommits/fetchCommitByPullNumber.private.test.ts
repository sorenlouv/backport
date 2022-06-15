import { print } from 'graphql';
import { getDevAccessToken } from '../../../../test/private/getDevAccessToken';
import { Commit } from '../../../sourceCommit/parseSourceCommit';
import * as apiRequestV4Module from '../apiRequestV4';
import { fetchCommitByPullNumber } from './fetchCommitByPullNumber';

const accessToken = getDevAccessToken();

describe('fetchCommitByPullNumber', () => {
  describe('snapshot request/response', () => {
    let spy: jest.SpyInstance;
    let commit: Commit;

    beforeEach(async () => {
      spy = jest.spyOn(apiRequestV4Module, 'apiRequestV4');

      commit = await fetchCommitByPullNumber({
        repoOwner: 'elastic',
        repoName: 'kibana',
        accessToken,
        pullNumber: 121633,
        sourceBranch: 'master',
      });
    });

    it('makes the right queries', () => {
      const queries = spy.mock.calls.reduce((acc, call) => {
        const query = call[0].query;
        const name = apiRequestV4Module.getQueryName(query);
        return { ...acc, [name]: print(query) };
      }, {});

      const queryNames = Object.keys(queries);
      expect(queryNames).toEqual(['CommitByPullNumber']);

      queryNames.forEach((name) => {
        expect(queries[name]).toMatchSnapshot(`Query: ${name}`);
      });
    });

    it('returns the correct response', async () => {
      expect(commit).toMatchSnapshot();
    });
  });

  describe('when PR was merged', () => {
    it('is returned', async () => {
      const options = {
        accessToken,
        pullNumber: 5,
        repoName: 'backport-e2e',
        repoOwner: 'backport-org',
        sourceBranch: 'main',
      };

      const expectedCommit: Commit = {
        author: { email: 'sorenlouv@gmail.com', name: 'Søren Louv-Jansen' },
        suggestedTargetBranches: [],
        sourceCommit: {
          branchLabelMapping: {
            '^v(\\d+).(\\d+).\\d+$': '$1.$2',
            '^v7.9.0$': '7.x',
            '^v8.0.0$': 'master',
          },
          committedDate: '2020-08-15T12:40:19Z',
          message: 'Add 🍏 emoji (#5)',
          sha: 'ee8c492334cef1ca077a56addb79a26f79821d2f',
        },
        sourcePullRequest: {
          labels: ['v7.8.0', 'v7.9.0', 'v8.0.0'],
          number: 5,
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
            isSourceBranch: false,
            label: 'v7.8.0',
            labelRegex: '^v(\\d+).(\\d+).\\d+$',
            mergeCommit: {
              message: 'Add 🍏 emoji (#5) (#7)',
              sha: '46cd6f9999effdf894a36dbc7db90e890f4be840',
            },
            number: 7,
            state: 'MERGED',
            url: 'https://github.com/backport-org/backport-e2e/pull/7',
          },
          {
            branch: '7.x',
            isSourceBranch: false,
            label: 'v7.9.0',
            labelRegex: '^v7.9.0$',
            mergeCommit: {
              message: 'Add 🍏 emoji (#5) (#6)',
              sha: '4bcd876d4ceaa73cf437bfc89b74d1a4e704c0a6',
            },
            number: 6,
            state: 'MERGED',
            url: 'https://github.com/backport-org/backport-e2e/pull/6',
          },
          {
            branch: 'master',
            isSourceBranch: true,
            label: 'v8.0.0',
            labelRegex: '^v8.0.0$',
            mergeCommit: {
              message: 'Add 🍏 emoji (#5)',
              sha: 'ee8c492334cef1ca077a56addb79a26f79821d2f',
            },
            number: 5,
            state: 'MERGED',
            url: 'https://github.com/backport-org/backport-e2e/pull/5',
          },
        ],
      };

      expect(await fetchCommitByPullNumber(options)).toEqual(expectedCommit);
    });
  });

  describe('when PR is still open', () => {
    it('throws an error', async () => {
      const options = {
        accessToken,
        pullNumber: 11,
        repoName: 'backport-e2e',
        repoOwner: 'backport-org',
        sourceBranch: 'main',
      };

      await expect(fetchCommitByPullNumber(options)).rejects.toThrowError(
        `The PR #11 is not merged`
      );
    });
  });

  describe('when PR does not exist', () => {
    it('throws an error', async () => {
      const options = {
        accessToken,
        pullNumber: 9999999999999,
        repoName: 'backport-e2e',
        repoOwner: 'backport-org',
        sourceBranch: 'main',
      };

      await expect(fetchCommitByPullNumber(options)).rejects.toThrowError(
        `Could not resolve to a PullRequest with the number of 9999999999999. (Github API v4)`
      );
    });
  });
});
