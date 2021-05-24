import inquirer from 'inquirer';
import nock from 'nock';
import { ValidConfigOptions } from './options/options';
import { runWithOptions } from './runWithOptions';
import * as childProcess from './services/child-process-promisified';
import * as fs from './services/fs-promisified';
import { AuthorIdResponse } from './services/github/v4/fetchAuthorId';
import { CommitByAuthorResponse } from './services/github/v4/fetchCommitsByAuthor';
import { commitsWithPullRequestsMock } from './services/github/v4/mocks/commitsByAuthorMock';
import { mockGqlRequest, createNockListener } from './test/nockHelpers';
import { PromiseReturnType } from './types/PromiseReturnType';
import { SpyHelper } from './types/SpyHelper';

describe('runWithOptions', () => {
  let rpcExecMock: SpyHelper<typeof childProcess.exec>;
  let rpcExecOriginalMock: SpyHelper<typeof childProcess.execAsCallback>;
  let inquirerPromptMock: SpyHelper<typeof inquirer.prompt>;
  let res: PromiseReturnType<typeof runWithOptions>;
  let getCreatePullRequestCalls: () => unknown[];
  let getCommitsByAuthorCalls: ReturnType<typeof mockGqlRequest>;
  let getAuthorIdCalls: ReturnType<typeof mockGqlRequest>;

  afterEach(() => {
    jest.clearAllMocks();
  });

  beforeEach(async () => {
    const options: ValidConfigOptions = {
      accessToken: 'myAccessToken',
      all: false,
      assignees: [],
      author: 'sqren',
      autoAssign: false,
      autoFixConflicts: undefined,
      autoMerge: false,
      autoMergeMethod: 'merge',
      ci: false,
      dryRun: false,
      editor: 'code',
      forceLocalConfig: undefined,
      fork: true,
      gitHostname: 'github.com',
      githubApiBaseUrlV3: 'https://api.github.com',
      githubApiBaseUrlV4: 'http://localhost/graphql', // Using localhost to avoid CORS issues when making requests (related to nock and jsdom)
      mainline: undefined,
      maxNumber: 10,
      multipleBranches: false,
      multipleCommits: false,
      noVerify: true,
      path: undefined,
      prDescription: 'myPrDescription',
      prTitle: 'myPrTitle {targetBranch} {commitMessages}',
      pullNumber: undefined,
      upstream: 'elastic/kibana',
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

    inquirerPromptMock = jest
      .spyOn(inquirer, 'prompt')
      .mockImplementationOnce((async (args: any) => {
        return { promptResult: args[0].choices[0].value };
      }) as any)
      .mockImplementationOnce((async (args: any) => {
        return { promptResult: args[0].choices[0].name };
      }) as any);

    getAuthorIdCalls = mockGqlRequest<AuthorIdResponse>({
      name: 'AuthorId',
      statusCode: 200,
      body: { data: { user: { id: 'sqren_author_id' } } },
    });

    getCommitsByAuthorCalls = mockGqlRequest<CommitByAuthorResponse>({
      name: 'CommitsByAuthor',
      statusCode: 200,
      body: { data: commitsWithPullRequestsMock },
    });

    getCreatePullRequestCalls = createNockListener(
      nock('https://api.github.com')
        .post('/repos/elastic/kibana/pulls')
        .reply(200, { html_url: 'pull request url', number: 1337 })
    );

    res = await runWithOptions(options);
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

  it('creates pull request', () => {
    expect(getCreatePullRequestCalls()).toEqual([
      {
        base: '6.x',
        body:
          'Backports the following commits to 6.x:\n - Add 👻 (2e63475c)\n\nmyPrDescription',
        head: 'sqren:backport/6.x/commit-2e63475c',
        title: 'myPrTitle 6.x Add 👻 (2e63475c)',
      },
    ]);
  });

  it('retrieves author id', () => {
    expect(getAuthorIdCalls()).toMatchInlineSnapshot(`
      Array [
        Object {
          "query": "
          query AuthorId($login: String!) {
            user(login: $login) {
              id
            }
          }
        ",
          "variables": Object {
            "login": "sqren",
          },
        },
      ]
    `);
  });

  it('retrieves commits by author', () => {
    expect(getCommitsByAuthorCalls().map((body) => body.variables)).toEqual([
      {
        authorId: 'sqren_author_id',
        historyPath: null,
        maxNumber: 10,
        repoName: 'kibana',
        repoOwner: 'elastic',
        sourceBranch: 'mySourceBranch',
      },
    ]);
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
