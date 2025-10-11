import { Octokit } from '@octokit/rest';
import type { BackportResponse } from '../../../entrypoint.api';
import { backportRun } from '../../../entrypoint.api';
import { getShortSha } from '../../../lib/github/commit-formatters';
import { getDevAccessToken } from '../../private/get-dev-access-token';
import { getSandboxPath, resetSandbox } from '../../sandbox';
import {
  closePullRequest,
  fetchPullRequest,
  setupConflictingCommits,
} from '../github-helpers';

jest.unmock('find-up');
jest.unmock('del');
jest.unmock('make-dir');

jest.setTimeout(25_000);

const accessToken = getDevAccessToken();
const octokit = new Octokit({ auth: accessToken });
const sandboxPath = getSandboxPath({ filename: __filename });

// repo
const REPO_OWNER = 'backport-org';
const REPO_NAME = 'integration-test';
const AUTHOR = 'sorenlouv';

// commit 1
const COMMIT_SHA_1 = '5bf29b7d847ea3dbde9280448f0f62ad0f22d3ad';
const BRANCH_WITH_ONE_COMMIT = `backport/7.x/commit-${getShortSha(
  COMMIT_SHA_1,
)}`;

// commit 2
const COMMIT_SHA_2 = '59d6ff1ca90a4ce210c0a4f0e159214875c19d60';
const BRANCH_WITH_TWO_COMMITS = `backport/7.x/commit-${getShortSha(
  COMMIT_SHA_1,
)}_commit-${getShortSha(COMMIT_SHA_2)}`;

