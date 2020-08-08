import childProcess = require('child_process');
import os from 'os';
import { URL } from 'url';
import gql from 'graphql-tag';
import inquirer from 'inquirer';
import nock from 'nock';
import { commitsWithPullRequestsMock } from '../../services/github/v4/mocks/commitsByAuthorMock';
import {
  HOMEDIR_PATH,
  REMOTE_ORIGIN_REPO_PATH,
  REMOTE_FORK_REPO_PATH,
} from './envConstants';

const unmockedExec = childProcess.exec;

export function createSpies({
  commitCount,
  githubApiBaseUrlV4,
}: {
  commitCount: number;
  githubApiBaseUrlV4: string;
}) {
  // set alternative homedir
  jest.spyOn(os, 'homedir').mockReturnValue(HOMEDIR_PATH);

  // mock childProcess.exec
  mockExec();

  // mock inquirer.prompt
  mockInquirerPrompts(commitCount);

  // getDefaultRepoBranchAndPerformStartupChecks
  const getDefaultRepoBranchCalls = mockGqlRequest({
    githubApiBaseUrlV4,
    name: 'getDefaultRepoBranchAndPerformStartupChecks',
    statusCode: 200,
    body: { repository: { defaultBranchRef: { name: 'master' } } },
  });

  // getIdByLogin
  const getIdByLoginCalls = mockGqlRequest({
    githubApiBaseUrlV4,
    name: 'getIdByLogin',
    statusCode: 200,
    body: { user: { id: 'sqren_author_id' } },
  });

  // getCommitsByAuthor
  const getCommitsByAuthorCalls = mockGqlRequest({
    githubApiBaseUrlV4,
    name: 'getCommitsByAuthor',
    statusCode: 200,
    body: commitsWithPullRequestsMock,
  });

  // mock Github v3 (REST) requests
  const createPullRequestCalls = mockCreatePullRequest();

  return {
    getDefaultRepoBranchCalls,
    getIdByLoginCalls,
    getCommitsByAuthorCalls,
    createPullRequestCalls,
  };
}

function mockExec() {
  jest.spyOn(childProcess, 'exec').mockImplementation((cmd, options, cb) => {
    const nextCmd = cmd
      .replace(
        'https://myAccessToken@github.com/elastic/backport-demo.git',
        REMOTE_ORIGIN_REPO_PATH
      )
      .replace(
        'https://myAccessToken@github.com/sqren/backport-demo.git',
        REMOTE_FORK_REPO_PATH
      );

    return unmockedExec(nextCmd, options, cb);
  });
}

function mockInquirerPrompts(commitCount: number) {
  jest
    .spyOn(inquirer, 'prompt')

    .mockImplementationOnce((async (args: any) => {
      return {
        promptResult:
          commitCount === 2
            ? [args[0].choices[0].value, args[0].choices[1].value]
            : args[0].choices[1].value,
      };
    }) as any)
    .mockImplementationOnce((async (args: any) => {
      return { promptResult: args[0].choices[0].name };
    }) as any);
}

function mockCreatePullRequest() {
  const scope = nock('https://api.github.com')
    .post('/repos/elastic/backport-demo/pulls')
    .reply(200, { number: 1337, html_url: 'myHtmlUrl' });

  return getNockCallsForScope(scope);
}

function mockGqlRequest({
  githubApiBaseUrlV4,
  name,
  statusCode,
  body,
  headers,
}: {
  githubApiBaseUrlV4: string;
  name: string;
  statusCode: number;
  body?: any;
  headers?: any;
}) {
  const { origin, pathname } = new URL(githubApiBaseUrlV4);

  const scope = nock(origin)
    .post(pathname, (body) => getGqlName(body.query) === name)
    .reply(statusCode, { data: body }, headers);

  return getNockCallsForScope(scope);
}

function getGqlName(query: string) {
  const obj = gql`
    ${query}
  `;

  // @ts-expect-error
  return obj.definitions[0].name.value;
}

function getNockCallsForScope(scope: nock.Scope) {
  const calls: string[] = [];
  scope.on('request', (req, interceptor, body) => {
    calls.push(JSON.parse(body));
  });
  return calls;
}
