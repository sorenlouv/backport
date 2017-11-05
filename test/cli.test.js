const inquirer = require('inquirer');
const axios = require('axios');
const nock = require('nock');
const httpAdapter = require('axios/lib/adapters/http');
const { init } = require('../src/cli');
const github = require('../src/github');
const commitsMock = require('./mocks/commits.json');
const { mockBackportDirPath } = require('./testHelpers');
const utils = require('../src/utils');

function setup() {
  const owner = 'elastic';
  const repoName = 'backport-cli-test';
  const fullRepoName = `${owner}/${repoName}`;
  axios.defaults.host = 'http://localhost';
  axios.defaults.adapter = httpAdapter;

  mockBackportDirPath();
  utils.exec = jest.fn().mockReturnValue(Promise.resolve());
  utils.writeFile = jest.fn().mockReturnValue(Promise.resolve());
  github.getCommits = jest.fn(github.getCommits);
  github.createPullRequest = jest.fn(github.createPullRequest);

  inquirer.prompt = jest
    .fn()
    .mockReturnValueOnce(Promise.resolve({ promptResult: fullRepoName }))
    .mockReturnValueOnce(
      Promise.resolve({
        promptResult: {
          message: 'myCommitMessage',
          sha: 'mySha'
        }
      })
    )
    .mockReturnValueOnce(
      Promise.resolve({
        promptResult: '6.2'
      })
    );

  nock('https://api.github.com')
    .get(`/repos/${owner}/${repoName}/commits`)
    .query({ author: 'sqren', per_page: '5', access_token: 'myAccessToken' })
    .reply(200, commitsMock);

  nock('https://api.github.com')
    .get(`/search/issues`)
    .query({
      q: 'repo:elastic/backport-cli-test mySha',
      access_token: 'myAccessToken'
    })
    .reply(200, {
      items: [
        {
          number: 'myPullRequest'
        }
      ]
    });

  nock('https://api.github.com')
    .post(`/repos/${owner}/${repoName}/pulls`)
    .query({ access_token: 'myAccessToken' })
    .reply(200, {
      html_url: 'myHtmlUrl'
    });

  return init(
    {
      username: 'sqren',
      accessToken: 'myAccessToken',
      repositories: [
        {
          name: fullRepoName,
          versions: ['6.x', '6.0', '5.6', '5.5', '5.4']
        }
      ]
    },
    { cwd: '/my/path', own: true, multiple: false }
  );
}

describe('select commit that originated from pull request', () => {
  beforeEach(setup);

  it('getCommit should be called with correct args', () => {
    expect(github.getCommits).toHaveBeenCalledWith(
      'elastic',
      'backport-cli-test',
      'sqren'
    );
  });

  it('createPullRequest should be called with correct args', () => {
    expect(github.createPullRequest).toHaveBeenCalledWith(
      'elastic',
      'backport-cli-test',
      {
        base: '6.2',
        body: 'Backports pull request #myPullRequest to 6.2',
        head: 'sqren:backport/6.2/pr-myPullRequest',
        title: '[6.2] myCommitMessage'
      }
    );
  });

  it('prompt calls should match snapshot', () => {
    expect(inquirer.prompt.mock.calls).toMatchSnapshot();
  });

  it('exec should be called with correct args', () => {
    expect(utils.exec.mock.calls).toMatchSnapshot();
  });

  it('writeFile should be called with correct args', () => {
    expect(utils.writeFile.mock.calls).toMatchSnapshot();
  });
});