describe('entrypoint.module', () => {
  describe('when a single commit is backported', () => {
    let res: BackportResponse;
    let pullRequestResponse: Awaited<ReturnType<typeof octokit.pulls.get>>;

    beforeAll(async () => {
      await resetState(accessToken);
      res = await backportRun({
        options: {
          dir: sandboxPath,
          accessToken,
          repoOwner: 'backport-org',
          repoName: 'integration-test',
          sha: COMMIT_SHA_1,
          targetBranches: ['7.x'],
        },
      });

      // @ts-expect-error
      const pullRequestNumber = res.results[0].pullRequestNumber as number;

      pullRequestResponse = await octokit.pulls.get({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        pull_number: pullRequestNumber,
      });
    });

    it('returns the backport result', () => {
      expect(res).toEqual({
        commits: [
          {
            author: { email: 'sorenlouv@gmail.com', name: 'Søren Louv-Jansen' },
            targetPullRequestStates: [],
            sourceBranch: 'master',
            sourceCommit: {
              committedDate: '2020-08-15T10:37:41Z',
              message: 'Add ❤️ emoji',
              sha: COMMIT_SHA_1,
              branchLabelMapping: undefined,
            },
            suggestedTargetBranches: [],
            sourcePullRequest: undefined,
          },
        ],
        results: [
          {
            didUpdate: false,
            hasConflicts: false,
            pullRequestNumber: expect.any(Number),
            pullRequestUrl: expect.stringContaining(
              'https://github.com/backport-org/integration-test/pull/',
            ),
            status: 'success',
            targetBranch: '7.x',
          },
        ],
        status: 'success',
      } as BackportResponse);
    });

    it('pull request: status code', async () => {
      expect(pullRequestResponse.status).toEqual(200);
    });

    it('pull request: title', async () => {
      expect(pullRequestResponse.data.title).toEqual('[7.x] Add ❤️ emoji');
    });

    it('pull request: body', async () => {
      expect(pullRequestResponse.data.body).toMatchInlineSnapshot(`
        "# Backport

        This will backport the following commits from \`master\` to \`7.x\`:
         - Add ❤️ emoji (5bf29b7d)

        <!--- Backport version: 1.2.3-mocked -->

        ### Questions ?
        Please refer to the [Backport tool documentation](https://github.com/sorenlouv/backport)"
      `);
    });

    it('pull request: head branch is in fork repo', async () => {
      expect(pullRequestResponse.data.head.label).toEqual(
        `sorenlouv:${BRANCH_WITH_ONE_COMMIT}`,
      );
    });

    it('pull request: base branch', async () => {
      expect(pullRequestResponse.data.base.label).toEqual('backport-org:7.x');
    });

    it('does not create any new branches in origin (backport-org/integration-test)', async () => {
      const branches = await getBranchesOnGithub({
        accessToken,
        repoOwner: REPO_OWNER,
        repoName: REPO_NAME,
      });
      expect(branches.map((b) => b.name)).toEqual(['7.x', 'master']);
    });

    it('creates a branch in the fork (sorenlouv/integration-test)', async () => {
      const branches = await getBranchesOnGithub({
        accessToken,
        repoOwner: AUTHOR,
        repoName: REPO_NAME,
      });

      expect(branches.map((b) => b.name)).toEqual([
        '7.x',
        BRANCH_WITH_ONE_COMMIT,
        'master',
      ]);
    });
  });

  describe('when two commits are backported', () => {
    let res: BackportResponse;
    let pullRequestResponse: Awaited<ReturnType<typeof octokit.pulls.get>>;

    beforeAll(async () => {
      await resetState(accessToken);
      res = await backportRun({
        options: {
          dir: sandboxPath,
          accessToken,
          repoOwner: 'backport-org',
          repoName: 'integration-test',
          sha: [COMMIT_SHA_1, COMMIT_SHA_2],
          targetBranches: ['7.x'],
        },
      });

      // @ts-expect-error
      const pullRequestNumber = res.results[0].pullRequestNumber as number;

      pullRequestResponse = await octokit.pulls.get({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        pull_number: pullRequestNumber,
      });
    });

    it('returns the backport result containing both commits', () => {
      expect(res).toEqual({
        commits: [
          {
            author: { email: 'sorenlouv@gmail.com', name: 'Søren Louv-Jansen' },
            targetPullRequestStates: [],
            sourceBranch: 'master',
            sourceCommit: {
              committedDate: '2020-08-15T10:37:41Z',
              message: 'Add ❤️ emoji',
              sha: COMMIT_SHA_1,
              branchLabelMapping: undefined,
            },
            suggestedTargetBranches: [],
            sourcePullRequest: undefined,
          },
          {
            author: { email: 'sorenlouv@gmail.com', name: 'Søren Louv-Jansen' },
            suggestedTargetBranches: [],
            targetPullRequestStates: [],
            sourceBranch: 'master',
            sourceCommit: {
              committedDate: '2020-08-15T10:44:04Z',
              message: 'Add family emoji (#2)',
              sha: COMMIT_SHA_2,
            },
            sourcePullRequest: undefined,
          },
        ],
        results: [
          {
            didUpdate: false,
            hasConflicts: false,
            pullRequestNumber: expect.any(Number),
            pullRequestUrl: expect.stringContaining(
              'https://github.com/backport-org/integration-test/pull/',
            ),
            status: 'success',
            targetBranch: '7.x',
          },
        ],
        status: 'success',
      } as BackportResponse);
    });

    it('pull request: status code', async () => {
      expect(pullRequestResponse.status).toEqual(200);
    });

    it('pull request: title', async () => {
      expect(pullRequestResponse.data.title).toEqual(
        '[7.x] Add ❤️ emoji | Add family emoji (#2)',
      );
    });

    it('pull request: body', async () => {
      expect(pullRequestResponse.data.body).toMatchInlineSnapshot(`
        "# Backport

        This will backport the following commits from \`master\` to \`7.x\`:
         - Add ❤️ emoji (5bf29b7d)
         - Add family emoji (#2) (59d6ff1c)

        <!--- Backport version: 1.2.3-mocked -->

        ### Questions ?
        Please refer to the [Backport tool documentation](https://github.com/sorenlouv/backport)"
      `);
    });

    it('pull request: head branch contains both commits in name', async () => {
      expect(pullRequestResponse.data.head.label).toEqual(
        `sorenlouv:${BRANCH_WITH_TWO_COMMITS}`,
      );
    });

    it('pull request: base branch', async () => {
      expect(pullRequestResponse.data.base.label).toEqual('backport-org:7.x');
    });
  });

  describe('when disabling fork mode', () => {
    let res: BackportResponse;
    let pullRequestResponse: Awaited<ReturnType<typeof octokit.pulls.get>>;

    beforeAll(async () => {
      await resetState(accessToken);
      res = await backportRun({
        options: {
          fork: false,
          dir: sandboxPath,
          accessToken,
          repoOwner: 'backport-org',
          repoName: 'integration-test',
          sha: COMMIT_SHA_1,
          targetBranches: ['7.x'],
        },
      });

      // @ts-expect-error
      const pullRequestNumber = res.results[0].pullRequestNumber as number;

      pullRequestResponse = await octokit.pulls.get({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        pull_number: pullRequestNumber,
      });
    });

    it('pull request: title', async () => {
      expect(pullRequestResponse.data.title).toEqual('[7.x] Add ❤️ emoji');
    });

    it('pull request: body', async () => {
      expect(pullRequestResponse.data.body).toMatchInlineSnapshot(`
        "# Backport

        This will backport the following commits from \`master\` to \`7.x\`:
         - Add ❤️ emoji (5bf29b7d)

        <!--- Backport version: 1.2.3-mocked -->

        ### Questions ?
        Please refer to the [Backport tool documentation](https://github.com/sorenlouv/backport)"
      `);
    });

    it('pull request: head branch is in origin (non-fork) repo', async () => {
      expect(pullRequestResponse.data.head.label).toEqual(
        `backport-org:${BRANCH_WITH_ONE_COMMIT}`,
      );
    });

    it('pull request: base branch', async () => {
      expect(pullRequestResponse.data.base.label).toEqual('backport-org:7.x');
    });

    it('returns pull request', () => {
      expect(res).toEqual({
        commits: [
          {
            author: { email: 'sorenlouv@gmail.com', name: 'Søren Louv-Jansen' },
            targetPullRequestStates: [],
            sourceBranch: 'master',
            sourceCommit: {
              committedDate: '2020-08-15T10:37:41Z',
              message: 'Add ❤️ emoji',
              sha: COMMIT_SHA_1,
              branchLabelMapping: undefined,
            },
            suggestedTargetBranches: [],
            sourcePullRequest: undefined,
          },
        ],
        results: [
          {
            didUpdate: false,
            hasConflicts: false,
            pullRequestNumber: expect.any(Number),
            pullRequestUrl: expect.stringContaining(
              'https://github.com/backport-org/integration-test/pull/',
            ),
            status: 'success',
            targetBranch: '7.x',
          },
        ],
        status: 'success',
      } as BackportResponse);
    });

    it('creates a new branch in origin (backport-org/integration-test)', async () => {
      const branches = await getBranchesOnGithub({
        accessToken,
        repoOwner: REPO_OWNER,
        repoName: REPO_NAME,
      });
      expect(branches.map((b) => b.name)).toEqual([
        '7.x',
        BRANCH_WITH_ONE_COMMIT,
        'master',
      ]);
    });

    it('does not create branches in the fork (sorenlouv/integration-test)', async () => {
      const branches = await getBranchesOnGithub({
        accessToken,
        repoOwner: AUTHOR,
        repoName: REPO_NAME,
      });
      expect(branches.map((b) => b.name)).toEqual(['7.x', 'master']);
    });
  });
});

