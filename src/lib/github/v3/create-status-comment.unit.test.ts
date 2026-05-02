import type { BackportResponse } from '../../../backport-run.js';
import type { ValidConfigOptions } from '../../../options/options.js';
import {
  cleanupFetchMock,
  mockFetchResponse,
  setupFetchMock,
} from '../../../test/helpers/mock-fetch.js';
import { setGithubToken } from '../../logger.js';
import {
  createStatusComment,
  getCommentBody,
} from './create-status-comment.js';

vi.unmock('../../logger');

describe('createStatusComment', () => {
  beforeEach(() => {
    setupFetchMock();
  });

  afterEach(() => {
    cleanupFetchMock();
  });

  it('redacts githubToken if it is included in the error message', async () => {
    const githubToken = 'ghp_abcdefg';
    setGithubToken(githubToken);

    const calls = mockFetchResponse({
      url: 'https://api.github.com/repos/elastic/kibana/issues/100/comments',
      method: 'POST',
      responseBody: 'some response',
    });

    await createStatusComment({
      options: {
        repoName: 'kibana',
        repoOwner: 'elastic',
        githubToken,
        backportBinary: 'node scripts/backport',
        publishStatusCommentOnSuccess: true,
        publishStatusCommentOnFailure: true,
        githubApiBaseUrlV3: 'https://api.github.com',
        interactive: false,
      } as ValidConfigOptions,
      backportResponse: {
        commits: [{ sourcePullRequest: { number: 100 } }],
        results: [
          {
            status: 'error',
            errorCode: 'unhandled-exception',
            errorMessage: `Error message containing very secret github token: ${githubToken}.`,
          },
        ],
      } as BackportResponse,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].body).toContain(
      'Error message containing very secret github token: <REDACTED>',
    );
  });
});

