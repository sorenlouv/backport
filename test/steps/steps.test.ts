import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import inquirer from 'inquirer';
import * as childProcess from 'child_process';
import { commitsMock } from '../mocks/commits';
import { initSteps } from '../../src/steps/steps';
import * as github from '../../src/services/github';
import * as rpc from '../../src/services/rpc';

function mockGetPullRequest(
  axiosMock: MockAdapter,
  repoOwner: string,
  repoName: string,
  commitSha: string,
  accessToken: string
) {
  return axiosMock
    .onGet(
      `https://api.github.com/search/issues?q=repo:${repoOwner}/${repoName}+${commitSha}+base:master&access_token=${accessToken}`
    )
    .reply(200, {
      items: [
        {
          number: `Pull number for ${commitSha}`
        }
      ]
    });
}

function mockVerifyAccessToken(
  axiosMock: MockAdapter,
  repoOwner: string,
  repoName: string,
  accessToken: string
) {
  return axiosMock
    .onHead(
      `https://api.github.com/repos/${repoOwner}/${repoName}?access_token=${accessToken}`
    )
    .reply(200);
}

function mockGetCommits(
  axiosMock: MockAdapter,
  {
    repoOwner = 'elastic',
    repoName = 'kibana',
    accessToken = 'myAccessToken',
    author = 'sqren',
    perPage = 5,
    res
  }: {
    repoOwner?: string;
    repoName?: string;
    accessToken?: string;
    author?: string;
    perPage?: number;
    res: {}[];
  }
) {
  return axiosMock
    .onGet(
      `https://api.github.com/repos/${repoOwner}/${repoName}/commits?access_token=${accessToken}&per_page=${perPage}&author=${author}`
    )
    .reply(200, res);
}

function mockCreatePullRequest(
  axiosMock: MockAdapter,
  {
    repoOwner = 'elastic',
    repoName = 'kibana',
    accessToken = 'myAccessToken',
    res
  }: {
    repoOwner?: string;
    repoName?: string;
    accessToken?: string;
    res: any;
  }
) {
  return axiosMock
    .onPost(
      `https://api.github.com/repos/${repoOwner}/${repoName}/pulls?access_token=${accessToken}`
    )
    .reply(200, res);
}

describe('run through steps', () => {
  let axiosMock: MockAdapter;
  let execMock: jest.SpyInstance;
  let inquirerPromptMock: jest.Mock;

  afterEach(() => {
    inquirerPromptMock.mockClear();
    execMock.mockClear();
  });

  beforeEach(async () => {
    const repoOwner = 'elastic';
    const repoName = 'kibana';
    const accessToken = 'myAccessToken';

    execMock = jest.spyOn(childProcess, 'exec');

    jest.spyOn(rpc, 'writeFile').mockResolvedValue(undefined);
    jest.spyOn(rpc, 'mkdirp').mockResolvedValue(undefined);

    jest.spyOn(github, 'fetchCommitsByAuthor');
    jest.spyOn(github, 'createPullRequest');

    inquirerPromptMock = jest
      .spyOn(inquirer, 'prompt')
      .mockResolvedValueOnce({
        promptResult: {
          message: 'myCommitMessage',
          sha: 'myCommitSha',
          pullNumber: 'myPullRequestNumber'
        }
      })
      .mockResolvedValueOnce({
        promptResult: '6.2'
      });

    axiosMock = new MockAdapter(axios);

    mockVerifyAccessToken(axiosMock, repoOwner, repoName, accessToken);

    mockGetCommits(axiosMock, {
      repoOwner,
      repoName,
      accessToken,
      res: commitsMock
    });

    mockGetPullRequest(
      axiosMock,
      repoOwner,
      repoName,
      'commitSha',
      'myAccessToken'
    );
    mockGetPullRequest(
      axiosMock,
      repoOwner,
      repoName,
      'commitSha2',
      'myAccessToken'
    );
    mockGetPullRequest(
      axiosMock,
      repoOwner,
      repoName,
      'commitSha3',
      'myAccessToken'
    );

    mockCreatePullRequest(axiosMock, {
      res: {
        html_url: 'myHtmlUrl'
      }
    });

    await initSteps({
      accessToken: 'myAccessToken',
      all: false,
      apiHostname: 'api.github.com',
      branches: [],
      branchChoices: [
        { name: '6.x' },
        { name: '6.0' },
        { name: '5.6' },
        { name: '5.5' },
        { name: '5.4' }
      ],
      gitHostname: 'github.com',
      labels: [],
      multiple: false,
      multipleBranches: false,
      multipleCommits: false,
      prTitle: 'myPrTitle',
      prDescription: 'myPrDescription',
      sha: undefined,
      repoName,
      repoOwner,
      username: 'sqren'
    });
  });

  it('should make correct requests', () => {
    expect(axiosMock.history).toMatchSnapshot();
  });

  it('getCommit should be called with correct args', () => {
    expect(github.fetchCommitsByAuthor).toHaveBeenCalledWith(
      expect.objectContaining({
        repoName: 'kibana',
        repoOwner: 'elastic',
        username: 'sqren',
        apiHostname: 'api.github.com'
      })
    );
  });

  it('createPullRequest should be called with correct args', () => {
    expect(github.createPullRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        repoName: 'kibana',
        repoOwner: 'elastic',
        apiHostname: 'api.github.com'
      }),
      {
        base: '6.2',
        body: `Backports the following commits to 6.2:\n - myCommitMessage (#myPullRequestNumber)\n\nmyPrDescription`,
        head: 'sqren:backport/6.2/pr-myPullRequestNumber',
        title: 'myPrTitle'
      }
    );
  });

  it('prompt calls should match snapshot', () => {
    expect(inquirer.prompt).toHaveBeenCalledTimes(2);
    expect(inquirerPromptMock.mock.calls).toMatchSnapshot();
  });

  it('exec should be called with correct args', () => {
    expect(execMock).toHaveBeenCalledTimes(9);
    expect(execMock.mock.calls).toMatchSnapshot();
  });
});