async function getBranchesOnGithub({
  accessToken,
  repoOwner,
  repoName,
}: {
  accessToken: string;
  repoOwner: string;
  repoName: string;
}) {
  const octokit = new Octokit({
    auth: accessToken,
  });

  const res = await octokit.repos.listBranches({
    owner: repoOwner,
    repo: repoName,
  });

  return res.data;
}

async function deleteBranchOnGithub({
  accessToken,
  repoOwner,
  repoName,
  branchName,
}: {
  accessToken: string;
  repoOwner: string;
  repoName: string;
  branchName: string;
}) {
  try {
    const octokit = new Octokit({
      auth: accessToken,
    });

    const opts = {
      owner: repoOwner,
      repo: repoName,
      ref: `heads/${branchName}`,
    };

    const res = await octokit.git.deleteRef(opts);

    return res.data;
  } catch (e) {
    //@ts-expect-error
    if (e.message === 'Reference does not exist') {
      return;
    }

    throw e;
  }
}

async function resetState(accessToken: string) {
  const ownerBranches = await getBranchesOnGithub({
    accessToken,
    repoOwner: REPO_OWNER,
    repoName: REPO_NAME,
  });

  // delete all branches except master and 7.x
  await Promise.all(
    ownerBranches
      .filter((b) => b.name !== 'master' && b.name !== '7.x')
      .map((b) => {
        return deleteBranchOnGithub({
          accessToken,
          repoOwner: REPO_OWNER,
          repoName: REPO_NAME,
          branchName: b.name,
        });
      }),
  );

  const forkBranches = await getBranchesOnGithub({
    accessToken,
    repoOwner: AUTHOR,
    repoName: REPO_NAME,
  });

  // delete all branches except master and 7.x
  await Promise.all(
    forkBranches
      .filter((b) => b.name !== 'master' && b.name !== '7.x')
      .map((b) => {
        return deleteBranchOnGithub({
          accessToken,
          repoOwner: AUTHOR,
          repoName: REPO_NAME,
          branchName: b.name,
        });
      }),
  );

  await resetSandbox(sandboxPath);
}

