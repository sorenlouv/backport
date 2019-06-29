import * as childProcess from 'child_process';
import MockAdapter from 'axios-mock-adapter';
import axios from 'axios';
import inquirer from 'inquirer';
import * as createPullRequest from '../../src/services/github/createPullRequest';
import * as fetchCommitsByAuthor from '../../src/services/github/fetchCommitsByAuthor';
import * as gqlRequest from '../../src/services/github/gqlRequest';
import * as rpc from '../../src/services/rpc';
import { BackportOptions } from '../../src/options/options';
import { commitsWithPullRequestsMock } from '../services/github/mocks/commitsByAuthorMock';
import { initSteps } from '../../src/steps/steps';

function mockVerifyAccessToken(
  axiosMock: MockAdapter,
  { repoName, repoOwner, accessToken }: BackportOptions
) {
  return axiosMock
    .onHead(
      `https://api.github.com/repos/${repoOwner}/${repoName}?access_token=${accessToken}`
    )
    .reply(200);
}

function mockGetCommitsByAuthor() {
  spyOn(gqlRequest, 'gqlRequest').and.returnValues(
    { user: { id: 'myUserId' } },
    commitsWithPullRequestsMock
  );
}

function mockCreatePullRequest(
  axiosMock: MockAdapter,
  { repoName, repoOwner, accessToken }: BackportOptions,
  res: any
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
  let inquirerPromptMock: jest.SpyInstance;

  afterEach(() => {
    inquirerPromptMock.mockClear();
    execMock.mockClear();
  });

  beforeEach(async () => {
    const options: BackportOptions = {
      accessToken: 'myAccessToken',
      all: false,
      apiHostname: 'api.github.com',
      author: undefined,
      branches: [],
      branchChoices: [
        { name: '6.x' },
        { name: '6.0' },
        { name: '5.6' },
        { name: '5.5' },
        { name: '5.4' }
      ],
      commitsCount: 10,
      gitHostname: 'github.com',
      labels: [],
      multiple: false,
      multipleBranches: false,
      multipleCommits: false,
      prDescription: 'myPrDescription',
      prTitle: 'myPrTitle {baseBranch} {commitMessages}',
      repoName: 'kibana',
      repoOwner: 'elastic',
      sha: undefined,
      username: 'sqren'
    };

    execMock = jest.spyOn(childProcess, 'exec');

    jest.spyOn(rpc, 'writeFile').mockResolvedValue(undefined);
    jest.spyOn(rpc, 'mkdirp').mockResolvedValue(undefined);

    jest.spyOn(fetchCommitsByAuthor, 'fetchCommitsByAuthor');
    jest.spyOn(createPullRequest, 'createPullRequest');

    inquirerPromptMock = jest
      .spyOn(inquirer, 'prompt')
      // @ts-ignore
      .mockImplementationOnce(async (args: any) => {
        return { promptResult: args[0].choices[0].value };
      })
      .mockImplementationOnce(async (args: any) => {
        return { promptResult: args[0].choices[0].name };
      });

    axiosMock = new MockAdapter(axios);
    mockVerifyAccessToken(axiosMock, options);
    mockGetCommitsByAuthor();
    mockCreatePullRequest(axiosMock, options, {
      res: { html_url: 'myHtmlUrl' }
    });

    await initSteps(options);
  });

  it('should make correct requests', () => {
    expect(axiosMock.history).toMatchSnapshot();
  });

  it('getCommit should be called with correct args', () => {
    expect(fetchCommitsByAuthor.fetchCommitsByAuthor).toHaveBeenCalledWith(
      expect.objectContaining({
        repoName: 'kibana',
        repoOwner: 'elastic',
        username: 'sqren',
        apiHostname: 'api.github.com'
      })
    );
  });

  it('createPullRequest should be called with correct args', () => {
    expect(createPullRequest.createPullRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        repoName: 'kibana',
        repoOwner: 'elastic',
        apiHostname: 'api.github.com'
      }),
      {
        base: '6.x',
        body: `Backports the following commits to 6.x:\n - [APM] Some long git commit message (#1337)\n\nmyPrDescription`,
        head: 'sqren:backport/6.x/pr-1337',
        title: 'myPrTitle 6.x [APM] Some long git commit message (#1337)'
      }
    );
  });

  it('prompt calls should match snapshot', () => {
    expect(inquirer.prompt).toHaveBeenCalledTimes(2);
    expect(inquirerPromptMock.mock.calls).toMatchSnapshot();
  });

  it('exec should be called with correct args', () => {
    expect(execMock).toHaveBeenCalledTimes(10);
    expect(execMock.mock.calls).toMatchSnapshot();
  });
});
