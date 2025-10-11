import type { Octokit } from '@octokit/rest';
import type { BackportResponse } from '../../entrypoint.api';

/**
 * Creates a commit on a specific branch in a GitHub repository
 */
export async function createCommitOnBranch({
  octokit,
  owner,
  repo,
  branch,
  filePath,
  content,
  message,
}: {
  octokit: Octokit;
  owner: string;
  repo: string;
  branch: string;
  filePath: string;
  content: string;
  message: string;
}): Promise<string> {
  const branchRef = await octokit.repos.getBranch({
    owner,
    repo,
    branch,
  });
  const latestCommitSha = branchRef.data.commit.sha;

  const blob = await octokit.git.createBlob({
    owner,
    repo,
    content,
    encoding: 'utf-8',
  });

  const tree = await octokit.git.createTree({
    owner,
    repo,
    tree: [
      {
        path: filePath,
        mode: '100644',
        type: 'blob',
        sha: blob.data.sha,
      },
    ],
    base_tree: branchRef.data.commit.commit.tree.sha,
  });

  const commit = await octokit.git.createCommit({
    owner,
    repo,
    message,
    tree: tree.data.sha,
    parents: [latestCommitSha],
  });

  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: commit.data.sha,
    force: true,
  });

  return commit.data.sha;
}

/**
 * Sets up conflicting commits on master and target branch for testing
 */
export async function setupConflictingCommits({
  octokit,
  owner,
  repo,
  fileName,
  targetBranch,
  resetState,
}: {
  octokit: Octokit;
  owner: string;
  repo: string;
  fileName: string;
  targetBranch: string;
  resetState: () => Promise<void>;
}): Promise<{ conflictCommitSha: string }> {
  await resetState();

  const conflictCommitSha = await createCommitOnBranch({
    octokit,
    owner,
    repo,
    branch: 'master',
    filePath: fileName,
    content: 'Content from master branch',
    message: `Add ${fileName} to master`,
  });

  await createCommitOnBranch({
    octokit,
    owner,
    repo,
    branch: targetBranch,
    filePath: fileName,
    content: 'Different content on 7.x branch',
    message: `Add conflicting ${fileName} to ${targetBranch}`,
  });

  return { conflictCommitSha };
}

/**
 * Fetches pull request details after a successful backport
 */
export async function fetchPullRequest({
  octokit,
  owner,
  repo,
  res,
}: {
  octokit: Octokit;
  owner: string;
  repo: string;
  res: BackportResponse;
}): Promise<Awaited<ReturnType<typeof octokit.pulls.get>> | undefined> {
  if (res.status === 'success') {
    const firstResult = res.results[0];
    if (firstResult?.status === 'success') {
      return await octokit.pulls.get({
        owner,
        repo,
        pull_number: firstResult.pullRequestNumber,
      });
    }
  }
  return undefined;
}

/**
 * Closes a pull request after test completion
 */
export async function closePullRequest({
  octokit,
  owner,
  repo,
  res,
}: {
  octokit: Octokit;
  owner: string;
  repo: string;
  res: BackportResponse;
}): Promise<void> {
  if (res.status === 'success') {
    const firstResult = res.results[0];
    if (firstResult?.status === 'success') {
      try {
        await octokit.pulls.update({
          owner,
          repo,
          pull_number: firstResult.pullRequestNumber,
          state: 'closed',
        });
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