describe('conflict handling with commitConflicts enabled', () => {
  let res: BackportResponse;
  let pullRequestResponse:
    | Awaited<ReturnType<typeof octokit.pulls.get>>
    | undefined;
  const timestamp = Date.now();

  describe('when conflicts occur and are committed', () => {
    const fileName = `conflict-test-${timestamp}.txt`;

    beforeAll(async () => {
      const { conflictCommitSha } = await setupConflictingCommits({
        octokit,
        owner: REPO_OWNER,
        repo: REPO_NAME,
        fileName,
        targetBranch: '7.x',
        resetState: () => resetState(accessToken),
      });

      res = await backportRun({
        options: {
          dir: sandboxPath,
          accessToken,
          repoOwner: REPO_OWNER,
          repoName: REPO_NAME,
          sha: conflictCommitSha,
          targetBranches: ['7.x'],
          commitConflicts: true,
          conflictLabel: 'merge-conflict',
          failOnConflicts: true,
          interactive: false,
        },
      });

      pullRequestResponse = await fetchPullRequest({
        octokit,
        owner: REPO_OWNER,
        repo: REPO_NAME,
        res,
      });
    });

    afterAll(async () => {
      await closePullRequest({
        octokit,
        owner: REPO_OWNER,
        repo: REPO_NAME,
        res,
      });
    });

    it('returns hasConflicts: true in the result', () => {
      expect(res.status).toBe('success');
      if (res.status === 'success') {
        expect(res.results).toHaveLength(1);
        expect(res.results[0].status).toBe('success');
        if (res.results[0].status === 'success') {
          expect(res.results[0].hasConflicts).toBe(true);
        }
      }
    });

    it('creates pull request successfully despite conflicts', () => {
      expect(res.status).toBe('success');
      if (res.status === 'success' && res.results[0].status === 'success') {
        expect(res.results[0].pullRequestUrl).toContain(
          `https://github.com/${REPO_OWNER}/${REPO_NAME}/pull/`,
        );
        expect(res.results[0].pullRequestNumber).toEqual(expect.any(Number));
      }
    });

    it('adds the merge-conflict label to the pull request', () => {
      expect(pullRequestResponse).toBeDefined();
      if (pullRequestResponse) {
        const labels = pullRequestResponse.data.labels.map((l) => l.name);
        expect(labels).toContain('merge-conflict');
      }
    });

    it('pull request is in open state', () => {
      expect(pullRequestResponse).toBeDefined();
      if (pullRequestResponse) {
        expect(pullRequestResponse.data.state).toBe('open');
      }
    });

    it('pull request title contains target branch', () => {
      expect(pullRequestResponse).toBeDefined();
      if (pullRequestResponse) {
        expect(pullRequestResponse.data.title).toContain('[7.x]');
      }
    });
  });

  describe('when using custom conflict label', () => {
    const fileName = `conflict-custom-${timestamp}.txt`;

    beforeAll(async () => {
      const { conflictCommitSha } = await setupConflictingCommits({
        octokit,
        owner: REPO_OWNER,
        repo: REPO_NAME,
        fileName,
        targetBranch: '7.x',
        resetState: () => resetState(accessToken),
      });

      res = await backportRun({
        options: {
          dir: sandboxPath,
          accessToken,
          repoOwner: REPO_OWNER,
          repoName: REPO_NAME,
          sha: conflictCommitSha,
          targetBranches: ['7.x'],
          commitConflicts: true,
          conflictLabel: 'needs-resolution',
          failOnConflicts: false,
          interactive: false,
        },
      });

      pullRequestResponse = await fetchPullRequest({
        octokit,
        owner: REPO_OWNER,
        repo: REPO_NAME,
        res,
      });
    });

    afterAll(async () => {
      await closePullRequest({
        octokit,
        owner: REPO_OWNER,
        repo: REPO_NAME,
        res,
      });
    });

    it('adds the custom conflict label', () => {
      expect(pullRequestResponse).toBeDefined();
      if (pullRequestResponse) {
        const labels = pullRequestResponse.data.labels.map((l) => l.name);
        expect(labels).toContain('needs-resolution');
        expect(labels).not.toContain('merge-conflict');
      }
    });

    it('returns hasConflicts: true', () => {
      expect(res.status).toBe('success');
      if (res.status === 'success' && res.results[0].status === 'success') {
        expect(res.results[0].hasConflicts).toBe(true);
      }
    });

    it('creates PR successfully with failOnConflicts: false', () => {
      expect(res.status).toBe('success');
      if (res.status === 'success' && res.results[0].status === 'success') {
        expect(res.results[0].pullRequestUrl).toBeTruthy();
      }
    });
  });
});
