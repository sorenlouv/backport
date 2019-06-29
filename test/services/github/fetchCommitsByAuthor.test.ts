import * as gqlRequest from '../../../src/services/github/gqlRequest';
import { CommitSelected } from '../../../src/services/github/Commit';
import {
  PullRequestEdge,
  fetchCommitsByAuthor,
  getExistingBackportPRs
} from '../../../src/services/github/fetchCommitsByAuthor';
import {
  commitsWithPullRequestsMock,
  commitsWithoutPullRequestsMock
} from './mocks/commitsByAuthorMock';
import { getDefaultOptions } from './getDefaultOptions';

describe('fetchCommitsByAuthor', () => {
  describe('when commit has an associated pull request', () => {
    let requestSpy: jasmine.Spy;
    let res: CommitSelected[];
    beforeEach(async () => {
      requestSpy = spyOn(gqlRequest, 'gqlRequest').and.returnValues(
        { user: { id: 'myUserId' } },
        commitsWithPullRequestsMock
      );

      const options = getDefaultOptions();
      res = await fetchCommitsByAuthor(options);
    });

    it('Should return a list of commits with pullNumber and existing backports', () => {
      expect(res).toEqual([
        {
          sha: 'myCommitSha',
          message: '[APM] Some long git commit message (#1337)',
          pullNumber: 1337,
          existingBackports: [
            { branch: '7.x', state: 'MERGED' },
            { branch: '7.2', state: 'MERGED' }
          ]
        },
        {
          sha: 'myGitHash2',
          message:
            '[APM] Refactor ESClient to allow other operations than `search` (#37334)',
          pullNumber: 37334,
          existingBackports: [{ branch: '7.x', state: 'MERGED' }]
        },
        {
          sha: 'myGitHash3',
          message:
            '[APM] Fix issue with missing agentName on metrics page (#37210)',
          pullNumber: 37210,
          existingBackports: [
            { branch: '7.x', state: 'MERGED' },
            { branch: '7.2', state: 'MERGED' }
          ]
        }
      ]);
    });

    it('should call with correct args to fetch author id', () => {
      expect(requestSpy.calls.argsFor(0)).toMatchSnapshot();
    });

    it('should call with correct args to fetch commits', () => {
      expect(requestSpy.calls.argsFor(1)).toMatchSnapshot();
    });
  });

  describe('when commit does not have an associated pull request', () => {
    it('should return commits without pull request', async () => {
      spyOn(gqlRequest, 'gqlRequest').and.returnValues(
        { user: { id: 'myUserId' } },
        commitsWithoutPullRequestsMock
      );

      const options = getDefaultOptions();
      const res = await fetchCommitsByAuthor(options);

      expect(res).toEqual([
        {
          sha: 'myOtherGitHash',
          message: 'My other git commit message (myOtherG)',
          pullNumber: undefined,
          existingBackports: []
        }
      ]);
    });
  });

  describe('when a custom github api hostname is supplied', () => {
    it('should be used in gql requests', async () => {
      const requestSpy = spyOn(gqlRequest, 'gqlRequest').and.returnValues(
        { user: { id: 'myUserId' } },
        commitsWithoutPullRequestsMock
      );

      const options = getDefaultOptions({
        apiHostname: 'api.github.my-company.com'
      });
      await fetchCommitsByAuthor(options);

      expect(requestSpy.calls.argsFor(0)[0].apiHostname).toBe(
        'api.github.my-company.com'
      );
      expect(requestSpy.calls.argsFor(1)[0].apiHostname).toBe(
        'api.github.my-company.com'
      );
    });
  });
});

describe('getExistingBackportPRs', () => {
  let pullRequest: PullRequestEdge;
  beforeEach(() => {
    pullRequest = {
      node: {
        number: 1234,
        timelineItems: {
          edges: [
            {
              node: {
                source: {
                  __typename: 'PullRequest',
                  state: 'MERGED' as const,
                  commits: {
                    edges: [
                      { node: { commit: { message: 'my message (#1234)' } } }
                    ]
                  },
                  baseRefName: '7.x'
                }
              }
            }
          ]
        }
      }
    };
  });

  it('should return a result when commit messages match', () => {
    const existingPRs = getExistingBackportPRs(
      'my message (#1234)',
      pullRequest
    );

    expect(existingPRs).toEqual([{ branch: '7.x', state: 'MERGED' }]);
  });

  it('should return a result when first line of commit message matches', () => {
    pullRequest.node.timelineItems.edges[0].node.source.commits.edges[0].node.commit.message =
      'my message (#1234)\n\nsomething else';
    const existingPRs = getExistingBackportPRs(
      'my message (#1234)',
      pullRequest
    );

    expect(existingPRs).toEqual([{ branch: '7.x', state: 'MERGED' }]);
  });
});
