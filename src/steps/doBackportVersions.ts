import ora from 'ora';
import { confirmConflictResolved } from '../services/prompts';
import { addLabels, createPullRequest, Commit } from '../services/github';
import { HandledError } from '../services/HandledError';
import { getRepoPath } from '../services/env';
import * as logger from '../services/logger';
import {
  cherrypick,
  createAndCheckoutBranch,
  isIndexDirty,
  push,
  resetAndPullMaster
} from '../services/git';

export function doBackportVersions(
  owner: string,
  repoName: string,
  commits: Commit[],
  branches: string[],
  username: string,
  labels: string[]
) {
  return sequentially(branches, async branch => {
    try {
      const pullRequest = await doBackportVersion(
        owner,
        repoName,
        commits,
        branch,
        username,
        labels
      );
      logger.log(`View pull request: ${pullRequest.html_url}\n`);
    } catch (e) {
      if (e.name === 'HandledError') {
        console.error(e.message);
      } else {
        console.error(e);
        throw e;
      }
    }
  });
}

export async function doBackportVersion(
  owner: string,
  repoName: string,
  commits: Commit[],
  branch: string,
  username: string,
  labels: string[] = []
) {
  const backportBranchName = getBackportBranchName(branch, commits);
  const refValues = commits.map(commit => getReferenceLong(commit)).join(', ');
  logger.log(`\nBackporting ${refValues} to ${branch}:`);

  await withSpinner({ text: 'Pulling latest changes' }, async () => {
    await resetAndPullMaster({ owner, repoName });
    await createAndCheckoutBranch({
      owner,
      repoName,
      baseBranch: branch,
      featureBranch: backportBranchName
    });
  });

  await sequentially(commits, commit =>
    cherrypickAndConfirm(owner, repoName, commit.sha)
  );

  await withSpinner(
    { text: `Pushing branch ${username}:${backportBranchName}` },
    () =>
      push({
        owner,
        repoName,
        remoteName: username,
        branchName: backportBranchName
      })
  );

  return withSpinner({ text: 'Creating pull request' }, async () => {
    const payload = getPullRequestPayload(branch, commits, username);
    const pullRequest = await createPullRequest(owner, repoName, payload);
    if (labels.length > 0) {
      await addLabels(owner, repoName, pullRequest.number, labels);
    }
    return pullRequest;
  });
}

function sequentially<T>(items: T[], handler: (item: T) => Promise<void>) {
  return items.reduce(async (p, item) => {
    await p;
    return handler(item);
  }, Promise.resolve());
}

function getBackportBranchName(branch: string, commits: Commit[]) {
  const refValues = commits
    .map(commit => getReferenceShort(commit))
    .join('_')
    .slice(0, 200);
  return `backport/${branch}/${refValues}`;
}

function getShortSha(commit: Commit) {
  return commit.sha.slice(0, 7);
}

export function getReferenceLong(commit: Commit) {
  return commit.pullRequest ? `#${commit.pullRequest}` : getShortSha(commit);
}

function getReferenceShort(commit: Commit) {
  return commit.pullRequest
    ? `pr-${commit.pullRequest}`
    : `commit-${getShortSha(commit)}`;
}

async function cherrypickAndConfirm(
  owner: string,
  repoName: string,
  sha: string
) {
  try {
    await withSpinner(
      {
        text: 'Cherry-picking commit',
        errorText: `Cherry-picking failed. Please resolve conflicts in: ${getRepoPath(
          owner,
          repoName
        )}`
      },
      () => cherrypick({ owner, repoName, sha })
    );
  } catch (e) {
    const hasConflict = e.cmd.includes('git cherry-pick');
    if (!hasConflict) {
      throw e;
    }

    await confirmResolvedRecursive(owner, repoName);
  }
}

async function confirmResolvedRecursive(owner: string, repoName: string) {
  const res = await confirmConflictResolved();
  if (!res) {
    throw new HandledError('Application was aborted.');
  }

  const isDirty = await isIndexDirty({ owner, repoName });
  if (isDirty) {
    await confirmResolvedRecursive(owner, repoName);
  }
}

function getPullRequestTitle(branch: string, commits: Commit[]) {
  const commitMessages = commits
    .map(commit => commit.message)
    .join(' | ')
    .slice(0, 200);

  return `[${branch}] ${commitMessages}`;
}

export function getPullRequestPayload(
  branch: string,
  commits: Commit[],
  username: string
) {
  const backportBranchName = getBackportBranchName(branch, commits);
  const commitRefs = commits
    .map(commit => {
      const ref = getReferenceLong(commit);
      return ` - ${commit.message.replace(`(${ref})`, '')} (${ref})`;
    })
    .join('\n');

  return {
    title: getPullRequestTitle(branch, commits),
    body: `Backports the following commits to ${branch}:\n${commitRefs}`,
    head: `${username}:${backportBranchName}`,
    base: `${branch}`
  };
}

async function withSpinner<T>(
  { text, errorText }: { text: string; errorText?: string },
  fn: () => Promise<T>
): Promise<T> {
  const spinner = ora(text).start();

  try {
    const res = await fn();
    spinner.succeed();

    return res;
  } catch (e) {
    if (errorText) {
      spinner.text = errorText;
    }
    spinner.fail();
    throw e;
  }
}
