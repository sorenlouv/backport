import chalk from 'chalk';
import ora from 'ora';
import { BackportOptions } from '../options/options';
import { CommitSelected } from '../services/github/Commit';
import { HandledError } from '../services/HandledError';
import { addLabelsToPullRequest } from '../services/github/addLabelsToPullRequest';
import {
  cherrypick,
  createFeatureBranch,
  deleteFeatureBranch,
  isIndexDirty,
  pushFeatureBranch,
  getRemoteName,
  setCommitAuthor
} from '../services/git';
import { confirmPrompt } from '../services/prompts';
import { createPullRequest } from '../services/github/createPullRequest';
import { getRepoPath } from '../services/env';
import { getShortSha } from '../services/github/commitFormatters';
import { log } from '../services/logger';
import { exec } from '../services/child-process-promisified';

export function doBackportVersions(
  options: BackportOptions,
  commits: CommitSelected[],
  branches: string[]
) {
  return sequentially(branches, async baseBranch => {
    try {
      await doBackportVersion(options, { commits, baseBranch });
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
  options: BackportOptions,
  {
    commits,
    baseBranch
  }: {
    commits: CommitSelected[];
    baseBranch: string;
  }
) {
  const featureBranch = getFeatureBranchName(baseBranch, commits);
  const commitMessages = commits
    .map(commit => ` - ${commit.message}`)
    .join('\n');
  log(
    `\n${chalk.bold(
      `Backporting the following commits to ${baseBranch}:`
    )}\n${commitMessages}\n`
  );

  await withSpinner({ text: 'Pulling latest changes' }, () =>
    createFeatureBranch(options, baseBranch, featureBranch)
  );

  await sequentially(commits, commit =>
    cherrypickAndConfirm(options, commit.sha)
  );

  if (options.resetAuthor) {
    await withSpinner(
      { text: `Changing author to "${options.username}"` },
      () => setCommitAuthor(options, options.username)
    );
  }

  const headBranchName = getHeadBranchName(options, featureBranch);

  await withSpinner({ text: `Pushing branch "${headBranchName}"` }, () =>
    pushFeatureBranch(options, featureBranch)
  );

  await deleteFeatureBranch(options, featureBranch);

  await withSpinner({ text: 'Creating pull request' }, async spinner => {
    const payload = getPullRequestPayload(options, baseBranch, commits);
    const pullRequest = await createPullRequest(options, payload);
    if (options.labels.length > 0) {
      await addLabelsToPullRequest(options, pullRequest.number);
    }
    spinner.text = `Created pull request: ${pullRequest.html_url}`;
  });
}

function sequentially<T>(items: T[], handler: (item: T) => Promise<void>) {
  return items.reduce(async (p, item) => {
    await p;
    return handler(item);
  }, Promise.resolve());
}

function getFeatureBranchName(baseBranch: string, commits: CommitSelected[]) {
  const refValues = commits
    .map(commit =>
      commit.pullNumber
        ? `pr-${commit.pullNumber}`
        : `commit-${getShortSha(commit.sha)}`
    )
    .join('_')
    .slice(0, 200);
  return `backport/${baseBranch}/${refValues}`;
}

async function cherrypickAndConfirm(options: BackportOptions, sha: string) {
  const spinner = ora(`Cherry-picking commit ${getShortSha(sha)}`).start();
  try {
    await cherrypick(options, sha);
    spinner.succeed();
  } catch (e) {
    const repoPath = getRepoPath(options);
    spinner.fail(`Cherry-picking failed.\n`);
    log(
      `Please resolve conflicts in: ${repoPath} and when all conflicts have been resolved and staged run:`
    );
    log(`\ngit cherry-pick --continue\n`);
    if (options.editor) {
      await exec(`${options.editor} ${repoPath}`);
    }

    const hasConflict = e.cmd.includes('git cherry-pick');
    if (!hasConflict) {
      throw e;
    }

    await resolveConflictsOrAbort(options);
  }
}

async function resolveConflictsOrAbort(options: BackportOptions) {
  const res = await confirmPrompt(
    'Press enter when you have commited all changes'
  );
  if (!res) {
    throw new HandledError('Aborted');
  }

  const isDirty = await isIndexDirty(options);
  if (isDirty) {
    await resolveConflictsOrAbort(options);
  }
}

function getPullRequestTitle(
  baseBranch: string,
  commits: CommitSelected[],
  prTitle: string
) {
  const commitMessages = commits.map(commit => commit.message).join(' | ');
  return prTitle
    .replace('{baseBranch}', baseBranch)
    .replace('{commitMessages}', commitMessages)
    .slice(0, 240);
}

function getHeadBranchName(options: BackportOptions, featureBranch: string) {
  const remoteName = getRemoteName(options);
  return `${remoteName}:${featureBranch}`;
}

function getPullRequestPayload(
  options: BackportOptions,
  baseBranch: string,
  commits: CommitSelected[]
) {
  const { prDescription, prTitle } = options;
  const featureBranch = getFeatureBranchName(baseBranch, commits);
  const commitMessages = commits
    .map(commit => ` - ${commit.message}`)
    .join('\n');
  const bodySuffix = prDescription ? `\n\n${prDescription}` : '';

  return {
    title: getPullRequestTitle(baseBranch, commits, prTitle),
    body: `Backports the following commits to ${baseBranch}:\n${commitMessages}${bodySuffix}`,
    head: getHeadBranchName(options, featureBranch),
    base: baseBranch
  };
}

async function withSpinner<T>(
  { text }: { text: string },
  fn: (spinner: ora.Ora) => Promise<T>
): Promise<T> {
  const spinner = ora(text).start();

  try {
    const res = await fn(spinner);
    spinner.succeed();
    return res;
  } catch (e) {
    spinner.fail();
    throw e;
  }
}
