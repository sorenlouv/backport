import axios from 'axios';
import inquirer from 'inquirer';
import nock from 'nock';
import { BackportOptions } from './options/options';
import { runWithOptions } from './runWithOptions';
import * as childProcess from './services/child-process-promisified';
import * as fs from './services/fs-promisified';
import * as createPullRequest from './services/github/v3/createPullRequest';
import * as fetchCommitsByAuthor from './services/github/v4/fetchCommitsByAuthor';
import { commitsWithPullRequestsMock } from './services/github/v4/mocks/commitsByAuthorMock';
import { PromiseReturnType } from './types/PromiseReturnType';
import { SpyHelper } from './types/SpyHelper';

describe('runWithOptions', () => {
  let rpcExecMock: SpyHelper<typeof childProcess.exec>;
  let rpcExecOriginalMock: SpyHelper<typeof childProcess.execAsCallback>;
  let inquirerPromptMock: SpyHelper<typeof inquirer.prompt>;
  let res: PromiseReturnType<typeof runWithOptions>;

  afterEach(() => {
    jest.clearAllMocks();
  });

  beforeEach(async () => {
    const options: BackportOptions = {
      accessToken: 'myAccessToken',
      all: false,
      assignees: [],
      author: 'sqren',
      autoFixConflicts: undefined,
      branchLabelMapping: undefined,
      ci: false,
      dryRun: false,
      editor: 'code',
      fork: true,
      gitHostname: 'github.com',
      githubApiBaseUrlV3: 'https://api.github.com',
      githubApiBaseUrlV4: 'https://api.github.com/graphql',
      mainline: undefined,
      maxNumber: 10,
      multipleBranches: false,
      multipleCommits: false,
      noVerify: true,
      path: undefined,
      prDescription: 'myPrDescription',
      prTitle: 'myPrTitle {targetBranch} {commitMessages}',
      pullNumber: undefined,
      repoName: 'kibana',
      repoOwner: 'elastic',
      resetAuthor: false,
      sha: undefined,
      sourceBranch: 'mySourceBranch',
      sourcePRLabels: [],
      prFilter: undefined,
      targetBranches: [],
      targetBranchChoices: [
        { name: '6.x' },
        { name: '6.0' },
        { name: '5.6' },
        { name: '5.5' },
        { name: '5.4' },
      ],
      targetPRLabels: [],
      username: 'sqren',
      verbose: false,
    };

    rpcExecMock = jest
      .spyOn(childProcess, 'exec')
      .mockResolvedValue({ stdout: 'success', stderr: '' });
    rpcExecOriginalMock = jest.spyOn(childProcess, 'execAsCallback');

    jest.spyOn(fs, 'writeFile').mockResolvedValue(undefined);

    jest.spyOn(fetchCommitsByAuthor, 'fetchCommitsByAuthor');
    jest.spyOn(createPullRequest, 'createPullRequest');

    inquirerPromptMock = jest
      .spyOn(inquirer, 'prompt')
      .mockImplementationOnce((async (args: any) => {
        return { promptResult: args[0].choices[0].value };
      }) as any)
      .mockImplementationOnce((async (args: any) => {
        return { promptResult: args[0].choices[0].name };
      }) as any);

    // Mock Github v4 API
    jest
      .spyOn(axios, 'post')

      // mock author id
      .mockResolvedValueOnce({
        data: {
          data: {
            user: {
              id: 'sqren_author_id',
            },
          },
        },
      })

      // mock list of commits
      .mockResolvedValueOnce({
        data: {
          data: commitsWithPullRequestsMock,
        },
      });

    const scope = nock('https://api.github.com')
      .post('/repos/elastic/kibana/pulls', {
        title: 'myPrTitle 6.x Add 👻 (2e63475c)',
        head: 'sqren:backport/6.x/commit-2e63475c',
        base: '6.x',
        body:
          'Backports the following commits to 6.x:\n - Add 👻 (2e63475c)\n\nmyPrDescription',
      })
      .reply(200, { html_url: 'pull request url', number: 1337 });

    res = await runWithOptions(options);
    scope.done();
  });

  it('returns pull request', () => {
    expect(res).toEqual([
      {
        pullRequestUrl: 'pull request url',
        success: true,
        targetBranch: '6.x',
      },
    ]);
  });

  it('getCommit should be called with correct args', () => {
    expect(fetchCommitsByAuthor.fetchCommitsByAuthor).toHaveBeenCalledWith(
      expect.objectContaining({
        repoName: 'kibana',
        repoOwner: 'elastic',
        username: 'sqren',
        githubApiBaseUrlV4: 'https://api.github.com/graphql',
      })
    );
  });

  it('createPullRequest should be called with correct args', () => {
    expect(createPullRequest.createPullRequest).toHaveBeenCalledWith({
      options: expect.objectContaining({
        repoName: 'kibana',
        repoOwner: 'elastic',
        githubApiBaseUrlV4: 'https://api.github.com/graphql',
      }),
      commits: [
        {
          existingTargetPullRequests: [],
          formattedMessage: 'Add 👻 (2e63475c)',
          pullNumber: undefined,
          targetBranchesFromLabels: [],
          sha: '2e63475c483f7844b0f2833bc57fdee32095bacb',
          sourceBranch: 'mySourceBranch',
        },
      ],
      targetBranch: '6.x',
      backportBranch: 'backport/6.x/commit-2e63475c',
    });
  });

  it('prompt calls should match snapshot', () => {
    expect(inquirer.prompt).toHaveBeenCalledTimes(2);
    expect(inquirerPromptMock.mock.calls).toMatchSnapshot();
  });

  it('exec should be called with correct args', () => {
    expect(rpcExecMock).toHaveBeenCalledTimes(10);
    expect(rpcExecMock.mock.calls).toMatchSnapshot();
  });

  it('git clone should be called with correct args', () => {
    expect(rpcExecOriginalMock).toHaveBeenCalledTimes(1);
    expect(rpcExecOriginalMock.mock.calls).toMatchSnapshot();
  });
});
