import type { BackportResponse } from './backport-run.js';
import type { Commit } from './entrypoint.api.js';
import { backportRun, getCommits } from './entrypoint.api.js';
import { getFirstLine } from './lib/github/commit-formatters.js';
import { getDevGithubToken } from './test/helpers/get-dev-github-token.js';
import { getSandboxPath, resetSandbox } from './test/helpers/sandbox.js';

vi.setConfig({ testTimeout: 10_000 });

const githubToken = getDevGithubToken();
const sandboxPath = getSandboxPath({ filename: import.meta.filename });

vi.unmock('del');
vi.unmock('make-dir');
vi.unmock('find-up');

describe('entrypoint.module', () => {
  describe('backportRun', () => {
    beforeAll(async () => {
      await resetSandbox(sandboxPath);
    });
    describe('when running into merge conflict', () => {
      let response: BackportResponse;
      beforeAll(async () => {
        response = await backportRun({
          options: {
            repoOwner: 'backport-org',
            repoName: 'repo-with-conflicts',
            interactive: false,
            githubToken,
            pullNumber: 12,
            targetBranches: ['7.x'],
            workdir: sandboxPath,
          },
        });
      });

      it('should fail with "error"', () => {
        expect(response.results[0].status).toBe('error');
      });

      it('should have correct error code', () => {
        expect(response.results[0]).toMatchObject({
          errorCode: 'merge-conflict-exception',
          errorMessage:
            'Commit could not be cherrypicked due to conflicts in: la-liga.md',
        });
      });

      it('contains a list of conflicting files', () => {
        expect(response.results[0]).toMatchObject({
          errorContext: {
            code: 'merge-conflict-exception',
            conflictingFiles: ['la-liga.md'],
          },
        });
      });
    });

    describe('when running into merge conflict with conflictResolution=theirs', () => {
      let response: BackportResponse;
      beforeAll(async () => {
        response = await backportRun({
          options: {
            repoOwner: 'backport-org',
            repoName: 'repo-with-conflicts',
            interactive: false,
            githubToken,
            pullNumber: 12,
            targetBranches: ['7.x'],
            conflictResolution: 'theirs',
            dryRun: true,
            workdir: sandboxPath,
          },
        });
      });

      it('should succeed instead of returning a conflict error', () => {
        expect(response.results[0].status).toBe('success');
      });

      it('should return a dry-run pull request url', () => {
        expect(response.results[0]).toEqual(
          expect.objectContaining({
            status: 'success',
            pullRequestUrl: 'this-is-a-dry-run',
            targetBranch: '7.x',
          }),
        );
      });
    });

    describe('when target branch in branchLabelMapping is invalid', () => {
      let response: BackportResponse;
      beforeAll(async () => {
        response = await backportRun({
          options: {
            githubToken,
            branchLabelMapping: {
              [`^backport-to-(.+)$`]: '$1',
            },
            interactive: false,
            pullNumber: 1,
            repoName: 'repo-with-invalid-target-branch-label',
            repoOwner: 'backport-org',
            workdir: sandboxPath,
          },
        });
      });

      it('should return handled error', () => {
        expect(response.results[0]).toMatchObject({
          status: 'error',
          errorCode: 'invalid-branch-exception',
          errorContext: {
            code: 'invalid-branch-exception',
            branchName: '--foo',
          },
        });
      });
    });

    describe('when missing branches to backport to', () => {
      let response: BackportResponse;
      beforeAll(async () => {
        response = await backportRun({
          options: {
            repoOwner: 'backport-org',
            repoName: 'repo-with-conflicts',
            interactive: false,
            githubToken,
            pullNumber: 12,
            workdir: sandboxPath,
          },
        });
      });

      it('should correct error code', () => {
        expect(response.results[0]).toMatchObject({
          status: 'error',
          errorCode: 'no-branches-exception',
          errorMessage: 'There are no branches to backport to. Aborting.',
        });
      });
    });

    describe('when backporting', () => {
      let response: BackportResponse;
      beforeAll(async () => {
        response = await backportRun({
          options: {
            repoOwner: 'backport-org',
            repoName: 'repo-with-conflicts',
            interactive: false,
            githubToken,
            pullNumber: 8,
            dryRun: true,
            workdir: sandboxPath,
          },
        });
      });

      it('should return successful backport response', () => {
        expect(response).toEqual({
          results: [
            {
              status: 'success',
              pullRequestNumber: 1337,
              pullRequestUrl: 'this-is-a-dry-run',
              targetBranch: '7.x',
            },
          ],
          commits: [
            {
              author: {
                email: 'sorenlouv@gmail.com',
                name: 'Søren Louv-Jansen',
              },
              suggestedTargetBranches: ['7.x'],
              targetPullRequestStates: [
                {
                  branch: '7.x',
                  label: 'backport-to-7.x',
                  branchLabelMappingKey: '^backport-to-(.*)$',
                  isSourceBranch: false,
                  state: 'NOT_CREATED',
                },
              ],
              sourceBranch: 'main',
              sourceCommit: {
                committedDate: '2021-12-16T00:03:34Z',
                message: 'Change Barca to Braithwaite (#8)',
                sha: '343402a748be2375325b2730fa979bcea5b96ba1',
              },
              sourcePullRequest: {
                labels: ['backport-to-7.x'],
                mergeCommit: {
                  message: 'Change Barca to Braithwaite (#8)',
                  sha: '343402a748be2375325b2730fa979bcea5b96ba1',
                },
                number: 8,
                title: 'Change Barca to Braithwaite',
                url: 'https://github.com/backport-org/repo-with-conflicts/pull/8',
              },
            },
          ],
        });
      });
    });
  });

  describe('getCommits', () => {
    const expectedAppleEmojiCommit: Commit = {
      author: { name: 'Søren Louv-Jansen', email: 'sorenlouv@gmail.com' },
      suggestedTargetBranches: [],
      sourceCommit: {
        branchLabelMapping: {
          '^v8.0.0$': 'master',
          '^v7.9.0$': '7.x',
          '^v(\\d+).(\\d+).\\d+$': '$1.$2',
        },
        committedDate: '2020-08-15T12:40:19Z',
        message: 'Add 🍏 emoji (#5)',
        sha: 'ee8c492334cef1ca077a56addb79a26f79821d2f',
      },
      sourcePullRequest: {
        labels: ['v7.8.0', 'v7.9.0', 'v8.0.0'],
        number: 5,
        title: 'Add 🍏 emoji',
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
          label: 'v7.8.0',
          branchLabelMappingKey: String.raw`^v(\d+).(\d+).\d+$`,
          isSourceBranch: false,
          state: 'MERGED',
          number: 7,
          url: 'https://github.com/backport-org/backport-e2e/pull/7',
          mergeCommit: {
            message: 'Add 🍏 emoji (#5) (#7)',
            sha: '46cd6f9999effdf894a36dbc7db90e890f4be840',
          },
        },
        {
          branch: '7.x',
          label: 'v7.9.0',
          branchLabelMappingKey: '^v7.9.0$',
          isSourceBranch: false,
          state: 'MERGED',
          number: 6,
          url: 'https://github.com/backport-org/backport-e2e/pull/6',
          mergeCommit: {
            message: 'Add 🍏 emoji (#5) (#6)',
            sha: '4bcd876d4ceaa73cf437bfc89b74d1a4e704c0a6',
          },
        },
        {
          branch: 'master',
          label: 'v8.0.0',
          branchLabelMappingKey: '^v8.0.0$',
          isSourceBranch: true,
          state: 'MERGED',
          number: 5,
          url: 'https://github.com/backport-org/backport-e2e/pull/5',
          mergeCommit: {
            message: 'Add 🍏 emoji (#5)',
            sha: 'ee8c492334cef1ca077a56addb79a26f79821d2f',
          },
        },
      ],
    };

    it('pullNumber', async () => {
      const commits = await getCommits({
        githubToken: githubToken,
        repoName: 'backport-e2e',
        repoOwner: 'backport-org',
        pullNumber: 5,
      });

      expect(commits).toEqual([expectedAppleEmojiCommit]);
    });

    it('sha', async () => {
      const commits = await getCommits({
        githubToken: githubToken,
        repoName: 'backport-e2e',
        repoOwner: 'backport-org',
        sha: 'ee8c492334cef1ca077a56addb79a26f79821d2f',
      });

      expect(commits).toEqual([expectedAppleEmojiCommit]);
    });

    it('prQuery', async () => {
      const commits = await getCommits({
        githubToken: githubToken,
        repoName: 'backport-e2e',
        repoOwner: 'backport-org',
        until: '2021-01-01',
        prQuery: 'label:v7.9.0 base:master',
        maxCount: 3,
      });

      const commitMessage = commits.map((commit) => {
        return {
          ...commit.sourceCommit,
          message: getFirstLine(commit.sourceCommit.message),
          branchLabelMapping: undefined,
        };
      });

      expect(commitMessage).toMatchInlineSnapshot(`
        [
          {
            "branchLabelMapping": undefined,
            "committedDate": "2020-08-15T19:54:32Z",
            "message": "Change Ulysses to Gretha (conflict) (#8)",
            "sha": "b484e161b705b39dbbfc5005e67ca24d05b23c37",
          },
          {
            "branchLabelMapping": undefined,
            "committedDate": "2020-08-15T12:40:19Z",
            "message": "Add 🍏 emoji (#5)",
            "sha": "ee8c492334cef1ca077a56addb79a26f79821d2f",
          },
          {
            "branchLabelMapping": undefined,
            "committedDate": "2020-08-15T10:44:04Z",
            "message": "Add family emoji (#2)",
            "sha": "59d6ff1ca90a4ce210c0a4f0e159214875c19d60",
          },
        ]
      `);
    });

    it('author', async () => {
      const commits = await getCommits({
        githubToken: githubToken,
        repoName: 'backport-e2e',
        repoOwner: 'backport-org',
        author: 'sorenlouv',
        until: '2021-01-01T10:00:00Z',
        maxCount: 3,
      });

      expect(commits).toMatchInlineSnapshot(`
        [
          {
            "author": {
              "email": "sorenlouv@gmail.com",
              "name": "Søren Louv-Jansen",
            },
            "sourceBranch": "master",
            "sourceCommit": {
              "branchLabelMapping": {
                "^v(\\d+).(\\d+).\\d+$": "$1.$2",
                "^v7.9.0$": "7.x",
                "^v8.0.0$": "master",
              },
              "committedDate": "2020-08-16T21:44:28Z",
              "message": "Add sheep emoji (#9)",
              "sha": "eebf165c82a4b718d95c11b3877e365b1949ff28",
            },
            "sourcePullRequest": {
              "labels": [
                "v7.8.0",
              ],
              "mergeCommit": {
                "message": "Add sheep emoji (#9)",
                "sha": "eebf165c82a4b718d95c11b3877e365b1949ff28",
              },
              "number": 9,
              "title": "Add sheep emoji",
              "url": "https://github.com/backport-org/backport-e2e/pull/9",
            },
            "suggestedTargetBranches": [],
            "targetPullRequestStates": [
              {
                "branch": "7.8",
                "branchLabelMappingKey": "^v(\\d+).(\\d+).\\d+$",
                "isSourceBranch": false,
                "label": "v7.8.0",
                "mergeCommit": undefined,
                "number": 10,
                "state": "OPEN",
                "url": "https://github.com/backport-org/backport-e2e/pull/10",
              },
            ],
          },
          {
            "author": {
              "email": "sorenlouv@gmail.com",
              "name": "Søren Louv-Jansen",
            },
            "sourceBranch": "master",
            "sourceCommit": {
              "branchLabelMapping": {
                "^v(\\d+).(\\d+).\\d+$": "$1.$2",
                "^v7.9.0$": "7.x",
                "^v8.0.0$": "master",
              },
              "committedDate": "2020-08-15T19:54:32Z",
              "message": "Change Ulysses to Gretha (conflict) (#8)",
              "sha": "b484e161b705b39dbbfc5005e67ca24d05b23c37",
            },
            "sourcePullRequest": {
              "labels": [
                "v7.9.0",
                "v8.0.0",
              ],
              "mergeCommit": {
                "message": "Change Ulysses to Gretha (conflict) (#8)",
                "sha": "b484e161b705b39dbbfc5005e67ca24d05b23c37",
              },
              "number": 8,
              "title": "Change Ulysses to Gretha (conflict)",
              "url": "https://github.com/backport-org/backport-e2e/pull/8",
            },
            "suggestedTargetBranches": [
              "7.x",
            ],
            "targetPullRequestStates": [
              {
                "branch": "7.x",
                "branchLabelMappingKey": "^v7.9.0$",
                "isSourceBranch": false,
                "label": "v7.9.0",
                "state": "NOT_CREATED",
              },
              {
                "branch": "master",
                "branchLabelMappingKey": "^v8.0.0$",
                "isSourceBranch": true,
                "label": "v8.0.0",
                "mergeCommit": {
                  "message": "Change Ulysses to Gretha (conflict) (#8)",
                  "sha": "b484e161b705b39dbbfc5005e67ca24d05b23c37",
                },
                "number": 8,
                "state": "MERGED",
                "url": "https://github.com/backport-org/backport-e2e/pull/8",
              },
            ],
          },
          {
            "author": {
              "email": "sorenlouv@gmail.com",
              "name": "Søren Louv-Jansen",
            },
            "sourceBranch": "master",
            "sourceCommit": {
              "branchLabelMapping": {
                "^v(\\d+).(\\d+).\\d+$": "$1.$2",
                "^v7.9.0$": "7.x",
                "^v8.0.0$": "master",
              },
              "committedDate": "2020-08-15T12:40:19Z",
              "message": "Add 🍏 emoji (#5)",
              "sha": "ee8c492334cef1ca077a56addb79a26f79821d2f",
            },
            "sourcePullRequest": {
              "labels": [
                "v7.8.0",
                "v7.9.0",
                "v8.0.0",
              ],
              "mergeCommit": {
                "message": "Add 🍏 emoji (#5)",
                "sha": "ee8c492334cef1ca077a56addb79a26f79821d2f",
              },
              "number": 5,
              "title": "Add 🍏 emoji",
              "url": "https://github.com/backport-org/backport-e2e/pull/5",
            },
            "suggestedTargetBranches": [],
            "targetPullRequestStates": [
              {
                "branch": "7.8",
                "branchLabelMappingKey": "^v(\\d+).(\\d+).\\d+$",
                "isSourceBranch": false,
                "label": "v7.8.0",
                "mergeCommit": {
                  "message": "Add 🍏 emoji (#5) (#7)",
                  "sha": "46cd6f9999effdf894a36dbc7db90e890f4be840",
                },
                "number": 7,
                "state": "MERGED",
                "url": "https://github.com/backport-org/backport-e2e/pull/7",
              },
              {
                "branch": "7.x",
                "branchLabelMappingKey": "^v7.9.0$",
                "isSourceBranch": false,
                "label": "v7.9.0",
                "mergeCommit": {
                  "message": "Add 🍏 emoji (#5) (#6)",
                  "sha": "4bcd876d4ceaa73cf437bfc89b74d1a4e704c0a6",
                },
                "number": 6,
                "state": "MERGED",
                "url": "https://github.com/backport-org/backport-e2e/pull/6",
              },
              {
                "branch": "master",
                "branchLabelMappingKey": "^v8.0.0$",
                "isSourceBranch": true,
                "label": "v8.0.0",
                "mergeCommit": {
                  "message": "Add 🍏 emoji (#5)",
                  "sha": "ee8c492334cef1ca077a56addb79a26f79821d2f",
                },
                "number": 5,
                "state": "MERGED",
                "url": "https://github.com/backport-org/backport-e2e/pull/5",
              },
            ],
          },
        ]
      `);
    });

    it('throws when missing a filter', async () => {
      await expect(() =>
        getCommits({
          githubToken: githubToken,
          repoName: 'backport-e2e',
          repoOwner: 'backport-org',
          maxCount: 3,
        }),
      ).rejects.toThrow(
        'Must supply one of: `pullNumber`, `sha`, `prQuery` or `author`',
      );
    });
  });
});