describe('getCommentBody', () => {
  describe('when an unknown error occurs', () => {
    const getParams = (opts: Partial<ValidConfigOptions>) => ({
      options: {
        backportBinary: 'node scripts/backport',
        ...opts,
      } as ValidConfigOptions,
      pullNumber: 55,
      backportResponse: {
        commits: [],
        results: [
          {
            status: 'error',
            errorCode: 'unhandled-exception',
            errorMessage: 'A terrible error occured',
          },
        ],
      } as BackportResponse,
    });

    it('posts a comment when `publishStatusCommentOnFailure = true`', () => {
      const params = getParams({ publishStatusCommentOnFailure: true });
      expect(getCommentBody(params)).toMatchInlineSnapshot(`
        "## 💔 Backport failed
        The pull request could not be backported due to the following error:
        \`A terrible error occured\`

        ### Manual backport
        To create the backport manually run:
        \`\`\`
        node scripts/backport --pr 55
        \`\`\`

        ### Questions ?
        Please refer to the [Backport tool documentation](https://github.com/sorenlouv/backport)

        <!--- Backport version: 1.2.3-mocked -->"
      `);
    });

    it('does not post a comment when `publishStatusCommentOnFailure = false`', () => {
      const params = getParams({ publishStatusCommentOnFailure: false });
      expect(getCommentBody(params)).toBe(undefined);
    });
  });

  describe('when all backports succeed', () => {
    const getParams = (opts: Partial<ValidConfigOptions>) => ({
      options: {
        repoName: 'kibana',
        repoOwner: 'elastic',
        autoMerge: true,
        ...opts,
      } as ValidConfigOptions,
      pullNumber: 55,
      backportResponse: {
        commits: [],
        results: [
          {
            status: 'success',

            targetBranch: '7.x',
            pullRequestNumber: 55,
            pullRequestUrl: 'url-to-pr',
          },
          {
            status: 'success',

            targetBranch: '7.1',
            pullRequestNumber: 66,
            pullRequestUrl: 'url-to-pr',
          },
        ],
      } as BackportResponse,
    });

    it('posts a comment when `publishStatusCommentOnSuccess = true`', () => {
      const params = getParams({ publishStatusCommentOnSuccess: true });
      expect(getCommentBody(params)).toMatchInlineSnapshot(`
        "## 💚 All backports created successfully

        | Status | Branch | Result |
        |:------:|:------:|:------|
        |✅|7.x|[<img src="https://img.shields.io/github/pulls/detail/state/elastic/kibana/55">](url-to-pr)|
        |✅|7.1|[<img src="https://img.shields.io/github/pulls/detail/state/elastic/kibana/66">](url-to-pr)|

        Note: Successful backport PRs will be merged automatically after passing CI.

        ### Questions ?
        Please refer to the [Backport tool documentation](https://github.com/sorenlouv/backport)

        <!--- Backport version: 1.2.3-mocked -->"
      `);
    });

    it('does not post a comment when `publishStatusCommentOnSuccess = false`', () => {
      const params = getParams({ interactive: true });
      expect(getCommentBody(params)).toMatchInlineSnapshot(`undefined`);
    });
  });

  describe('when all backports fail', () => {
    const getParams = (opts: Partial<ValidConfigOptions>) => ({
      options: {
        repoName: 'kibana',
        repoOwner: 'elastic',
        autoMerge: true,
        backportBinary: 'node scripts/backport',
        ...opts,
      } as ValidConfigOptions,
      pullNumber: 55,
      backportResponse: {
        commits: [],
        results: [
          {
            status: 'error',
            targetBranch: '7.x',
            errorCode: 'unhandled-exception',
            errorMessage: 'My boom error!',
          },
          {
            status: 'error',
            targetBranch: '7.1',
            errorCode: 'unhandled-exception',
            errorMessage: 'My boom error!',
          },
        ],
      } as BackportResponse,
    });

    it('posts a comment when `publishStatusCommentOnFailure = true`', () => {
      const params = getParams({ publishStatusCommentOnFailure: true });
      expect(getCommentBody(params)).toMatchInlineSnapshot(`
        "## 💔 All backports failed

        | Status | Branch | Result |
        |:------:|:------:|:------|
        |❌|7.x|An unhandled error occurred. Please see the logs for details|
        |❌|7.1|An unhandled error occurred. Please see the logs for details|

        ### Manual backport
        To create the backport manually run:
        \`\`\`
        node scripts/backport --pr 55
        \`\`\`

        ### Questions ?
        Please refer to the [Backport tool documentation](https://github.com/sorenlouv/backport)

        <!--- Backport version: 1.2.3-mocked -->"
      `);
    });

    it('does not post a comment when `publishStatusCommentOnFailure = false`', () => {
      const params = getParams({ publishStatusCommentOnFailure: false });
      expect(getCommentBody(params)).toBe(undefined);
    });
  });

  describe('when some backports fail', () => {
    const getParams = (opts: Partial<ValidConfigOptions>) => ({
      options: {
        repoName: 'kibana',
        repoOwner: 'elastic',
        autoMerge: true,
        backportBinary: 'node scripts/backport',
        ...opts,
      } as ValidConfigOptions,
      pullNumber: 55,
      backportResponse: {
        commits: [],
        results: [
          {
            status: 'success',
            targetBranch: '7.x',
            pullRequestNumber: 55,
            pullRequestUrl: 'url-to-pr-55',
          },

          {
            status: 'error',
            targetBranch: '7.1',
            errorCode: 'unhandled-exception',
            errorMessage: 'My boom error!',
          },
        ],
      } as BackportResponse,
    });

    it('posts a comment when `publishStatusCommentOnFailure = true`', () => {
      const params = getParams({ publishStatusCommentOnFailure: true });
      expect(getCommentBody(params)).toMatchInlineSnapshot(`
        "## 💔 Some backports could not be created

        | Status | Branch | Result |
        |:------:|:------:|:------|
        |✅|7.x|[<img src="https://img.shields.io/github/pulls/detail/state/elastic/kibana/55">](url-to-pr-55)|
        |❌|7.1|An unhandled error occurred. Please see the logs for details|

        Note: Successful backport PRs will be merged automatically after passing CI.

        ### Manual backport
        To create the backport manually run:
        \`\`\`
        node scripts/backport --pr 55
        \`\`\`

        ### Questions ?
        Please refer to the [Backport tool documentation](https://github.com/sorenlouv/backport)

        <!--- Backport version: 1.2.3-mocked -->"
      `);
    });

    it('does not post a comment when running `publishStatusCommentOnFailure = false`', () => {
      const params = getParams({ publishStatusCommentOnFailure: false });
      expect(getCommentBody(params)).toMatchInlineSnapshot(`undefined`);
    });
  });

  describe('when some backports fail due to conflicts', () => {
    const getParams = (opts: Partial<ValidConfigOptions>) => ({
      options: {
        repoName: 'kibana',
        repoOwner: 'elastic',
        autoMerge: true,
        backportBinary: 'node scripts/backport',
        ...opts,
      } as ValidConfigOptions,
      pullNumber: 55,
      backportResponse: {
        commits: [],
        results: [
          {
            status: 'success',
            targetBranch: '7.x',
            pullRequestNumber: 55,
            pullRequestUrl: 'url-to-pr-55',
          },

          {
            status: 'error',
            targetBranch: '7.1',
            errorCode: 'merge-conflict-exception',
            errorMessage:
              'Commit could not be cherrypicked due to conflicts in: readme.md',
            errorContext: {
              code: 'merge-conflict-exception',
              conflictingFiles: ['readme.md'],
              commitsWithoutBackports: [
                {
                  formatted: 'some-formatted-text',
                  commit: {
                    author: {
                      email: 'soren.louv@elastic.co',
                      name: 'Søren Louv-Jansen',
                    },
                    sourceBranch: 'master',
                    sourcePullRequest: {
                      labels: [],
                      number: 5,
                      url: 'url-to-pr-5',
                      title: 'New Zealand commit message',
                      mergeCommit: {
                        sha: '',
                        message: 'New Zealand commit message',
                      },
                    },
                    suggestedTargetBranches: [],
                    sourceCommit: {
                      branchLabelMapping: {},
                      committedDate: '',
                      sha: '',
                      message: 'New Zealand commit message',
                    },
                    targetPullRequestStates: [],
                  },
                },
                {
                  formatted: 'some-formatted-text',
                  commit: {
                    author: {
                      email: 'soren.louv@elastic.co',
                      name: 'Søren Louv-Jansen',
                    },
                    sourceBranch: 'master',
                    sourcePullRequest: {
                      labels: [],
                      number: 44,
                      title: 'Australia commit',
                      url: 'url-to-pr-44',
                      mergeCommit: {
                        sha: '',
                        message: 'Australia commit',
                      },
                    },
                    suggestedTargetBranches: [],
                    sourceCommit: {
                      branchLabelMapping: {},
                      committedDate: '',
                      sha: '',
                      message: 'Australia commit',
                    },
                    targetPullRequestStates: [],
                  },
                },
                {
                  formatted: 'some-formatted-text',
                  commit: {
                    author: {
                      email: 'matthias.wilhelm@elastic.co',
                      name: 'Matthias Polman-Wilhelm',
                    },
                    sourceBranch: 'master',
                    sourcePullRequest: {
                      labels: [],
                      number: 44,
                      title: 'Antarctica commit | with pipeline char',
                      url: 'url-to-pr-45',
                      mergeCommit: {
                        sha: '',
                        message: 'Antarctica commit | with pipeline char',
                      },
                    },
                    suggestedTargetBranches: [],
                    sourceCommit: {
                      branchLabelMapping: {},
                      committedDate: '',
                      sha: '',
                      message: 'Antarctica commit | with pipeline char',
                    },
                    targetPullRequestStates: [],
                  },
                },
              ],
            },
          },

          {
            status: 'error',
            targetBranch: '7.2',
            errorCode: 'merge-conflict-exception',
            errorMessage:
              'Commit could not be cherrypicked due to conflicts in: my-file.txt',
            errorContext: {
              code: 'merge-conflict-exception',
              conflictingFiles: ['my-file.txt'],
              commitsWithoutBackports: [],
            },
          },
        ],
      } as BackportResponse,
    });

    it('posts a comment when `publishStatusCommentOnFailure = true`', () => {
      const params = getParams({ publishStatusCommentOnFailure: true });
      expect(getCommentBody(params)).toMatchInlineSnapshot(`
        "## 💔 Some backports could not be created

        | Status | Branch | Result |
        |:------:|:------:|:------|
        |✅|7.x|[<img src="https://img.shields.io/github/pulls/detail/state/elastic/kibana/55">](url-to-pr-55)|
        |❌|7.1|**Backport failed because of merge conflicts**<br><br>You might need to backport the following PRs to 7.1:<br> - [New Zealand commit message](url-to-pr-5)<br> - [Australia commit](url-to-pr-44)<br> - [Antarctica commit \\| with pipeline char](url-to-pr-45)|
        |❌|7.2|Backport failed because of merge conflicts|

        Note: Successful backport PRs will be merged automatically after passing CI.

        ### Manual backport
        To create the backport manually run:
        \`\`\`
        node scripts/backport --pr 55
        \`\`\`

        ### Questions ?
        Please refer to the [Backport tool documentation](https://github.com/sorenlouv/backport)

        <!--- Backport version: 1.2.3-mocked -->"
      `);
    });

    it('does not post a comment when `publishStatusCommentOnFailure = false`', () => {
      const params = getParams({ publishStatusCommentOnFailure: false });
      expect(getCommentBody(params)).toBe(undefined);
    });
  });

  describe('when backport was aborted due to missing branches', () => {
    const getParams = (opts: Partial<ValidConfigOptions>) => ({
      options: {
        repoName: 'kibana',
        repoOwner: 'elastic',
        autoMerge: true,
        backportBinary: 'node scripts/backport',
        ...opts,
      } as ValidConfigOptions,
      pullNumber: 55,
      backportResponse: {
        commits: [],
        results: [
          {
            status: 'error',
            errorCode: 'no-branches-exception',
            errorMessage: 'There are no branches to backport to. Aborting.',
          },
        ],
      } as BackportResponse,
    });

    it('posts a comment when `publishStatusCommentOnAbort = true`', () => {
      const params = getParams({
        publishStatusCommentOnAbort: true,
      });
      expect(getCommentBody(params)).toMatchInlineSnapshot(`
        "## ⚪ Backport skipped
        The pull request was not backported as there were no branches to backport to. If this is a mistake, please apply the desired version labels or run the backport tool manually.

        ### Manual backport
        To create the backport manually run:
        \`\`\`
        node scripts/backport --pr 55
        \`\`\`

        ### Questions ?
        Please refer to the [Backport tool documentation](https://github.com/sorenlouv/backport)

        <!--- Backport version: 1.2.3-mocked -->"
      `);
    });

    it('does not post a comment when `publishStatusCommentOnAbort = false`', () => {
      const params = getParams({ publishStatusCommentOnAbort: false });
      expect(getCommentBody(params)).toBe(undefined);
    });
  });

  describe('when backport was aborted during conflict resolution', () => {
    const getParams = (opts: Partial<ValidConfigOptions>) => ({
      options: {
        interactive: true,
        repoName: 'kibana',
        repoOwner: 'elastic',
        autoMerge: true,
        backportBinary: 'node scripts/backport',
        ...opts,
      } as ValidConfigOptions,
      pullNumber: 55,
      backportResponse: {
        commits: [],
        results: [
          {
            targetBranch: 'staging',
            status: 'error',
            errorCode: 'abort-conflict-resolution-exception',
            errorMessage: 'Conflict resolution was aborted by the user',
          },
        ],
      } as BackportResponse,
    });

    it('posts a comment when `publishStatusCommentOnAbort = true`', () => {
      const params = getParams({
        publishStatusCommentOnAbort: true,
      });
      expect(getCommentBody(params)).toMatchInlineSnapshot(`undefined`);
    });

    it('does not post a comment when `publishStatusCommentOnAbort = false`', () => {
      const params = getParams({ publishStatusCommentOnAbort: false });
      expect(getCommentBody(params)).toBe(undefined);
    });

    it('posts a comment when `publishStatusCommentOnFailure = true`', () => {
      const params = getParams({
        publishStatusCommentOnFailure: true,
      });
      expect(getCommentBody(params)).toMatchInlineSnapshot(`
        "## 💔 All backports failed

        | Status | Branch | Result |
        |:------:|:------:|:------|
        |❌|staging|Conflict resolution was aborted by the user|

        ### Manual backport
        To create the backport manually run:
        \`\`\`
        node scripts/backport --pr 55
        \`\`\`

        ### Questions ?
        Please refer to the [Backport tool documentation](https://github.com/sorenlouv/backport)

        <!--- Backport version: 1.2.3-mocked -->"
      `);
    });

    it('does not post a comment when `publishStatusCommentOnFailure = false`', () => {
      const params = getParams({ publishStatusCommentOnFailure: false });
      expect(getCommentBody(params)).toBe(undefined);
    });
  });

  describe("when target branch doesn't exist", () => {
    const getParams = (opts: Partial<ValidConfigOptions>) => ({
      options: {
        interactive: true,
        repoName: 'kibana',
        repoOwner: 'elastic',
        autoMerge: true,
        backportBinary: 'node scripts/backport',
        ...opts,
      } as ValidConfigOptions,
      pullNumber: 55,
      backportResponse: {
        commits: [],
        results: [
          {
            targetBranch: 'main',
            status: 'error',
            errorCode: 'branch-not-found-exception',
            errorMessage: 'The branch "main" is invalid or doesn\'t exist',
          },
        ],
      } as BackportResponse,
    });

    it('posts a comment when `publishStatusCommentOnFailure = true`', () => {
      const params = getParams({
        publishStatusCommentOnFailure: true,
      });
      expect(getCommentBody(params)).toMatchInlineSnapshot(`
        "## 💔 All backports failed

        | Status | Branch | Result |
        |:------:|:------:|:------|
        |❌|main|The branch "main" is invalid or doesn't exist|

        ### Manual backport
        To create the backport manually run:
        \`\`\`
        node scripts/backport --pr 55
        \`\`\`

        ### Questions ?
        Please refer to the [Backport tool documentation](https://github.com/sorenlouv/backport)

        <!--- Backport version: 1.2.3-mocked -->"
      `);
    });

    it('does not post a comment when `publishStatusCommentOnFailure = false`', () => {
      const params = getParams({ publishStatusCommentOnFailure: false });
      expect(getCommentBody(params)).toBe(undefined);
    });
  });

  describe('when target branch is invalid', () => {
    const getParams = (opts: Partial<ValidConfigOptions>) => ({
      options: {
        interactive: true,
        repoName: 'kibana',
        repoOwner: 'elastic',
        autoMerge: true,
        backportBinary: 'node scripts/backport',
        ...opts,
      } as ValidConfigOptions,
      pullNumber: 55,
      backportResponse: {
        commits: [],
        results: [
          {
            targetBranch: '--foo',
            status: 'error',
            errorCode: 'branch-not-found-exception',
            errorMessage: 'The branch "--foo" is invalid or doesn\'t exist',
          },
        ],
      } as BackportResponse,
    });

    it('posts a comment when `publishStatusCommentOnFailure = true`', () => {
      const params = getParams({
        publishStatusCommentOnFailure: true,
      });
      expect(getCommentBody(params)).toMatchInlineSnapshot(`
        "## 💔 All backports failed

        | Status | Branch | Result |
        |:------:|:------:|:------|
        |❌|--foo|The branch "--foo" is invalid or doesn't exist|

        ### Manual backport
        To create the backport manually run:
        \`\`\`
        node scripts/backport --pr 55
        \`\`\`

        ### Questions ?
        Please refer to the [Backport tool documentation](https://github.com/sorenlouv/backport)

        <!--- Backport version: 1.2.3-mocked -->"
      `);
    });

    it('does not post a comment when `publishStatusCommentOnFailure = false`', () => {
      const params = getParams({ publishStatusCommentOnFailure: false });
      expect(getCommentBody(params)).toBe(undefined);
    });
  });

  describe('shield.io badges', () => {
    const getParams = (opts: Partial<ValidConfigOptions>) => ({
      options: {
        interactive: true,
        repoName: 'kibana',
        repoOwner: 'elastic',
        autoMerge: true,
        backportBinary: 'node scripts/backport',
        publishStatusCommentOnSuccess: true,
        ...opts,
      } as ValidConfigOptions,
      pullNumber: 55,
      backportResponse: {
        commits: [],
        results: [
          {
            status: 'success',

            targetBranch: '7.x',
            pullRequestNumber: 55,
            pullRequestUrl: 'url-to-pr',
          },
        ],
      } as BackportResponse,
    });

    it('posts a comment without shields.io badge when repo is private`', () => {
      const params = getParams({ isRepoPrivate: true });
      expect(getCommentBody(params)).not.toContain('img.shields.io');
      expect(getCommentBody(params)).toMatchInlineSnapshot(`
        "## 💚 All backports created successfully

        | Status | Branch | Result |
        |:------:|:------:|:------|
        |✅|7.x|url-to-pr|

        Note: Successful backport PRs will be merged automatically after passing CI.

        ### Questions ?
        Please refer to the [Backport tool documentation](https://github.com/sorenlouv/backport)

        <!--- Backport version: 1.2.3-mocked -->"
      `);
    });

    it('posts a comment with shields.io badge when repo is public`', () => {
      const params = getParams({ isRepoPrivate: false });
      expect(getCommentBody(params)).toContain('img.shields.io');
      expect(getCommentBody(params)).toMatchInlineSnapshot(`
        "## 💚 All backports created successfully

        | Status | Branch | Result |
        |:------:|:------:|:------|
        |✅|7.x|[<img src="https://img.shields.io/github/pulls/detail/state/elastic/kibana/55">](url-to-pr)|

        Note: Successful backport PRs will be merged automatically after passing CI.

        ### Questions ?
        Please refer to the [Backport tool documentation](https://github.com/sorenlouv/backport)

        <!--- Backport version: 1.2.3-mocked -->"
      `);
    });
  });
});
